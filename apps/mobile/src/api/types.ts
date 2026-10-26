// Contractul HTTP dintre frontend și backend (rutele din planul aplicației).
// Fișierul e identic în web și mobile; când backend-ul NestJS publică
// specificația OpenAPI, tipurile de aici se pot genera din ea.

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

/** Criptotext ElGamal (A, B), hex. */
export interface Ciphertext {
  a: string
  b: string
}

export interface BallotSubmission {
  credentialPubkey: string
  /** Câte un criptotext per candidat, în ordinea pozițiilor. */
  ciphertexts: Ciphertext[]
  proofs: unknown
  signature: string
}

export interface BallotReceipt {
  seq: number
  /** Codul de urmărire = hash-ul intrării de pe board. */
  trackingCode: string
  receivedAt: string
}

export interface BoardEntry {
  seq: number
  hash: string
  prevHash: string
  credentialPubkey: string
  ciphertexts: Ciphertext[]
  receivedAt: string
}

export interface ElectionResult {
  electionId: string
  counts: { candidateId: string; votes: number }[]
  totalBallots: number
  publishedAt: string
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
  listElections(): Promise<Election[]>
  getElection(id: string): Promise<Election>
  createElection(input: CreateElectionInput): Promise<Election>
  importEligible(id: string, csv: string): Promise<EligibleImportResult>
  openElection(id: string): Promise<Election>
  closeElection(id: string): Promise<Election>
  registerOcr(id: string, input: RegisterOcrInput): Promise<Registration>
  registerNfc(id: string, input: RegisterNfcInput): Promise<Registration>
  castBallot(id: string, ballot: BallotSubmission): Promise<BallotReceipt>
  getBoard(id: string): Promise<BoardEntry[]>
  /** 404 dacă nu există niciun buletin cu acest cod. */
  findBallot(id: string, trackingCode: string): Promise<BoardEntry>
  /** 404 până la publicarea rezultatului. */
  getResult(id: string): Promise<ElectionResult>
}
