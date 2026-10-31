// Parametrii publici ai scrutinului și cheile trustees (schemă n-din-n).
//
// Fiecare trustee i alege xᵢ și publică Yᵢ = xᵢG, cu o dovadă Schnorr că știe
// xᵢ. Cheia scrutinului e Y = ΣYᵢ, deci decriptarea cere toți trustees.
// Dovada împiedică „atacul cheii necinstite”: un trustee care ar publica
// Yᵢ = X − ΣYⱼ (fără să cunoască logaritmul) ar putea controla singur Y.

import { proveDlog, verifyDlog, type CompactProof } from './proofs.js'
import { G, mul, pointFromHex, pointToHex, randomScalar, scalarFromHex, scalarToHex, ZERO, type Hex, type Point } from './group.js'

export interface TrusteePublic {
  id: string
  name: string
  /** Yᵢ = xᵢG */
  publicKeyShare: Hex
  /** Dovada că trustee-ul cunoaște xᵢ, legată de scrutin și de id-ul său. */
  proof: CompactProof
}

/** Tot ce trebuie să știe un client sau un verificator ca să cripteze sau să verifice. */
export interface ElectionParams {
  electionId: string
  /** Numele candidaților, în ordinea pozițiilor din vectorul de vot. */
  candidates: string[]
  /** Câte opțiuni poate bifa alegătorul (implicit exact 1). */
  minSelections: number
  maxSelections: number
  trustees: TrusteePublic[]
  /** Y = ΣYᵢ */
  publicKey: Hex
}

/** Cheia trustee-ului, așa cum o păstrează CLI-ul local. Secretul nu ajunge la server. */
export interface TrusteeKey {
  electionId: string
  trusteeId: string
  /** xᵢ, hex */
  secretKey: Hex
  publicKeyShare: Hex
  proof: CompactProof
}

const keyContext = (electionId: string, trusteeId: string) => ['key', electionId, trusteeId]

export function generateTrusteeKey(electionId: string, trusteeId: string): TrusteeKey {
  const x = randomScalar()
  const Y = mul(G, x)
  return {
    electionId,
    trusteeId,
    secretKey: scalarToHex(x),
    publicKeyShare: pointToHex(Y),
    proof: proveDlog(x, Y, keyContext(electionId, trusteeId)),
  }
}

export function verifyTrusteeKey(electionId: string, trusteeId: string, publicKeyShare: Hex, proof: CompactProof): boolean {
  try {
    return verifyDlog(pointFromHex(publicKeyShare), proof, keyContext(electionId, trusteeId))
  } catch {
    return false
  }
}

export function combinePublicKeys(shares: Hex[]): Hex {
  return pointToHex(shares.reduce<Point>((acc, s) => acc.add(pointFromHex(s)), ZERO))
}

export function trusteeSecret(key: TrusteeKey): bigint {
  return scalarFromHex(key.secretKey)
}

/** Mulțimea valorilor permise pentru numărul de opțiuni bifate. */
export function allowedCounts(params: Pick<ElectionParams, 'minSelections' | 'maxSelections'>): number[] {
  const out: number[] = []
  for (let k = params.minSelections; k <= params.maxSelections; k++) out.push(k)
  return out
}
