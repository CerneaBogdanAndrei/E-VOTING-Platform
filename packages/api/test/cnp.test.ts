import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkCnp, generateCnp } from '../src/index.js'

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
})
