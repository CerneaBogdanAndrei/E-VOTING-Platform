// Ajutoare comune testelor: un scrutin simulat fără server, o cheie de test cu o
// singură parte secretă și un buletin „trișat” care încearcă să treacă dovezile.

import {
  addCiphertexts,
  appendEntry,
  ballotDigest,
  ballotSignatureMessage,
  combinePartialDecryptions,
  combinePublicKeys,
  computeAggregate,
  decodeCiphertext,
  DOMAIN,
  encrypt,
  encryptBallot,
  G,
  generateCredential,
  generateTrusteeKey,
  partialDecrypt,
  pointFromHex,
  pointToHex,
  proveEqualLogs,
  proveZeroOne,
  randomScalar,
  signMessage,
  type AuditBundle,
  type Ballot,
  type BoardEntry,
  type ElectionParams,
  type TrusteeKeyPair,
} from '../src/index.js'

export interface SimulatedElection {
  params: ElectionParams
  trusteeKeys: TrusteeKeyPair[]
  bundle: AuditBundle
}

/** Un scrutin complet, fără server: chei, voturi, board, agregat, decriptări și rezultat. */
export function simulateElection(electionId: string, candidateCount: number, votes: number[], trustees = 3): SimulatedElection {
  const keys = Array.from({ length: trustees }, (_, i) => generateTrusteeKey(electionId, `t${i + 1}`))
  const publicKey = combinePublicKeys(keys.map((k) => k.publicKey.publicKeyShare))
  const params: ElectionParams = { electionId, publicKey, candidateCount }

  const registrations: { credentialPubkey: string }[] = []
  const board: BoardEntry[] = []
  votes.forEach((choice, k) => {
    const cred = generateCredential()
    registrations.push({ credentialPubkey: cred.publicKey })
    const { ballot } = encryptBallot(params, choice, cred.secretKey, cred.publicKey)
    board.push(appendEntry(electionId, board.at(-1), ballot, new Date(Date.UTC(2026, 10, 3, 8, 0, k)).toISOString()))
  })

  const aggregate = computeAggregate(candidateCount, board)
  const partials = keys.map((k) => partialDecrypt(k.keyPair, aggregate))
  const counts = combinePartialDecryptions(aggregate, partials, board.length)
  const candidates = Array.from({ length: candidateCount }, (_, j) => ({ id: `c${j + 1}`, position: j, name: `Candidat ${j + 1}` }))

  return {
    params,
    trusteeKeys: keys.map((k) => k.keyPair),
    bundle: {
      election: {
        id: electionId,
        publicKey,
        candidates,
        trustees: keys.map((k) => ({
          id: k.keyPair.trusteeId,
          name: k.keyPair.trusteeId,
          publicKeyShare: k.publicKey.publicKeyShare,
          keyProof: k.publicKey.proof,
        })),
      },
      registrations,
      board,
      tally: { aggregate, partials },
      result: { counts: counts.map((n, j) => ({ candidateId: candidates[j].id, votes: n })), totalBallots: board.length },
    },
  }
}

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/** Cheie de scrutin cu o singură parte secretă, pentru testele de criptare. */
export function testKey() {
  const x = randomScalar()
  return { x, publicKey: pointToHex(G.multiply(x)) }
}

/**
 * Buletin „trișat”: criptează valorile date (pot fi 2 sau −1) și încearcă
 * dovezile ca și cum ar fi 0/1. Semnătura e corectă, deci doar dovezile îl pot opri.
 */
export function forgeBallot(params: ElectionParams, values: number[]): Ballot {
  const cred = generateCredential()
  const y = pointFromHex(params.publicKey)
  const context = [params.electionId, params.publicKey, String(params.candidateCount), cred.publicKey]
  const rs = values.map(() => randomScalar())
  const ciphertexts = values.map((m, j) => encrypt(params.publicKey, BigInt(m), rs[j]))
  const points = ciphertexts.map((c) => decodeCiphertext(c))
  const choices = points.map((p, j) => proveZeroOne([...context, String(j)], y, p.a, p.b, values[j] === 1 ? 1 : 0, rs[j]))
  const sum = addCiphertexts(points)
  const rSum = rs.reduce((a, b) => a + b, 0n)
  const proofs = { choices, sum: proveEqualLogs(DOMAIN.sum, context, y, sum.a, sum.b.subtract(G), rSum) }
  const unsigned = { electionId: params.electionId, credentialPubkey: cred.publicKey, ciphertexts, proofs }
  return { ...unsigned, signature: signMessage(cred.secretKey, ballotSignatureMessage(ballotDigest(unsigned))) }
}
