import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import {
  base64ToBytes,
  isValidCnp,
  mrzFromDg1,
  parseMrz,
  type AuthChallenge,
  type AuthSession,
  type BallotReceipt,
  type Registration,
  type RegistrationMethod,
} from '@evoting/api'
import {
  appendEntry,
  authMessage,
  isCredentialPubkey,
  verifyBallot,
  verifySignature,
  type Ballot,
  type BoardEntry,
} from '@evoting/crypto'
import { AuditService } from '../common/audit.service.js'
import { randomToken, signSession, verifySession } from '../common/security.js'
import { bad, obj, str } from '../common/validate.js'
import { CONFIG, type AppConfig } from '../config.js'
import { Database, isUniqueViolation } from '../db/database.service.js'
import { ElectionsService, toEntry } from '../elections/elections.service.js'
import { PassiveAuthService } from '../nfc/passive-auth.service.js'

const CHALLENGE_TTL_MS = 2 * 60_000
const SESSION_TTL_MS = 10 * 60_000

interface PendingChallenge {
  electionId: string
  credentialPubkey: string
  nonce: string
  expiresAt: number
}

@Injectable()
export class VotingService {
  /** Provocările de autentificare trăiesc doar câteva minute, deci stau în memorie. */
  private readonly challenges = new Map<string, PendingChallenge>()

