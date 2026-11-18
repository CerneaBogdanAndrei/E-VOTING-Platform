#!/usr/bin/env node
// Alegeri simulate cap-coadă contra backend-ului real, cu alegători sintetici:
// comisie, trustees, înregistrare (OCR și NFC cu cipuri de test), vot, numărare
// și verificare publică. La final compară rezultatul cu voturile „în clar” ale
// simulării și afișează metricile de performanță din planul de evaluare.
//
//   evoting-simulate --api URL --admin-token TOKEN --voters 1000 [--candidates 3] [--trustees 3]
//                    [--concurrency 8] [--nfc 0.3 --pki DIR] [--workers N] [--report FIȘIER]
//
// Backend-ul trebuie pornit cu RATE_LIMIT=off: toți alegătorii vin de pe aceeași adresă IP.
// Ajutoarele sunt în lib/: metrici, paralelism, alegători sintetici, afișare.

import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { authenticate, createHttpClient, decimal, prepareBallot, type Election } from '@evoting/api'
import { generateCredential, generateTrusteeKey, partialDecrypt, verifyElection, type TrusteeKeyPair } from '@evoting/crypto'
import { createNodeWork, defaultThreads } from '@evoting/crypto/node'
import { stats, timed } from './lib/metrics.js'
import { badLine, good, ok, step } from './lib/output.js'
import { pool } from './lib/pool.js'
import { loadChipFactory, pickChoice, seededRandom, syntheticMrz, uniqueCnps } from './lib/synthetic.js'

