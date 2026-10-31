// ElGamal exponențial pe ristretto255.
//
//   Enc(m; r) = (A, B) = (rG, mG + rY)
//
// Suma a două criptotexte criptează suma mesajelor: (A₁+A₂, B₁+B₂) = Enc(m₁+m₂; r₁+r₂).
// Pe asta se bazează numărarea homomorfă: se adună toate buletinele și se
// decriptează doar totalul.

import { G, gTimes, mul, pointFromHex, pointToHex, randomScalar, ZERO, type Hex, type Point } from './group.js'

/** Criptotext în formă internă (puncte). */
export interface CiphertextPoints {
  A: Point
  B: Point
}

/** Criptotext serializat, așa cum circulă prin API și stă pe board. */
export interface Ciphertext {
  a: Hex
  b: Hex
}

export function encrypt(publicKey: Point, m: number | bigint, r: bigint = randomScalar()): CiphertextPoints {
  return { A: mul(G, r), B: gTimes(m).add(mul(publicKey, r)) }
}

export function addCiphertexts(cts: CiphertextPoints[]): CiphertextPoints {
  let A = ZERO
  let B = ZERO
  for (const ct of cts) {
    A = A.add(ct.A)
    B = B.add(ct.B)
  }
  return { A, B }
}

/** Decriptare cu cheia secretă întreagă: întoarce mG (m se află apoi cu discreteLog). */
export function decryptToPoint(secretKey: bigint, ct: CiphertextPoints): Point {
  return ct.B.subtract(mul(ct.A, secretKey))
}

export function ciphertextToJson(ct: CiphertextPoints): Ciphertext {
  return { a: pointToHex(ct.A), b: pointToHex(ct.B) }
}

export function ciphertextFromJson(ct: unknown): CiphertextPoints {
  const c = ct as Partial<Ciphertext> | null
  if (!c || typeof c !== 'object') throw new Error('criptotext lipsă')
  return { A: pointFromHex(c.a), B: pointFromHex(c.b) }
}

export function ciphertextEquals(x: CiphertextPoints, y: CiphertextPoints): boolean {
  return x.A.equals(y.A) && x.B.equals(y.B)
}
