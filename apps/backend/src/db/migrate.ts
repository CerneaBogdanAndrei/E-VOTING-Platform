// Migrări SQL simple: fișierele din migrations/ se aplică în ordine, o singură
// dată, fiecare într-o tranzacție. Un lock consultativ evită aplicarea dublă.

import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const MIGRATIONS_DIR = fileURLToPath(new URL('../../../migrations/', import.meta.url))

export async function migrate(databaseUrl: string, log: (msg: string) => void = () => undefined): Promise<string[]> {
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  const applied: string[] = []
  try {
    await client.query('SELECT pg_advisory_lock(727001)')
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
    const done = new Set((await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name))
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()
    for (const file of files) {
      if (done.has(file)) continue
      const sql = await readFile(MIGRATIONS_DIR + file, 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw new Error(`Migrarea ${file} a eșuat: ${(err as Error).message}`)
      }
      applied.push(file)
      log(`migrare aplicată: ${file}`)
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined)
    await client.end()
  }
  return applied
}
