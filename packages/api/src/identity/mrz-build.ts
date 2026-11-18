// Construiește MRZ-uri de test (buletin vechi TD2, CEI TD1) pentru demonstrații,
// teste și cipurile simulate. Parserul e în mrz.ts.

import { mrzCheckDigit } from './mrz.js'

export interface MrzInput {
  surname: string
  givenNames: string
  documentNumber: string
  cnp: string
  sex: 'M' | 'F'
  /** AALLZZ */
  expiry: string
}

const pad = (s: string, len: number) => s.padEnd(len, '<').slice(0, len)
const withCheck = (s: string) => s + mrzCheckDigit(s)

const nameField = (surname: string, given: string, len: number) =>
  pad(`${surname.toUpperCase().replace(/[^A-Z]+/g, '<')}<<${given.toUpperCase().replace(/[^A-Z]+/g, '<')}`, len)

/** MRZ TD2 de test, în formatul cărții de identitate vechi. */
export function buildTd2(input: MrzInput): string {
  const birth = input.cnp.slice(1, 7)
  const doc = withCheck(pad(input.documentNumber, 9))
  const birthC = withCheck(birth)
  const expC = withCheck(input.expiry)
  const optional = input.cnp[0] + input.cnp.slice(7)
  const composite = mrzCheckDigit(doc + birthC + expC + optional)
  return [`IDROU${nameField(input.surname, input.givenNames, 31)}`, `${doc}ROU${birthC}${input.sex}${expC}${optional}${composite}`].join('\n')
}

/** MRZ TD1 de test, în formatul CEI, cu CNP-ul în câmpul opțional al primului rând. */
export function buildTd1(input: MrzInput): string {
  const birth = input.cnp.slice(1, 7)
  const doc = withCheck(pad(input.documentNumber, 9))
  const l1 = `IDROU${doc}${pad(input.cnp, 15)}`
  const l2head = `${withCheck(birth)}${input.sex}${withCheck(input.expiry)}ROU`
  const opt2 = pad('', 11)
  const composite = mrzCheckDigit(l1.slice(5, 30) + withCheck(birth) + withCheck(input.expiry) + opt2)
  return [l1, `${l2head}${opt2}${composite}`, nameField(input.surname, input.givenNames, 30)].join('\n')
}
