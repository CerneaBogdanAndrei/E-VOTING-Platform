// Implementarea PostgreSQL a stocării (testată cu PostgreSQL 16; merge cu Supabase).
// Schema: db/schema.sql. Conexiunea: DATABASE_URL.
//
// Atomicitatea: exclusive(key, fn) deschide o tranzacție și ia un advisory lock
// pe cheie (pg_advisory_xact_lock), eliberat automat la COMMIT/ROLLBACK. Toate
// interogările din fn rulează pe aceeași conexiune (AsyncLocalStorage), deci
// văd și scriu în aceeași tranzacție. Merge și prin pooler-ul Supabase în modul
// „transaction” (portul 6543), pentru că lacătul ține doar cât tranzacția.

import { AsyncLocalStorage } from 'node:async_hooks'
import pg from 'pg'
import type { BoardEntry, PartialDecryption } from '@evoting/crypto'
import {
  UniqueViolation,
  type AuditRow,
  type CandidateRow,
  type ElectionRow,
  type PartialDecryptionRow,
  type RegistrationRow,
  type ResultRow,
  type Storage,
  type TrusteeRow,
} from './storage.js'

type Queryable = pg.Pool | pg.PoolClient

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v))

/** Opțiunile de conexiune: SSL activ, cu excepția serverelor locale (sau DATABASE_SSL=off). */
export function poolConfig(url: string): pg.PoolConfig {
  const u = new URL(url)
  const local = ['localhost', '127.0.0.1', '::1'].includes(u.hostname) || u.hostname.startsWith('/')
  const sslEnv = process.env.DATABASE_SSL
  const ssl = sslEnv ? !/^(0|false|off|no)$/i.test(sslEnv) : !local
  // sslmode din URL e ignorat: SSL se configurează explicit mai jos.
  u.searchParams.delete('sslmode')
  return {
    connectionString: u.toString(),
    // Supabase folosește certificate pe care Node nu le are în lista implicită; legătura rămâne criptată.
    // Pentru verificarea completă, se poate da certificatul CA al proiectului prin DATABASE_CA (PEM).
    ssl: ssl ? (process.env.DATABASE_CA ? { ca: process.env.DATABASE_CA } : { rejectUnauthorized: false }) : false,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  }
}

function mapUnique<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((err: { code?: string; constraint?: string }) => {
    if (err?.code === '23505') throw new UniqueViolation(err.constraint ?? 'unique')
    throw err
  })
}

const ELECTION_COLS = {
  title: 'title',
  status: 'status',
  opensAt: 'opens_at',
  closesAt: 'closes_at',
  minSelections: 'min_selections',
  maxSelections: 'max_selections',
  publicKey: 'public_key',
  aggregate: 'aggregate',
  tallyBallotCount: 'tally_ballot_count',
  createdAt: 'created_at',
} as const

const TRUSTEE_COLS = { name: 'name', publicKeyShare: 'public_key_share', keyProof: 'key_proof', inviteCodeHash: 'invite_code_hash' } as const
const JSON_COLS = new Set(['aggregate', 'key_proof'])

/** Construiește „SET a = $1, b = $2” dintr-un patch, cu valorile JSON serializate. */
function setClause(patch: Record<string, unknown>, cols: Record<string, string>, offset: number) {
  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, value] of Object.entries(patch)) {
    const col = cols[key]
    if (!col || value === undefined) continue
    values.push(JSON_COLS.has(col) && value !== null ? JSON.stringify(value) : value)
    sets.push(`${col} = $${offset + values.length}`)
  }
  return { sets, values }
}

function electionFromRow(r: Record<string, unknown>): ElectionRow {
  return {
    id: r.id as string,
    title: r.title as string,
    status: r.status as ElectionRow['status'],
    opensAt: iso(r.opens_at),
    closesAt: iso(r.closes_at),
    minSelections: r.min_selections as number,
    maxSelections: r.max_selections as number,
    publicKey: (r.public_key as string) ?? null,
    aggregate: (r.aggregate as ElectionRow['aggregate']) ?? null,
    tallyBallotCount: (r.tally_ballot_count as number) ?? null,
    createdAt: iso(r.created_at),
  }
}

