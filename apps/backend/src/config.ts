import { randomBytes } from 'node:crypto'

export interface AppConfig {
  databaseUrl: string
  /** Cheia HMAC pentru CNP, hex. Stă doar în mediul serverului, niciodată în baza de date. */
  cnpHmacKey: string
  adminToken: string
  sessionSecret: string
  /** Certificatele CSCA de încredere pentru Passive Authentication. */
  cscaDir: string | null
  port: number
  corsOrigins: string[] | true
  rateLimit: boolean
  /** Limita pentru rutele sensibile (autentificare, înregistrare, comisie), cereri pe minut per IP. */
  sensitiveLimit: number
}

export const CONFIG = Symbol('CONFIG')

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const missing = ['DATABASE_URL', 'CNP_HMAC_KEY', 'ADMIN_TOKEN'].filter((k) => !env[k])
  if (missing.length) throw new Error(`Lipsesc variabilele de mediu: ${missing.join(', ')} (vezi .env.example)`)
  const cnpHmacKey = env.CNP_HMAC_KEY!.toLowerCase()
  if (!/^[0-9a-f]{64,}$/.test(cnpHmacKey)) throw new Error('CNP_HMAC_KEY trebuie să aibă cel puțin 32 de octeți, în hex (openssl rand -hex 32)')
  if (env.ADMIN_TOKEN!.length < 16) throw new Error('ADMIN_TOKEN trebuie să aibă cel puțin 16 caractere')
  return {
    databaseUrl: env.DATABASE_URL!,
    cnpHmacKey,
    adminToken: env.ADMIN_TOKEN!,
    sessionSecret: env.SESSION_SECRET || randomBytes(32).toString('hex'),
    cscaDir: env.CSCA_DIR || null,
    port: Number(env.PORT || 3000),
    corsOrigins: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((s) => s.trim()) : true,
    rateLimit: env.RATE_LIMIT !== 'off',
    sensitiveLimit: Number(env.SENSITIVE_RATE_LIMIT || 30),
  }
}
