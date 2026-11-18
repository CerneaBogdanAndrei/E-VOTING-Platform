// Scrutinul, așa cum îl publică serverul și cum îl creează sau îl modifică comisia.

import type { ChaumPedersenProof } from '@evoting/crypto'

export type ElectionStatus = 'draft' | 'open' | 'closed' | 'tallied'

/** `blank` e opțiunea „vot alb”: un candidat special, criptat la fel ca ceilalți, afișat separat. */
export type CandidateKind = 'candidate' | 'blank'

export interface Candidate {
  id: string
  name: string
  description: string
  /** Poziția în vectorul de vot (0, 1, 2, ...). */
  position: number
  kind: CandidateKind
}

export interface Trustee {
  id: string
  name: string
  /** Yᵢ = xᵢG, hex. null până când CLI-ul de trustee trimite cheia. */
  publicKeyShare: string | null
  /** Dovada Schnorr că trustee-ul cunoaște xᵢ. */
  keyProof: ChaumPedersenProof | null
  partialDecryptionSubmitted: boolean
}

export interface ElectionStats {
  eligible: number
  registered: number
  ballots: number
}

export interface Election {
  id: string
  title: string
  status: ElectionStatus
  /** Votul se poate trimite doar în intervalul [opensAt, closesAt]; la closesAt serverul închide singur. */
  opensAt: string
  closesAt: string
  /** Y = ΣYᵢ, hex. null până când toți trustees și-au trimis cheia. */
  publicKey: string | null
  candidates: Candidate[]
  trustees: Trustee[]
  stats: ElectionStats
}

export interface CreateElectionInput {
  title: string
  opensAt: string
  closesAt: string
  candidates: { name: string; description: string }[]
  trustees: { name: string }[]
  /** Adaugă opțiunea „vot alb” la sfârșitul listei. */
  allowBlank?: boolean
}

/** Ce se poate schimba cât timp scrutinul e în configurare (trustees nu: au token-uri deja emise). */
export type UpdateElectionInput = Partial<Pick<CreateElectionInput, 'title' | 'opensAt' | 'closesAt' | 'candidates' | 'allowBlank'>>

/** Token-ul unui trustee se afișează o singură dată, la crearea scrutinului; serverul păstrează doar hash-ul lui. */
export interface TrusteeToken {
  trusteeId: string
  name: string
  token: string
}

export interface CreatedElection {
  election: Election
  trusteeTokens: TrusteeToken[]
}

export interface EligibleImportResult {
  imported: number
  duplicates: number
  invalid: { line: number; value: string }[]
}
