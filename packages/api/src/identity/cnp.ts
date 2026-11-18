// Validarea și generarea CNP-urilor. Structura: S AA LL ZZ JJ NNN C
// (sex și secol, data nașterii, județ, număr de ordine, cifră de control).

const CONTROL_KEY = '279146358279'

function controlDigit(first12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * Number(CONTROL_KEY[i])
  const r = sum % 11
  return r === 10 ? 1 : r
}

function centuryFor(s: number): number | null {
  if (s === 1 || s === 2) return 1900
  if (s === 3 || s === 4) return 1800
  if (s === 5 || s === 6) return 2000
  if (s === 7 || s === 8) return 1900 // rezidenți străini; secolul nu e codat
  return null
}

export type CnpCheck = { ok: true } | { ok: false; reason: string }

export function checkCnp(value: string): CnpCheck {
  if (!/^\d{13}$/.test(value)) return { ok: false, reason: 'CNP-ul are 13 cifre' }
  const century = centuryFor(Number(value[0]))
  if (century === null) return { ok: false, reason: 'Prima cifră nu e validă' }
  const year = century + Number(value.slice(1, 3))
  const month = Number(value.slice(3, 5))
  const day = Number(value.slice(5, 7))
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false, reason: 'Data nașterii nu e validă' }
  }
  const county = Number(value.slice(7, 9))
  if (county < 1 || (county > 52 && county !== 70)) return { ok: false, reason: 'Codul județului nu e valid' }
  if (controlDigit(value) !== Number(value[12])) return { ok: false, reason: 'Cifra de control nu se potrivește' }
  return { ok: true }
}

export function isValidCnp(value: string): boolean {
  return checkCnp(value).ok
}

const pad = (n: number, width: number) => String(n).padStart(width, '0')

/** CNP fictiv, dar valid ca format, pentru o persoană născută între 2000 și 2007. */
export function generateCnp(rand: () => number): string {
  const s = rand() < 0.5 ? 5 : 6
  const year = 2000 + Math.floor(rand() * 8)
  const month = 1 + Math.floor(rand() * 12)
  const day = 1 + Math.floor(rand() * 28)
  const county = 1 + Math.floor(rand() * 52)
  const order = 1 + Math.floor(rand() * 999)
  const first12 = `${s}${pad(year % 100, 2)}${pad(month, 2)}${pad(day, 2)}${pad(county, 2)}${pad(order, 3)}`
  return first12 + controlDigit(first12)
}