function trusteeFromRow(r: Record<string, unknown>): TrusteeRow {
  return {
    id: r.id as string,
    electionId: r.election_id as string,
    name: r.name as string,
    publicKeyShare: (r.public_key_share as string) ?? null,
    keyProof: (r.key_proof as TrusteeRow['keyProof']) ?? null,
    inviteCodeHash: (r.invite_code_hash as string) ?? null,
  }
}

function entryFromRow(electionId: string, r: Record<string, unknown>): BoardEntry {
  return {
    seq: r.seq as number,
    prevHash: r.prev_hash as string,
    hash: r.hash as string,
    trackingCode: r.tracking_code as string,
    receivedAt: r.received_at as string,
    ballot: {
      electionId,
      credentialPubkey: r.credential_pubkey as string,
      ciphertexts: r.ciphertexts as BoardEntry['ballot']['ciphertexts'],
      proofs: r.proofs as BoardEntry['ballot']['proofs'],
      signature: r.signature as string,
    },
  }
}

const REQUIRED_TABLES = ['elections', 'candidates', 'trustees', 'eligible_voters', 'registrations', 'ballots', 'partial_decryptions', 'results', 'audit_log']

export class PostgresStorage implements Storage {
  readonly kind: string
  private readonly tx = new AsyncLocalStorage<pg.PoolClient>()

  private constructor(private readonly pool: pg.Pool, host: string) {
    this.kind = `PostgreSQL (${host})`
  }

