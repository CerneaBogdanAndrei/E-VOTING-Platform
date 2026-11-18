// Înregistrarea alegătorului: prin OCR (CNP-ul citit de pe MRZ, nivel „optic”) sau
// prin NFC (DG1 + SOD verificate cu Passive Authentication, nivel „criptografic”).
// În bază intră doar HMAC(CNP) și cheia publică a credentialului. O persoană deja
// înregistrată care n-a votat își poate înlocui credentialul (alt telefon), dar nu
// cu un nivel de încredere mai mic.

import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { base64ToBytes, isValidCnp, mrzFromDg1, parseMrz, type Registration, type RegistrationMethod, type TrustLevel } from '@evoting/api'
import { cnpHmac, isCredentialPubkey } from '@evoting/crypto'
import { AuditService } from '../audit/audit.service.js'
import { bad, obj, str } from '../common/validate.js'
import { CONFIG, type AppConfig } from '../config.js'
import { Database, isUniqueViolation } from '../db/database.service.js'
import { ElectionsRepository } from '../elections/elections.repository.js'
import { PassiveAuthService } from '../nfc/passive-auth.service.js'

const TRUST_RANK: Record<TrustLevel, number> = { optic: 1, criptografic: 2 }

@Injectable()
export class RegistrationService {
  constructor(
    private readonly db: Database,
    private readonly elections: ElectionsRepository,
    private readonly audit: AuditService,
    private readonly passiveAuth: PassiveAuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async registerOcr(electionId: string, body: unknown): Promise<Registration> {
    const input = obj(body, 'înregistrarea')
    const cnp = str(input.cnp, 'CNP', { max: 13 })
    if (!isValidCnp(cnp)) throw bad('CNP invalid')
    return this.register(electionId, cnp, input.credentialPubkey, 'ocr')
  }

  /**
   * NFC: serverul face Passive Authentication pe SOD (semnătura până la CSCA și
   * hash-ul DG1), apoi extrage CNP-ul din MRZ-ul din DG1. Verificarea e aici, nu
   * în aplicație, pentru că o aplicație modificată ar putea pretinde orice.
   */
  async registerNfc(electionId: string, body: unknown): Promise<Registration> {
    const input = obj(body, 'înregistrarea')
    let dg1: Uint8Array
    let sod: Uint8Array
    try {
      dg1 = base64ToBytes(str(input.dg1, 'DG1', { max: 2000 }))
      sod = base64ToBytes(str(input.sod, 'SOD', { max: 20000 }))
    } catch {
      throw bad('DG1 și SOD trebuie trimise în base64')
    }
    const pa = await this.passiveAuth.verify(dg1, sod)
    if (!pa.ok) throw bad(`Passive Authentication a eșuat: ${pa.reason}`)
    let mrz
    try {
      mrz = parseMrz(mrzFromDg1(dg1))
    } catch (err) {
      throw bad(`DG1 invalid: ${(err as Error).message}`)
    }
    if (!mrz?.valid) throw bad('MRZ-ul din DG1 nu trece cifrele de control')
    if (mrz.expired) throw bad('Documentul este expirat')
    if (!mrz.cnp) throw bad('CNP-ul nu a putut fi extras din DG1')
    return this.register(electionId, mrz.cnp, input.credentialPubkey, 'nfc', { dsc: pa.signer })
  }

  private async register(
    electionId: string,
    cnp: string,
    credentialPubkey: unknown,
    method: RegistrationMethod,
    extra: Record<string, unknown> = {},
  ): Promise<Registration> {
    if (!isCredentialPubkey(credentialPubkey)) throw bad('Cheia de credential nu e o cheie publică Ed25519 validă')
    const hmac = cnpHmac(this.config.cnpHmacKey, cnp)
    const trustLevel: TrustLevel = method === 'nfc' ? 'criptografic' : 'optic'
    return this.db.transaction(async (client) => {
      const e = await this.elections.lock(client, electionId)
      if (e.status !== 'draft' && e.status !== 'open') throw new ConflictException('Înregistrarea s-a închis pentru acest scrutin')
      const eligible = await client.query('SELECT 1 FROM eligible_voters WHERE election_id = $1 AND cnp_hmac = $2', [electionId, hmac])
      if (!eligible.rowCount) throw new ForbiddenException('CNP-ul nu figurează în lista alegătorilor eligibili')

      // persoana e deja înregistrată: re-înregistrare doar dacă n-a votat și nu coboară nivelul de încredere
      const existing = await client.query<{ credential_pubkey: string; trust_level: TrustLevel }>(
        'SELECT credential_pubkey, trust_level FROM registrations WHERE election_id = $1 AND cnp_hmac = $2',
        [electionId, hmac],
      )
      let replacedPrevious = false
      if (existing.rows[0]) {
        const old = existing.rows[0]
        const voted = await client.query('SELECT 1 FROM ballots WHERE election_id = $1 AND credential_pubkey = $2', [electionId, old.credential_pubkey])
        if (voted.rowCount) throw new ConflictException('Persoana a votat deja; credentialul nu mai poate fi înlocuit')
        if (TRUST_RANK[trustLevel] < TRUST_RANK[old.trust_level]) {
          throw new ConflictException('Înregistrarea existentă are un nivel de încredere mai mare (NFC); reînregistrează-te tot prin NFC')
        }
        await client.query('DELETE FROM registrations WHERE election_id = $1 AND cnp_hmac = $2', [electionId, hmac])
        await client.query('DELETE FROM auth_challenges WHERE election_id = $1 AND credential_pubkey = $2', [electionId, old.credential_pubkey])
        replacedPrevious = true
      }

      try {
        const { rows } = await client.query<{ registered_at: Date }>(
          'INSERT INTO registrations (election_id, cnp_hmac, credential_pubkey, method, trust_level) VALUES ($1, $2, $3, $4, $5) RETURNING registered_at',
          [electionId, hmac, credentialPubkey, method, trustLevel],
        )
        // în jurnal intră doar credentialul și metoda, nu și HMAC-ul (care ar lega credentialul de persoană)
        await this.audit.log('alegător', replacedPrevious ? 'voter.reregister' : 'voter.register', electionId, { credentialPubkey, method, ...extra }, client)
        const registration: Registration = { electionId, credentialPubkey, method, trustLevel, registeredAt: rows[0].registered_at.toISOString() }
        return replacedPrevious ? { ...registration, replacedPrevious } : registration
      } catch (err) {
        if (isUniqueViolation(err, 'registrations_election_id_cnp_hmac_key')) throw new ConflictException('Persoana este deja înregistrată la acest scrutin')
        if (isUniqueViolation(err, 'registrations_election_id_credential_pubkey_key')) throw new ConflictException('Credentialul este deja folosit')
        throw err
      }
    })
  }
}
