// Numărarea homomorfă și decriptarea rezultatului de către trustees.
//
//   (Aⱼ, Bⱼ) = (Σₖ Aₖⱼ, Σₖ Bₖⱼ) = Enc(Tⱼ)         agregatul pentru candidatul j
//   Dᵢⱼ = xᵢAⱼ, cu dovadă DLEQ că log_G Yᵢ = log_Aⱼ Dᵢⱼ   decriptarea parțială a trustee-ului i
//   TⱼG = Bⱼ − Σᵢ Dᵢⱼ                                   combinarea
//   Tⱼ = log_G(TⱼG), prin baby-step giant-step         totalul (cel mult numărul de buletine)

import type { Ballot } from './ballot.js'
import { addCiphertexts, ciphertextFromJson, ciphertextToJson, type Ciphertext } from './elgamal.js'
import { G, mul, pointFromHex, pointToHex, ZERO, type Hex, type Point } from './group.js'
import { proveDleq, verifyDleq, type CompactProof } from './proofs.js'
import { trusteeSecret, type TrusteeKey } from './election.js'

export interface PartialShare {
  /** Dᵢⱼ = xᵢAⱼ */
  d: Hex
  proof: CompactProof
}

export interface PartialDecryption {
  trusteeId: string
  /** Câte o valoare per candidat, în ordinea pozițiilor. */
  shares: PartialShare[]
}

const decContext = (electionId: string, trusteeId: string, index: number) => ['dec', electionId, trusteeId, index]

/** Agregatul pentru fiecare candidat, recalculabil de oricine din buletinele de pe board. */
export function computeAggregate(candidateCount: number, ballots: Pick<Ballot, 'ciphertexts'>[]): Ciphertext[] {
  const out: Ciphertext[] = []
  for (let j = 0; j < candidateCount; j++) {
    out.push(ciphertextToJson(addCiphertexts(ballots.map((b) => ciphertextFromJson(b.ciphertexts[j])))))
  }
  return out
}

export function partialDecrypt(key: TrusteeKey, aggregate: Ciphertext[]): PartialDecryption {
  const x = trusteeSecret(key)
  const Yi = pointFromHex(key.publicKeyShare)
  return {
    trusteeId: key.trusteeId,
    shares: aggregate.map((ct, j) => {
      const A = pointFromHex(ct.a)
      const D = mul(A, x)
      return { d: pointToHex(D), proof: proveDleq(x, A, Yi, D, decContext(key.electionId, key.trusteeId, j)) }
    }),
  }
}

/** Întoarce lista problemelor (goală = decriptarea parțială e corectă). */
export function verifyPartialDecryption(
  electionId: string,
  trustee: { id: string; name: string; publicKeyShare: Hex },
  aggregate: Ciphertext[],
  partial: PartialDecryption | undefined,
  candidateNames: string[] = [],
): string[] {
  if (!partial || partial.trusteeId !== trustee.id || !Array.isArray(partial.shares) || partial.shares.length !== aggregate.length) {
    return [`${trustee.name}: decriptarea parțială lipsește sau e incompletă`]
  }
  const problems: string[] = []
  aggregate.forEach((ct, j) => {
    let ok = false
    try {
      const share = partial.shares[j]
      ok = verifyDleq(pointFromHex(ct.a), pointFromHex(trustee.publicKeyShare), pointFromHex(share.d), share.proof, decContext(electionId, trustee.id, j))
    } catch {
      ok = false
    }
    if (!ok) problems.push(`${trustee.name}, ${candidateNames[j] ?? `candidatul ${j + 1}`}: dovada decriptării parțiale nu se verifică`)
  })
  return problems
}

/**
 * Combină decriptările parțiale și află totalurile. Întoarce null pentru un
 * candidat dacă totalul nu e în [0, maxCount] (de exemplu, o parte lipsește sau e falsă).
 */
export function combineDecryptions(aggregate: Ciphertext[], partials: PartialDecryption[], maxCount: number): (number | null)[] {
  return aggregate.map((ct, j) => {
    let D: Point = ZERO
    for (const p of partials) D = D.add(pointFromHex(p.shares[j].d))
    return discreteLog(pointFromHex(ct.b).subtract(D), maxCount)
  })
}

/**
 * Baby-step giant-step: găsește m ∈ [0, max] cu mG = target în O(√max) pași.
 * Funcționează doar pentru că totalurile sunt mici (cel mult numărul de alegători);
 * pentru un scalar de 252 de biți, ca o cheie secretă, ar fi nevoie de ~2¹²⁶ pași.
 */
export function discreteLog(target: Point, max: number): number | null {
  const m = Math.max(1, Math.ceil(Math.sqrt(max + 1)))
  const baby = new Map<string, number>()
  let cur: Point = ZERO
  for (let j = 0; j < m; j++) {
    baby.set(pointToHex(cur), j)
    cur = cur.add(G)
  }
  const giant = mul(G, BigInt(m)).negate()
  let gamma = target
  for (let i = 0; i <= m; i++) {
    const j = baby.get(pointToHex(gamma))
    if (j !== undefined) {
      const value = i * m + j
      return value <= max ? value : null
    }
    gamma = gamma.add(giant)
  }
  return null
}
