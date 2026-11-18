import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  combinePartialDecryptions,
  computeAggregate,
  decodeCiphertext,
  decryptToPoint,
  encodeSmall,
  G,
  generateTrusteeKey,
  partialDecrypt,
  pointFromHex,
  pointToHex,
  scalarFromHex,
  verifyPartialDecryption,
  verifyTrusteeKey,
} from '../src/index.js'
import { clone, simulateElection } from './helpers.js'

describe('trustees și decriptarea', () => {
  it('dovada Schnorr a cheii e legată de scrutin și de trustee', () => {
    const { publicKey } = generateTrusteeKey('e1', 't1')
    assert.ok(verifyTrusteeKey('e1', publicKey))
    assert.ok(!verifyTrusteeKey('e2', publicKey))
    assert.ok(!verifyTrusteeKey('e1', { ...publicKey, trusteeId: 't2' }))
  })

  it('o cheie publică care nu e un punct valid sau o dovadă stricată sunt respinse fără excepție', () => {
    const { publicKey } = generateTrusteeKey('e1', 't1')
    assert.ok(!verifyTrusteeKey('e1', { ...publicKey, publicKeyShare: 'zz' }))
    assert.ok(!verifyTrusteeKey('e1', { ...publicKey, proof: { c: publicKey.proof.c, s: 'nu-e-hex' } }))
  })

  it('cheia secretă trebuie să corespundă cheii publice la decriptare', () => {
    const sim = simulateElection('e-key', 2, [0, 1])
    const wrong = { ...sim.trusteeKeys[0], publicKeyShare: sim.trusteeKeys[1].publicKeyShare }
    assert.throws(() => partialDecrypt(wrong, sim.bundle.tally!.aggregate!), /nu corespunde/)
  })

  it('decriptarea cere toți trustees și dă totalurile corecte', () => {
    const sim = simulateElection('e-dec', 3, [0, 1, 1, 2, 1, 0, 1])
    const aggregate = sim.bundle.tally!.aggregate!
    const partials = sim.trusteeKeys.map((k) => partialDecrypt(k, aggregate))
    assert.deepEqual(combinePartialDecryptions(aggregate, partials, 7), [2, 4, 1])
    // fără un trustee, rezultatul nu se poate afla
    assert.throws(() => combinePartialDecryptions(aggregate, partials.slice(0, 2), 7))
  })

  it('un trustee care trișează la decriptarea parțială e detectat', () => {
    const sim = simulateElection('e-cheat', 2, [0, 1, 1])
    const aggregate = sim.bundle.tally!.aggregate!
    const honest = partialDecrypt(sim.trusteeKeys[0], aggregate)
    const cheat = clone(honest)
    cheat.shares[1] = pointToHex(pointFromHex(cheat.shares[1]).add(G))
    const y = sim.bundle.election.trustees[0].publicKeyShare!
    assert.deepEqual(verifyPartialDecryption('e-cheat', y, aggregate, honest), { ok: true })
    assert.equal(verifyPartialDecryption('e-cheat', y, aggregate, cheat).ok, false)
  })

  it('agregatul nu se poate decripta fără cheia completă', () => {
    const sim = simulateElection('e-agg', 2, [1, 1, 0])
    const ct = decodeCiphertext(computeAggregate(2, sim.bundle.board)[0])
    const x1 = scalarFromHex(sim.trusteeKeys[0].secretKey)
    assert.ok(!decryptToPoint(x1, ct).equals(encodeSmall(1)))
  })
})
