// Metricile de performanță din plan, măsurate pe calculator (Node).
// Rulare: npm run bench [-- numărDeBuletine]   (implicit 1000)
import * as C from '../dist/index.js'

const N = Number(process.argv[2] ?? 1000)
const candidates = ['A', 'B', 'C']
const electionId = 'bench'
const keys = [1, 2, 3].map((i) => C.generateTrusteeKey(electionId, `t${i}`))
const params = {
  electionId, candidates, minSelections: 1, maxSelections: 1,
  trustees: keys.map((k) => ({ id: k.trusteeId, name: k.trusteeId, publicKeyShare: k.publicKeyShare, proof: k.proof })),
  publicKey: C.combinePublicKeys(keys.map((k) => k.publicKeyShare)),
}
const time = (label, fn) => { const t = performance.now(); const r = fn(); const ms = performance.now() - t; console.log(`${label.padEnd(48)} ${ms.toFixed(1).padStart(9)} ms`); return r }

console.log(`ristretto255, ${candidates.length} candidați, 3 trustees, ${N} buletine\n`)
const board = []
const regs = []
time(`criptare + dovezi + semnătură (${N} buletine)`, () => {
  for (let i = 0; i < N; i++) {
    const cred = C.generateCredential(); regs.push(cred.publicKey)
    const enc = C.encryptBallot(params, cred.publicKey, i % 3)
    board.push(C.makeEntry(electionId, board.at(-1) ?? null, C.signBallot(enc.body, cred.secretKey), new Date().toISOString()))
  }
})
time('validarea unui buletin (server, medie)', () => { for (let i = 0; i < 100; i++) C.verifyBallot(params, board[i % N].ballot) })
const aggregate = time('agregare homomorfă', () => C.computeAggregate(3, board.map((e) => e.ballot)))
const partials = time('decriptări parțiale (3 trustees)', () => keys.map((k) => C.partialDecrypt(k, aggregate)))
const counts = time('combinare + baby-step giant-step', () => C.combineDecryptions(aggregate, partials, N))
const report = await (async () => { const t = performance.now(); const r = await C.verifyElectionRecord({ version: 1, title: '', status: 'tallied', params, registrations: regs, board, tally: { ballotCount: N, aggregate, partials, counts } }); console.log(`${'verificare publică completă'.padEnd(48)} ${(performance.now() - t).toFixed(1).padStart(9)} ms`); return r })()
console.log(`\nrezultat: ${counts.join(' / ')}, verificator: ${report.ok ? 'TRECE' : 'PICĂ'}`)
