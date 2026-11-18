import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { addCiphertexts, babyStepGiantStep, decodeCiphertext, decryptToPoint, encodeSmall, encrypt } from '../src/index.js'
import { testKey } from './helpers.js'

describe('ElGamal exponențial', () => {
  it('criptare și decriptare', () => {
    const { x, publicKey } = testKey()
    for (const m of [0, 1, 7]) {
      const ct = decodeCiphertext(encrypt(publicKey, m))
      assert.ok(decryptToPoint(x, ct).equals(encodeSmall(m)))
    }
  })

  it('același vot dă de fiecare dată alt criptotext', () => {
    const { publicKey } = testKey()
    const a = encrypt(publicKey, 1)
    const b = encrypt(publicKey, 1)
    assert.notEqual(a.a, b.a)
    assert.notEqual(a.b, b.b)
  })

  it('proprietatea homomorfă: suma criptotextelor criptează suma voturilor', () => {
    const { x, publicKey } = testKey()
    const votes = [1, 0, 1, 1, 0, 1]
    const sum = addCiphertexts(votes.map((m) => decodeCiphertext(encrypt(publicKey, m))))
    assert.ok(decryptToPoint(x, sum).equals(encodeSmall(4)))
  })

  it('baby-step giant-step găsește totaluri mici, inclusiv 0 și maximul', () => {
    for (const [t, max] of [
      [0, 0],
      [0, 10],
      [10, 10],
      [37, 100],
      [999, 1000],
      [4321, 10000],
    ]) {
      assert.equal(babyStepGiantStep(encodeSmall(t), max), t)
    }
    assert.equal(babyStepGiantStep(encodeSmall(11), 10), null)
  })
})
