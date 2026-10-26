// Pașii alegătorului din aplicație, comuni pentru mobil, simulator și teste:
// autentificare cu credentialul, criptarea buletinului, trimiterea și verificarea.

import {
  authMessage,
  checkOwnEntry,
  encryptBallot,
  signMessage,
  type ElectionParams,
  type EncryptedBallot,
} from '@evoting/crypto'
import type { ApiClient, BallotReceipt, Election } from './types.js'

export interface VoterCredential {
  secretKey: string
  publicKey: string
}

export function electionParams(election: Election): ElectionParams {
  if (!election.publicKey) throw new Error('Cheia scrutinului nu e încă publicată')
  return { electionId: election.id, publicKey: election.publicKey, candidateCount: election.candidates.length }
}

/** Pasul 1 al votului: serverul trimite un nonce, aplicația îl semnează cu cheia de credential. */
export async function authenticate(api: ApiClient, electionId: string, credential: VoterCredential): Promise<string> {
  const challenge = await api.authChallenge(electionId, credential.publicKey)
  const signature = signMessage(credential.secretKey, authMessage(electionId, credential.publicKey, challenge.nonce))
  const session = await api.authVerify(challenge.challengeId, signature)
  return session.token
}

/** Criptează opțiunea (poziția candidatului) și generează dovezile și semnătura. */
export function prepareBallot(election: Election, credential: VoterCredential, position: number): EncryptedBallot {
  return encryptBallot(electionParams(election), position, credential.secretKey, credential.publicKey)
}

export async function submitBallot(api: ApiClient, election: Election, credential: VoterCredential, prepared: EncryptedBallot): Promise<BallotReceipt> {
  const token = await authenticate(api, election.id, credential)
  return api.castBallot(election.id, prepared.ballot, token)
}

export type OwnBallotCheck =
  | { status: 'ok'; seq: number }
  | { status: 'missing' }
  | { status: 'modified'; reason: string }

/** Caută buletinul pe board după cod și verifică local că e exact cel trimis. */
export async function verifyOwnBallot(api: ApiClient, electionId: string, receipt: Pick<BallotReceipt, 'trackingCode' | 'ballotHash'>): Promise<OwnBallotCheck> {
  let entry
  try {
    entry = await api.findBallot(electionId, receipt.trackingCode)
  } catch (err) {
    if ((err as { status?: number }).status === 404) return { status: 'missing' }
    throw err
  }
  const check = checkOwnEntry(electionId, entry, receipt)
  return check.ok ? { status: 'ok', seq: entry.seq } : { status: 'modified', reason: check.reason }
}
