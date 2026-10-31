#!/usr/bin/env node
// Verificatorul public. Oricine îl poate rula, fără niciun drept special:
//
//   evoting-verify --server URL --election ID [--anchor HASH ...] [--save registru.json]
//   evoting-verify --file registru.json [--anchor HASH ...]
//
// Verifică, în ordine: cheile trustees, lanțul de hash-uri (și hash-urile
// publicate independent), semnăturile și unicitatea credentialelor, dovezile ZK,
// agregatul recalculat de la zero, decriptările parțiale și rezultatul.
// Codul de ieșire e 0 doar dacă totul trece.

import { readFileSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { parseArgs } from 'node:util'
import { Worker } from 'node:worker_threads'
import { verifyElectionRecord, type BoardEntry, type ElectionParams, type ElectionRecord } from '@evoting/crypto'
import { ApiError, createApiClient } from '@evoting/api'

const { values } = parseArgs({
  options: {
    server: { type: 'string', default: process.env.EVOTING_SERVER ?? 'http://localhost:3000' },
    election: { type: 'string', short: 'e' },
    file: { type: 'string', short: 'f' },
    anchor: { type: 'string', multiple: true, short: 'a' },
    save: { type: 'string', short: 's' },
    workers: { type: 'string', short: 'w' },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
})

const green = (s: string) => `\x1b[32m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`

/** Pasul 3 (partea scumpă) în paralel, pe toate nucleele. */
function parallelProofChecker(workers: number) {
  return async (params: ElectionParams, board: BoardEntry[]): Promise<string[]> => {
    if (workers <= 1 || board.length < 200) {
      const { checkBallotProofs } = await import('@evoting/crypto')
      return checkBallotProofs(params, board)
    }
    const size = Math.ceil(board.length / workers)
    const chunks = Array.from({ length: workers }, (_, i) => board.slice(i * size, (i + 1) * size)).filter((c) => c.length)
    const results = await Promise.all(
      chunks.map(
        (entries) =>
          new Promise<string[]>((resolve, reject) => {
            const w = new Worker(new URL('./worker.js', import.meta.url), { workerData: { params, entries } })
            w.once('message', resolve)
            w.once('error', reject)
          }),
      ),
    )
    return results.flat()
  }
}

async function main() {
  if (values.help || (!values.file && !values.election)) {
    console.log('Utilizare: evoting-verify --server URL --election ID [--anchor HASH ...] [--save registru.json]\n           evoting-verify --file registru.json [--anchor HASH ...]')
    process.exit(values.help ? 0 : 2)
  }
  let record: ElectionRecord
  if (values.file) {
    record = JSON.parse(readFileSync(values.file, 'utf8')) as ElectionRecord
  } else {
    const api = createApiClient(values.server!)
    record = await api.getRecord(values.election!)
    if (values.save) {
      writeFileSync(values.save, JSON.stringify(record))
      if (!values.json) console.log(dim(`Registrul a fost salvat în ${values.save}`))
    }
  }
  const workers = Number(values.workers ?? Math.min(availableParallelism(), 8))
  if (!values.json) {
    console.log(bold(`\n${record.title}`))
    console.log(dim(`${record.params.electionId} · ${record.status} · ${record.board.length} buletine · ${record.params.trustees.length} trustees · ${workers} fire de verificare\n`))
  }
  const report = await verifyElectionRecord(record, { anchors: values.anchor ?? [], proofChecker: parallelProofChecker(workers) })
  if (values.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    report.steps.forEach((s, i) => {
      const mark = s.skipped ? yellow('–') : s.ok ? green('✓') : red('✗')
      console.log(`${mark} ${i}. ${s.title}${s.ok ? dim(`  ${s.summary}`) : ''}`)
      for (const p of s.problems) console.log(red(`     ${p}`))
    })
    console.log(dim(`\nCapul lanțului: ${report.head}`))
    console.log(dim(`Durată: ${(report.ms / 1000).toFixed(1)} s`))
    if (report.ok) {
      const counts = report.counts
      console.log(green(bold(`\nREZULTAT VERIFICAT${counts ? '' : ' (numărarea nu a avut loc încă)'}`)))
      if (counts) record.params.candidates.forEach((c, j) => console.log(`  ${c.padEnd(32)} ${String(counts[j]).padStart(6)}`))
    } else {
      console.log(red(bold('\nVERIFICAREA A EȘUAT: rezultatul nu este de încredere.')))
    }
  }
  process.exit(report.ok ? 0 : 1)
}

main().catch((err) => {
  console.error(red(`✗ ${err instanceof ApiError ? `server (${err.status}): ${err.message}` : (err as Error).message}`))
  process.exit(2)
})
