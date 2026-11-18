import { randomBytes } from 'node:crypto'

export interface AppConfig {
  databaseUrl: string
  /** Cheia HMAC pentru CNP, hex. Stă doar în mediul serverului, niciodată în baza de date. */
  cnpHmacKey: string
  /** Token-ul „rădăcină” al comisiei; cu el se creează membrii cu token propriu. */
  adminToken: string
  sessionSecret: string
  /** Certificatele CSCA de încredere pentru Passive Authentication. */
  cscaDir: string | null
  port: number
  corsOrigins: string[] | true
  rateLimit: boolean
  /** Limita pentru rutele sensibile (autentificare, înregistrare, comisie), cereri pe minut per IP. */
  sensitiveLimit: number
  /** La cât timp verifică serverul scrutinele deschise a căror dată de închidere a trecut (0 = niciodată). */
  autoCloseIntervalMs: number
  /** Numărul de proxy-uri de încredere din față (Caddy, nginx), ca adresa IP reală să fie cea din X-Forwarded-For. */
  trustProxy: number
  production: boolean
}

export const CONFIG = Symbol('CONFIG')

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const missing = ['DATABASE_URL', 'CNP_HMAC_KEY', 'ADMIN_TOKEN'].filter((k) => !env[k])
  if (missing.length) throw new Error(`Lipsesc variabilele de mediu: ${missing.join(', ')} (vezi .env.example)`)
  const cnpHmacKey = env.CNP_HMAC_KEY!.toLowerCase()
  if (!/^[0-9a-f]{64,}$/.test(cnpHmacKey)) throw new Error('CNP_HMAC_KEY trebuie să aibă cel puțin 32 de octeți, în hex (openssl rand -hex 32)')
  if (env.ADMIN_TOKEN!.length < 16) throw new Error('ADMIN_TOKEN trebuie să aibă cel puțin 16 caractere')
  const production = env.NODE_ENV === 'production'
  if (production && !env.SESSION_SECRET) {
    console.warn('SESSION_SECRET lipsește: sesiunile alegătorilor nu supraviețuiesc unei reporniri și nu merg cu mai multe instanțe')
  }
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
    autoCloseIntervalMs: env.AUTO_CLOSE_INTERVAL_MS === undefined ? 60_000 : Number(env.AUTO_CLOSE_INTERVAL_MS),
    trustProxy: env.TRUST_PROXY === 'true' ? 1 : Number(env.TRUST_PROXY || 0) || 0,
    production,
  }
}
