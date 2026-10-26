import { randomBytes } from 'node:crypto'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { createHttpClient, type ApiClient } from '@evoting/api'
import { createApp } from '../src/app.js'
import type { AppConfig } from '../src/config.js'
import { createTestPki, type TestPki } from '../src/nfc/test-pki.js'

export const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgres://evoting:evoting@localhost:5432/evoting_test'

export async function databaseAvailable(): Promise<boolean> {
  const client = new pg.Client({ connectionString: TEST_DB })
  try {
    await client.connect()
    await client.end()
    return true
  } catch {
    return false
  }
}

/** Golește schema bazei de test (migrările o recreează la pornirea aplicației). */
export async function resetDatabase() {
  const client = new pg.Client({ connectionString: TEST_DB })
  await client.connect()
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
  await client.end()
}

export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]) {
  const client = new pg.Client({ connectionString: TEST_DB })
  await client.connect()
  try {
    return await client.query<T>(text, values)
  } finally {
    await client.end()
  }
}

export interface TestServer {
  url: string
  api: ApiClient
  /** Clientul fără token de comisie. */
  anonymous: ApiClient
  config: AppConfig
  pki: TestPki
  close(): Promise<void>
}

export async function startServer(overrides: Partial<AppConfig> = {}): Promise<TestServer> {
  const pki = await createTestPki()
  const dir = await mkdtemp(join(tmpdir(), 'evoting-csca-'))
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'test-csca.pem'), pki.cscaCertPem)
  const config: AppConfig = {
    databaseUrl: TEST_DB,
    cnpHmacKey: randomBytes(32).toString('hex'),
    adminToken: 'token-comisie-de-test-1234',
    sessionSecret: randomBytes(32).toString('hex'),
    cscaDir: dir,
    port: 0,
    corsOrigins: true,
    rateLimit: false,
    sensitiveLimit: 30,
    ...overrides,
  }
  const app = await createApp(config, { logger: false })
  await app.listen(0, '127.0.0.1')
  const address = app.getHttpServer().address() as { port: number }
  const url = `http://127.0.0.1:${address.port}`
  return {
    url,
    api: createHttpClient(url, { getAdminToken: () => config.adminToken }),
    anonymous: createHttpClient(url),
    config,
    pki,
    close: () => app.close(),
  }
}
