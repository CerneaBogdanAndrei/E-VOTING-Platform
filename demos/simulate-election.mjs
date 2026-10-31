// Alegeri simulate cap-coadă prin API-ul real, cu CLI-urile adevărate pentru
// trustees și verificare (etapa „MVP” din plan și testele de integrare la scară).
//
//   1. pornește backend-ul:  RATE_LIMIT=off npm run dev:backend
//   2. rulează:              node demos/simulate-election.mjs [--voters 100] [--server URL] [--password comisie]
//
// La final, verificatorul public trebuie să treacă. Fișierele (CNP-uri fictive,
// cheile trustees, registrul) rămân în demos/out/.

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { generateCnp, generateCredential } from '@evoting/crypto'
import { createApiClient, vote } from '@evoting/api'

const { values } = parseArgs({
  options: {
    server: { type: 'string', default: process.env.EVOTING_SERVER ?? 'http://localhost:3000' },
    password: { type: 'string', default: process.env.ADMIN_PASSWORD ?? 'comisie' },
    voters: { type: 'string', default: '50' },
    eligible: { type: 'string' },
    concurrency: { type: 'string', default: '8' },
  },
})
const N = Number(values.voters)
const ELIGIBLE = Number(values.eligible ?? Math.ceil(N * 1.3))
const out = fileURLToPath(new URL('./out/', import.meta.url))
mkdirSync(out, { recursive: true })
const root = fileURLToPath(new URL('..', import.meta.url))
const cli = (tool, args) => execFileSync('node', [`${root}tools/${tool}/dist/cli.js`, ...args], { stdio: 'inherit', cwd: out })
const step = (s) => console.log(`\n\x1b[1m▸ ${s}\x1b[0m`)
const t0 = Date.now()

let token = null
const api = createApiClient(values.server, { adminToken: () => token })

step('Comisia se autentifică și creează scrutinul')
token = (await api.adminLogin(values.password)).token
const candidates = [
  { name: 'Andrei Munteanu', description: 'Calculatoare, anul III' },
  { name: 'Ioana Dumitrescu', description: 'Automatică, anul II' },
  { name: 'Mihai Stoica', description: 'Electronică, anul IV' },
]
let election = await api.createElection({
  title: `Simulare ${new Date().toLocaleString('ro-RO')} (${N} alegători)`,
  opensAt: new Date().toISOString(),
  closesAt: new Date(Date.now() + 86_400_000).toISOString(),
  candidates,
  trustees: [{ name: 'Comisia electorală' }, { name: 'Observatori independenți' }, { name: 'Reprezentanții candidaților' }],
})
console.log(`  ${election.id}`)

step(`Comisia importă ${ELIGIBLE} CNP-uri fictive (serverul păstrează doar HMAC-ul)`)
const cnps = Array.from({ length: ELIGIBLE }, () => generateCnp())
writeFileSync(`${out}${election.id}.eligibili.csv`, ['cnp', ...cnps].join('\n'))
console.log(' ', await api.importEligible(election.id, ['cnp', ...cnps].join('\n')))

step('Fiecare trustee rulează CLI-ul: cheia secretă rămâne local, la server ajunge doar Yᵢ')
const codes = {}
for (const t of election.trustees) {
  codes[t.id] = (await api.trusteeInvite(election.id, t.id)).code
  cli('trustee', ['keygen', '--server', values.server, '--election', election.id, '--trustee', t.id, '--code', codes[t.id]])
}

step('Comisia deschide votul')
election = await api.openElection(election.id)

step(`${N} alegători se înregistrează și votează (criptare + dovezi ZK pe „telefon”)`)
const tVote = Date.now()
const tallyExpected = candidates.map(() => 0)
let done = 0
const queue = cnps.slice(0, N)
await Promise.all(
  Array.from({ length: Number(values.concurrency) }, async () => {
    for (let cnp = queue.shift(); cnp; cnp = queue.shift()) {
      const cred = generateCredential()
      await api.registerOcr(election.id, { cnp, credentialPubkey: cred.publicKey })
      const choice = Math.random() < 0.45 ? 0 : Math.random() < 0.6 ? 1 : 2
      tallyExpected[choice]++
      await vote(api, election, cred, choice)
      if (++done % 25 === 0 || done === N) process.stdout.write(`\r  ${done}/${N} buletine pe board`)
    }
  }),
)
console.log(`  (${((Date.now() - tVote) / 1000).toFixed(1)} s)`)

step('Comisia închide votul; serverul calculează agregatul homomorf')
election = await api.closeElection(election.id)
const head = (await api.getBoardHead(election.id)).hash
writeFileSync(`${out}${election.id}.head.txt`, head + '\n')
console.log(`  Capul lanțului (de publicat pe site-ul facultății): ${head}`)

step('Fiecare trustee verifică board-ul și trimite decriptarea parțială')
for (const t of election.trustees) cli('trustee', ['decrypt', '--server', values.server, '--election', election.id, '--trustee', t.id, '--code', codes[t.id]])

step('Rezultatul publicat')
const result = await api.getResult(election.id)
result.counts.forEach((c, i) => console.log(`  ${candidates[i].name.padEnd(22)} ${String(c.votes).padStart(5)}  (așteptat ${tallyExpected[i]})`))
const correct = result.counts.every((c, i) => c.votes === tallyExpected[i])
console.log(correct ? '  \x1b[32m✓ identic cu voturile trimise\x1b[0m' : '  \x1b[31m✗ diferă de voturile trimise\x1b[0m')

step('Un observator oarecare rulează verificatorul public')
cli('verifier', ['--server', values.server, '--election', election.id, '--anchor', head, '--save', `${election.id}.registru.json`])
console.log(`\nGata în ${((Date.now() - t0) / 1000).toFixed(1)} s. Fișiere în demos/out/.`)
process.exit(correct ? 0 : 1)
