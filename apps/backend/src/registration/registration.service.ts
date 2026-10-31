// Înregistrarea alegătorului: CNP (din OCR sau din cip) → HMAC → eligibilitate → credential.

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { checkCnp, cnpFingerprint, isValidCredentialKey } from '@evoting/crypto'
import type { Registration, RegistrationMethod } from '@evoting/api'
import { CONFIG, type AppConfig } from '../config.js'
import { nowIso } from '../common/time.js'
import { ElectionsService } from '../elections/elections.service.js'
import { PassiveAuthService } from '../nfc/passive-auth.service.js'
import { STORAGE, UniqueViolation, type Storage } from '../storage/storage.js'

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(STORAGE) private readonly storage: Storage,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(ElectionsService) private readonly elections: ElectionsService,
    @Inject(PassiveAuthService) private readonly passiveAuth: PassiveAuthService,
  ) {}

  registerOcr(electionId: string, cnp: string, credentialPubkey: string): Promise<Registration> {
    return this.register(electionId, cnp, credentialPubkey, 'ocr')
  }

  /**
   * NFC: serverul (nu aplicația) verifică semnătura SOD până la CSCA și hash-ul DG1,
   * apoi extrage CNP-ul din DG1. O aplicație modificată nu poate pretinde că a verificat un document fals.
   */
  async registerNfc(electionId: string, dg1: string, sod: string, credentialPubkey: string): Promise<Registration> {
    const doc = await this.passiveAuth.verify(dg1, sod)
    return this.register(electionId, doc.cnp, credentialPubkey, 'nfc')
  }

  private async register(electionId: string, cnp: string, credentialPubkey: string, method: RegistrationMethod): Promise<Registration> {
    const e = await this.elections.row(electionId)
    if (e.status !== 'draft' && e.status !== 'open') throw new ConflictException('Înregistrarea s-a închis pentru acest scrutin')
    const check = checkCnp(cnp)
    if (!check.ok) throw new BadRequestException(`CNP invalid: ${check.reason}`)
    if (!isValidCredentialKey(credentialPubkey)) throw new BadRequestException('Cheia publică de credential nu e o cheie Ed25519 validă')
    const cnpHmac = cnpFingerprint(this.config.cnpHmacKey, cnp)
    if (!(await this.storage.eligibleVoters.exists(electionId, cnpHmac))) {
      throw new ForbiddenException('CNP-ul nu figurează în lista alegătorilor eligibili')
    }
    const row = {
      electionId,
      cnpHmac,
      credentialPubkey,
      method,
      trustLevel: method === 'nfc' ? ('criptografic' as const) : ('optic' as const),
      registeredAt: nowIso(),
    }
    try {
      await this.storage.registrations.insert(row)
    } catch (err) {
      if (err instanceof UniqueViolation) {
        throw new ConflictException(err.constraint === 'registrations_cnp' ? 'Persoana este deja înregistrată la acest scrutin' : 'Credentialul este deja folosit')
      }
      throw err
    }
    const { cnpHmac: _omit, ...pub } = row
    void _omit
    return pub
  }
}
