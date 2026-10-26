import { randomHex } from './platform'
import type { BallotSubmission } from './types'

// PLACEHOLDER: aici nu se criptează nimic. Funcțiile se înlocuiesc cu
// packages/crypto (ElGamal exponențial pe ristretto255, dovezi Chaum-Pedersen,
// semnătura cu cheia de credential din Android Keystore), conform planului.
export const CRYPTO_READY = false

export interface PlaceholderProofs {
  kind: 'placeholder'
  /** Votul în clar. Există doar până apare criptografia reală. */
  plaintext: number[]
}

export function buildBallot(candidateCount: number, choice: number, credentialPubkey: string): BallotSubmission {
  const plaintext = Array.from({ length: candidateCount }, (_, i) => (i === choice ? 1 : 0))
  const proofs: PlaceholderProofs = { kind: 'placeholder', plaintext }
  return {
    credentialPubkey,
    ciphertexts: plaintext.map(() => ({ a: randomHex(32), b: randomHex(32) })),
    proofs,
    signature: '',
  }
}

/** Stă în locul cheii publice de credential generate în Android Keystore. */
export function newCredential(): string {
  return randomHex(32)
}
