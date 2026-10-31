// Pașii alegătorului, comuni aplicației mobile, scripturilor de demo și testelor.

import { authMessage, encryptBallot, signBallot, signMessage, type CredentialKeyPair, type ElectionParams, type EncryptedBallot } from '@evoting/crypto'
import type { ApiClient } from './client.js'
import type { BallotReceipt, Election } from './types.js'

/** Parametrii criptografici publici, extrași din răspunsul GET /elections/:id. */
export function electionParams(election: Election): ElectionParams {
  if (!election.publicKey) throw new Error('Scrutinul nu are încă cheia publică (lipsesc cheile trustees)')
  const candidates = [...election.candidates].sort((a, b) => a.position - b.position)
  return {
    electionId: election.id,
    candidates: candidates.map((c) => c.name),
    minSelections: election.minSelections,
    maxSelections: election.maxSelections,
    publicKey: election.publicKey,
    trustees: election.trustees.map((t) => {
      if (!t.publicKeyShare || !t.keyProof) throw new Error(`Lipsește cheia trustee-ului ${t.name}`)
      return { id: t.id, name: t.name, publicKeyShare: t.publicKeyShare, proof: t.keyProof }
    }),
  }
}

/** Autentificare prin semnarea unei provocări de la server cu cheia de credential. */
export async function authenticate(api: ApiClient, electionId: string, credential: CredentialKeyPair): Promise<string> {
  const { nonce } = await api.authChallenge({ electionId, credentialPubkey: credential.publicKey })
  const signature = signMessage(credential.secretKey, authMessage(electionId, nonce))
  const session = await api.authVerify({ electionId, credentialPubkey: credential.publicKey, nonce, signature })
  return session.token
}

/** Semnează și trimite un buletin deja criptat (după o eventuală provocare Benaloh). */
export async function submitBallot(api: ApiClient, electionId: string, credential: CredentialKeyPair, encrypted: EncryptedBallot): Promise<BallotReceipt> {
  const token = await authenticate(api, electionId, credential)
  return api.castBallot(electionId, token, signBallot(encrypted.body, credential.secretKey))
}

/** Criptează, semnează și trimite votul într-un singur pas. */
export async function vote(api: ApiClient, election: Election, credential: CredentialKeyPair, choices: number | number[]): Promise<BallotReceipt> {
  const encrypted = encryptBallot(electionParams(election), credential.publicKey, choices)
  return submitBallot(api, election.id, credential, encrypted)
}
