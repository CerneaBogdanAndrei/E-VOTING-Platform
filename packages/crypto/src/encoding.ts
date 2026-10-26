// Codificări comune: hex, UTF-8 și JSON canonic (chei sortate, fără spații),
// ca același obiect să dea mereu același hash, indiferent de platformă.

import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js'

export { bytesToHex, hexToBytes, utf8ToBytes }

export function isHex(value: unknown, bytes?: number): value is string {
  if (typeof value !== 'string' || value.length % 2 !== 0 || !/^[0-9a-f]*$/.test(value)) return false
  return bytes === undefined || value.length === bytes * 2
}

/** JSON cu cheile sortate recursiv. Nu acceptă valori care nu se serializează stabil. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonicalJson: număr nefinit')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
  }
  throw new Error(`canonicalJson: tip nesuportat (${typeof value})`)
}
