// Zona MRZ a actelor de identitate (ICAO 9303): parsare, cifre de control și
// extragerea CNP-ului. Aceeași funcție rulează pe telefon (după OCR) și pe
// server (pe DG1 citit prin NFC).
//
// Formate: TD1 (3 rânduri × 30, cartea electronică de identitate), TD2 (2 × 36,
// buletinul vechi), TD3 (2 × 44, pașaport).
//
// Unde stă CNP-ul (întrebare deschisă în plan, de confirmat pe documente reale):
//   • dacă MRZ-ul conține 13 cifre consecutive care formează un CNP valid, acela e CNP-ul;
//   • altfel, la buletinul vechi, câmpul opțional conține prima cifră a CNP-ului și
//     ultimele 6, iar data nașterii din MRZ dă cifrele 2–7: CNP = S + AALLZZ + JJNNNC.

import { checkCnp } from './cnp.js'

const WEIGHTS = [7, 3, 1]

function charValue(ch: string): number {
  if (ch === '<') return 0
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 55
  return -1
}

/** Cifra de control ICAO: suma ponderată 7-3-1 modulo 10. */
export function mrzCheckDigit(field: string): number {
  let sum = 0
  for (let i = 0; i < field.length; i++) {
    const v = charValue(field[i])
    if (v < 0) return -1
    sum += v * WEIGHTS[i % 3]
  }
  return sum % 10
}

export interface MrzField {
  name: string
  value: string
  ok: boolean
}

export interface ParsedMrz {
  format: 'TD1' | 'TD2' | 'TD3'
  documentNumber: string
  nationality: string
  birthDate: string
  sex: string
  expiryDate: string
  surname: string
  givenNames: string
  /** Rezultatul fiecărei cifre de control: o citire OCR greșită pică aici. */
  checks: MrzField[]
  valid: boolean
  cnp: string | null
  lines: string[]
}

/** Normalizează textul (OCR sau DG1): litere mari, fără spații, rânduri de lungime cunoscută. */
export function mrzLines(text: string): string[] {
  const raw = text
    .toUpperCase()
    .replace(/[«‹]/g, '<')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ''))
    .filter(Boolean)
  if (raw.length >= 2) return raw
  // Un singur șir (de exemplu, din DG1): îl împărțim după lungimea totală.
  const s = raw[0] ?? ''
  if (s.length === 90) return [s.slice(0, 30), s.slice(30, 60), s.slice(60)]
  if (s.length === 72) return [s.slice(0, 36), s.slice(36)]
  if (s.length === 88) return [s.slice(0, 44), s.slice(44)]
  return raw
}

const names = (field: string) => {
  const [surname, given = ''] = field.split('<<')
  return { surname: surname.replace(/</g, ' ').trim(), givenNames: given.replace(/</g, ' ').trim() }
}

const check = (name: string, field: string, digit: string): MrzField => ({ name, value: field, ok: mrzCheckDigit(field) === Number(digit) && /\d/.test(digit) })

export function parseMrz(text: string): ParsedMrz | null {
  const lines = mrzLines(text)
  let p: Omit<ParsedMrz, 'valid' | 'cnp' | 'lines'> & { optional: string[] }
  if (lines.length === 3 && lines.every((l) => l.length === 30)) {
    const [l1, l2, l3] = lines
    p = {
      format: 'TD1',
      documentNumber: l1.slice(5, 14).replace(/</g, ''),
      nationality: l2.slice(15, 18),
      birthDate: l2.slice(0, 6),
      sex: l2[7],
      expiryDate: l2.slice(8, 14),
      ...names(l3),
      optional: [l1.slice(15, 30), l2.slice(18, 29)],
      checks: [
        check('număr document', l1.slice(5, 14), l1[14]),
        check('data nașterii', l2.slice(0, 6), l2[6]),
        check('data expirării', l2.slice(8, 14), l2[14]),
        check('control general', l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29), l2[29]),
      ],
    }
  } else if (lines.length === 2 && (lines[0].length === 36 || lines[0].length === 44) && lines[1].length === lines[0].length) {
    const [l1, l2] = lines
    const td3 = l1.length === 44
    const optEnd = td3 ? 42 : 35
    p = {
      format: td3 ? 'TD3' : 'TD2',
      documentNumber: l2.slice(0, 9).replace(/</g, ''),
      nationality: l2.slice(10, 13),
      birthDate: l2.slice(13, 19),
      sex: l2[20],
      expiryDate: l2.slice(21, 27),
      ...names(l1.slice(5)),
      optional: [l2.slice(28, optEnd)],
      checks: [
        check('număr document', l2.slice(0, 9), l2[9]),
        check('data nașterii', l2.slice(13, 19), l2[19]),
        check('data expirării', l2.slice(21, 27), l2[27]),
        check('control general', l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, optEnd + (td3 ? 1 : 0)), l2[td3 ? 43 : 35]),
      ],
    }
  } else {
    return null
  }
  const { optional, ...rest } = p
  return { ...rest, valid: p.checks.every((c) => c.ok), cnp: cnpFromMrz(lines.join(''), p.birthDate, optional), lines }
}

/** Caută CNP-ul în MRZ (vezi comentariul de la începutul fișierului). */
export function cnpFromMrz(mrz: string, birthDate?: string, optional: string[] = []): string | null {
  for (const m of mrz.matchAll(/(?=(\d{13}))/g)) if (checkCnp(m[1]).ok) return m[1]
  if (birthDate && /^\d{6}$/.test(birthDate)) {
    for (const field of optional) {
      const digits = field.replace(/</g, '')
      const m = /^(\d)(\d{6})/.exec(digits)
      if (m) {
        const cnp = m[1] + birthDate + m[2]
        if (checkCnp(cnp).ok) return cnp
      }
    }
  }
  return null
}

/** Construiește un MRZ TD1 valid (cu cifre de control), pentru teste și documente de demo. */
export function buildTd1(opts: { documentNumber: string; birthDate: string; sex: 'M' | 'F'; expiryDate: string; surname: string; givenNames: string; cnp: string }): string[] {
  const fit = (s: string, n: number) => (s.toUpperCase().replace(/[^A-Z0-9<]/g, '<') + '<'.repeat(n)).slice(0, n)
  const doc = fit(opts.documentNumber, 9)
  const l1 = `IDROU${doc}${mrzCheckDigit(doc)}${fit(opts.cnp, 15)}`
  const l2head = `${opts.birthDate}${mrzCheckDigit(opts.birthDate)}${opts.sex}${opts.expiryDate}${mrzCheckDigit(opts.expiryDate)}ROU${fit('', 11)}`
  const composite = l1.slice(5, 30) + l2head.slice(0, 7) + l2head.slice(8, 15) + l2head.slice(18, 29)
  const l2 = l2head + mrzCheckDigit(composite)
  const l3 = fit(`${opts.surname.replace(/\s+/g, '<')}<<${opts.givenNames.replace(/\s+/g, '<')}`, 30)
  return [l1, l2, l3]
}
