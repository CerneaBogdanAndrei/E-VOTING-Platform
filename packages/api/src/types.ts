// Contractul HTTP dintre clienți (web, mobil, CLI) și backend, după rutele din
// planul aplicației. Formatele criptografice vin din @evoting/crypto, ca o dovadă
// generată pe telefon să fie verificată de exact același cod pe server și la audit.

import type {
  Ballot,
  BoardEntry,
  ChaumPedersenProof,
  Ciphertext,
  PartialDecryption,
  TrusteePublicKey,
} from '@evoting/crypto'

export type { Ballot, BoardEntry, ChaumPedersenProof, Ciphertext, PartialDecryption, TrusteePublicKey }

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
}

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

/** Ce se publică despre înregistrări: doar credentialele, fără nicio legătură cu persoana. */
export type PublicRegistration = Omit<Registration, 'electionId'>

export interface AuthChallenge {
  challengeId: string
  nonce: string
  expiresAt: string
}

export interface AuthSession {
  token: string
  expiresAt: string
}

export interface BallotReceipt {
  seq: number
  /** Codul de urmărire = hash-ul intrării de pe board. */
  trackingCode: string
  ballotHash: string
  receivedAt: string
}

export interface BoardHead {
  seq: number
  hash: string
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

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface ApiClient {
  // public
  listElections(): Promise<Election[]>
  getElection(id: string): Promise<Election>
  getBoard(id: string): Promise<BoardEntry[]>
  /** 404 dacă nu există niciun buletin cu acest cod. */
  findBallot(id: string, trackingCode: string): Promise<BoardEntry>
  getBoardHead(id: string): Promise<BoardHead>
  getRegistrations(id: string): Promise<PublicRegistration[]>
  getTally(id: string): Promise<TallyInfo>
  /** 404 până la publicarea rezultatului. */
  getResult(id: string): Promise<ElectionResult>
  getAuditBundle(id: string): Promise<AuditBundleResponse>

  // comisia (cer token de administrator)
  createElection(input: CreateElectionInput): Promise<CreatedElection>
  importEligible(id: string, csv: string): Promise<EligibleImportResult>
  openElection(id: string): Promise<Election>
  closeElection(id: string): Promise<Election>
  getAuditLog(id: string): Promise<AuditLogEntry[]>
  checkAdmin(): Promise<void>

  // trustees (cer token-ul trustee-ului)
  submitTrusteeKey(id: string, token: string, key: TrusteePublicKey): Promise<Election>
  submitPartialDecryption(id: string, token: string, partial: PartialDecryption): Promise<Election>

  // alegătorul
  registerOcr(id: string, input: RegisterOcrInput): Promise<Registration>
  registerNfc(id: string, input: RegisterNfcInput): Promise<Registration>
  authChallenge(id: string, credentialPubkey: string): Promise<AuthChallenge>
  authVerify(challengeId: string, signature: string): Promise<AuthSession>
  castBallot(id: string, ballot: Ballot, sessionToken: string): Promise<BallotReceipt>
}
