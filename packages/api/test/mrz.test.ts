import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildTd1, buildTd2, mrzCheckDigit, parseMrz } from '../src/index.js'

const NOW = new Date('2026-10-26T12:00:00Z')

describe('MRZ', () => {
  it('cifra de control ICAO pe exemplele din documentul 9303', () => {
    assert.equal(mrzCheckDigit('D23145890'), 7)
    assert.equal(mrzCheckDigit('740812'), 2)
    assert.equal(mrzCheckDigit('120415'), 9)
  })

  it('exemplul ICAO TD1 trece toate cifrele de control', () => {
    const mrz = parseMrz('I<UTOD231458907<<<<<<<<<<<<<<<\n7408122F1204159UTO<<<<<<<<<<<6\nERIKSSON<<ANNA<MARIA<<<<<<<<<<', NOW)!
    assert.equal(mrz.format, 'TD1')
    assert.equal(mrz.valid, true)
    assert.equal(mrz.surname, 'ERIKSSON')
    assert.equal(mrz.givenNames, 'ANNA MARIA')
    assert.equal(mrz.birthDate, '1974-08-12')
    assert.equal(mrz.documentNumber, 'D23145890')
  })

  it('exemplul ICAO TD2 trece toate cifrele de control', () => {
    const mrz = parseMrz('I<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<\nD231458907UTO7408122F1204159<<<<<<<6', NOW)!
    assert.equal(mrz.format, 'TD2')
    assert.equal(mrz.valid, true)
    assert.equal(mrz.expiryDate, '2012-04-15')
    assert.equal(mrz.expired, true)
  })

  const person = { surname: 'Popescu', givenNames: 'Andrei Mihai', documentNumber: 'GL123456', cnp: '5040312170018', sex: 'M' as const, expiry: '310428' }

  it('buletinul vechi (TD2): CNP-ul se reconstituie din prima cifră, data nașterii și ultimele șase cifre', () => {
    const text = buildTd2(person)
    assert.equal(text.split('\n')[1].length, 36)
    const mrz = parseMrz(text, NOW)!
    assert.equal(mrz.valid, true)
    assert.equal(mrz.cnp, person.cnp)
    assert.equal(mrz.surname, 'POPESCU')
    assert.equal(mrz.expired, false)
  })

  it('CEI (TD1): CNP-ul din câmpul opțional', () => {
    const mrz = parseMrz(buildTd1(person), NOW)!
    assert.equal(mrz.format, 'TD1')
    assert.equal(mrz.valid, true)
    assert.equal(mrz.cnp, person.cnp)
  })

  it('textul OCR cu zgomot și confuzii O/0 se citește, iar o cifră greșită e prinsă', () => {
    const [l1, l2] = buildTd2(person).split('\n')
    const mrz = parseMrz(`ROMANIA CARTE DE IDENTITATE\n${l1.replace(/<</, '« ')}\n${l2.replace(/0/, 'O')}`, NOW)
    assert.ok(mrz)
    assert.equal(mrz!.cnp, person.cnp)
    const broken = l2.slice(0, 15) + ((Number(l2[15]) + 1) % 10) + l2.slice(16)
    assert.equal(parseMrz(`${l1}\n${broken}`, NOW)!.valid, false)
  })

  it('un text fără zonă MRZ dă null', () => {
    assert.equal(parseMrz('ROMANIA\nCARTE DE IDENTITATE\nPOPESCU ANDREI', NOW), null)
  })
})
