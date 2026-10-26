// Trustees: fiecare alege local xᵢ, publică Yᵢ = xᵢG cu o dovadă Schnorr,
// iar cheia scrutinului e Y = ΣYᵢ (schemă n-din-n). La final, fiecare publică
// Dᵢⱼ = xᵢAⱼ pentru agregatul fiecărui candidat, cu dovadă Chaum-Pedersen.

import { decodeCiphertext } from './elgamal.js'
import {
  G,
  mulSecret,
  pointFromHex,
  pointToHex,
  randomNonZeroScalar,
  scalarFromHex,
  scalarToHex,
  ZERO,
  type Point,
} from './group.js'
import { DOMAIN, proveEqualLogs, proveSchnorr, verifyEqualLogs, verifySchnorr } from './proofs.js'
import type { Ciphertext, PartialDecryption, TrusteePublicKey } from './types.js'

export interface TrusteeKeyPair {
  trusteeId: string
  electionId: string
  secretKey: string
  publicKeyShare: string
}

const keyContext = (electionId: string, trusteeId: string) => [electionId, trusteeId]
const decryptionContext = (electionId: string, trusteeId: string, j: number) => [electionId, trusteeId, String(j)]

export function generateTrusteeKey(electionId: string, trusteeId: string): { keyPair: TrusteeKeyPair; publicKey: TrusteePublicKey } {
  const x = randomNonZeroScalar()
  const y = mulSecret(G, x)
  const publicKeyShare = pointToHex(y)
  return {
    keyPair: { trusteeId, electionId, secretKey: scalarToHex(x), publicKeyShare },
    publicKey: { trusteeId, publicKeyShare, proof: proveSchnorr(DOMAIN.trusteeKey, keyContext(electionId, trusteeId), x, y) },
  }
}

export function verifyTrusteeKey(electionId: string, key: TrusteePublicKey): boolean {
  try {
    const y = pointFromHex(key.publicKeyShare, 'Yᵢ')
    if (y.equals(ZERO)) return false
    return verifySchnorr(DOMAIN.trusteeKey, keyContext(electionId, key.trusteeId), y, key.proof)
  } catch {
    return false
  }
}

/** Y = Y₁ + … + Yₙ. */
export function combinePublicKeys(shares: readonly string[]): string {
  if (shares.length === 0) throw new Error('Nicio cheie de trustee')
  return pointToHex(shares.reduce<Point>((acc, s, i) => acc.add(pointFromHex(s, `Y${i + 1}`)), ZERO))
}

export function partialDecrypt(keyPair: TrusteeKeyPair, aggregate: readonly Ciphertext[]): PartialDecryption {
  const x = scalarFromHex(keyPair.secretKey, 'cheia secretă')
  const y = pointFromHex(keyPair.publicKeyShare, 'Yᵢ')
  if (!mulSecret(G, x).equals(y)) throw new Error('Cheia secretă nu corespunde cheii publice a trustee-ului')
  const shares: string[] = []
  const proofs = aggregate.map((ct, j) => {
    const { a } = decodeCiphertext(ct, `agregatul ${j + 1}`)
    const d = mulSecret(a, x)
    shares.push(pointToHex(d))
    return proveEqualLogs(DOMAIN.decryption, decryptionContext(keyPair.electionId, keyPair.trusteeId, j), a, y, d, x)
  })
  return { trusteeId: keyPair.trusteeId, shares, proofs }
}

export type PartialCheck = { ok: true } | { ok: false; reason: string; candidate?: number }

export function verifyPartialDecryption(
  electionId: string,
  publicKeyShare: string,
  aggregate: readonly Ciphertext[],
  partial: PartialDecryption,
): PartialCheck {
  try {
    const n = aggregate.length
    if (!Array.isArray(partial.shares) || partial.shares.length !== n || !Array.isArray(partial.proofs) || partial.proofs.length !== n) {
      return { ok: false, reason: `Se așteaptă ${n} decriptări parțiale și ${n} dovezi` }
    }
    const y = pointFromHex(publicKeyShare, 'Yᵢ')
    for (let j = 0; j < n; j++) {
      const { a } = decodeCiphertext(aggregate[j], `agregatul ${j + 1}`)
      const d = pointFromHex(partial.shares[j], `D${j + 1}`)
      if (!verifyEqualLogs(DOMAIN.decryption, decryptionContext(electionId, partial.trusteeId, j), a, y, d, partial.proofs[j])) {
        return { ok: false, reason: `Dovada decriptării parțiale pică la candidatul de pe poziția ${j + 1}`, candidate: j }
      }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}
