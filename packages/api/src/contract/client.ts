// Interfața comună a clientului API. Clientul HTTP și backend-ul simulat o
// implementează identic, deci ecranele nu știu cu care vorbesc.

import type { Ballot, BoardEntry, PartialDecryption, TrusteePublicKey } from '@evoting/crypto'
import type { AdminIdentity, CommissionMember, CreateMemberInput, CreatedMember } from './admin.js'
import type { AuditBundleResponse, AuditLogEntry, BoardHead, BoardPage, ElectionResult, TallyInfo } from './board.js'
import type { CreateElectionInput, CreatedElection, Election, EligibleImportResult, UpdateElectionInput } from './election.js'
import type { AuthChallenge, AuthSession, BallotReceipt, PublicRegistration, RegisterNfcInput, RegisterOcrInput, Registration } from './voter.js'

export interface ApiClient {
  // public
  listElections(): Promise<Election[]>
  getElection(id: string): Promise<Election>
  /** Tot board-ul. Pentru afișare, `getBoardPage`. */
  getBoard(id: string): Promise<BoardEntry[]>
  /** O pagină din board (cele mai noi intrări primele). */
  getBoardPage(id: string, page: number, size: number): Promise<BoardPage>
  /** 404 dacă nu există niciun buletin cu acest cod. */
  findBallot(id: string, trackingCode: string): Promise<BoardEntry>
  getBoardHead(id: string): Promise<BoardHead>
  getRegistrations(id: string): Promise<PublicRegistration[]>
  getTally(id: string): Promise<TallyInfo>
  /** 404 până la publicarea rezultatului. */
  getResult(id: string): Promise<ElectionResult>
  getAuditBundle(id: string): Promise<AuditBundleResponse>

  // comisia (cer token de comisie; rolul `observator` doar citește)
  createElection(input: CreateElectionInput): Promise<CreatedElection>
  /** Doar în `draft`. */
  updateElection(id: string, input: UpdateElectionInput): Promise<Election>
  /** Doar în `draft`: șterge scrutinul cu candidații, trustees, eligibilii și înregistrările lui. */
  deleteElection(id: string): Promise<void>
  /** În `draft` sau `open`. */
  importEligible(id: string, csv: string): Promise<EligibleImportResult>
  openElection(id: string): Promise<Election>
  closeElection(id: string): Promise<Election>
  getAuditLog(id: string): Promise<AuditLogEntry[]>
  /** Cine e autentificat; 401 dacă token-ul e greșit. */
  checkAdmin(): Promise<AdminIdentity>
  listMembers(): Promise<CommissionMember[]>
  createMember(input: CreateMemberInput): Promise<CreatedMember>
  revokeMember(id: string): Promise<void>

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
