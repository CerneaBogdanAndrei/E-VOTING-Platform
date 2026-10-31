// Demonstrația 5: serverul (sau cine a spart baza de date) modifică board-ul.
// Descarcă registrul unui scrutin numărat, face pe rând câte o manipulare și
// rulează verificatorul public pe fiecare variantă: verificatorul pică și spune unde.
//   node demos/attacks/5-tamper-board.mjs --election ID [--server URL]
import { parseArgs } from 'node:util'
import { G, encryptBallot, generateCredential, makeEntry, pointFromHex, pointToHex, signBallot, verifyElectionRecord } from '@evoting/crypto'
import { createApiClient } from '@evoting/api'

const { values } = parseArgs({ options: { server: { type: 'string', default: process.env.EVOTING_SERVER ?? 'http://localhost:3000' }, election: { type: 'string' } } })
if (!values.election) throw new Error('lipsește --election (un scrutin numărat, de exemplu din simulate-election.mjs)')
const record = await createApiClient(values.server).getRecord(values.election)
if (record.board.length < 3 || !record.tally) throw new Error('scrutinul trebuie să fie numărat și să aibă cel puțin 3 buletine')
const clone = () => structuredClone(record)

const attacks = [
  ['Original, nemodificat', (r) => r],
  ['Un vot în plus pentru candidatul 1 în buletinul #2 (B + G)', (r) => { const ct = r.board[1].ballot.ciphertexts[0]; ct.b = pointToHex(pointFromHex(ct.b).add(G)); return r }],
  ['Buletinul #2 șters', (r) => { r.board.splice(1, 1); return r }],
  ['Ballot stuffing: buletin nou, cu un credential neînregistrat, lanț recalculat corect', (r) => {
    const cred = generateCredential()
    const ballot = signBallot(encryptBallot(r.params, cred.publicKey, 0).body, cred.secretKey)
    r.board.push(makeEntry(r.params.electionId, r.board.at(-1), ballot, new Date().toISOString()))
    return r
  }],
  ['Rezultat publicat falsificat (+5 pentru candidatul 2)', (r) => { r.tally.counts[1] += 5; return r }],
  ['Un trustee trișează la decriptare', (r) => { const s = r.tally.partials[0].shares[0]; s.d = pointToHex(pointFromHex(s.d).add(G)); return r }],
]

for (const [label, mutate] of attacks) {
  const report = await verifyElectionRecord(mutate(clone()))
  console.log(`\n\x1b[1m${label}\x1b[0m → ${report.ok ? '\x1b[32mverificatorul TRECE\x1b[0m' : '\x1b[31mverificatorul PICĂ\x1b[0m'}`)
  for (const s of report.steps.filter((x) => !x.ok)) for (const p of s.problems.slice(0, 3)) console.log(`   ✗ [${s.title}] ${p}`)
}
