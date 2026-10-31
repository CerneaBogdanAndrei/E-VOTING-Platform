// Grupul ristretto255 (RFC 9496) și operațiile de bază pe puncte și scalari.
//
// ristretto255 e construit peste Curve25519, dar are ordin prim q, deci nu are
// capcanele de cofactor ale Ed25519: orice codificare validă e un element al
// grupului de ordin q, iar verificarea „aparține grupului” e chiar decodarea.
//
// Notație (ca în planul aplicației): G generatorul, q ordinul grupului,
// literele mari sunt puncte, cele mici sunt scalari din Z_q.

import { ristretto255 } from '@noble/curves/ed25519.js'
import { sha512 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js'

export type Point = InstanceType<typeof ristretto255.Point>
export type Hex = string

const RP = ristretto255.Point

export const GROUP_NAME = 'ristretto255'
/** Ordinul grupului: q = 2²⁵² + 27742317777372353535851937790883648493. */
export const Q: bigint = RP.Fn.ORDER
export const G: Point = RP.BASE
export const ZERO: Point = RP.ZERO

export function mod(a: bigint, m: bigint = Q): bigint {
  const r = a % m
  return r < 0n ? r + m : r
}

/**
 * s·P. Scalarul se reduce modulo q. Pentru s = 0 rezultatul e elementul neutru
 * (multiply din noble refuză 0, fiindcă e gândit pentru chei secrete).
 */
export function mul(p: Point, s: bigint): Point {
  const k = mod(s)
  return k === 0n ? ZERO : p.multiply(k)
}

/**
 * s·P pentru date publice (verificarea dovezilor). Folosește înmulțirea care nu
 * rulează în timp constant, de ~1,5 ori mai rapidă; e sigură doar când nici P,
 * nici s nu sunt secrete.
 */
export function mulPublic(p: Point, s: bigint): Point {
  return p.multiplyUnsafe(mod(s))
}

const prepared = new Map<string, Point>()

/**
 * Decodează un punct folosit des ca bază (cheia scrutinului, cheile trustees) și
 * îi precalculează tabela de ferestre: înmulțirile cu el devin de ~4 ori mai rapide.
 */
export function preparedPoint(hex: Hex): Point {
  let p = prepared.get(hex)
  if (!p) {
    if (prepared.size >= 32) prepared.delete(prepared.keys().next().value!)
    p = pointFromHex(hex)
    p.precompute(8, false)
    prepared.set(hex, p)
  }
  return p
}

/** m·G pentru un întreg mic, eventual negativ (codificarea votului în exponent). */
export function gTimes(m: number | bigint): Point {
  return mul(G, BigInt(m))
}

/** Scalar uniform în [1, q). Folosește 64 de octeți aleatori, deci abaterea de la uniform e neglijabilă. */
export function randomScalar(): bigint {
  for (;;) {
    const s = mod(bytesToNumber(randomBytes(64)))
    if (s !== 0n) return s
  }
}

export function bytesToNumber(bytes: Uint8Array): bigint {
  return bytes.length === 0 ? 0n : BigInt('0x' + bytesToHex(bytes))
}

// ───────────── Codificare ─────────────

export function pointToHex(p: Point): Hex {
  return p.toHex()
}

/**
 * Decodează un punct și verifică, în același timp, că e un element valid al
 * grupului. Aruncă eroare pentru orice șir care nu e o codificare canonică.
 */
export function pointFromHex(hex: unknown): Point {
  if (typeof hex !== 'string' || !/^[0-9a-f]{64}$/.test(hex)) throw new Error('punct în format greșit (64 de caractere hex)')
  return RP.fromHex(hex)
}

export function isValidPoint(hex: unknown): boolean {
  try {
    pointFromHex(hex)
    return true
  } catch {
    return false
  }
}

export function scalarToHex(s: bigint): Hex {
  return mod(s).toString(16).padStart(64, '0')
}

export function scalarFromHex(hex: unknown): bigint {
  if (typeof hex !== 'string' || !/^[0-9a-f]{64}$/.test(hex)) throw new Error('scalar în format greșit (64 de caractere hex)')
  const s = BigInt('0x' + hex)
  if (s >= Q) throw new Error('scalarul depășește ordinul grupului')
  return s
}

// ───────────── Hash ─────────────

/**
 * Hash spre Z_q, folosit pentru provocările Fiat–Shamir. Părțile se
 * serializează ca listă JSON, deci concatenarea e neambiguă („ab”,„c” ≠ „a”,„bc”).
 * SHA-512 dă 512 biți, iar reducerea modulo q (252 de biți) e practic uniformă.
 */
export function hashToScalar(...parts: (string | number)[]): bigint {
  return mod(bytesToNumber(sha512(utf8ToBytes(JSON.stringify(parts)))))
}

export { bytesToHex, hexToBytes, randomBytes, utf8ToBytes }
