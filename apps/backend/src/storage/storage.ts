// Stratul de stocare, abstractizat.
//
// Fiecare repository corespunde unei tabele din schema PostgreSQL (db/schema.sql).
// Acum rulează implementarea în memorie (MemoryStorage, opțional salvată într-un
// fișier JSON); pentru PostgreSQL se scrie o clasă PostgresStorage care
// implementează aceeași interfață și se schimbă doar providerul din StorageModule.
// Serviciile nu știu ce stocare folosesc.
//
// Reguli pe care orice implementare trebuie să le respecte (le cer testele):
//   • unicitatea (election_id, cnp_hmac) și (election_id, credential_pubkey) la înregistrări
//     → UniqueViolation
//   • ballots este append-only: nu există update sau delete
//   • appendBallot e atomic: citește ultima intrare și scrie următoarea fără ca altă
//     cerere să se strecoare între ele (în PostgreSQL: tranzacție + SELECT … FOR UPDATE
//     sau advisory lock per scrutin, plus UNIQUE(election_id, seq) și UNIQUE(election_id, credential_pubkey))

import type { BoardEntry, Ciphertext, CompactProof, PartialDecryption } from '@evoting/crypto'
import type { ElectionStatus, RegistrationMethod, TrustLevel } from '@evoting/api'

export const STORAGE = Symbol('STORAGE')

/** Încălcarea unei constrângeri de unicitate (în PostgreSQL: codul 23505). */
export class UniqueViolation extends Error {
  constructor(readonly constraint: string) {
    super(`unique violation: ${constraint}`)
    this.name = 'UniqueViolation'
  }
}

// ───────────── Rândurile tabelelor ─────────────

export interface ElectionRow {
  id: string
  title: string
  status: ElectionStatus
  opensAt: string
  closesAt: string
  minSelections: number
  maxSelections: number
  /** Y = ΣYᵢ, completat când toți trustees și-au trimis cheia. */
  publicKey: string | null
  /** Agregatul per candidat, calculat la închidere. */
  aggregate: Ciphertext[] | null
  /** Câte buletine au intrat în agregat. */
  tallyBallotCount: number | null
  createdAt: string
}

export interface CandidateRow {
  id: string
  electionId: string
  name: string
  description: string
  position: number
}

export interface TrusteeRow {
  id: string
  electionId: string
  name: string
  /** Doar Yᵢ, niciodată xᵢ. */
  publicKeyShare: string | null
  keyProof: CompactProof | null
  /** SHA-256 al codului de acces al trustee-ului (codul în clar nu se stochează). */
  inviteCodeHash: string | null
}

export interface RegistrationRow {
  electionId: string
  cnpHmac: string
  credentialPubkey: string
  method: RegistrationMethod
  trustLevel: TrustLevel
  registeredAt: string
}

export interface PartialDecryptionRow {
  electionId: string
  trusteeId: string
  partial: PartialDecryption
  submittedAt: string
}

export interface ResultRow {
  electionId: string
  counts: number[]
  publishedAt: string
}

export interface AuditRow {
  id: number
  electionId: string | null
  actor: string
  action: string
  payload: Record<string, unknown>
  createdAt: string
}

// ───────────── Repository-uri ─────────────

export interface ElectionsRepository {
  insert(election: ElectionRow, candidates: CandidateRow[], trustees: TrusteeRow[]): Promise<void>
  findById(id: string): Promise<ElectionRow | null>
  list(): Promise<ElectionRow[]>
  update(id: string, patch: Partial<Omit<ElectionRow, 'id'>>): Promise<ElectionRow>
  candidates(electionId: string): Promise<CandidateRow[]>
}

export interface TrusteesRepository {
  listByElection(electionId: string): Promise<TrusteeRow[]>
  findById(electionId: string, trusteeId: string): Promise<TrusteeRow | null>
  update(electionId: string, trusteeId: string, patch: Partial<Omit<TrusteeRow, 'id' | 'electionId'>>): Promise<TrusteeRow>
}

export interface EligibleVotersRepository {
  /** Inserează amprentele noi; întoarce câte erau deja în listă. */
  addMany(electionId: string, cnpHmacs: string[]): Promise<{ inserted: number; duplicates: number }>
  exists(electionId: string, cnpHmac: string): Promise<boolean>
  count(electionId: string): Promise<number>
}

export interface RegistrationsRepository {
  /** Aruncă UniqueViolation('registrations_cnp') sau ('registrations_credential'). */
  insert(row: RegistrationRow): Promise<void>
  findByCredential(electionId: string, credentialPubkey: string): Promise<RegistrationRow | null>
  count(electionId: string): Promise<{ total: number; nfc: number }>
  /** Cheile publice ale credentialelor, în ordinea înregistrării (publice, fără identitate). */
  credentials(electionId: string): Promise<string[]>
}

export interface BallotsRepository {
  /**
   * Adaugă atomic o intrare. `build` primește ultima intrare (sau null) și întoarce
   * intrarea nouă; între citire și scriere nicio altă adăugare nu poate interveni.
   * Aruncă UniqueViolation('ballots_credential') dacă credentialul a votat deja.
   */
  append(electionId: string, build: (last: BoardEntry | null) => BoardEntry | Promise<BoardEntry>): Promise<BoardEntry>
  list(electionId: string): Promise<BoardEntry[]>
  last(electionId: string): Promise<BoardEntry | null>
  count(electionId: string): Promise<number>
  /** Caută după codul de urmărire sau după hash-ul intrării. */
  findByCode(electionId: string, code: string): Promise<BoardEntry | null>
  hasCredential(electionId: string, credentialPubkey: string): Promise<boolean>
}

export interface PartialDecryptionsRepository {
  /** O singură decriptare per trustee: aruncă UniqueViolation('partial_decryptions_trustee'). */
  insert(row: PartialDecryptionRow): Promise<void>
  list(electionId: string): Promise<PartialDecryptionRow[]>
}

export interface ResultsRepository {
  insert(row: ResultRow): Promise<void>
  find(electionId: string): Promise<ResultRow | null>
}

export interface AuditLogRepository {
  append(row: Omit<AuditRow, 'id'>): Promise<AuditRow>
  list(electionId: string): Promise<AuditRow[]>
}

export interface Storage {
  readonly kind: string
  elections: ElectionsRepository
  trustees: TrusteesRepository
  eligibleVoters: EligibleVotersRepository
  registrations: RegistrationsRepository
  ballots: BallotsRepository
  partialDecryptions: PartialDecryptionsRepository
  results: ResultsRepository
  auditLog: AuditLogRepository
  /**
   * Rulează fn exclusiv față de alte apeluri cu aceeași cheie (de exemplu,
   * schimbarea stării unui scrutin vs. adăugarea unui buletin).
   * În PostgreSQL: tranzacție cu pg_advisory_xact_lock(hashtext(key)).
   */
  exclusive<T>(key: string, fn: () => Promise<T>): Promise<T>
}
