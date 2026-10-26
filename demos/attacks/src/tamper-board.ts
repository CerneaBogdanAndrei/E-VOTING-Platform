// Demonstrația 5: un administrator rău-intenționat modifică board-ul direct în
// baza de date (ocolind trigger-ul append-only), apoi verificatorul public arată
// exact buletinul modificat. La final, modificarea se anulează.
//
//   DATABASE_URL=... node dist/tamper-board.js --api http://localhost:3000 --election ID [--seq 3]

import { parseArgs } from 'node:util'
import pg from 'pg'
import { createHttpClient } from '@evoting/api'
import { verifyElection } from '@evoting/crypto'

const { values } = parseArgs({
  options: {
    api: { type: 'string', default: process.env.EVOTING_API ?? 'http://localhost:3000' },
    election: { type: 'string' },
    seq: { type: 'string', default: '1' },
  },
})
const electionId = values.election ?? (console.error('Lipsește --election'), process.exit(2))
const seq = Number(values.seq)
const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://evoting:evoting@localhost:5432/evoting' })
const api = createHttpClient(values.api!)

async function report(title: string) {
  const b = await api.getAuditBundle(electionId)
  const r = await verifyElection({ ...b })
  console.log(`\n${title}: ${r.ok ? '\x1b[32mtoate verificările trec\x1b[0m' : '\x1b[31mverificarea pică\x1b[0m'}`)
  for (const s of r.steps.filter((x) => x.status === 'fail')) for (const f of s.failures) console.log(`  ${s.title} → ${f.where}: ${f.message}`)
}

await db.connect()
const { rows } = await db.query<{ ciphertexts: unknown[] }>('SELECT ciphertexts FROM ballots WHERE election_id = $1 AND seq = $2', [electionId, seq])
if (!rows[0]) {
  console.error(`Buletinul #${seq} nu există în scrutinul ${electionId}`)
  process.exit(1)
}
const original = rows[0].ciphertexts
console.log(`Demonstrația 5: modificarea buletinului #${seq} direct în PostgreSQL`)
await report('Înainte')

try {
  await db.query('ALTER TABLE ballots DISABLE TRIGGER ballots_append_only')
  // inversează primele două criptotexte: votul ar trece de la un candidat la altul
  const swapped = [original[1], original[0], ...original.slice(2)]
  await db.query('UPDATE ballots SET ciphertexts = $3 WHERE election_id = $1 AND seq = $2', [electionId, seq, JSON.stringify(swapped)])
  console.log(`\n(atacatorul a inversat criptotextele candidaților 1 și 2 în buletinul #${seq})`)
  await report('După modificare')
} finally {
  await db.query('UPDATE ballots SET ciphertexts = $3 WHERE election_id = $1 AND seq = $2', [electionId, seq, JSON.stringify(original)])
  await db.query('ALTER TABLE ballots ENABLE TRIGGER ballots_append_only')
  await report('După restaurare')
  await db.end()
}
