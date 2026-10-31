// Configurarea din variabile de mediu. Secretele (cheia HMAC, parola comisiei)
// nu stau niciodată în baza de date.

import { randomBytes } from 'node:crypto'
import { Logger } from '@nestjs/common'

export interface AppConfig {
  port: number
  /** Cheia HMAC pentru CNP, hex (32 de octeți). */
  cnpHmacKey: string
  /** Parola comisiei pentru panoul web. */
  adminPassword: string
  /** Activează rutele /demo (simulări pentru prezentare). Nu se folosește în producție. */
  demoMode: boolean
  /** Conexiunea PostgreSQL (de exemplu Supabase). Dacă lipsește, stocarea e în memorie. */
  databaseUrl: string | undefined
  /** Fișier JSON în care se salvează stocarea în memorie (opțional). */
  dataFile: string | undefined
  /** Director cu certificatele CSCA (PEM/DER) pentru Passive Authentication. */
  cscaDir: string | undefined
  /** Limitarea ratei cererilor (protecție la brute force). */
  rateLimit: boolean
  corsOrigin: string | boolean
  /** Durata sesiunilor (secunde). */
  voterSessionTtl: number
  adminSessionTtl: number
}

export const CONFIG = Symbol('CONFIG')

const log = new Logger('Config')

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  let cnpHmacKey = env.CNP_HMAC_KEY ?? ''
  if (!/^[0-9a-f]{64}$/i.test(cnpHmacKey)) {
    if (cnpHmacKey) throw new Error('CNP_HMAC_KEY trebuie să aibă 64 de caractere hex (32 de octeți)')
    cnpHmacKey = randomBytes(32).toString('hex')
    log.warn('CNP_HMAC_KEY lipsește: s-a generat o cheie temporară. Amprentele CNP nu vor mai corespunde după repornire.')
  }
  let adminPassword = env.ADMIN_PASSWORD ?? ''
  if (!adminPassword) {
    adminPassword = 'comisie'
    log.warn('ADMIN_PASSWORD lipsește: parola comisiei este „comisie”. Setați ADMIN_PASSWORD în afara demo-ului.')
  }
  const flag = (v: string | undefined, def: boolean) => (v === undefined || v === '' ? def : !/^(0|false|off|no)$/i.test(v))
  return {
    port: Number(env.PORT ?? 3000),
    cnpHmacKey: cnpHmacKey.toLowerCase(),
    adminPassword,
    demoMode: flag(env.DEMO_MODE, false),
    databaseUrl: env.DATABASE_URL || undefined,
    dataFile: env.DATA_FILE || undefined,
    cscaDir: env.CSCA_DIR || undefined,
    rateLimit: flag(env.RATE_LIMIT, true),
    corsOrigin: env.CORS_ORIGIN ? env.CORS_ORIGIN : true,
    voterSessionTtl: Number(env.VOTER_SESSION_TTL ?? 900),
    adminSessionTtl: Number(env.ADMIN_SESSION_TTL ?? 8 * 3600),
  }
}
