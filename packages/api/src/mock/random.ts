// Utilitare ale backend-ului simulat: aleator reproductibil, latență, copiere.

import { bytesToHex } from '@evoting/crypto'

export const randomToken = () => bytesToHex(crypto.getRandomValues(new Uint8Array(24)))

export const delay = (ms = 80 + Math.random() * 120) => new Promise((r) => setTimeout(r, ms))

// structuredClone lipsește în Hermes (React Native).
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/** Generator pseudo-aleator cu sămânță, ca scrutinele de demonstrație să fie aceleași la fiecare pornire. */
export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Alege un indice cu probabilitate proporțională cu ponderea lui. */
export function pickWeighted(rand: () => number, weights: number[]) {
  let r = rand() * weights.reduce((a, b) => a + b, 0)
  const i = weights.findIndex((w) => (r -= w) < 0)
  return i === -1 ? weights.length - 1 : i
}