const { values } = parseArgs({
  options: {
    api: { type: 'string', default: process.env.EVOTING_API ?? 'http://localhost:3000' },
    'admin-token': { type: 'string', default: process.env.ADMIN_TOKEN },
    voters: { type: 'string', default: '100' },
    candidates: { type: 'string', default: '3' },
    trustees: { type: 'string', default: '3' },
    concurrency: { type: 'string', default: '8' },
    nfc: { type: 'string', default: '0' },
    pki: { type: 'string' },
    report: { type: 'string' },
    // verificarea publică se măsoară pe un fir și apoi în paralel, pe atâtea fire
    workers: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
})

if (values.help) {
  console.log(`Simulator de alegeri – vezi comentariul din tools/simulator/src/cli.ts`)
  process.exit(0)
}

const N = Number(values.voters)
const C = Number(values.candidates)
const T = Number(values.trustees)
const CONC = Number(values.concurrency)
const WORKERS = values.workers ? Number(values.workers) : defaultThreads()
const NFC_SHARE = Number(values.nfc)
const adminToken = values['admin-token'] ?? (console.error('Lipsește --admin-token (sau ADMIN_TOKEN)'), process.exit(2))
const api = createHttpClient(values.api!, { getAdminToken: () => adminToken })

async function main() {
  const metrics: Record<string, unknown> = { voters: N, candidates: C, trustees: T, concurrency: CONC, nfcShare: NFC_SHARE }
  const t0 = performance.now()
  const rand = seededRandom()

  step(`1. Comisia creează scrutinul (${C} candidați, ${T} trustees)`)
  const { election: created, trusteeTokens } = await api.createElection({
    title: `Simulare ${N} alegători – ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    opensAt: new Date().toISOString(),
    closesAt: new Date(Date.now() + 86400_000).toISOString(),
    candidates: Array.from({ length: C }, (_, j) => ({ name: `Candidat ${String.fromCharCode(65 + j)}`, description: 'simulare' })),
    trustees: Array.from({ length: T }, (_, i) => ({ name: `Trustee ${i + 1}` })),
  })
  ok(`scrutinul ${created.id}`)

  step('2. Trustees generează cheile local și trimit doar Yᵢ')
  const keys: TrusteeKeyPair[] = []
  let election: Election = created
  for (const t of trusteeTokens) {
    const { keyPair, publicKey } = generateTrusteeKey(created.id, t.trusteeId)
    keys.push(keyPair)
    election = await api.submitTrusteeKey(created.id, t.token, publicKey)
  }
  ok(`cheia scrutinului Y = ${election.publicKey?.slice(0, 16)}…`)

  step(`3. Importul listei de ${N} alegători eligibili (CNP-uri fictive)`)
  const voters = uniqueCnps(N, rand)
  const [imported, importMs] = await timed(() => api.importEligible(created.id, ['cnp', ...voters].join('\n')))
  ok(`${imported.imported} importați în ${importMs.toFixed(0)} ms (serverul păstrează doar HMAC-urile)`)
  election = await api.openElection(created.id)
  ok('votul e deschis')

  let makeChip: ((mrz: string) => Promise<{ dg1: string; sod: string }>) | null = null
  if (NFC_SHARE > 0) {
    if (!values.pki) throw new Error('--nfc cere --pki DIR (generat cu npm run test-pki -w @evoting/backend)')
    makeChip = await loadChipFactory(values.pki)
  }

  step(`4. ${N} alegători: înregistrare, autentificare, criptare + dovezi, trimitere (concurență ${CONC})`)
  const intended = Array.from({ length: C }, () => 0)
  const encryptMs: number[] = []
  const castMs: number[] = []
  const registerMs: number[] = []
  let nfcCount = 0
  const tVote = performance.now()
  await pool(
    voters,
    CONC,
    async (cnp, i) => {
      const cred = generateCredential()
      const useNfc = makeChip !== null && rand() < NFC_SHARE
      const [, regMs] = await timed(async () => {
        if (useNfc) {
          const chip = await makeChip!(syntheticMrz(i, cnp))
          await api.registerNfc(created.id, { ...chip, credentialPubkey: cred.publicKey })
          nfcCount++
        } else {
          await api.registerOcr(created.id, { cnp, credentialPubkey: cred.publicKey })
        }
      })
      registerMs.push(regMs)
      const choice = pickChoice(C, rand)
      intended[choice]++
      const [prepared, encMs] = await timed(() => prepareBallot(election, cred, choice))
      encryptMs.push(encMs)
      const token = await authenticate(api, created.id, cred)
      const [, sendMs] = await timed(() => api.castBallot(created.id, prepared.ballot, token))
      castMs.push(sendMs)
    },
    (done) => {
      if (process.stdout.isTTY && (done % 10 === 0 || done === N)) process.stdout.write(`\r  … ${done}/${N}`)
    },
  )
  const voteTotal = performance.now() - tVote
  if (process.stdout.isTTY) process.stdout.write('\r')
  ok(`${N} buletine pe board în ${decimal(voteTotal / 1000)} s (${decimal(N / (voteTotal / 1000))} buletine/s), ${nfcCount} prin NFC`)
  metrics.encryptAndProveMs = stats(encryptMs)
  metrics.castRoundtripMs = stats(castMs)
  metrics.registerRoundtripMs = stats(registerMs)
  metrics.ballotsPerSecond = +(N / (voteTotal / 1000)).toFixed(2)

  step('5. Închiderea votului: serverul publică agregatul')
  const [, closeMs] = await timed(() => api.closeElection(created.id))
  ok(`agregat calculat și publicat în ${closeMs.toFixed(0)} ms`)
  metrics.closeAggregateMs = +closeMs.toFixed(1)

  step('6. Fiecare trustee decriptează parțial agregatul')
  const tally = await api.getTally(created.id)
  const decryptMs: number[] = []
  for (const [i, t] of trusteeTokens.entries()) {
    const [partial, ms] = await timed(() => partialDecrypt(keys[i], tally.aggregate!))
    decryptMs.push(ms)
    const [, submitMs] = await timed(() => api.submitPartialDecryption(created.id, t.token, partial))
    ok(`${t.name}: decriptare în ${ms.toFixed(0)} ms, verificată și combinată de server în ${submitMs.toFixed(0)} ms`)
  }
  metrics.partialDecryptMs = stats(decryptMs)

  step('7. Rezultatul publicat vs. voturile simulate')
  const result = await api.getResult(created.id)
  const published = election.candidates.map((c) => result.counts.find((x) => x.candidateId === c.id)?.votes ?? 0)
  for (const c of election.candidates) console.log(`  ${c.name}: publicat ${published[c.position]}, simulat ${intended[c.position]}`)
  const correct = published.every((v, j) => v === intended[j])
  if (correct) good('✓ rezultatul corespunde exact voturilor exprimate')
  else badLine('✗ rezultatul diferă')

  step('8. Verificarea publică completă (ca un observator oarecare)')
  const [bundle, downloadMs] = await timed(() => createHttpClient(values.api!).getAuditBundle(created.id))
  const [report, verifyMs] = await timed(() => verifyElection({ ...bundle }, { publishedHead: bundle.head }))
  for (const s of report.steps) console.log(`  ${s.status === 'ok' ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${s.title}`)
  ok(`descărcare ${downloadMs.toFixed(0)} ms, verificare ${decimal(verifyMs / 1000, 2)} s (${decimal(verifyMs / N)} ms/buletin)`)
  metrics.verifyTotalMs = +verifyMs.toFixed(0)
  metrics.verifyPerBallotMs = +(verifyMs / N).toFixed(2)
  if (WORKERS > 1) {
    // aceeași verificare, cu semnăturile și dovezile împărțite pe toate nucleele
    const work = createNodeWork(WORKERS)
    const [parallel, parallelMs] = await timed(() => verifyElection({ ...bundle }, { publishedHead: bundle.head, work }))
    await work.close()
    const same = JSON.stringify(parallel) === JSON.stringify(report)
    const speedup = verifyMs / parallelMs
    ;(same ? ok : badLine)(
      `în paralel, pe ${WORKERS} fire: ${decimal(parallelMs / 1000, 2)} s, de ${decimal(speedup)} ori mai rapid; raport ${same ? 'identic' : 'DIFERIT'}`,
    )
    metrics.verifyThreads = WORKERS
    metrics.verifyParallelMs = +parallelMs.toFixed(0)
    metrics.verifySpeedup = +speedup.toFixed(2)
    metrics.verifyParallelSameReport = same
  }
  metrics.auditBundleBytes = JSON.stringify(bundle).length
  metrics.resultCorrect = correct
  metrics.verifierOk = report.ok
  metrics.totalSeconds = +((performance.now() - t0) / 1000).toFixed(1)
  metrics.electionId = created.id

  step('Metrici')
  console.table({
    'criptare + dovezi / buletin (client)': metrics.encryptAndProveMs,
    'trimitere + validare (server, dus-întors)': metrics.castRoundtripMs,
    'înregistrare (dus-întors)': metrics.registerRoundtripMs,
    'decriptare parțială / trustee': metrics.partialDecryptMs,
  })
  console.log(
    `  buletine/s: ${metrics.ballotsPerSecond} · închidere: ${metrics.closeAggregateMs} ms · verificare: ${metrics.verifyTotalMs} ms` +
      (metrics.verifyParallelMs !== undefined ? ` (în paralel pe ${metrics.verifyThreads} fire: ${metrics.verifyParallelMs} ms)` : ''),
  )
  if (values.report) {
    await writeFile(values.report, JSON.stringify(metrics, null, 2))
    ok(`raport salvat în ${values.report}`)
  }
  // exitCode, nu process.exit(): pe Windows, oprirea forțată imediat după un fetch prăbușește Node
  process.exitCode = correct && report.ok && metrics.verifyParallelSameReport !== false ? 0 : 1
}

main().catch((err) => {
  console.error(`\x1b[31mEroare:\x1b[0m ${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 1
})
