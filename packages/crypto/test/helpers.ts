import {
  appendEntry,
  combinePartialDecryptions,
  combinePublicKeys,
  computeAggregate,
  encryptBallot,
  generateCredential,
  generateTrusteeKey,
  partialDecrypt,
  type AuditBundle,
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
        trustees: keys.map((k) => ({ id: k.keyPair.trusteeId, name: k.keyPair.trusteeId, publicKeyShare: k.publicKey.publicKeyShare, keyProof: k.publicKey.proof })),
      },
      registrations,
      board,
      tally: { aggregate, partials },
      result: { counts: counts.map((votes, j) => ({ candidateId: candidates[j].id, votes })), totalBallots: board.length },
    },
  }
}

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
