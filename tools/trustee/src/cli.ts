#!/usr/bin/env node
// CLI-ul trustee-ului. Cheia secretă xᵢ se generează și rămâne pe calculatorul
// trustee-ului; la server ajung doar Yᵢ și decriptarea parțială, cu dovezi.
//
//   evoting-trustee keygen  --server URL --election ID --trustee t1 --code COD [--key fișier]
//   evoting-trustee decrypt --server URL --election ID --code COD [--key fișier]
//   evoting-trustee status  --server URL --election ID
//
// Înainte de decriptare, CLI-ul NU are încredere în server: descarcă board-ul,
// verifică lanțul și dovezile fiecărui buletin și recalculează agregatul. Dacă
// serverul i-ar cere să decripteze altceva decât suma buletinelor (de exemplu,
// un singur buletin, ca să afle votul cuiva), CLI-ul refuză.

import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { computeAggregate, generateTrusteeKey, partialDecrypt, verifyElectionRecord, type TrusteeKey } from '@evoting/crypto'
import { ApiError, createApiClient } from '@evoting/api'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    server: { type: 'string', default: process.env.EVOTING_SERVER ?? 'http://localhost:3000' },
    election: { type: 'string', short: 'e' },
    trustee: { type: 'string', short: 't' },
    code: { type: 'string', short: 'c', default: process.env.EVOTING_TRUSTEE_CODE },
    key: { type: 'string', short: 'k' },
    force: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
})

const green = (s: string) => `\x1b[32m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`

const USAGE = `CLI trustee – vot electronic verificabil

  keygen   generează cheia (local) și trimite doar cheia publică Yᵢ cu dovada Schnorr
  decrypt  verifică board-ul, recalculează agregatul și trimite decriptarea parțială cu dovezi
  status   arată starea cheilor și a decriptărilor

Opțiuni: --server URL  --election ID  --trustee ID  --code COD (de la comisie)  --key FIȘIER  --force`

function fail(message: string): never {
  console.error(red(`✗ ${message}`))
  process.exit(1)
}

function need(name: keyof typeof values): string {
  const v = values[name]
  if (typeof v !== 'string' || !v) fail(`lipsește --${name}`)
  return v
}

const keyPath = (election: string, trustee: string) => values.key ?? `${election}.${trustee}.trustee-key.json`

async function main() {
  const command = positionals[0]
  if (!command || values.help) {
    console.log(USAGE)
    return
  }
  const api = createApiClient(values.server!)
  const electionId = need('election')

  if (command === 'status') {
    const e = await api.getElection(electionId)
    console.log(`${e.title}  ${dim(`(${e.status})`)}`)
    for (const t of e.trustees) {
      console.log(`  ${t.id}  ${t.name.padEnd(30)} cheie: ${t.publicKeyShare ? green('trimisă') : 'lipsă'}   decriptare: ${t.partialDecryptionSubmitted ? green('trimisă') : 'lipsă'}`)
    }
    console.log(`  Cheia scrutinului: ${e.publicKey ?? 'încă necalculată'}`)
    return
  }

  if (command === 'keygen') {
    const trusteeId = need('trustee')
    const code = need('code')
    const file = keyPath(electionId, trusteeId)
    if (existsSync(file) && !values.force) fail(`${file} există deja. Nu suprascriu o cheie (folosește --force doar dacă știi ce faci).`)
    const e = await api.getElection(electionId)
    const t = e.trustees.find((x) => x.id === trusteeId)
    if (!t) fail(`trustee-ul ${trusteeId} nu există (disponibili: ${e.trustees.map((x) => x.id).join(', ')})`)
    const key = generateTrusteeKey(electionId, trusteeId)
    // Cheia se salvează ÎNAINTE de trimitere: dacă se pierde după, scrutinul nu mai poate fi decriptat.
    writeFileSync(file, JSON.stringify(key, null, 2))
    chmodSync(file, 0o600)
    console.log(`Cheia secretă a fost salvată în ${file} ${dim('(permisiuni 600; fă o copie offline, pe un stick)')}`)
    const updated = await api.submitTrusteeKey(electionId, code, { trusteeId, publicKeyShare: key.publicKeyShare, proof: key.proof })
    console.log(green(`✓ Yᵢ trimis pentru ${t.name}: ${key.publicKeyShare}`))
    console.log(updated.publicKey ? `Toate cheile sunt primite. Cheia scrutinului: ${updated.publicKey}` : 'Se așteaptă cheile celorlalți trustees.')
    return
  }

  if (command === 'decrypt') {
    const code = need('code')
    const trusteeHint = values.trustee
    const file = values.key ?? (trusteeHint ? keyPath(electionId, trusteeHint) : fail('lipsește --key (sau --trustee)'))
    const key = JSON.parse(readFileSync(file, 'utf8')) as TrusteeKey
    if (key.electionId !== electionId) fail(`cheia din ${file} aparține scrutinului ${key.electionId}`)

    const [tally, record] = await Promise.all([api.getTally(electionId), api.getRecord(electionId)])
    if (tally.status !== 'closed' || !tally.aggregate) fail(`scrutinul nu e închis (stare: ${tally.status})`)
    const me = record.params.trustees.find((t) => t.id === key.trusteeId)
    if (!me || me.publicKeyShare !== key.publicKeyShare) fail('cheia publică înregistrată pe server nu corespunde cheii tale locale')

    console.log(`Verific board-ul înainte de decriptare (${record.board.length} buletine)…`)
    const report = await verifyElectionRecord({ ...record, tally: null })
    for (const s of report.steps.filter((x) => !x.skipped)) console.log(`  ${s.ok ? green('✓') : red('✗')} ${s.title}${s.ok ? dim(` – ${s.summary}`) : ''}`)
    if (!report.ok) {
      for (const s of report.steps) for (const p of s.problems) console.log(red(`      ${p}`))
      fail('board-ul nu trece verificarea. Nu decriptez.')
    }
    const recomputed = computeAggregate(record.params.candidates.length, record.board.map((b) => b.ballot))
    const same = tally.ballotCount === record.board.length && recomputed.every((ct, j) => ct.a === tally.aggregate![j].a && ct.b === tally.aggregate![j].b)
    if (!same) fail('agregatul cerut de server NU este suma buletinelor de pe board. Refuz decriptarea (posibilă încercare de a afla un vot individual).')
    console.log(green(`  ✓ Agregatul cerut de server = suma celor ${record.board.length} buletine, recalculată local`))

    const partial = partialDecrypt(key, tally.aggregate)
    const state = await api.submitPartialDecryption(electionId, code, partial)
    console.log(green(`✓ Decriptarea parțială a fost trimisă (${partial.shares.length} valori, fiecare cu dovadă Chaum–Pedersen).`))
    console.log(state.status === 'tallied' ? 'Toți trustees au decriptat: rezultatul e publicat.' : `Trimise: ${state.submitted.length} din ${record.params.trustees.length}.`)
    return
  }

  fail(`comandă necunoscută: ${command}\n\n${USAGE}`)
}

main().catch((err) => fail(err instanceof ApiError ? `server (${err.status}): ${err.message}` : (err as Error).message))
