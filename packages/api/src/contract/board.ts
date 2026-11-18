// Ce publică serverul pentru verificare: board-ul, agregatul, decriptările, rezultatul, jurnalul.
// Formatele criptografice vin din @evoting/crypto, ca o dovadă generată pe telefon să fie
// verificată de exact același cod pe server și la audit.

import type { Ballot, BoardEntry, ChaumPedersenProof, Ciphertext, PartialDecryption, TrusteePublicKey } from '@evoting/crypto'
import type { Election } from './election.js'
import type { PublicRegistration } from './voter.js'

export type { Ballot, BoardEntry, ChaumPedersenProof, Ciphertext, PartialDecryption, TrusteePublicKey }

export interface BoardHead {
  seq: number
  hash: string
}

/** O pagină din board, pentru afișare; verificatorul folosește board-ul întreg din audit-bundle. */
export interface BoardPage {
  entries: BoardEntry[]
  total: number
  page: number
  size: number
}

export interface TallyInfo {
  /** Criptotextele agregate per candidat, publicate la închidere. */
  aggregate: Ciphertext[] | null
  partials: PartialDecryption[]
}

export interface ElectionResult {
  electionId: string
  counts: { candidateId: string; votes: number }[]
  totalBallots: number
  publishedAt: string
}

export interface AuditLogEntry {
  id: number
  actor: string
  action: string
  payload: unknown
  createdAt: string
}

/** Tot ce are nevoie verificatorul public, într-un singur document. */
export interface AuditBundleResponse {
  election: Election
  registrations: PublicRegistration[]
  board: BoardEntry[]
  tally: TallyInfo
  result: ElectionResult | null
  head: BoardHead
}
