// Ajutoare pentru testele end-to-end: baza de test (o golește!), pornirea serverului
// pe un port liber și clienți API cu și fără token de comisie.

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { ApiError, createHttpClient, type ApiClient, type CreateElectionInput } from '@evoting/api'
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
  /** Un client cu alt token de comisie (de exemplu al unui membru). */
  as(token: string): ApiClient
  config: AppConfig
  pki: TestPki
  close(): Promise<void>
}

export const ADMIN_TOKEN = 'token-comisie-de-test-1234'

export async function startServer(overrides: Partial<AppConfig> = {}): Promise<TestServer> {
  const pki = await createTestPki()
  const dir = await mkdtemp(join(tmpdir(), 'evoting-csca-'))
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'test-csca.pem'), pki.cscaCertPem)
  const config: AppConfig = {
    databaseUrl: TEST_DB,
    cnpHmacKey: randomBytes(32).toString('hex'),
    adminToken: ADMIN_TOKEN,
    sessionSecret: randomBytes(32).toString('hex'),
    cscaDir: dir,
    port: 0,
    corsOrigins: true,
    rateLimit: false,
    sensitiveLimit: 30,
    autoCloseIntervalMs: 0,
    trustProxy: 0,
    production: false,
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
    as: (token) => createHttpClient(url, { getAdminToken: () => token }),
    config,
    pki,
    close: () => app.close(),
  }
}

/** Pentru assert.rejects: eroarea e un ApiError cu codul dat (și, opțional, un mesaj care se potrivește). */
export const rejects = (status: number, pattern?: RegExp) => (err: unknown) => {
  assert.ok(err instanceof ApiError, String(err))
  assert.equal(err.status, status, err.message)
  if (pattern) assert.match(err.message, pattern)
  return true
}

const HOUR = 3600_000

/** Un scrutin de test, deschis de o oră și cu închiderea peste o zi, cu trei candidați și doi trustees. */
export const electionInput = (over: Partial<CreateElectionInput> = {}): CreateElectionInput => ({
  title: 'Consiliul Facultății – test',
  opensAt: new Date(Date.now() - HOUR).toISOString(),
  closesAt: new Date(Date.now() + 24 * HOUR).toISOString(),
  candidates: [
    { name: 'Ana', description: 'Calculatoare' },
    { name: 'Bogdan', description: 'Automatică' },
    { name: 'Corina', description: 'Electronică' },
  ],
  trustees: [{ name: 'Comisia' }, { name: 'Observatori' }],
  ...over,
})
