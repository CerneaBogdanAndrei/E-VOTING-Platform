import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkCnp, generateCnp, parseCnpList } from '../src/index.js'

describe('CNP', () => {
  it('validează cifra de control și data', () => {
    assert.deepEqual(checkCnp('1960101400011'), { ok: true })
    assert.equal(checkCnp('1960101400017').ok, false)
    assert.equal(checkCnp('1961301400011').ok, false)
  })

  it('respinge formatul, prima cifră și județul greșite', () => {
    assert.equal(checkCnp('123').ok, false)
    assert.equal(checkCnp('0960101400011').ok, false)
    assert.equal(checkCnp('1960101990011').ok, false)
  })

  it('generatorul produce doar CNP-uri valide', () => {
    let seed = 1
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 200; i++) assert.ok(checkCnp(generateCnp(rand)).ok)
  })

  it('lista CSV: antetul, coloanele, ghilimelele, CRLF și liniile greșite (cu numărul lor)', () => {
    const csv = ['cnp;nume', '"1960101400011";Ana', '', '5040312170018,Bogdan', '1960101400017', 'cnp'].join('\r\n')
    assert.deepEqual(parseCnpList(csv), {
      valid: ['1960101400011', '5040312170018'],
      invalid: [
        { line: 5, value: '1960101400017' },
        { line: 6, value: 'cnp' },
      ],
    })
    assert.deepEqual(parseCnpList(''), { valid: [], invalid: [] })
  })
})
