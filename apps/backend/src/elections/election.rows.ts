// Rândurile din PostgreSQL și transformarea lor în obiectele din contractul API.

import type { BoardEntry, Candidate, CandidateKind, ElectionResult, ElectionStatus, PublicRegistration, TallyInfo } from '@evoting/api'
import type { PartialDecryption } from '@evoting/crypto'

export interface ElectionRow {
  id: string
  title: string
  status: ElectionStatus
  opens_at: Date
  closes_at: Date
  public_key: string | null
  aggregate: TallyInfo['aggregate']
  eligible: string
  registered: string
  ballots: string
}

export interface CandidateRow {
  id: string
  election_id: string
  name: string
  description: string
  position: number
  kind: CandidateKind
}

export interface BallotRow {
  seq: number
  credential_pubkey: string
  ciphertexts: BoardEntry['ciphertexts']
  proofs: BoardEntry['proofs']
  signature: string
  ballot_hash: string
  prev_hash: string
  hash: string
  received_at: string
}

export interface RegistrationRow {
  credential_pubkey: string
  method: 'ocr' | 'nfc'
  trust_level: 'optic' | 'criptografic'
  registered_at: Date
}

export interface PartialRow {
  trustee_id: string
  shares: string[]
  proofs: PartialDecryption['proofs']
}

export interface ResultRow {
  counts: ElectionResult['counts']
  total_ballots: number
  published_at: Date
}

/** Scrutinul cu statisticile lui, calculate în aceeași interogare. */
export const ELECTION_SELECT = `
  SELECT e.id, e.title, e.status, e.opens_at, e.closes_at, e.public_key, e.aggregate,
    (SELECT count(*) FROM eligible_voters v WHERE v.election_id = e.id) AS eligible,
    (SELECT count(*) FROM registrations r WHERE r.election_id = e.id) AS registered,
    (SELECT count(*) FROM ballots b WHERE b.election_id = e.id) AS ballots
  FROM elections e`

export const toCandidate = (c: CandidateRow): Candidate => ({ id: c.id, name: c.name, description: c.description, position: c.position, kind: c.kind })

export const toEntry = (r: BallotRow): BoardEntry => ({
  seq: r.seq,
  hash: r.hash,
  prevHash: r.prev_hash,
  ballotHash: r.ballot_hash,
  credentialPubkey: r.credential_pubkey,
  ciphertexts: r.ciphertexts,
  proofs: r.proofs,
  signature: r.signature,
  receivedAt: r.received_at,
})

export const toRegistration = (r: RegistrationRow): PublicRegistration => ({
  credentialPubkey: r.credential_pubkey,
  method: r.method,
  trustLevel: r.trust_level,
  registeredAt: r.registered_at.toISOString(),
})

export const toPartial = (p: PartialRow): PartialDecryption => ({ trusteeId: p.trustee_id, shares: p.shares, proofs: p.proofs })

export const toResult = (electionId: string, r: ResultRow): ElectionResult => ({
  electionId,
  counts: r.counts,
  totalBallots: r.total_ballots,
  publishedAt: r.published_at.toISOString(),
})

/** Candidații de inserat, cu pozițiile lor; votul alb, dacă e cerut, e ultimul. */
export function candidateRows(
  electionId: string,
  candidates: { name: string; description: string }[],
  allowBlank: boolean,
): Omit<CandidateRow, 'election_id'>[] {
  const rows: Omit<CandidateRow, 'election_id'>[] = candidates.map((c, i) => ({
    id: `${electionId}-c${i + 1}`,
    name: c.name,
    description: c.description,
    position: i,
    kind: 'candidate',
  }))
  if (allowBlank) rows.push({ id: `${electionId}-alb`, name: 'Vot alb', description: '', position: rows.length, kind: 'blank' })
  return rows
}

/** ID-ul scrutinului pornește de la titlu: fără diacritice, doar litere, cifre și cratime. */
export function slug(title: string) {
  return (
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'scrutin'
  )
}
