import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canonicalJson, cnpHmac, hexToBytes, hmacSha256Hex, pointFromHex, randomScalar, scalarFromHex, scalarToHex } from '../src/index.js'

describe('codificări și hash-uri', () => {
  it('JSON canonic nu depinde de ordinea cheilor', () => {
    assert.equal(canonicalJson({ b: 1, a: [2, { d: 'x', c: null }] }), canonicalJson({ a: [2, { c: null, d: 'x' }], b: 1 }))
    assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}')
  })

  it('JSON canonic ignoră câmpurile undefined și respinge valorile instabile', () => {
    assert.equal(canonicalJson({ a: 1, b: undefined }), '{"a":1}')
    assert.throws(() => canonicalJson({ a: Number.NaN }))
    assert.throws(() => canonicalJson({ a: () => 1 }))
  })

  it('HMAC-SHA256 respectă vectorul de test RFC 4231 (cazul 1)', () => {
    const key = hexToBytes('0b'.repeat(20))
    assert.equal(hmacSha256Hex(key, 'Hi There'), 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7')
  })

  it('HMAC(CNP) diferă la chei diferite și e determinist la aceeași cheie', () => {
    const k1 = '11'.repeat(32)
    const k2 = '22'.repeat(32)
    assert.equal(cnpHmac(k1, '5040312170011'), cnpHmac(k1, '5040312170011'))
    assert.notEqual(cnpHmac(k1, '5040312170011'), cnpHmac(k2, '5040312170011'))
  })

  it('scalarii se codifică reversibil și se resping valorile ≥ q', () => {
    const s = randomScalar()
    assert.equal(scalarFromHex(scalarToHex(s)), s)
    assert.throws(() => scalarFromHex('ff'.repeat(32)))
    assert.throws(() => pointFromHex('ff'.repeat(32)))
  })

  it('hex-ul de lungime greșită sau cu caractere invalide e respins', () => {
    assert.throws(() => scalarFromHex('ab'))
    assert.throws(() => scalarFromHex('zz'.repeat(32)))
    assert.throws(() => pointFromHex(42))
  })
})
