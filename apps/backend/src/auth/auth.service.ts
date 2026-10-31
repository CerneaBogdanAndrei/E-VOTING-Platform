// Autentificarea alegătorului (provocare semnată cu cheia de credential) și a
// comisiei (parolă → token). Nonce-urile și sesiunile sunt efemere și stau în
// memorie, nu în baza de date (în producție: Redis sau tabelă cu expirare).

import { randomBytes } from 'node:crypto'
import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { authMessage, constantTimeEqual, sha256Hex, verifySignature } from '@evoting/crypto'
import type { AdminSession, AuthChallenge, AuthSession } from '@evoting/api'
import { CONFIG, type AppConfig } from '../config.js'
import { STORAGE, type Storage } from '../storage/storage.js'

interface Pending {
  electionId: string
  credentialPubkey: string
  expires: number
}

interface VoterSession {
  electionId: string
  credentialPubkey: string
  expires: number
}

const NONCE_TTL_MS = 2 * 60_000

@Injectable()
export class AuthService {
  private nonces = new Map<string, Pending>()
  private voterSessions = new Map<string, VoterSession>()
  private adminSessions = new Map<string, number>()

  constructor(
    @Inject(STORAGE) private readonly storage: Storage,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  private sweep() {
    const now = Date.now()
    for (const [k, v] of this.nonces) if (v.expires < now) this.nonces.delete(k)
    for (const [k, v] of this.voterSessions) if (v.expires < now) this.voterSessions.delete(k)
    for (const [k, v] of this.adminSessions) if (v < now) this.adminSessions.delete(k)
  }

  async challenge(electionId: string, credentialPubkey: string): Promise<AuthChallenge> {
    this.sweep()
    const reg = await this.storage.registrations.findByCredential(electionId, credentialPubkey)
    if (!reg) throw new ForbiddenException('Credential neînregistrat la acest scrutin')
    const nonce = randomBytes(32).toString('hex')
    const expires = Date.now() + NONCE_TTL_MS
    this.nonces.set(nonce, { electionId, credentialPubkey, expires })
    return { nonce, expiresAt: new Date(expires).toISOString() }
  }

  verify(electionId: string, credentialPubkey: string, nonce: string, signature: string): AuthSession {
    const pending = this.nonces.get(nonce)
    // Nonce-ul se consumă la prima încercare, reușită sau nu: nu poate fi reluat.
    this.nonces.delete(nonce)
    if (!pending || pending.expires < Date.now() || pending.electionId !== electionId || pending.credentialPubkey !== credentialPubkey) {
      throw new UnauthorizedException('Provocare expirată sau necunoscută')
    }
    if (!verifySignature(credentialPubkey, authMessage(electionId, nonce), signature)) {
      throw new UnauthorizedException('Semnătura provocării nu se verifică')
    }
    const token = randomBytes(32).toString('hex')
    const expires = Date.now() + this.config.voterSessionTtl * 1000
    this.voterSessions.set(token, { electionId, credentialPubkey, expires })
    return { token, expiresAt: new Date(expires).toISOString() }
  }

  /** Verifică tokenul alegătorului pentru scrutinul și credentialul dat. */
  requireVoter(token: string | undefined, electionId: string, credentialPubkey: string) {
    const s = token ? this.voterSessions.get(token) : undefined
    if (!s || s.expires < Date.now()) throw new UnauthorizedException('Autentificare necesară: semnați provocarea serverului (POST /auth/challenge)')
    if (s.electionId !== electionId || s.credentialPubkey !== credentialPubkey) {
      throw new ForbiddenException('Sesiunea aparține altui credential sau altui scrutin')
    }
  }

  /** Închide sesiunea după vot, ca tokenul să nu poată fi refolosit. */
  endVoterSession(token: string) {
    this.voterSessions.delete(token)
  }

  adminLogin(password: string): AdminSession {
    this.sweep()
    // Se compară hash-urile, ca timpul să nu depindă de lungimea sau prefixul parolei.
    if (!constantTimeEqual(sha256Hex(password), sha256Hex(this.config.adminPassword))) {
      throw new UnauthorizedException('Parolă greșită')
    }
    const token = randomBytes(32).toString('hex')
    const expires = Date.now() + this.config.adminSessionTtl * 1000
    this.adminSessions.set(token, expires)
    return { token, expiresAt: new Date(expires).toISOString() }
  }

  isAdmin(token: string | undefined): boolean {
    if (!token) return false
    const exp = this.adminSessions.get(token)
    return exp !== undefined && exp > Date.now()
  }
}

export function bearerToken(header: string | undefined): string | undefined {
  const m = /^Bearer\s+([0-9a-f]{64})$/i.exec(header ?? '')
  return m?.[1]
}
