// CNP: validare, date fictive pentru teste, amprenta HMAC și atacul de dicționar.
// Structura: S AA LL ZZ JJ NNN C (sex și secol, data nașterii, județ, număr de ordine, cifră de control).

import { hmacSha256Hex, sha256Hex } from './hash.js'

export const COUNTIES: Record<string, string> = {
  '01': 'Alba', '02': 'Arad', '03': 'Argeș', '04': 'Bacău', '05': 'Bihor', '06': 'Bistrița-Năsăud',
  '07': 'Botoșani', '08': 'Brașov', '09': 'Brăila', '10': 'Buzău', '11': 'Caraș-Severin', '12': 'Cluj',
  '13': 'Constanța', '14': 'Covasna', '15': 'Dâmbovița', '16': 'Dolj', '17': 'Galați', '18': 'Gorj',
  '19': 'Harghita', '20': 'Hunedoara', '21': 'Ialomița', '22': 'Iași', '23': 'Ilfov', '24': 'Maramureș',
  '25': 'Mehedinți', '26': 'Mureș', '27': 'Neamț', '28': 'Olt', '29': 'Prahova', '30': 'Satu Mare',
  '31': 'Sălaj', '32': 'Sibiu', '33': 'Suceava', '34': 'Teleorman', '35': 'Timiș', '36': 'Tulcea',
  '37': 'Vaslui', '38': 'Vâlcea', '39': 'Vrancea', '40': 'București', '41': 'București S1',
  '42': 'București S2', '43': 'București S3', '44': 'București S4', '45': 'București S5',
  '46': 'București S6', '51': 'Călărași', '52': 'Giurgiu',
}
const COUNTY_CODES = Object.keys(COUNTIES)
const WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9]
const CENTURY: Record<number, number> = { 1: 1900, 2: 1900, 3: 1800, 4: 1800, 5: 2000, 6: 2000, 7: 1900, 8: 1900 }

export function cnpControlDigit(first12: string): number {
  let s = 0
  for (let i = 0; i < 12; i++) s += Number(first12[i]) * WEIGHTS[i]
  const r = s % 11
  return r === 10 ? 1 : r
}

export type CnpCheck =
  | { ok: true; sex: 'M' | 'F'; birthDate: string; county: string }
  | { ok: false; reason: string }

export function checkCnp(value: unknown): CnpCheck {
  const cnp = String(value ?? '')
  if (!/^\d{13}$/.test(cnp)) return { ok: false, reason: 'CNP-ul are exact 13 cifre' }
  const s = Number(cnp[0])
  if (!CENTURY[s]) return { ok: false, reason: 'prima cifră (sex și secol) trebuie să fie între 1 și 8' }
  const year = CENTURY[s] + Number(cnp.slice(1, 3))
  const month = Number(cnp.slice(3, 5))
  const day = Number(cnp.slice(5, 7))
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false, reason: 'data nașterii nu există' }
  }
  const county = COUNTIES[cnp.slice(7, 9)]
  if (!county) return { ok: false, reason: 'codul de județ nu există' }
  if (cnp.slice(9, 12) === '000') return { ok: false, reason: 'numărul de ordine nu poate fi 000' }
  if (cnpControlDigit(cnp) !== Number(cnp[12])) return { ok: false, reason: 'cifra de control nu se potrivește' }
  return { ok: true, sex: s % 2 === 1 ? 'M' : 'F', birthDate: `${year}-${cnp.slice(3, 5)}-${cnp.slice(5, 7)}`, county }
}

export const isValidCnp = (value: unknown): boolean => checkCnp(value).ok

/**
 * Amprenta CNP-ului, singura formă în care CNP-ul ajunge în baza de date.
 * Cheia stă în afara bazei (variabilă de mediu sau vault).
 */
export function cnpFingerprint(hmacKeyHex: string, cnp: string): string {
  return hmacSha256Hex(hmacKeyHex, `evoting/v1/cnp|${cnp}`)
}

/** Varianta greșită, pentru demonstrația de atac: SHA-256 simplu, fără cheie. */
export const cnpPlainSha256 = (cnp: string) => sha256Hex(cnp)

const pad = (n: number, w: number) => String(n).padStart(w, '0')

function sexDigits(year: number): [string, string] {
  if (year >= 2000) return ['5', '6']
  if (year >= 1900) return ['1', '2']
  return ['3', '4']
}

function fromParts(sexDigit: string, birthDate: string, county: string, serial: number): string {
  const [y, m, d] = birthDate.split('-')
  const first12 = sexDigit + y.slice(2) + m + d + county + pad(serial, 3)
  return first12 + cnpControlDigit(first12)
}

/** CNP fictiv, dar valid ca format. `rand` întoarce valori în [0, 1) (implicit Math.random). */
export function generateCnp(rand: () => number = Math.random, fromYear = 1998, toYear = 2007): string {
  const start = Date.UTC(fromYear, 0, 1)
  const days = Math.floor((Date.UTC(toYear, 11, 31) - start) / 86_400_000)
  const birthDate = new Date(start + Math.floor(rand() * (days + 1)) * 86_400_000).toISOString().slice(0, 10)
  const [male, female] = sexDigits(Number(birthDate.slice(0, 4)))
  const county = COUNTY_CODES[Math.floor(rand() * COUNTY_CODES.length)]
  return fromParts(rand() < 0.5 ? male : female, birthDate, county, 1 + Math.floor(rand() * 999))
}

/**
 * Toate CNP-urile posibile pentru o dată de naștere: 2 (sex) × 48 (județe) × 999 (număr de ordine) ≈ 96.000.
 * Cifra de control nu adaugă entropie. De aceea SHA-256 simplu pe CNP se sparge în câteva secunde.
 */
export function cnpSearchSpace(birthDate: string): string[] {
  const list: string[] = []
  for (const s of sexDigits(Number(birthDate.slice(0, 4)))) {
    for (const county of COUNTY_CODES) for (let serial = 1; serial <= 999; serial++) list.push(fromParts(s, birthDate, county, serial))
  }
  return list
}

/** Generator determinist (mulberry32), pentru date de test reproductibile. */
export function seededRandom(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
