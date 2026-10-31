import { Logger } from '@nestjs/common'
import type { AppConfig } from '../config.js'
import { MemoryStorage } from './memory.storage.js'
import type { Storage } from './storage.js'

/**
 * Alege stocarea: PostgreSQL (de exemplu Supabase) dacă există DATABASE_URL,
 * altfel memorie (opțional salvată în DATA_FILE).
 */
export async function createStorage(config: AppConfig): Promise<Storage> {
  const log = new Logger('Storage')
  if (config.databaseUrl) {
    const { PostgresStorage } = await import('./postgres.storage.js')
    const storage = await PostgresStorage.connect(config.databaseUrl)
    log.log(`Stocare: ${storage.kind}`)
    return storage
  }
  const storage = new MemoryStorage(config.dataFile)
  log.log(`Stocare: ${storage.kind}`)
  return storage
}
