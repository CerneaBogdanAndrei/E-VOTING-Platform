// Grupul ristretto255 (RFC 9496): ordin prim q, fără cofactor, deci orice
// element valid decodat aparține grupului în care lucrăm.

import { ristretto255 } from '@noble/curves/ed25519.js'
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils.js'
import { isHex } from './encoding.js'

const RistrettoPoint = ristretto255.Point

/** Interfața folosită din punctele ristretto255 (clasa din @noble/curves nu se poate exporta în declarații). */
export interface Point {
  add(other: Point): Point
  subtract(other: Point): Point
  negate(): Point
  multiply(scalar: bigint): Point
  multiplyUnsafe(scalar: bigint): Point
  precompute(windowSize?: number, isLazy?: boolean): Point
  equals(other: Point): boolean
  is0(): boolean
  toHex(): string
}

/** Ordinul grupului, q = 2²⁵² + 27742317777372353535851937790883648493. */
export const Q: bigint = RistrettoPoint.Fn.ORDER
export const G: Point = RistrettoPoint.BASE as unknown as Point
export const ZERO: Point = RistrettoPoint.ZERO as unknown as Point

export class CryptoFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CryptoFormatError'
  }
}

export const modQ = (x: bigint): bigint => {
  const r = x % Q
  return r < 0n ? r + Q : r
}

function bytesToNumberLE(bytes: Uint8Array): bigint {
  let n = 0n
  for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i])
  return n
}

/** 64 de octeți aleatori reduși modulo q: abaterea de la uniform e neglijabilă (2⁻²⁵⁹). */
export const scalarFromWideBytes = (bytes: Uint8Array): bigint => modQ(bytesToNumberLE(bytes))

export const randomScalar = (): bigint => scalarFromWideBytes(randomBytes(64))

/** Scalar nenul, pentru chei secrete. */
export function randomNonZeroScalar(): bigint {
  for (;;) {
    const s = randomScalar()
    if (s !== 0n) return s
  }
}

export function scalarToHex(s: bigint): string {
  const bytes = new Uint8Array(32)
  let x = modQ(s)
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number(x & 0xffn)
    x >>= 8n
  }
  return bytesToHex(bytes)
}

/** Decodare strictă: 32 de octeți little-endian, valoare < q. */
export function scalarFromHex(hex: unknown, what = 'scalar'): bigint {
  if (!isHex(hex, 32)) throw new CryptoFormatError(`${what}: se așteaptă 64 de caractere hex`)
  const n = bytesToNumberLE(hexToBytes(hex))
  if (n >= Q) throw new CryptoFormatError(`${what}: valoare în afara intervalului [0, q)`)
  return n
}

export const pointToHex = (p: Point): string => p.toHex()

/** Decodare strictă a unui element ristretto255; respinge codificările invalide. */
export function pointFromHex(hex: unknown, what = 'punct'): Point {
  if (!isHex(hex, 32)) throw new CryptoFormatError(`${what}: se așteaptă 64 de caractere hex`)
  try {
    return RistrettoPoint.fromHex(hex) as unknown as Point
  } catch {
    throw new CryptoFormatError(`${what}: nu este un element ristretto255 valid`)
  }
}

/** m·G pentru m mic, folosit la codificarea voturilor (0 sau 1) și la totaluri. */
export const encodeSmall = (m: number | bigint): Point => {
  const s = BigInt(m)
  return s === 0n ? ZERO : G.multiply(modQ(s))
}

/**
 * Înmulțire pentru date publice (verificare): mai rapidă, dar nu în timp
 * constant, deci se folosește doar cu scalari care nu sunt secreți.
 */
export const mulPublic = (p: Point, s: bigint): Point => (s === 0n ? ZERO : p.multiplyUnsafe(s))

/** Înmulțire în timp constant, pentru scalari secreți (r, x, k). */
export const mulSecret = (p: Point, s: bigint): Point => (s === 0n ? ZERO : p.multiply(s))
