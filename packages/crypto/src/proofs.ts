// Dovezile zero-knowledge, toate de tip Σ-protocol făcute neinteractive prin
// Fiat-Shamir. Provocarea include contextul (scrutin, credential, poziție), deci
// o dovadă copiată nu se potrivește în alt scrutin sau pentru alt alegător.
//
//   Schnorr          știu x cu Y = xG                            (cheia trustee-ului)
//   Chaum-Pedersen   știu w cu U = wG și V = wH                  (suma = 1, decriptarea parțială)
//   Disjunctivă 0/1  (A, B) criptează 0 SAU 1, fără a spune care (fiecare criptotext din buletin)

import { hashToScalar } from './hash.js'
import {
  G,
  modQ,
  mulPublic,
  mulSecret,
  pointToHex,
  randomScalar,
  scalarFromHex,
  scalarToHex,
  type Point,
} from './group.js'
import type { ChaumPedersenProof, ZeroOneProof } from './types.js'

export const DOMAIN = {
  trusteeKey: 'evoting/v1/trustee-key',
  zeroOne: 'evoting/v1/ballot-01',
  sum: 'evoting/v1/ballot-sum',
  decryption: 'evoting/v1/partial-decryption',
} as const

const hexes = (points: readonly Point[]) => points.map(pointToHex)

// ───────────── Schnorr ─────────────

export function proveSchnorr(domain: string, context: readonly string[], x: bigint, y: Point): ChaumPedersenProof {
  const k = randomScalar()
  const t = mulSecret(G, k)
  const c = hashToScalar(domain, [...context, ...hexes([G, y, t])])
  return { c: scalarToHex(c), s: scalarToHex(modQ(k + c * x)) }
}

export function verifySchnorr(domain: string, context: readonly string[], y: Point, proof: ChaumPedersenProof): boolean {
  const c = scalarFromHex(proof?.c, 'dovadă.c')
  const s = scalarFromHex(proof?.s, 'dovadă.s')
  const t = mulPublic(G, s).subtract(mulPublic(y, c))
  return hashToScalar(domain, [...context, ...hexes([G, y, t])]) === c
}

// ───────────── Chaum-Pedersen ─────────────

/** Dovedește că U = wG și V = wH folosesc același w. */
export function proveEqualLogs(
  domain: string,
  context: readonly string[],
  h: Point,
  u: Point,
  v: Point,
  w: bigint,
): ChaumPedersenProof {
  const k = randomScalar()
  const t1 = mulSecret(G, k)
  const t2 = mulSecret(h, k)
  const c = hashToScalar(domain, [...context, ...hexes([G, h, u, v, t1, t2])])
  return { c: scalarToHex(c), s: scalarToHex(modQ(k + c * w)) }
}

export function verifyEqualLogs(
  domain: string,
  context: readonly string[],
  h: Point,
  u: Point,
  v: Point,
  proof: ChaumPedersenProof,
): boolean {
  const c = scalarFromHex(proof?.c, 'dovadă.c')
  const s = scalarFromHex(proof?.s, 'dovadă.s')
  const t1 = mulPublic(G, s).subtract(mulPublic(u, c))
  const t2 = mulPublic(h, s).subtract(mulPublic(v, c))
  return hashToScalar(domain, [...context, ...hexes([G, h, u, v, t1, t2])]) === c
}

// ───────────── Disjunctivă 0/1 (Cramer-Damgård-Schoenmakers) ─────────────
//
// Pentru (A, B) = (rG, mG + rY), ramura j afirmă că (A, B − jG) = (rG, rY).
// Ramura adevărată se dovedește normal; cealaltă se simulează alegând întâi
// provocarea și răspunsul. Provocarea totală c = c₀ + c₁ e fixată de hash,
// deci prover-ul poate simula cel mult o ramură.

export function proveZeroOne(
  context: readonly string[],
  y: Point,
  a: Point,
  b: Point,
  m: 0 | 1,
  r: bigint,
): ZeroOneProof {
  const v = [b, b.subtract(G)]
  const other = (1 - m) as 0 | 1
  const c = [0n, 0n]
  const s = [0n, 0n]
  const t1: Point[] = []
  const t2: Point[] = []

  // ramura simulată
  c[other] = randomScalar()
  s[other] = randomScalar()
  t1[other] = mulPublic(G, s[other]).subtract(mulPublic(a, c[other]))
  t2[other] = mulPublic(y, s[other]).subtract(mulPublic(v[other], c[other]))

  // ramura reală
  const k = randomScalar()
  t1[m] = mulSecret(G, k)
  t2[m] = mulSecret(y, k)

  const total = hashToScalar(DOMAIN.zeroOne, [...context, ...hexes([y, a, b, t1[0], t2[0], t1[1], t2[1]])])
  c[m] = modQ(total - c[other])
  s[m] = modQ(k + c[m] * r)

  return { c0: scalarToHex(c[0]), c1: scalarToHex(c[1]), s0: scalarToHex(s[0]), s1: scalarToHex(s[1]) }
}

export function verifyZeroOne(context: readonly string[], y: Point, a: Point, b: Point, proof: ZeroOneProof): boolean {
  const c0 = scalarFromHex(proof?.c0, 'dovadă.c0')
  const c1 = scalarFromHex(proof?.c1, 'dovadă.c1')
  const s0 = scalarFromHex(proof?.s0, 'dovadă.s0')
  const s1 = scalarFromHex(proof?.s1, 'dovadă.s1')
  const v1 = b.subtract(G)
  const t10 = mulPublic(G, s0).subtract(mulPublic(a, c0))
  const t20 = mulPublic(y, s0).subtract(mulPublic(b, c0))
  const t11 = mulPublic(G, s1).subtract(mulPublic(a, c1))
  const t21 = mulPublic(y, s1).subtract(mulPublic(v1, c1))
  const total = hashToScalar(DOMAIN.zeroOne, [...context, ...hexes([y, a, b, t10, t20, t11, t21])])
  return modQ(c0 + c1) === total
}
