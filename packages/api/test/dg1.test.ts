import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { base64ToBytes, buildTd1, buildTd2, bytesToBase64, dg1FromMrz, mrzFromDg1 } from '../src/index.js'

const person = { surname: 'Popescu', givenNames: 'Andrei Mihai', documentNumber: 'GL123456', cnp: '5040312170018', sex: 'M' as const, expiry: '310428' }

describe('DG1', () => {
  it('împachetează și despachetează MRZ-ul TD1 și TD2', () => {
    for (const text of [buildTd1(person), buildTd2(person)]) assert.equal(mrzFromDg1(dg1FromMrz(text)), text)
  })

  it('respinge un DG1 fără eticheta 61 sau fără MRZ', () => {
    assert.throws(() => mrzFromDg1(new Uint8Array([0x62, 0x01, 0x00])), /61/)
    assert.throws(() => mrzFromDg1(new Uint8Array([0x61, 0x03, 0x5f, 0x1f, 0x00])), /lungime/)
  })

  it('base64 e reversibil', () => {
    const bytes = dg1FromMrz(buildTd1(person))
    assert.deepEqual(base64ToBytes(bytesToBase64(bytes)), bytes)
  })
})
