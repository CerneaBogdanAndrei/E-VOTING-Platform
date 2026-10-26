import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const randomToken = (bytes = 24) => randomBytes(bytes).toString('hex')

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

/** Comparație în timp constant, ca un atacator să nu afle prefixul corect din timpul de răspuns. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb) && a.length === b.length
}

export function bearer(header: string | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '')
  return m ? m[1] : null
}

export interface VoterSession {
  electionId: string
  credentialPubkey: string
  expiresAt: number
}

/** Sesiune fără stare: payload-ul semnat cu HMAC, valabil câteva minute, doar pentru trimiterea buletinului. */
export function signSession(secret: string, session: VoterSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  const mac = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${mac}`
}

export function verifySession(secret: string, token: string): VoterSession | null {
  const [payload, mac] = token.split('.')
  if (!payload || !mac) return null
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  if (!safeEqual(mac, expected)) return null
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as VoterSession
    return session.expiresAt > Date.now() ? session : null
  } catch {
    return null
  }
}