  static async connect(url: string): Promise<PostgresStorage> {
    const pool = new pg.Pool(poolConfig(url))
    const storage = new PostgresStorage(pool, new URL(url).hostname)
    const { rows } = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = current_schema() and table_name = any($1)`,
      [REQUIRED_TABLES],
    )
    const missing = REQUIRED_TABLES.filter((t) => !rows.some((r) => r.table_name === t))
    if (missing.length) {
      await pool.end()
      throw new Error(`Lipsesc tabelele: ${missing.join(', ')}. Rulează apps/backend/db/schema.sql (în Supabase: SQL Editor) sau „npm run db:migrate”.`)
    }
    return storage
  }

  async close() {
    await this.pool.end()
  }

  /** Conexiunea curentă: cea a tranzacției în curs, dacă există, altfel pool-ul. */
  private get db(): Queryable {
    return this.tx.getStore() ?? this.pool
  }

  private q<R extends pg.QueryResultRow = Record<string, unknown>>(text: string, values?: unknown[]) {
    return this.db.query<R>(text, values)
  }

  /** Rulează fn într-o tranzacție cu lacăt pe cheie; în interiorul altei tranzacții, doar ia lacătul. */
  private async locked<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const current = this.tx.getStore()
    if (current) {
      await current.query('select pg_advisory_xact_lock(hashtext($1))', [key])
      return fn()
    }
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [key])
      const result = await this.tx.run(client, fn)
      await client.query('commit')
      return result
    } catch (err) {
      await client.query('rollback').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
  }

  exclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    return this.locked(`x:${key}`, fn)
  }

  elections = {
    insert: (election: ElectionRow, candidates: CandidateRow[], trustees: TrusteeRow[]) =>
      this.locked(`insert:${election.id}`, async () => {
        await mapUnique(
          this.q(
            `insert into elections (id, title, status, opens_at, closes_at, min_selections, max_selections, public_key, aggregate, tally_ballot_count, created_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [election.id, election.title, election.status, election.opensAt, election.closesAt, election.minSelections, election.maxSelections, election.publicKey, election.aggregate ? JSON.stringify(election.aggregate) : null, election.tallyBallotCount, election.createdAt],
          ),
        )
        for (const c of candidates) {
          await this.q('insert into candidates (id, election_id, name, description, position) values ($1, $2, $3, $4, $5)', [c.id, c.electionId, c.name, c.description, c.position])
        }
        for (const t of trustees) {
          await this.q('insert into trustees (election_id, id, name, public_key_share, key_proof, invite_code_hash) values ($1, $2, $3, $4, $5, $6)', [
            t.electionId,
            t.id,
            t.name,
            t.publicKeyShare,
            t.keyProof ? JSON.stringify(t.keyProof) : null,
            t.inviteCodeHash,
          ])
        }
      }),
    findById: async (id: string) => {
      const { rows } = await this.q('select * from elections where id = $1', [id])
      return rows[0] ? electionFromRow(rows[0]) : null
    },
    list: async () => (await this.q('select * from elections order by created_at desc')).rows.map(electionFromRow),
    update: async (id: string, patch: Partial<Omit<ElectionRow, 'id'>>) => {
      const { sets, values } = setClause(patch, ELECTION_COLS, 1)
      const { rows } = sets.length
        ? await this.q(`update elections set ${sets.join(', ')} where id = $1 returning *`, [id, ...values])
        : await this.q('select * from elections where id = $1', [id])
      if (!rows[0]) throw new Error(`election ${id} not found`)
      return electionFromRow(rows[0])
    },
    candidates: async (electionId: string) =>
      (await this.q('select * from candidates where election_id = $1 order by position', [electionId])).rows.map((r) => ({
        id: r.id as string,
        electionId: r.election_id as string,
        name: r.name as string,
        description: r.description as string,
        position: r.position as number,
      })),
  }

  trustees = {
    listByElection: async (electionId: string) => (await this.q('select * from trustees where election_id = $1 order by id', [electionId])).rows.map(trusteeFromRow),
    findById: async (electionId: string, trusteeId: string) => {
      const { rows } = await this.q('select * from trustees where election_id = $1 and id = $2', [electionId, trusteeId])
      return rows[0] ? trusteeFromRow(rows[0]) : null
    },
    update: async (electionId: string, trusteeId: string, patch: Partial<Omit<TrusteeRow, 'id' | 'electionId'>>) => {
      const { sets, values } = setClause(patch, TRUSTEE_COLS, 2)
      const { rows } = sets.length
        ? await this.q(`update trustees set ${sets.join(', ')} where election_id = $1 and id = $2 returning *`, [electionId, trusteeId, ...values])
        : await this.q('select * from trustees where election_id = $1 and id = $2', [electionId, trusteeId])
      if (!rows[0]) throw new Error(`trustee ${trusteeId} not found`)
      return trusteeFromRow(rows[0])
    },
  }

  eligibleVoters = {
    addMany: async (electionId: string, cnpHmacs: string[]) => {
      let inserted = 0
      // În loturi, ca o listă de zeci de mii de CNP-uri să nu depășească limita de parametri.
      for (let i = 0; i < cnpHmacs.length; i += 5000) {
        const batch = cnpHmacs.slice(i, i + 5000)
        const r = await this.q('insert into eligible_voters (election_id, cnp_hmac) select $1, unnest($2::text[]) on conflict do nothing', [electionId, batch])
        inserted += r.rowCount ?? 0
      }
      return { inserted, duplicates: cnpHmacs.length - inserted }
    },
    exists: async (electionId: string, cnpHmac: string) =>
      (await this.q('select 1 from eligible_voters where election_id = $1 and cnp_hmac = $2', [electionId, cnpHmac])).rowCount! > 0,
    count: async (electionId: string) => Number((await this.q('select count(*) as n from eligible_voters where election_id = $1', [electionId])).rows[0].n),
  }

  registrations = {
    insert: async (row: RegistrationRow) => {
      await mapUnique(
        this.q('insert into registrations (election_id, cnp_hmac, credential_pubkey, method, trust_level, registered_at) values ($1, $2, $3, $4, $5, $6)', [
          row.electionId,
          row.cnpHmac,
          row.credentialPubkey,
          row.method,
          row.trustLevel,
          row.registeredAt,
        ]),
      )
    },
    findByCredential: async (electionId: string, credentialPubkey: string) => {
      const { rows } = await this.q('select * from registrations where election_id = $1 and credential_pubkey = $2', [electionId, credentialPubkey])
      const r = rows[0]
      return r
        ? {
            electionId: r.election_id as string,
            cnpHmac: (r.cnp_hmac as string).trim(),
            credentialPubkey: (r.credential_pubkey as string).trim(),
            method: r.method as RegistrationRow['method'],
            trustLevel: r.trust_level as RegistrationRow['trustLevel'],
            registeredAt: iso(r.registered_at),
          }
        : null
    },
    count: async (electionId: string) => {
      const { rows } = await this.q(`select count(*) as total, count(*) filter (where method = 'nfc') as nfc from registrations where election_id = $1`, [electionId])
      return { total: Number(rows[0].total), nfc: Number(rows[0].nfc) }
    },
    credentials: async (electionId: string) =>
      (await this.q('select credential_pubkey from registrations where election_id = $1 order by id', [electionId])).rows.map((r) => (r.credential_pubkey as string).trim()),
  }

  ballots = {
    append: (electionId: string, build: (last: BoardEntry | null) => BoardEntry | Promise<BoardEntry>) =>
      this.locked(`ballots:${electionId}`, async () => {
        const last = await this.ballots.last(electionId)
        const e = await build(last)
        await mapUnique(
          this.q(
            `insert into ballots (election_id, seq, credential_pubkey, tracking_code, ciphertexts, proofs, signature, prev_hash, hash, received_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [electionId, e.seq, e.ballot.credentialPubkey, e.trackingCode, JSON.stringify(e.ballot.ciphertexts), JSON.stringify(e.ballot.proofs), e.ballot.signature, e.prevHash, e.hash, e.receivedAt],
          ),
        )
        return e
      }),
    list: async (electionId: string) => (await this.q('select * from ballots where election_id = $1 order by seq', [electionId])).rows.map((r) => entryFromRow(electionId, r)),
    last: async (electionId: string) => {
      const { rows } = await this.q('select * from ballots where election_id = $1 order by seq desc limit 1', [electionId])
      return rows[0] ? entryFromRow(electionId, rows[0]) : null
    },
    count: async (electionId: string) => Number((await this.q('select count(*) as n from ballots where election_id = $1', [electionId])).rows[0].n),
    findByCode: async (electionId: string, code: string) => {
      const { rows } = await this.q('select * from ballots where election_id = $1 and (tracking_code = $2 or hash = $2) limit 1', [electionId, code])
      return rows[0] ? entryFromRow(electionId, rows[0]) : null
    },
    hasCredential: async (electionId: string, credentialPubkey: string) =>
      (await this.q('select 1 from ballots where election_id = $1 and credential_pubkey = $2', [electionId, credentialPubkey])).rowCount! > 0,
  }

  partialDecryptions = {
    insert: async (row: PartialDecryptionRow) => {
      await mapUnique(
        this.q('insert into partial_decryptions (election_id, trustee_id, shares, submitted_at) values ($1, $2, $3, $4)', [row.electionId, row.trusteeId, JSON.stringify(row.partial.shares), row.submittedAt]).catch(
          (err: { code?: string; constraint?: string }) => {
            if (err?.code === '23505') err.constraint = 'partial_decryptions_trustee'
            throw err
          },
        ),
      )
    },
    list: async (electionId: string) =>
      (await this.q('select * from partial_decryptions where election_id = $1 order by trustee_id', [electionId])).rows.map((r) => ({
        electionId,
        trusteeId: r.trustee_id as string,
        partial: { trusteeId: r.trustee_id as string, shares: r.shares as PartialDecryption['shares'] },
        submittedAt: iso(r.submitted_at),
      })),
  }

  results = {
    insert: async (row: ResultRow) => {
      await mapUnique(this.q('insert into results (election_id, counts, published_at) values ($1, $2, $3)', [row.electionId, JSON.stringify(row.counts), row.publishedAt]))
    },
    find: async (electionId: string) => {
      const { rows } = await this.q('select * from results where election_id = $1', [electionId])
      return rows[0] ? { electionId, counts: rows[0].counts as number[], publishedAt: iso(rows[0].published_at) } : null
    },
  }

  auditLog = {
    append: async (row: Omit<AuditRow, 'id'>) => {
      const { rows } = await this.q('insert into audit_log (election_id, actor, action, payload, created_at) values ($1, $2, $3, $4, $5) returning id', [
        row.electionId,
        row.actor,
        row.action,
        JSON.stringify(row.payload),
        row.createdAt,
      ])
      return { id: Number(rows[0].id), ...row }
    },
    list: async (electionId: string) =>
      (await this.q('select * from audit_log where election_id = $1 order by id', [electionId])).rows.map((r) => ({
        id: Number(r.id),
        electionId: r.election_id as string,
        actor: r.actor as string,
        action: r.action as string,
        payload: r.payload as Record<string, unknown>,
        createdAt: iso(r.created_at),
      })),
  }
}
