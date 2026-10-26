// Zona MRZ (ICAO 9303) a actelor de identitate românești. Textul vine din OCR
// (telefon) sau din DG1 (cipul CEI), iar cifrele de control validează citirea.
//
//   TD2, 2 × 36 caractere: cartea de identitate „veche”
//     rândul 2: nr. document(9) c | ROU | data nașterii(6) c | sex | expirare(6) c | opțional(7) | c compus
//     Opționalul conține prima cifră a CNP-ului și ultimele șase: CNP = S + AALLZZ + JJNNNC.
//   TD1, 3 × 30 caractere: cartea electronică de identitate (CEI)
//     CNP-ul se caută în câmpurile opționale; dacă apare ca la TD2 (7 cifre), se reconstituie la fel.
//
// Pozițiile CNP-ului sunt întrebarea deschisă din plan: parserul încearcă variantele
// cunoscute și acceptă doar un CNP valid, cu data nașterii identică celei din MRZ.

import { checkCnp } from './cnp.js'

export type MrzFormat = 'TD1' | 'TD2' | 'TD3'

export interface MrzCheck {
  field: string
  ok: boolean
}

export interface MrzData {
  format: MrzFormat
  lines: string[]
  documentCode: string
  issuingState: string
  documentNumber: string
  surname: string
  givenNames: string
  nationality: string
  /** AAAA-LL-ZZ */
  birthDate: string
  /** AAAA-LL-ZZ */
  expiryDate: string
  sex: 'M' | 'F' | '<'
  optional: string[]
  checks: MrzCheck[]
  /** Toate cifrele de control se potrivesc. */
  valid: boolean
  cnp: string | null
  expired: boolean
}

const VALUES: Record<string, number> = { '<': 0 }
for (let i = 0; i < 10; i++) VALUES[String(i)] = i
for (let i = 0; i < 26; i++) VALUES[String.fromCharCode(65 + i)] = 10 + i
const WEIGHTS = [7, 3, 1]

/** Cifra de control ICAO: ponderi 7, 3, 1, modulo 10. */
export function mrzCheckDigit(text: string): number {
  let sum = 0
  for (let i = 0; i < text.length; i++) sum += (VALUES[text[i]] ?? 0) * WEIGHTS[i % 3]
  return sum % 10
}

const checkOk = (data: string, digit: string) => digit === '<' ? /^<*$/.test(data) : Number(digit) === mrzCheckDigit(data)

/**
 * Curăță textul OCR: majuscule, fără spații, confuziile tipice („«” → „<”),
 * și păstrează rândurile care au lungimea unui format MRZ.
 */
export function normalizeMrzLines(text: string): string[] {
  const lines = text
    .toUpperCase()
    .replace(/[«‹]/g, '<')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 28)
  // ultimele rânduri care formează un bloc MRZ complet
  for (const [count, len] of [
    [3, 30],
    [2, 36],
    [2, 44],
  ] as const) {
    for (let start = lines.length - count; start >= 0; start--) {
      const block = lines.slice(start, start + count)
      if (block.every((l) => Math.abs(l.length - len) <= 1)) return block.map((l) => l.padEnd(len, '<').slice(0, len))
    }
  }
  return lines
}

/** OCR-ul confundă des O cu 0 și I cu 1 în câmpurile numerice. */
const digits = (s: string) => s.replace(/O/g, '0').replace(/[IL]/g, '1').replace(/S/g, '5').replace(/B/g, '8')

function mrzDate(yymmdd: string, kind: 'birth' | 'expiry', now = new Date()): string {
  const yy = Number(yymmdd.slice(0, 2))
  const current = now.getUTCFullYear() % 100
  let century: number
  if (kind === 'birth') century = yy > current ? 1900 : 2000
  else century = yy < current - 50 ? 2100 : 2000
  return `${century + yy}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`
}

function parseName(field: string) {
  const [surname = '', given = ''] = field.replace(/<+$/, '').split('<<')
  return { surname: surname.replace(/</g, ' ').trim(), givenNames: given.replace(/</g, ' ').trim() }
}

const clean = (s: string) => s.replace(/<+$/g, '').replace(/</g, '')

/** CNP-ul candidat: valid și cu aceeași dată de naștere ca MRZ-ul. */
function findCnp(optional: string[], birthYymmdd: string): string | null {
  const candidates: string[] = []
  for (const raw of optional) {
    const field = digits(raw.replace(/</g, ''))
    for (const m of field.matchAll(/\d{13}/g)) candidates.push(m[0])
    // varianta TD2: S + JJNNNC
    const seven = digits(raw).replace(/</g, '').slice(0, 7)
    if (/^\d{7}$/.test(seven)) candidates.push(seven[0] + birthYymmdd + seven.slice(1))
  }
  return candidates.find((c) => checkCnp(c).ok && c.slice(1, 7) === birthYymmdd) ?? null
}

