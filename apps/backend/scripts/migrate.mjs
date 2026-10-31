// Creează tabelele în baza de date din DATABASE_URL (alternativa la lipirea
// db/schema.sql în SQL Editor-ul Supabase). Scriptul e idempotent.
//   DATABASE_URL=postgresql://… npm run db:migrate
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { poolConfig } from '../dist/storage/postgres.storage.js'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Setează DATABASE_URL (în .env sau în linia de comandă).')
  process.exit(1)
}
const client = new pg.Client(poolConfig(url))
await client.connect()
await client.query(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'))
const { rows } = await client.query(`select table_name from information_schema.tables where table_schema = current_schema() order by 1`)
console.log(`Schema aplicată. Tabele: ${rows.map((r) => r.table_name).join(', ')}`)
await client.end()
