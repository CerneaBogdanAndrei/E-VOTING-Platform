// Contractul HTTP dintre backend și clienți (web, mobil, CLI-uri).
// Un singur fișier, folosit de toate părțile, ca să nu se poată desincroniza.
// Structurile criptografice (buletin, intrare pe board, registrul scrutinului)
// vin din @evoting/crypto.

import type { Ballot, BoardEntry, Ciphertext, CompactProof, ElectionRecord, PartialDecryption, VerificationReport } from '@evoting/crypto'

export type { Ballot, BoardEntry, Ciphertext, CompactProof, ElectionRecord, PartialDecryption, VerificationReport }

export type ElectionStatus = 'draft' | 'open' | 'closed' | 'tallied'

export interface Candidate {
  id: string
  name: string
  description: string
  /** Poziția în vectorul de vot (0, 1, 2, ...). */
  position: number
}

export interface Trustee {
  id: string
  name: string
  /** Yᵢ = xᵢG, hex. null până când CLI-ul de trustee trimite cheia. */
  publicKeyShare: string | null
  /** Dovada Schnorr că trustee-ul își cunoaște cheia. */
  keyProof: CompactProof | null
  partialDecryptionSubmitted: boolean
}

export interface ElectionStats {
  eligible: number
  registered: number
  ballots: number
  /** Câte înregistrări au fost făcute prin NFC (nivel de încredere criptografic). */
  registeredNfc: number
}

export interface BoardHead {
  seq: number
  hash: string
}

export interface Election {
  id: string
  title: string
  status: ElectionStatus
  opensAt: string
  closesAt: string
  /** Câte opțiuni poate bifa alegătorul (implicit exact 1). */
  minSelections: number
  maxSelections: number
  /** Y = ΣYᵢ, hex. null până când toți trustees și-au trimis cheia. */
  publicKey: string | null
  candidates: Candidate[]
  trustees: Trustee[]
  stats: ElectionStats
  /** Capul lanțului de pe board, de publicat independent (de exemplu pe site-ul facultății). */
  boardHead: BoardHead
  createdAt: string
}

export interface CreateElectionInput {
  title: string
  opensAt: string
  closesAt: string
  candidates: { name: string; description: string }[]
  trustees: { name: string }[]
  minSelections?: number
  maxSelections?: number
}

export interface EligibleImportResult {
  imported: number
  duplicates: number
  invalid: { line: number; value: string }[]
}

export type RegistrationMethod = 'ocr' | 'nfc'
export type TrustLevel = 'optic' | 'criptografic'

export interface RegisterOcrInput {
  cnp: string
  credentialPubkey: string
}

export interface RegisterNfcInput {
  /** DG1 și SOD citite de pe cip, base64. Serverul face Passive Authentication. */
  dg1: string
  sod: string
  credentialPubkey: string
}

export interface Registration {
  electionId: string
  credentialPubkey: string
  method: RegistrationMethod
  trustLevel: TrustLevel
  registeredAt: string
}

export interface AuthChallengeInput {
  electionId: string
  credentialPubkey: string
}

export interface AuthChallenge {
  nonce: string
  expiresAt: string
}

export interface AuthVerifyInput extends AuthChallengeInput {
  nonce: string
  /** Semnătura Ed25519 peste authMessage(electionId, nonce). */
  signature: string
}

export interface AuthSession {
  token: string
  expiresAt: string
}

export interface BallotReceipt {
  seq: number
  /** Codul de urmărire = hash-ul buletinului (telefonul îl știe dinainte). */
  trackingCode: string
  /** Hash-ul intrării de pe board. */
  entryHash: string
  receivedAt: string
}

export interface TallyState {
  status: ElectionStatus
  /** Agregatul per candidat; null cât timp votul e deschis. */
  aggregate: Ciphertext[] | null
  ballotCount: number
  /** Trustees care și-au trimis deja decriptarea parțială. */
  submitted: string[]
}

export interface TrusteeKeySubmission {
  trusteeId: string
  publicKeyShare: string
  proof: CompactProof
}

export interface ElectionResult {
  electionId: string
  counts: { candidateId: string; votes: number }[]
  totalBallots: number
  eligible: number
  /** Cvorum: 1/3 + 1 din alegătorii eligibili (regulamentele de alegeri studențești). */
  quorum: number
  quorumReached: boolean
  publishedAt: string
}

export interface AuditLogEntry {
  id: number
  actor: string
  action: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface AdminSession {
  token: string
  expiresAt: string
}

export interface TrusteeInvite {
  trusteeId: string
  /** Codul de acces al trustee-ului pentru CLI. Se afișează o singură dată. */
  code: string
}

export interface ServerInfo {
  name: string
  version: string
  group: string
  demoMode: boolean
  nfcPassiveAuth: boolean
  time: string
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
