// Numărarea homomorfă: se adună criptotextele fiecărui candidat, trustees
// decriptează parțial doar sumele, iar totalul Tⱼ se află din TⱼG prin
// baby-step giant-step, fiind cel mult numărul de buletine.

import { addCiphertexts, decodeCiphertext, encodeCiphertext } from './elgamal.js'
import { G, pointFromHex, pointToHex, ZERO, type Point } from './group.js'
import type { Ciphertext, PartialDecryption } from './types.js'

/** (Aⱼ, Bⱼ) = (Σₖ Aₖⱼ, Σₖ Bₖⱼ) pentru fiecare candidat j. */
export function computeAggregate(candidateCount: number, ballots: readonly { ciphertexts: readonly Ciphertext[] }[]): Ciphertext[] {
  const columns = Array.from({ length: candidateCount }, () => [] as ReturnType<typeof decodeCiphertext>[])
  ballots.forEach((b, k) => {
    if (b.ciphertexts.length !== candidateCount) throw new Error(`Buletinul ${k + 1} are ${b.ciphertexts.length} criptotexte`)
    b.ciphertexts.forEach((ct, j) => columns[j].push(decodeCiphertext(ct, `buletinul ${k + 1}, criptotextul ${j + 1}`)))
  })
  return columns.map((col) => encodeCiphertext(addCiphertexts(col)))
}

/** Logaritm discret pentru valori mici: găsește t ∈ [0, max] cu tG = target, în O(√max). */
export function babyStepGiantStep(target: Point, max: number): number | null {
  if (max < 0) return null
  const m = Math.max(1, Math.ceil(Math.sqrt(max + 1)))
  const baby = new Map<string, number>()
  let p: Point = ZERO
  for (let j = 0; j < m; j++) {
    baby.set(pointToHex(p), j)
    p = p.add(G)
  }
  const giant = p.negate() // −mG
  let q = target
  for (let i = 0; i <= m; i++) {
    const j = baby.get(pointToHex(q))
    if (j !== undefined) {
      const t = i * m + j
      return t <= max ? t : null
    }
    q = q.add(giant)
  }
  return null
}

/** TⱼG = Bⱼ − Σᵢ Dᵢⱼ, apoi Tⱼ prin baby-step giant-step. */
export function combinePartialDecryptions(aggregate: readonly Ciphertext[], partials: readonly PartialDecryption[], maxVotes: number): number[] {
  return aggregate.map((ct, j) => {
    const { b } = decodeCiphertext(ct, `agregatul ${j + 1}`)
    const sum = partials.reduce<Point>((acc, p) => acc.add(pointFromHex(p.shares[j], `D${j + 1}`)), ZERO)
    const t = babyStepGiantStep(b.subtract(sum), maxVotes)
    if (t === null) throw new Error(`Totalul candidatului de pe poziția ${j + 1} nu e în intervalul [0, ${maxVotes}]`)
    return t
  })
}
