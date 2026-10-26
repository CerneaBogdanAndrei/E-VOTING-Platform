#!/usr/bin/env node
// CLI-ul trustee-ului. Cheia secretă xᵢ se generează și rămâne pe calculatorul
// trustee-ului, într-un fișier local; serverul primește doar Yᵢ și dovezile.
//
//   evoting-trustee keygen  --api URL --election ID --trustee ID --token TOKEN [--out FIȘIER]
//   evoting-trustee decrypt --key FIȘIER --token TOKEN [--api URL]
//   evoting-trustee status  --api URL --election ID

import { readFile, writeFile, access } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { createHttpClient, type ApiClient } from '@evoting/api'
import { generateTrusteeKey, partialDecrypt, verifyElection, type TrusteeKeyPair } from '@evoting/crypto'

interface KeyFile extends TrusteeKeyPair {
  api: string
  createdAt: string
}

const ok = (s: string) => console.log(`  \x1b[32m✓\x1b[0m ${s}`)
const bad = (s: string) => console.log(`  \x1b[31m✗\x1b[0m ${s}`)
const die = (s: string): never => {
  console.error(`\x1b[31mEroare:\x1b[0m ${s}`)
  process.exit(1)
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    api: { type: 'string', default: process.env.EVOTING_API ?? 'http://localhost:3000' },
    election: { type: 'string' },
    trustee: { type: 'string' },
    token: { type: 'string', default: process.env.TRUSTEE_TOKEN },
    key: { type: 'string' },
    out: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
})

const HELP = `CLI trustee – vot electronic verificabil

  keygen   Generează local cheia xᵢ, o salvează într-un fișier și trimite doar Yᵢ cu dovada Schnorr.
           --api URL --election ID --trustee ID --token TOKEN [--out FIȘIER]
  decrypt  După închiderea votului: verifică board-ul și agregatul, apoi trimite decriptarea parțială.
           --key FIȘIER --token TOKEN [--api URL]
  status   Arată starea scrutinului și a trustees.
           --api URL --election ID

Token-ul se poate da și prin variabila de mediu TRUSTEE_TOKEN.`

async function keygen(api: ApiClient) {
  const electionId = values.election ?? die('lipsește --election')
  const trusteeId = values.trustee ?? die('lipsește --trustee')
  const token = values.token ?? die('lipsește --token (sau TRUSTEE_TOKEN)')
  const out = values.out ?? `${trusteeId}.trustee-key.json`
  try {
    await access(out)
    die(`fișierul ${out} există deja; nu suprascriu o cheie existentă`)
  } catch {
    // nu există, bine
  }

  const election = await api.getElection(electionId)
  const trustee = election.trustees.find((t) => t.id === trusteeId) ?? die(`trustee-ul ${trusteeId} nu există în scrutin`)
  if (trustee.publicKeyShare) die('acest trustee și-a trimis deja cheia')
  console.log(`Scrutin: ${election.title}\nTrustee: ${trustee.name}\n`)

  const { keyPair, publicKey } = generateTrusteeKey(electionId, trusteeId)
  const file: KeyFile = { ...keyPair, api: values.api!, createdAt: new Date().toISOString() }
  // fișierul se scrie înainte de trimitere: dacă trimiterea reușește, cheia nu se poate pierde
  await writeFile(out, JSON.stringify(file, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
  ok(`cheia secretă xᵢ salvată în ${out} (permisiuni 600). Păstreaz-o offline până la numărare.`)

  const updated = await api.submitTrusteeKey(electionId, token, publicKey)
  ok(`Yᵢ = ${publicKey.publicKeyShare.slice(0, 16)}… trimisă, cu dovada Schnorr`)
  if (updated.publicKey) ok(`toți trustees au trimis cheile; cheia scrutinului Y = ${updated.publicKey.slice(0, 16)}…`)
  else console.log(`  Mai lipsesc ${updated.trustees.filter((t) => !t.publicKeyShare).length} chei.`)
}

async function decrypt(apiUrl: string | undefined) {
  const keyPath = values.key ?? die('lipsește --key')
  const key = JSON.parse(await readFile(keyPath, 'utf8')) as KeyFile
  const api = createHttpClient(apiUrl ?? key.api)
  const token = values.token ?? die('lipsește --token (sau TRUSTEE_TOKEN)')
  const bundle = await api.getAuditBundle(key.electionId)
  const e = bundle.election
  console.log(`Scrutin: ${e.title} (${e.status})\nBuletine pe board: ${bundle.board.length}\n`)
  if (e.status !== 'closed') die('decriptarea se face doar după închiderea votului, înainte de publicarea rezultatului')
  const me = e.trustees.find((t) => t.id === key.trusteeId) ?? die('cheia nu aparține unui trustee al acestui scrutin')
  if (me.publicKeyShare !== key.publicKeyShare) die('cheia publică din fișier diferă de cea înregistrată pe server')
  if (me.partialDecryptionSubmitted) die('decriptarea parțială a fost deja trimisă')

  // Trustee-ul nu decriptează orbește: verifică întâi board-ul și că agregatul e suma lui.
  // Altfel un server rău-intenționat i-ar putea cere să decripteze un buletin individual.
  console.log('Verific board-ul înainte de decriptare…')
  const report = await verifyElection({ ...bundle, result: null })
  for (const s of report.steps) {
    if (s.id === 'decryption') continue
    if (s.status === 'fail') {
      bad(s.title)
      for (const f of s.failures.slice(0, 5)) console.log(`      ${f.where}: ${f.message}`)
    } else ok(s.title)
  }
  if (!report.ok) die('verificarea a picat; nu trimit decriptarea parțială')

  const partial = partialDecrypt(key, bundle.tally.aggregate!)
  const updated = await api.submitPartialDecryption(key.electionId, token, partial)
  ok(`decriptarea parțială (${partial.shares.length} valori Dᵢⱼ cu dovezi Chaum-Pedersen) a fost trimisă`)
  if (updated.status === 'tallied') {
    const result = await api.getResult(key.electionId)
    ok('toți trustees au decriptat; rezultatul e publicat:')
    for (const c of updated.candidates) console.log(`      ${c.name}: ${result.counts.find((x) => x.candidateId === c.id)?.votes ?? 0}`)
  } else {
    console.log(`  Mai lipsesc ${updated.trustees.filter((t) => !t.partialDecryptionSubmitted).length} decriptări.`)
  }
}

async function status(api: ApiClient) {
  const e = await api.getElection(values.election ?? die('lipsește --election'))
  console.log(`${e.title}\nStare: ${e.status}\nCheia scrutinului: ${e.publicKey ?? '—'}\nBuletine: ${e.stats.ballots}\n`)
  for (const t of e.trustees) {
    console.log(`  ${t.name} (${t.id}): cheie ${t.publicKeyShare ? '✓' : '—'}, decriptare ${t.partialDecryptionSubmitted ? '✓' : '—'}`)
  }
}

try {
  const [command] = positionals
  if (values.help || !command) console.log(HELP)
  else if (command === 'keygen') await keygen(createHttpClient(values.api!))
  else if (command === 'decrypt') await decrypt(process.argv.includes('--api') ? values.api : undefined)
  else if (command === 'status') await status(createHttpClient(values.api!))
  else die(`comandă necunoscută: ${command}\n\n${HELP}`)
} catch (err) {
  die(err instanceof Error ? err.message : String(err))
}
