// Citirile din baza de date pentru scrutine (rutele publice) și blocarea rândului
// unui scrutin în tranzacții. Scrierile sunt în serviciile fiecărui modul.

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { AuditBundleResponse, BoardEntry, BoardHead, BoardPage, Election, ElectionResult, PublicRegistration, TallyInfo } from '@evoting/api'
import { genesisHash, normalizeTrackingCode, type ElectionParams } from '@evoting/crypto'
import { Database, type Queryable } from '../db/database.service.js'
import {
  ELECTION_SELECT,
  toCandidate,
  toEntry,
  toPartial,
  toRegistration,
  toResult,
  type BallotRow,
  type CandidateRow,
  type ElectionRow,
  type PartialRow,
  type RegistrationRow,
  type ResultRow,
} from './election.rows.js'

const REGISTRATIONS_SQL = 'SELECT credential_pubkey, method, trust_level, registered_at FROM registrations WHERE election_id = $1 ORDER BY id'
const PARTIALS_SQL =
  'SELECT p.trustee_id, p.shares, p.proofs FROM partial_decryptions p JOIN trustees t ON t.id = p.trustee_id WHERE p.election_id = $1 ORDER BY t.position'
const RESULT_SQL = 'SELECT counts, total_ballots, published_at FROM results WHERE election_id = $1'
const BOARD_SQL = 'SELECT * FROM ballots WHERE election_id = $1 ORDER BY seq'

export interface LockedElection {
  status: Election['status']
  opens_at: Date
  closes_at: Date
  public_key: string | null
  aggregate: TallyInfo['aggregate']
}

/** Parametrii de care depind criptarea și verificarea unui buletin, plus starea și intervalul. */
export interface ElectionParamsWithState extends ElectionParams {
  status: Election['status']
  opensAt: Date
  closesAt: Date
}

@Injectable()
export class ElectionsRepository {
  constructor(private readonly db: Database) {}

