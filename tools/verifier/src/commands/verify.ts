// Verificarea completă a unui scrutin: de pe server sau dintr-un fișier salvat,
// opțional față de hash-ul publicat independent. Codul de ieșire e 0 doar dacă trece tot.

import { readFile, writeFile } from 'node:fs/promises'
import { createHttpClient, type AuditBundleResponse } from '@evoting/api'
import { sequentialWork, verifyElection, type BallotWork, type StepId } from '@evoting/crypto'
import { createNodeWork, defaultThreads } from '@evoting/crypto/node'
import { CliExit, die, GREEN, RED, statusIcon } from '../output.js'

export interface VerifyOptions {
  api: string
  election?: string
  bundle?: string
  head?: string
  save?: string
  json?: boolean
  workers?: string
}

/**
 * `--workers N`: câte fire; 1 = totul în firul principal (ca înainte). Implicit, toate nucleele,
 * dar nu mai multe fire decât are rost (pornirea unui fir costă câteva zeci de ms): unul la 16 buletine.
 */
export function parseWorkers(value: string | undefined, ballots: number): number {
  if (value === undefined) return Math.max(1, Math.min(defaultThreads(), Math.ceil(ballots / 16)))
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 256) die('--workers se dă ca număr întreg între 1 și 256')
  return n
}

/** `--head SEQ:HASH`, hash-ul publicat independent pentru intrarea `seq`. */
export function parseHead(value: string | undefined) {
  if (!value) return undefined
  const m = /^(\d+):([0-9a-fA-F]{64})$/.exec(value.trim())
  if (!m) die('--head se dă ca SEQ:HASH, de exemplu 120:3fa4…')
  return { seq: Number(m![1]), hash: m![2].toLowerCase() }
}

async function loadBundle(options: VerifyOptions): Promise<AuditBundleResponse> {
  if (options.bundle) return JSON.parse(await readFile(options.bundle, 'utf8'))
  const id = options.election ?? die('lipsește --election (sau --bundle)')
  const bundle = await createHttpClient(options.api).getAuditBundle(id)
  if (options.save) await writeFile(options.save, JSON.stringify(bundle))
  return bundle
}

export async function verify(options: VerifyOptions) {
  const bundle = await loadBundle(options)
  const e = bundle.election
  const quiet = options.json
  if (!quiet) {
    console.log(`\n${e.title}  [${e.id}]`)
    console.log(`Stare: ${e.status} · ${bundle.board.length} buletine · ${bundle.registrations.length} credentiale înregistrate\n`)
  }

  const publishedHead = parseHead(options.head)
  const threads = parseWorkers(options.workers, bundle.board.length)
  const work: BallotWork & { close?: () => Promise<void> } = threads > 1 ? createNodeWork(threads) : sequentialWork()
  const started = performance.now()
  const timings: Partial<Record<StepId, number>> = {}
  let current = null as StepId | null
  let stepStart = started
  let lastPrint = 0
  const verifying = verifyElection(
    { election: e, registrations: bundle.registrations, board: bundle.board, tally: bundle.tally, result: bundle.result },
    {
      publishedHead,
      work,
      onProgress: (step, done, total) => {
        const now = performance.now()
        if (step !== current) {
          if (current) timings[current] = now - stepStart
          current = step
          stepStart = now
        }
        if (!quiet && process.stdout.isTTY && now - lastPrint > 200) {
          lastPrint = now
          process.stdout.write(`\r  … ${step}: ${done}/${total}   `)
        }
      },
    },
  )
  // firele se opresc și dacă verificarea aruncă; altfel procesul n-ar mai ieși
  const report = await verifying.finally(() => work.close?.())
  if (current) timings[current] = performance.now() - stepStart
  const total = performance.now() - started
  if (!quiet && process.stdout.isTTY) process.stdout.write('\r' + ' '.repeat(40) + '\r')

  if (quiet) {
    console.log(JSON.stringify({ ...report, threads, timingsMs: timings, totalMs: Math.round(total) }, null, 2))
  } else {
    report.steps.forEach((s, i) => {
      const t = timings[s.id] ? ` (${Math.round(timings[s.id]!)} ms)` : ''
      console.log(`${statusIcon(s.status)} ${i}. ${s.title}${t}`)
      for (const d of s.details) console.log(`     ${d}`)
      for (const f of s.failures) console.log(`     ${RED(`${f.where}:`)} ${f.message}`)
    })
    console.log(`\nUltimul hash al board-ului: ${report.head}`)
    console.log(`Verificare completă în ${(total / 1000).toFixed(2)} s, pe ${threads === 1 ? 'un fir' : `${threads} fire`}`)
    console.log(report.ok ? `\n${GREEN('REZULTATUL ESTE VERIFICAT.')}` : `\n${RED('VERIFICAREA A PICAT: rezultatul nu este de încredere.')}`)
  }
  if (!report.ok) throw new CliExit(1)
}