  constructor(
    private readonly db: Database,
    private readonly elections: ElectionsService,
    private readonly audit: AuditService,
    private readonly passiveAuth: PassiveAuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  // ───────────── înregistrare ─────────────

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

  private async register(electionId: string, cnp: string, credentialPubkey: unknown, method: RegistrationMethod, extra: Record<string, unknown> = {}): Promise<Registration> {
    if (!isCredentialPubkey(credentialPubkey)) throw bad('Cheia de credential nu e o cheie publică Ed25519 validă')
    const cnpHmac = this.elections.hmac(cnp)
    const trustLevel = method === 'nfc' ? 'criptografic' : 'optic'
    return this.db.transaction(async (client) => {
      const e = await this.elections.lock(client, electionId)
      if (e.status !== 'draft' && e.status !== 'open') throw new ConflictException('Înregistrarea s-a închis pentru acest scrutin')
      const eligible = await client.query('SELECT 1 FROM eligible_voters WHERE election_id = $1 AND cnp_hmac = $2', [electionId, cnpHmac])
      if (!eligible.rowCount) throw new ForbiddenException('CNP-ul nu figurează în lista alegătorilor eligibili')
      try {
        const { rows } = await client.query<{ registered_at: Date }>(
          'INSERT INTO registrations (election_id, cnp_hmac, credential_pubkey, method, trust_level) VALUES ($1, $2, $3, $4, $5) RETURNING registered_at',
          [electionId, cnpHmac, credentialPubkey, method, trustLevel],
        )
        // în jurnal intră doar credentialul și metoda, nu și HMAC-ul (care ar lega credentialul de persoană)
        await this.audit.log('alegător', 'voter.register', electionId, { credentialPubkey, method, ...extra }, client)
        return { electionId, credentialPubkey, method, trustLevel, registeredAt: rows[0].registered_at.toISOString() }
      } catch (err) {
        if (isUniqueViolation(err, 'registrations_election_id_cnp_hmac_key')) throw new ConflictException('Persoana este deja înregistrată la acest scrutin')
        if (isUniqueViolation(err, 'registrations_election_id_credential_pubkey_key')) throw new ConflictException('Credentialul este deja folosit')
        throw err
      }
    })
  }

  // ───────────── autentificare ─────────────

  async challenge(body: unknown): Promise<AuthChallenge> {
    const input = obj(body, 'cererea')
    const electionId = str(input.electionId, 'electionId', { max: 100 })
    const credentialPubkey = str(input.credentialPubkey, 'credentialPubkey', { max: 64 })
    const reg = await this.db.query('SELECT 1 FROM registrations WHERE election_id = $1 AND credential_pubkey = $2', [electionId, credentialPubkey])
    if (!reg.rowCount) throw new ForbiddenException('Credential neînregistrat la acest scrutin')
    this.gc()
    const challengeId = randomToken(16)
    const nonce = randomToken(32)
    const expiresAt = Date.now() + CHALLENGE_TTL_MS
    this.challenges.set(challengeId, { electionId, credentialPubkey, nonce, expiresAt })
    return { challengeId, nonce, expiresAt: new Date(expiresAt).toISOString() }
  }

  async verify(body: unknown): Promise<AuthSession> {
    const input = obj(body, 'cererea')
    const challengeId = str(input.challengeId, 'challengeId', { max: 64 })
    const c = this.challenges.get(challengeId)
    // provocarea se consumă la prima încercare, reușită sau nu
    this.challenges.delete(challengeId)
    if (!c || c.expiresAt < Date.now()) throw new UnauthorizedException('Provocare expirată sau necunoscută')
    if (!verifySignature(c.credentialPubkey, authMessage(c.electionId, c.credentialPubkey, c.nonce), input.signature)) {
      throw new UnauthorizedException('Semnătura provocării nu e validă')
    }
    const expiresAt = Date.now() + SESSION_TTL_MS
    return { token: signSession(this.config.sessionSecret, { electionId: c.electionId, credentialPubkey: c.credentialPubkey, expiresAt }), expiresAt: new Date(expiresAt).toISOString() }
  }

  private gc() {
    const now = Date.now()
    if (this.challenges.size < 10_000) {
      for (const [k, v] of this.challenges) if (v.expiresAt < now) this.challenges.delete(k)
      return
    }
    this.challenges.clear()
  }

  // ───────────── votul ─────────────

  async cast(electionId: string, sessionToken: string | null, body: unknown): Promise<BallotReceipt> {
    const session = sessionToken ? verifySession(this.config.sessionSecret, sessionToken) : null
    if (!session) throw new UnauthorizedException('Sesiune lipsă sau expirată; autentifică-te din nou')
    const raw = obj(body, 'buletinul')
    const ballot: Ballot = {
      electionId: raw.electionId as string,
      credentialPubkey: raw.credentialPubkey as string,
      ciphertexts: raw.ciphertexts as Ballot['ciphertexts'],
      proofs: raw.proofs as Ballot['proofs'],
      signature: raw.signature as string,
    }
    if (session.electionId !== electionId || ballot.electionId !== electionId) throw new ForbiddenException('Sesiunea sau buletinul aparțin altui scrutin')
    if (session.credentialPubkey !== ballot.credentialPubkey) throw new ForbiddenException('Sesiunea aparține altui credential')

    // dovezile se verifică înainte de tranzacție: durează câteva zeci de ms și nu țin board-ul blocat
    const params = await this.elections.params(electionId)
    if (params.status !== 'open') throw new ConflictException('Scrutinul nu este deschis')
    const check = verifyBallot(params, ballot)
    if (!check.ok) throw bad(`Buletin respins: ${check.reason}`)

    try {
      const entry = await this.db.transaction(async (client) => {
        const e = await this.elections.lock(client, electionId)
        if (e.status !== 'open') throw new ConflictException('Scrutinul nu este deschis')
        const reg = await client.query('SELECT 1 FROM registrations WHERE election_id = $1 AND credential_pubkey = $2', [electionId, ballot.credentialPubkey])
        if (!reg.rowCount) throw new ForbiddenException('Credential neînregistrat la acest scrutin')
        const voted = await client.query('SELECT 1 FROM ballots WHERE election_id = $1 AND credential_pubkey = $2', [electionId, ballot.credentialPubkey])
        if (voted.rowCount) throw new ConflictException('Acest credential a votat deja')
        const last = await client.query('SELECT * FROM ballots WHERE election_id = $1 ORDER BY seq DESC LIMIT 1', [electionId])
        const previous: BoardEntry | undefined = last.rows[0] ? toEntry(last.rows[0]) : undefined
        const next = appendEntry(electionId, previous, ballot, new Date().toISOString())
        await client.query(
          `INSERT INTO ballots (election_id, seq, credential_pubkey, ciphertexts, proofs, signature, ballot_hash, prev_hash, hash, received_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [electionId, next.seq, next.credentialPubkey, JSON.stringify(next.ciphertexts), JSON.stringify(next.proofs), next.signature, next.ballotHash, next.prevHash, next.hash, next.receivedAt],
        )
        return next
      })
      return { seq: entry.seq, trackingCode: entry.hash, ballotHash: entry.ballotHash, receivedAt: entry.receivedAt }
    } catch (err) {
      if (isUniqueViolation(err, 'ballots_election_id_credential_pubkey_key')) throw new ConflictException('Acest credential a votat deja')
      if (err instanceof NotFoundException) throw err
      throw err
    }
  }
}
