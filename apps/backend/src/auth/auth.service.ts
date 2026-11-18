// Autentificarea alegătorului: serverul emite un nonce, telefonul îl semnează cu
// cheia de credential, iar serverul răspunde cu o sesiune HMAC fără stare,
// valabilă doar câteva minute și doar pentru trimiterea buletinului.
// Provocările stau în tabela auth_challenges, deci serverul poate fi repornit
// sau rulat în mai multe instanțe fără să le piardă.

import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { AuthChallenge, AuthSession } from '@evoting/api'
import { authMessage, verifySignature } from '@evoting/crypto'
import { randomToken, signSession } from '../common/security.js'
import { obj, str } from '../common/validate.js'
import { CONFIG, type AppConfig } from '../config.js'
import { Database } from '../db/database.service.js'

const CHALLENGE_TTL_MS = 2 * 60_000
export const SESSION_TTL_MS = 10 * 60_000

interface ChallengeRow {
  election_id: string
  credential_pubkey: string
  nonce: string
  expires_at: Date
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: Database,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async challenge(body: unknown): Promise<AuthChallenge> {
    const input = obj(body, 'cererea')
    const electionId = str(input.electionId, 'electionId', { max: 100 })
    const credentialPubkey = str(input.credentialPubkey, 'credentialPubkey', { max: 64 })
    const reg = await this.db.query('SELECT 1 FROM registrations WHERE election_id = $1 AND credential_pubkey = $2', [electionId, credentialPubkey])
    if (!reg.rowCount) throw new ForbiddenException('Credential neînregistrat la acest scrutin')
    // curățenie ieftină: provocările expirate dispar la fiecare cerere nouă
    await this.db.query('DELETE FROM auth_challenges WHERE expires_at < now()')
    const challengeId = randomToken(16)
    const nonce = randomToken(32)
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS)
    await this.db.query('INSERT INTO auth_challenges (id, election_id, credential_pubkey, nonce, expires_at) VALUES ($1, $2, $3, $4, $5)', [
      challengeId,
      electionId,
      credentialPubkey,
      nonce,
      expiresAt,
    ])
    return { challengeId, nonce, expiresAt: expiresAt.toISOString() }
  }

  async verify(body: unknown): Promise<AuthSession> {
    const input = obj(body, 'cererea')
    const challengeId = str(input.challengeId, 'challengeId', { max: 64 })
    // provocarea se consumă la prima încercare, reușită sau nu
    const { rows } = await this.db.query<ChallengeRow>(
      'DELETE FROM auth_challenges WHERE id = $1 RETURNING election_id, credential_pubkey, nonce, expires_at',
      [challengeId],
    )
    const c = rows[0]
    if (!c || c.expires_at.getTime() < Date.now()) throw new UnauthorizedException('Provocare expirată sau necunoscută')
    if (!verifySignature(c.credential_pubkey, authMessage(c.election_id, c.credential_pubkey, c.nonce), input.signature)) {
      throw new UnauthorizedException('Semnătura provocării nu e validă')
    }
    const expiresAt = Date.now() + SESSION_TTL_MS
    const token = signSession(this.config.sessionSecret, { electionId: c.election_id, credentialPubkey: c.credential_pubkey, expiresAt })
    return { token, expiresAt: new Date(expiresAt).toISOString() }
  }
}