  /** Completează rândurile cu candidații și trustees, în două interogări pentru toate scrutinele. */
  private async hydrate(rows: ElectionRow[], client: Queryable = this.db): Promise<Election[]> {
    if (rows.length === 0) return []
    const ids = rows.map((r) => r.id)
    const candidates = await client.query<CandidateRow>(
      'SELECT id, election_id, name, description, position, kind FROM candidates WHERE election_id = ANY($1) ORDER BY position',
      [ids],
    )
    const trustees = await client.query<{
      id: string
      election_id: string
      name: string
      public_key_share: string | null
      key_proof: Election['trustees'][number]['keyProof']
      submitted: boolean
    }>(
      `SELECT t.id, t.election_id, t.name, t.public_key_share, t.key_proof,
         EXISTS (SELECT 1 FROM partial_decryptions p WHERE p.trustee_id = t.id) AS submitted
       FROM trustees t WHERE t.election_id = ANY($1) ORDER BY t.position`,
      [ids],
    )
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      opensAt: r.opens_at.toISOString(),
      closesAt: r.closes_at.toISOString(),
      publicKey: r.public_key,
      candidates: candidates.rows.filter((c) => c.election_id === r.id).map(toCandidate),
      trustees: trustees.rows
        .filter((t) => t.election_id === r.id)
        .map((t) => ({
          id: t.id,
          name: t.name,
          publicKeyShare: t.public_key_share,
          keyProof: t.key_proof,
          partialDecryptionSubmitted: t.submitted,
        })),
      stats: { eligible: Number(r.eligible), registered: Number(r.registered), ballots: Number(r.ballots) },
    }))
  }

  async list(): Promise<Election[]> {
    const { rows } = await this.db.query<ElectionRow>(`${ELECTION_SELECT} ORDER BY e.opens_at DESC`)
    return this.hydrate(rows)
  }

  async get(id: string, client: Queryable = this.db): Promise<Election> {
    const { rows } = await client.query<ElectionRow>(`${ELECTION_SELECT} WHERE e.id = $1`, [id])
    if (!rows[0]) throw new NotFoundException('Scrutinul nu există')
    return (await this.hydrate(rows, client))[0]
  }

  async exists(id: string) {
    const { rowCount } = await this.db.query('SELECT 1 FROM elections WHERE id = $1', [id])
    if (!rowCount) throw new NotFoundException('Scrutinul nu există')
  }

  /** Blochează rândul scrutinului până la finalul tranzacției (serializează schimbările de stare și adăugările pe board). */
  async lock(client: Queryable, id: string): Promise<LockedElection> {
    const { rows } = await client.query<LockedElection>('SELECT status, opens_at, closes_at, public_key, aggregate FROM elections WHERE id = $1 FOR UPDATE', [
      id,
    ])
    if (!rows[0]) throw new NotFoundException('Scrutinul nu există')
    return rows[0]
  }

  async params(id: string): Promise<ElectionParamsWithState> {
    const { rows } = await this.db.query<{ status: Election['status']; opens_at: Date; closes_at: Date; public_key: string | null; n: string }>(
      'SELECT status, opens_at, closes_at, public_key, (SELECT count(*) FROM candidates c WHERE c.election_id = e.id) AS n FROM elections e WHERE id = $1',
      [id],
    )
    if (!rows[0]) throw new NotFoundException('Scrutinul nu există')
    if (!rows[0].public_key) throw new ConflictException('Cheia scrutinului nu e încă publicată')
    return {
      electionId: id,
      publicKey: rows[0].public_key,
      candidateCount: Number(rows[0].n),
      status: rows[0].status,
      opensAt: rows[0].opens_at,
      closesAt: rows[0].closes_at,
    }
  }

  // ───────────── board ─────────────

  async board(id: string): Promise<BoardEntry[]> {
    await this.exists(id)
    const { rows } = await this.db.query<BallotRow>(BOARD_SQL, [id])
    return rows.map(toEntry)
  }

  /** O pagină, cele mai noi intrări primele. */
  async boardPage(id: string, page: number, size: number): Promise<BoardPage> {
    await this.exists(id)
    const total = Number((await this.db.query<{ n: string }>('SELECT count(*) AS n FROM ballots WHERE election_id = $1', [id])).rows[0].n)
    const { rows } = await this.db.query<BallotRow>('SELECT * FROM ballots WHERE election_id = $1 ORDER BY seq DESC LIMIT $2 OFFSET $3', [
      id,
      size,
      (page - 1) * size,
    ])
    return { entries: rows.map(toEntry), total, page, size }
  }

  async findBallot(id: string, code: string): Promise<BoardEntry> {
    const { rows } = await this.db.query<BallotRow>('SELECT * FROM ballots WHERE election_id = $1 AND hash = $2', [id, normalizeTrackingCode(code)])
    if (!rows[0]) throw new NotFoundException('Niciun buletin cu acest cod de urmărire')
    return toEntry(rows[0])
  }

  /** Ultima intrare de pe board, folosită la legarea intrării următoare. */
  async lastEntry(client: Queryable, id: string): Promise<BoardEntry | undefined> {
    const { rows } = await client.query<BallotRow>('SELECT * FROM ballots WHERE election_id = $1 ORDER BY seq DESC LIMIT 1', [id])
    return rows[0] ? toEntry(rows[0]) : undefined
  }

  async head(id: string, client: Queryable = this.db): Promise<BoardHead> {
    if (client === this.db) await this.exists(id)
    const { rows } = await client.query<{ seq: number; hash: string }>('SELECT seq, hash FROM ballots WHERE election_id = $1 ORDER BY seq DESC LIMIT 1', [id])
    return rows[0] ?? { seq: 0, hash: genesisHash(id) }
  }

  // ───────────── înregistrări, numărare, rezultat ─────────────

  async registrations(id: string): Promise<PublicRegistration[]> {
    await this.exists(id)
    const { rows } = await this.db.query<RegistrationRow>(REGISTRATIONS_SQL, [id])
    return rows.map(toRegistration)
  }

  async tally(id: string, client: Queryable = this.db): Promise<TallyInfo> {
    const { rows } = await client.query<{ aggregate: TallyInfo['aggregate'] }>('SELECT aggregate FROM elections WHERE id = $1', [id])
    if (!rows[0]) throw new NotFoundException('Scrutinul nu există')
    const partials = await client.query<PartialRow>(PARTIALS_SQL, [id])
    return { aggregate: rows[0].aggregate, partials: partials.rows.map(toPartial) }
  }

  async result(id: string): Promise<ElectionResult> {
    await this.exists(id)
    const { rows } = await this.db.query<ResultRow>(RESULT_SQL, [id])
    if (!rows[0]) throw new NotFoundException('Rezultatul nu a fost publicat încă')
    return toResult(id, rows[0])
  }

  /** Tot ce are nevoie verificatorul, dintr-un singur instantaneu consistent al bazei. */
  async auditBundle(id: string): Promise<AuditBundleResponse> {
    return this.db.transaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
      const election = await this.get(id, client)
      const board = (await client.query<BallotRow>(BOARD_SQL, [id])).rows.map(toEntry)
      const regs = await client.query<RegistrationRow>(REGISTRATIONS_SQL, [id])
      const tally = await this.tally(id, client)
      const res = await client.query<ResultRow>(RESULT_SQL, [id])
      const last = board.at(-1)
      return {
        election,
        registrations: regs.rows.map(toRegistration),
        board,
        tally,
        result: res.rows[0] ? toResult(id, res.rows[0]) : null,
        head: last ? { seq: last.seq, hash: last.hash } : { seq: 0, hash: genesisHash(id) },
      }
    })
  }
}
