// Buletinul de vot: câte un criptotext 0/1 per candidat, dovezile că fiecare
// e 0 sau 1 și că suma e 1, plus semnătura credentialului peste tot ansamblul.

import { authMessage, signMessage, verifySignature } from './credential.js'
import {
  addCiphertexts,
  decodeCiphertext,
  encodeCiphertext,
  encryptPoints,
  preparePublicKey,
  type CiphertextPoints,
} from './elgamal.js'
import { G, modQ, randomNonZeroScalar, scalarFromHex, scalarToHex } from './group.js'
import { hashObject } from './hash.js'
import { DOMAIN, proveEqualLogs, proveZeroOne, verifyEqualLogs, verifyZeroOne } from './proofs.js'
import type { Ballot, BallotProofs, Ciphertext, ElectionParams } from './types.js'

export { authMessage }

/** Contextul Fiat-Shamir al unui buletin: scrutinul, cheia lui și credentialul alegătorului. */
const ballotContext = (params: ElectionParams, credentialPubkey: string) => [
  params.electionId,
  params.publicKey,
  String(params.candidateCount),
  credentialPubkey,
]

/** Ce semnează credentialul: totul în afară de semnătura însăși. */
export function ballotDigest(ballot: Omit<Ballot, 'signature'>): string {
  return hashObject({
    electionId: ballot.electionId,
    credentialPubkey: ballot.credentialPubkey,
    ciphertexts: ballot.ciphertexts,
    proofs: ballot.proofs,
  })
}

export const ballotSignatureMessage = (digest: string) => `evoting/v1/ballot|${digest}`

/** Hash-ul buletinului semnat, care intră în intrarea de pe board. */
export const ballotHash = (ballot: Ballot) =>
  hashObject({
    electionId: ballot.electionId,
    credentialPubkey: ballot.credentialPubkey,
    ciphertexts: ballot.ciphertexts,
    proofs: ballot.proofs,
    signature: ballot.signature,
  })

/** Secretele unui buletin, păstrate doar pentru provocarea Benaloh. */
export interface BallotSecrets {
  choice: number
  randomness: string[]
}

export interface EncryptedBallot {
  ballot: Ballot
  secrets: BallotSecrets
}

export function encryptBallot(params: ElectionParams, choice: number, credentialSecretKey: string, credentialPubkey: string): EncryptedBallot {
  const n = params.candidateCount
  if (!Number.isInteger(choice) || choice < 0 || choice >= n) throw new Error('Opțiune în afara listei de candidați')
  const y = preparePublicKey(params.publicKey)
  const context = ballotContext(params, credentialPubkey)

  const randomness: bigint[] = []
  const points: CiphertextPoints[] = []
  const choices = []
  for (let j = 0; j < n; j++) {
    const m = j === choice ? 1 : 0
    const r = randomNonZeroScalar()
    const ct = encryptPoints(y, m, r)
    randomness.push(r)
    points.push(ct)
    choices.push(proveZeroOne([...context, String(j)], y, ct.a, ct.b, m, r))
  }

  const sum = addCiphertexts(points)
  const rSum = modQ(randomness.reduce((acc, r) => acc + r, 0n))
  const proofs: BallotProofs = {
    choices,
    sum: proveEqualLogs(DOMAIN.sum, context, y, sum.a, sum.b.subtract(G), rSum),
  }

  const unsigned = { electionId: params.electionId, credentialPubkey, ciphertexts: points.map(encodeCiphertext), proofs }
  const signature = signMessage(credentialSecretKey, ballotSignatureMessage(ballotDigest(unsigned)))
  return {
    ballot: { ...unsigned, signature },
    secrets: { choice, randomness: randomness.map(scalarToHex) },
  }
}

export type BallotCheck = { ok: true } | { ok: false; reason: string; candidate?: number }

function checkShape(params: ElectionParams, ballot: Ballot): BallotCheck {
  if (!ballot || typeof ballot !== 'object') return { ok: false, reason: 'Buletinul lipsește' }
  if (ballot.electionId !== params.electionId) return { ok: false, reason: 'Buletinul aparține altui scrutin' }
  const n = params.candidateCount
  if (!Array.isArray(ballot.ciphertexts) || ballot.ciphertexts.length !== n) {
    return { ok: false, reason: `Se așteaptă ${n} criptotexte` }
  }
  const proofs = ballot.proofs
  if (!proofs || !Array.isArray(proofs.choices) || proofs.choices.length !== n || !proofs.sum) {
    return { ok: false, reason: 'Dovezile sunt incomplete' }
  }
  return { ok: true }
}

export function verifyBallotSignature(ballot: Ballot): boolean {
  return verifySignature(ballot.credentialPubkey, ballotSignatureMessage(ballotDigest(ballot)), ballot.signature)
}

/** Dovezile ZK: fiecare criptotext e 0 sau 1, iar suma e 1. */
export function verifyBallotProofs(params: ElectionParams, ballot: Ballot): BallotCheck {
  try {
    const shape = checkShape(params, ballot)
    if (!shape.ok) return shape
    const n = params.candidateCount
    const y = preparePublicKey(params.publicKey)
    const context = ballotContext(params, ballot.credentialPubkey)
    const points = ballot.ciphertexts.map((ct, j) => decodeCiphertext(ct, `criptotextul ${j + 1}`))
    for (let j = 0; j < n; j++) {
      if (!verifyZeroOne([...context, String(j)], y, points[j].a, points[j].b, ballot.proofs.choices[j])) {
        return { ok: false, reason: `Dovada „0 sau 1” pică la candidatul de pe poziția ${j + 1}`, candidate: j }
      }
    }
    const sum = addCiphertexts(points)
    if (!verifyEqualLogs(DOMAIN.sum, context, y, sum.a, sum.b.subtract(G), ballot.proofs.sum)) {
      return { ok: false, reason: 'Dovada că suma voturilor e 1 pică' }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

/** Verifică forma, semnătura și dovezile unui buletin. Nu verifică eligibilitatea credentialului. */
export function verifyBallot(params: ElectionParams, ballot: Ballot): BallotCheck {
  const shape = checkShape(params, ballot)
  if (!shape.ok) return shape
  if (!verifyBallotSignature(ballot)) return { ok: false, reason: 'Semnătura credentialului nu e validă' }
  return verifyBallotProofs(params, ballot)
}

export type AuditCheck = { ok: true; choice: number } | { ok: false; reason: string }

/**
 * Provocarea Benaloh: cu r-urile dezvăluite, oricine recriptează opțiunea
 * declarată și compară cu buletinul. Un buletin auditat nu se mai trimite.
 */
export function auditBallot(params: ElectionParams, ciphertexts: readonly Ciphertext[], secrets: BallotSecrets): AuditCheck {
  try {
    const n = params.candidateCount
    if (ciphertexts.length !== n || secrets.randomness.length !== n) return { ok: false, reason: 'Număr greșit de criptotexte' }
    const y = preparePublicKey(params.publicKey)
    for (let j = 0; j < n; j++) {
      const r = scalarFromHex(secrets.randomness[j], `r${j + 1}`)
      const expected = encodeCiphertext(encryptPoints(y, j === secrets.choice ? 1 : 0, r))
      if (expected.a !== ciphertexts[j].a || expected.b !== ciphertexts[j].b) {
        return { ok: false, reason: `Criptotextul ${j + 1} nu corespunde opțiunii declarate` }
      }
    }
    return { ok: true, choice: secrets.choice }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}
