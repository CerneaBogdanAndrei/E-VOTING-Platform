#!/usr/bin/env node
// Verificatorul public. Descarcă tot ce publică serverul și verifică, în ordine:
// cheile, lanțul de hash-uri (și hash-ul publicat independent), semnăturile și
// credentialele, dovezile ZK, agregatul și decriptarea. Nu are nevoie de niciun drept.
//
//   evoting-verify --api URL --election ID [--head SEQ:HASH] [--save FIȘIER] [--json]
//   evoting-verify --bundle FIȘIER [--head SEQ:HASH]
//   evoting-verify audit-ballot --api URL --election ID --file AUDIT.json

import { readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { createHttpClient, type AuditBundleResponse } from '@evoting/api'
import { auditBallot, verifyElection, type BallotSecrets, type Ciphertext, type StepId } from '@evoting/crypto'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    api: { type: 'string', default: process.env.EVOTING_API ?? 'http://localhost:3000' },
    election: { type: 'string' },
    bundle: { type: 'string' },
    head: { type: 'string' },
    save: { type: 'string' },
    file: { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
})

const HELP = `Verificator public – vot electronic verificabil

  evoting-verify --api URL --election ID     descarcă board-ul și verifică tot
     --head SEQ:HASH   hash-ul publicat independent (de ex. pe site-ul facultății)
     --save FIȘIER     salvează datele descărcate, pentru arhivă sau verificare offline
     --json            raport în format JSON
  evoting-verify --bundle FIȘIER              verifică offline un fișier salvat
  evoting-verify audit-ballot --election ID --file AUDIT.json
                                              verifică un buletin auditat (provocarea Benaloh)

Codul de ieșire e 0 doar dacă toate verificările trec.`

const die = (s: string): never => {
  console.error(`\x1b[31mEroare:\x1b[0m ${s}`)
  process.exit(2)
}

function parseHead(value: string | undefined) {
  if (!value) return undefined
  const m = /^(\d+):([0-9a-fA-F]{64})$/.exec(value.trim())
  if (!m) die('--head se dă ca SEQ:HASH, de exemplu 120:3fa4…')
  return { seq: Number(m![1]), hash: m![2].toLowerCase() }
}

async function verify() {
  let bundle: AuditBundleResponse
  if (values.bundle) {
    bundle = JSON.parse(await readFile(values.bundle, 'utf8'))
  } else {
    const id = values.election ?? die('lipsește --election (sau --bundle)')
    bundle = await createHttpClient(values.api!).getAuditBundle(id)
    if (values.save) await writeFile(values.save, JSON.stringify(bundle))
  }
  const e = bundle.election
  const quiet = values.json
  if (!quiet) {
    console.log(`\n${e.title}  [${e.id}]`)
    console.log(`Stare: ${e.status} · ${bundle.board.length} buletine · ${bundle.registrations.length} credentiale înregistrate\n`)
  }

  const started = performance.now()
  const timings: Partial<Record<StepId, number>> = {}
  let current = null as StepId | null
  let stepStart = started
  let lastPrint = 0
  const report = await verifyElection(
    { election: e, registrations: bundle.registrations, board: bundle.board, tally: bundle.tally, result: bundle.result },
    {
      publishedHead: parseHead(values.head),
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
  if (current) timings[current] = performance.now() - stepStart
  const total = performance.now() - started
  if (!quiet && process.stdout.isTTY) process.stdout.write('\r' + ' '.repeat(40) + '\r')

  if (quiet) {
    console.log(JSON.stringify({ ...report, timingsMs: timings, totalMs: Math.round(total) }, null, 2))
  } else {
    report.steps.forEach((s, i) => {
      const icon = s.status === 'ok' ? '\x1b[32m✓\x1b[0m' : s.status === 'fail' ? '\x1b[31m✗\x1b[0m' : '\x1b[33m–\x1b[0m'
      const t = timings[s.id] ? ` (${Math.round(timings[s.id]!)} ms)` : ''
      console.log(`${icon} ${i}. ${s.title}${t}`)
      for (const d of s.details) console.log(`     ${d}`)
      for (const f of s.failures) console.log(`     \x1b[31m${f.where}:\x1b[0m ${f.message}`)
    })
    console.log(`\nUltimul hash al board-ului: ${report.head}`)
    console.log(`Verificare completă în ${(total / 1000).toFixed(2)} s`)
    console.log(report.ok ? '\n\x1b[32mREZULTATUL ESTE VERIFICAT.\x1b[0m' : '\n\x1b[31mVERIFICAREA A PICAT: rezultatul nu este de încredere.\x1b[0m')
  }
  process.exit(report.ok ? 0 : 1)
}

/** Fișierul exportat de aplicație la provocarea Benaloh: criptotextele, opțiunea declarată și r-urile. */
interface AuditFile {
  electionId: string
  ciphertexts: Ciphertext[]
  secrets: BallotSecrets
}

async function auditBallotCommand() {
  const data = JSON.parse(await readFile(values.file ?? die('lipsește --file'), 'utf8')) as AuditFile
  const e = await createHttpClient(values.api!).getElection(values.election ?? data.electionId)
  if (!e.publicKey) die('scrutinul nu are încă o cheie publică')
  const r = auditBallot({ electionId: e.id, publicKey: e.publicKey!, candidateCount: e.candidates.length }, data.ciphertexts, data.secrets)
  if (r.ok) {
    const c = e.candidates.find((x) => x.position === r.choice)
    console.log(`\x1b[32m✓\x1b[0m Buletinul criptează exact opțiunea declarată: ${c?.name ?? r.choice}`)
    console.log('  Aplicația a criptat corect. Acest buletin a fost dezvăluit, deci nu se mai trimite; votul se recriptează.')
    process.exit(0)
  }
  console.log(`\x1b[31m✗\x1b[0m ${r.reason}`)
  console.log('  Aplicația NU a criptat opțiunea aleasă. Raportează comisiei și nu vota de pe acest dispozitiv.')
  process.exit(1)
}

try {
  const [command] = positionals
  if (values.help) console.log(HELP)
  else if (command === 'audit-ballot') await auditBallotCommand()
  else if (!command || command === 'verify') await verify()
  else die(`comandă necunoscută: ${command}\n\n${HELP}`)
} catch (err) {
  die(err instanceof Error ? err.message : String(err))
}
