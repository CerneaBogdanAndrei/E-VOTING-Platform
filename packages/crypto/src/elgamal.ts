// ElGamal exponențial: Enc(m) = (rG, mG + rY). Mesajul stă în exponent, deci
// produsul (aici suma, în notație aditivă) a două criptotexte criptează suma mesajelor.

import {
  encodeSmall,
  G,
  mulSecret,
  pointFromHex,
  pointToHex,
  randomNonZeroScalar,
  ZERO,
  type Point as PointT,
} from './group.js'
import type { Ciphertext } from './types.js'

export interface CiphertextPoints {
  a: PointT
  b: PointT
}

const prepared = new Map<string, PointT>()

/** Cheia publică decodată, cu tabele precalculate pentru înmulțiri repetate. */
export function preparePublicKey(hex: string): PointT {
  let y = prepared.get(hex)
  if (!y) {
    y = pointFromHex(hex, 'cheia publică').precompute(8)
    if (prepared.size > 64) prepared.clear()
    prepared.set(hex, y)
  }
  return y
}

export function encryptPoints(y: PointT, m: number | bigint, r: bigint): CiphertextPoints {
  return { a: mulSecret(G, r), b: encodeSmall(m).add(mulSecret(y, r)) }
}

export function encrypt(publicKey: string, m: number | bigint, r: bigint = randomNonZeroScalar()): Ciphertext {
  const { a, b } = encryptPoints(preparePublicKey(publicKey), m, r)
  return { a: pointToHex(a), b: pointToHex(b) }
}

export function decodeCiphertext(ct: unknown, what = 'criptotext'): CiphertextPoints {
  const c = ct as Partial<Ciphertext> | null
  if (!c || typeof c !== 'object') throw new Error(`${what}: lipsește`)
  return { a: pointFromHex(c.a, `${what}.A`), b: pointFromHex(c.b, `${what}.B`) }
}

export const encodeCiphertext = (c: CiphertextPoints): Ciphertext => ({ a: pointToHex(c.a), b: pointToHex(c.b) })

export function addCiphertexts(list: readonly CiphertextPoints[]): CiphertextPoints {
  let a: PointT = ZERO
  let b: PointT = ZERO
  for (const c of list) {
    a = a.add(c.a)
    b = b.add(c.b)
  }
  return { a, b }
}

/** Decriptare cu cheia secretă completă: mG = B − xA. Folosită doar în teste și demonstrații. */
export function decryptToPoint(secret: bigint, ct: CiphertextPoints): PointT {
  return ct.b.subtract(mulSecret(ct.a, secret))
}