export function parseMrz(text: string, now = new Date()): MrzData | null {
  const lines = normalizeMrzLines(text)
  let data: Omit<MrzData, 'cnp' | 'expired' | 'valid'> & { birth: string }

  if (lines.length === 3 && lines[0].length === 30) {
    const [l1, l2, l3] = lines
    const docNumber = l1.slice(5, 14)
    const birth = digits(l2.slice(0, 6))
    const expiry = digits(l2.slice(8, 14))
    const composite = l1.slice(5, 30) + digits(l2.slice(0, 7)) + digits(l2.slice(8, 15)) + l2.slice(18, 29)
    data = {
      format: 'TD1',
      lines,
      documentCode: clean(l1.slice(0, 2)),
      issuingState: clean(l1.slice(2, 5)),
      documentNumber: clean(docNumber),
      ...parseName(l3),
      nationality: clean(l2.slice(15, 18)),
      birthDate: mrzDate(birth, 'birth', now),
      expiryDate: mrzDate(expiry, 'expiry', now),
      sex: (l2[7] as 'M' | 'F' | '<') ?? '<',
      optional: [l1.slice(15, 30), l2.slice(18, 29)],
      checks: [
        { field: 'numărul documentului', ok: checkOk(docNumber, l1[14]) },
        { field: 'data nașterii', ok: checkOk(birth, digits(l2[6])) },
        { field: 'data expirării', ok: checkOk(expiry, digits(l2[14])) },
        { field: 'cifra de control compusă', ok: checkOk(composite, digits(l2[29])) },
      ],
      birth,
    }
  } else if (lines.length === 2 && (lines[0].length === 36 || lines[0].length === 44)) {
    const [l1, l2] = lines
    const td3 = l1.length === 44
    const docNumber = l2.slice(0, 9)
    const birth = digits(l2.slice(13, 19))
    const expiry = digits(l2.slice(21, 27))
    const optEnd = td3 ? 42 : 35
    const composite = td3
      ? l2.slice(0, 10) + digits(l2.slice(13, 20)) + l2.slice(21, 43)
      : l2.slice(0, 10) + digits(l2.slice(13, 20)) + digits(l2.slice(21, 35))
    data = {
      format: td3 ? 'TD3' : 'TD2',
      lines,
      documentCode: clean(l1.slice(0, 2)),
      issuingState: clean(l1.slice(2, 5)),
      documentNumber: clean(docNumber),
      ...parseName(l1.slice(5)),
      nationality: clean(l2.slice(10, 13)),
      birthDate: mrzDate(birth, 'birth', now),
      expiryDate: mrzDate(expiry, 'expiry', now),
      sex: (l2[20] as 'M' | 'F' | '<') ?? '<',
      optional: [l2.slice(28, optEnd)],
      checks: [
        { field: 'numărul documentului', ok: checkOk(docNumber, l2[9]) },
        { field: 'data nașterii', ok: checkOk(birth, digits(l2[19])) },
        { field: 'data expirării', ok: checkOk(expiry, digits(l2[27])) },
        ...(td3 ? [{ field: 'numărul personal', ok: checkOk(l2.slice(28, 42), digits(l2[42])) }] : []),
        { field: 'cifra de control compusă', ok: checkOk(composite, digits(l2[td3 ? 43 : 35])) },
      ],
      birth,
    }
  } else {
    return null
  }

  const { birth, ...rest } = data
  const today = now.toISOString().slice(0, 10)
  return {
    ...rest,
    valid: rest.checks.every((c) => c.ok),
    cnp: findCnp(rest.optional, birth),
    expired: rest.expiryDate < today,
  }
}

const pad = (s: string, len: number) => s.padEnd(len, '<').slice(0, len)
const withCheck = (s: string) => s + mrzCheckDigit(s)

export interface MrzInput {
  surname: string
  givenNames: string
  documentNumber: string
  cnp: string
  sex: 'M' | 'F'
  expiry: string // AALLZZ
}

const nameField = (surname: string, given: string, len: number) =>
  pad(`${surname.toUpperCase().replace(/[^A-Z]+/g, '<')}<<${given.toUpperCase().replace(/[^A-Z]+/g, '<')}`, len)

/** MRZ TD2 de test, în formatul cărții de identitate vechi (pentru demonstrații și teste). */
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
