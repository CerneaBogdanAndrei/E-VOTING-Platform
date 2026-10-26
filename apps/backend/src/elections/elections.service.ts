import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import {
  type AuditBundleResponse,
  type BoardEntry,
  type BoardHead,
  type CreateElectionInput,
  type CreatedElection,
  type Election,
  type ElectionResult,
  type EligibleImportResult,
  type PublicRegistration,
  type TallyInfo,
  isValidCnp,
} from '@evoting/api'
import {
  cnpHmac,
  combinePublicKeys,
  computeAggregate,
  genesisHash,
  normalizeTrackingCode,
  verifyTrusteeKey,
  type ElectionParams,
  type TrusteePublicKey,
} from '@evoting/crypto'
import { AuditService } from '../common/audit.service.js'
import { randomToken, sha256 } from '../common/security.js'
import { arr, bad, isoDate, obj, str } from '../common/validate.js'
import { CONFIG, type AppConfig } from '../config.js'
import { Database, type Queryable } from '../db/database.service.js'

interface ElectionRow {
  id: string
  title: string
  status: Election['status']
  opens_at: Date
  closes_at: Date
  public_key: string | null
  aggregate: TallyInfo['aggregate']
  eligible: string
  registered: string
  ballots: string
}

interface BallotRow {
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

const ELECTION_SELECT = `
  SELECT e.id, e.title, e.status, e.opens_at, e.closes_at, e.public_key, e.aggregate,
    (SELECT count(*) FROM eligible_voters v WHERE v.election_id = e.id) AS eligible,
    (SELECT count(*) FROM registrations r WHERE r.election_id = e.id) AS registered,
    (SELECT count(*) FROM ballots b WHERE b.election_id = e.id) AS ballots
  FROM elections e`

function slug(title: string) {
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

@Injectable()
export class ElectionsService {
  constructor(
    private readonly db: Database,
    private readonly audit: AuditService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  hmac(cnp: string) {
    return cnpHmac(this.config.cnpHmacKey, cnp)
  }

  // ───────────── citire ─────────────

  private async hydrate(rows: ElectionRow[], client: Queryable = this.db): Promise<Election[]> {
    if (rows.length === 0) return []
    const ids = rows.map((r) => r.id)
    const candidates = await client.query<{ id: string; election_id: string; name: string; description: string; position: number }>(
      'SELECT id, election_id, name, description, position FROM candidates WHERE election_id = ANY($1) ORDER BY position',
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
      candidates: candidates.rows
        .filter((c) => c.election_id === r.id)
        .map((c) => ({ id: c.id, name: c.name, description: c.description, position: c.position })),
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

  /** Blochează rândul scrutinului până la finalul tranzacției (serializează schimbările de stare și adăugările pe board). */
  async lock(client: Queryable, id: string) {
    const { rows } = await client.query<{ status: Election['status']; public_key: string | null; aggregate: TallyInfo['aggregate'] }>(
      'SELECT status, public_key, aggregate FROM elections WHERE id = $1 FOR UPDATE',
      [id],
    )
    if (!rows[0]) throw new NotFoundException('Scrutinul nu există')
    return rows[0]
  }

  async params(id: string): Promise<ElectionParams & { status: Election['status'] }> {
    const { rows } = await this.db.query<{ status: Election['status']; public_key: string | null; n: string }>(
      'SELECT status, public_key, (SELECT count(*) FROM candidates c WHERE c.election_id = e.id) AS n FROM elections e WHERE id = $1',
      [id],
    )
    if (!rows[0]) throw new NotFoundException('Scrutinul nu există')
    if (!rows[0].public_key) throw new ConflictException('Cheia scrutinului nu e încă publicată')
    return { electionId: id, publicKey: rows[0].public_key, candidateCount: Number(rows[0].n), status: rows[0].status }
  }

  async board(id: string): Promise<BoardEntry[]> {
    await this.exists(id)
    const { rows } = await this.db.query<BallotRow>('SELECT * FROM ballots WHERE election_id = $1 ORDER BY seq', [id])
    return rows.map(toEntry)
  }

  async findBallot(id: string, code: string): Promise<BoardEntry> {
    const { rows } = await this.db.query<BallotRow>('SELECT * FROM ballots WHERE election_id = $1 AND hash = $2', [id, normalizeTrackingCode(code)])
    if (!rows[0]) throw new NotFoundException('Niciun buletin cu acest cod de urmărire')
    return toEntry(rows[0])
  }

  async head(id: string): Promise<BoardHead> {
    await this.exists(id)
    const { rows } = await this.db.query<{ seq: number; hash: string }>('SELECT seq, hash FROM ballots WHERE election_id = $1 ORDER BY seq DESC LIMIT 1', [id])
    return rows[0] ?? { seq: 0, hash: genesisHash(id) }
  }

  async registrations(id: string): Promise<PublicRegistration[]> {
    await this.exists(id)
    const { rows } = await this.db.query<{ credential_pubkey: string; method: 'ocr' | 'nfc'; trust_level: 'optic' | 'criptografic'; registered_at: Date }>(
      'SELECT credential_pubkey, method, trust_level, registered_at FROM registrations WHERE election_id = $1 ORDER BY id',
      [id],
    )
    return rows.map((r) => ({ credentialPubkey: r.credential_pubkey, method: r.method, trustLevel: r.trust_level, registeredAt: r.registered_at.toISOString() }))
  }

  async tally(id: string): Promise<TallyInfo> {
    const { rows } = await this.db.query<{ aggregate: TallyInfo['aggregate'] }>('SELECT aggregate FROM elections WHERE id = $1', [id])
    if (!rows[0]) throw new NotFoundException('Scrutinul nu există')
    const partials = await this.db.query<{ trustee_id: string; shares: string[]; proofs: TallyInfo['partials'][number]['proofs'] }>(
      'SELECT p.trustee_id, p.shares, p.proofs FROM partial_decryptions p JOIN trustees t ON t.id = p.trustee_id WHERE p.election_id = $1 ORDER BY t.position',
      [id],
    )
    return { aggregate: rows[0].aggregate, partials: partials.rows.map((p) => ({ trusteeId: p.trustee_id, shares: p.shares, proofs: p.proofs })) }
  }

  async result(id: string): Promise<ElectionResult> {
    await this.exists(id)
    const { rows } = await this.db.query<{ counts: ElectionResult['counts']; total_ballots: number; published_at: Date }>(
      'SELECT counts, total_ballots, published_at FROM results WHERE election_id = $1',
      [id],
    )
    if (!rows[0]) throw new NotFoundException('Rezultatul nu a fost publicat încă')
    return { electionId: id, counts: rows[0].counts, totalBallots: rows[0].total_ballots, publishedAt: rows[0].published_at.toISOString() }
  }

  async auditBundle(id: string): Promise<AuditBundleResponse> {
    // o singură tranzacție cu snapshot, ca board-ul și rezultatul să fie din același moment
    return this.db.transaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
      const election = await this.get(id, client)
      const board = (await client.query<BallotRow>('SELECT * FROM ballots WHERE election_id = $1 ORDER BY seq', [id])).rows.map(toEntry)
      const regs = await client.query<{ credential_pubkey: string; method: 'ocr' | 'nfc'; trust_level: 'optic' | 'criptografic'; registered_at: Date }>(
        'SELECT credential_pubkey, method, trust_level, registered_at FROM registrations WHERE election_id = $1 ORDER BY id',
        [id],
      )
      const partials = await client.query<{ trustee_id: string; shares: string[]; proofs: TallyInfo['partials'][number]['proofs'] }>(
        'SELECT p.trustee_id, p.shares, p.proofs FROM partial_decryptions p JOIN trustees t ON t.id = p.trustee_id WHERE p.election_id = $1 ORDER BY t.position',
        [id],
      )
      const agg = await client.query<{ aggregate: TallyInfo['aggregate'] }>('SELECT aggregate FROM elections WHERE id = $1', [id])
      const res = await client.query<{ counts: ElectionResult['counts']; total_ballots: number; published_at: Date }>(
        'SELECT counts, total_ballots, published_at FROM results WHERE election_id = $1',
        [id],
      )
      const last = board.at(-1)
      return {
        election,
        registrations: regs.rows.map((r) => ({ credentialPubkey: r.credential_pubkey, method: r.method, trustLevel: r.trust_level, registeredAt: r.registered_at.toISOString() })),
        board,
        tally: { aggregate: agg.rows[0].aggregate, partials: partials.rows.map((p) => ({ trusteeId: p.trustee_id, shares: p.shares, proofs: p.proofs })) },
        result: res.rows[0]
          ? { electionId: id, counts: res.rows[0].counts, totalBallots: res.rows[0].total_ballots, publishedAt: res.rows[0].published_at.toISOString() }
          : null,
        head: last ? { seq: last.seq, hash: last.hash } : { seq: 0, hash: genesisHash(id) },
      }
    })
  }

  private async exists(id: string) {
    const { rowCount } = await this.db.query('SELECT 1 FROM elections WHERE id = $1', [id])
    if (!rowCount) throw new NotFoundException('Scrutinul nu există')
  }

  // ───────────── comisia ─────────────

  async create(body: unknown): Promise<CreatedElection> {
    const input = obj(body, 'scrutin') as Partial<CreateElectionInput>
    const title = str(input.title, 'Titlul', { max: 200 })
    const opensAt = isoDate(input.opensAt, 'Deschiderea')
    const closesAt = isoDate(input.closesAt, 'Închiderea')
    if (closesAt <= opensAt) throw bad('Închiderea trebuie să fie după deschidere')
    const candidates = arr(input.candidates, 'Candidații', { max: 50 }).map((c, i) => {
      const o = obj(c, `Candidatul ${i + 1}`)
      return { name: str(o.name, `Numele candidatului ${i + 1}`, { max: 120 }), description: str(o.description ?? '', 'Descrierea', { max: 300, allowEmpty: true }) }
    })
    if (candidates.length < 2) throw bad('Sunt necesari cel puțin doi candidați')
    const trustees = arr(input.trustees, 'Trustees', { max: 10 }).map((t, i) => ({ name: str(obj(t, `Trustee ${i + 1}`).name, `Numele trustee-ului ${i + 1}`, { max: 120 }) }))
    if (trustees.length < 1) throw bad('Este necesar cel puțin un trustee')

    const id = `${slug(title)}-${randomToken(3)}`
    const tokens = trustees.map((t, i) => ({ trusteeId: `${id}-t${i + 1}`, name: t.name, token: randomToken() }))
    await this.db.transaction(async (client) => {
      await client.query('INSERT INTO elections (id, title, opens_at, closes_at) VALUES ($1, $2, $3, $4)', [id, title, opensAt, closesAt])
      for (const [i, c] of candidates.entries()) {
        await client.query('INSERT INTO candidates (id, election_id, name, description, position) VALUES ($1, $2, $3, $4, $5)', [`${id}-c${i + 1}`, id, c.name, c.description, i])
      }
      for (const [i, t] of tokens.entries()) {
        await client.query('INSERT INTO trustees (id, election_id, name, position, token_hash) VALUES ($1, $2, $3, $4, $5)', [t.trusteeId, id, t.name, i, sha256(t.token)])
      }
      await this.audit.log('comisie', 'election.create', id, { title, candidates: candidates.length, trustees: trustees.length }, client)
    })
    return { election: await this.get(id), trusteeTokens: tokens }
  }

  /** CSV cu un CNP pe linie. CNP-urile în clar nu se salvează și nu se loghează: intră doar HMAC-ul. */
  async importEligible(id: string, csv: unknown): Promise<EligibleImportResult> {
    if (typeof csv !== 'string') throw bad('Se așteaptă un fișier CSV (Content-Type: text/csv)')
    const result: EligibleImportResult = { imported: 0, duplicates: 0, invalid: [] }
    const hmacs: string[] = []
    for (const [i, raw] of csv.split(/\r?\n/).entries()) {
      const value = raw.split(/[,;]/)[0].trim().replace(/^"|"$/g, '')
      if (!value || (i === 0 && /^cnp$/i.test(value))) continue
      if (!isValidCnp(value)) {
        // în răspuns apare doar numărul liniei, nu și valoarea, ca un CNP greșit să nu ajungă în loguri
        if (result.invalid.length < 1000) result.invalid.push({ line: i + 1, value: value.length > 4 ? `${value.slice(0, 2)}…${value.slice(-2)}` : '…' })
        continue
      }
      hmacs.push(this.hmac(value))
    }
    await this.db.transaction(async (client) => {
      const e = await this.lock(client, id)
      if (e.status !== 'draft') throw new ConflictException('Lista se poate importa doar înainte de deschiderea votului')
      const unique = [...new Set(hmacs)]
      result.duplicates += hmacs.length - unique.length
      for (let k = 0; k < unique.length; k += 1000) {
        const chunk = unique.slice(k, k + 1000)
        const { rowCount } = await client.query(
          'INSERT INTO eligible_voters (election_id, cnp_hmac) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING',
          [id, chunk],
        )
        result.imported += rowCount ?? 0
        result.duplicates += chunk.length - (rowCount ?? 0)
      }
      await this.audit.log('comisie', 'eligible.import', id, { imported: result.imported, duplicates: result.duplicates, invalid: result.invalid.length }, client)
    })
    return result
  }

  async open(id: string): Promise<Election> {
    await this.db.transaction(async (client) => {
      const e = await this.lock(client, id)
      if (e.status !== 'draft') throw new ConflictException('Scrutinul nu este în configurare')
      const missing = await client.query('SELECT 1 FROM trustees WHERE election_id = $1 AND public_key_share IS NULL', [id])
      if (missing.rowCount) throw new ConflictException(`Lipsesc cheile de la ${missing.rowCount} trustee(s)`)
      const eligible = await client.query('SELECT 1 FROM eligible_voters WHERE election_id = $1 LIMIT 1', [id])
      if (!eligible.rowCount) throw new ConflictException('Lista alegătorilor eligibili este goală')
      await client.query("UPDATE elections SET status = 'open' WHERE id = $1", [id])
      await this.audit.log('comisie', 'election.open', id, { publicKey: e.public_key }, client)
    })
    return this.get(id)
  }

  /** La închidere, serverul calculează și publică criptotextele agregate per candidat. */
  async close(id: string): Promise<Election> {
    await this.db.transaction(async (client) => {
      const e = await this.lock(client, id)
      if (e.status !== 'open') throw new ConflictException('Scrutinul nu este deschis')
      const n = Number((await client.query<{ n: string }>('SELECT count(*) AS n FROM candidates WHERE election_id = $1', [id])).rows[0].n)
      const ballots = await client.query<{ ciphertexts: BoardEntry['ciphertexts'] }>('SELECT ciphertexts FROM ballots WHERE election_id = $1 ORDER BY seq', [id])
      const aggregate = computeAggregate(n, ballots.rows)
      await client.query("UPDATE elections SET status = 'closed', aggregate = $2 WHERE id = $1", [id, JSON.stringify(aggregate)])
      const head = await client.query<{ seq: number; hash: string }>('SELECT seq, hash FROM ballots WHERE election_id = $1 ORDER BY seq DESC LIMIT 1', [id])
      await this.audit.log('comisie', 'election.close', id, { ballots: ballots.rowCount, head: head.rows[0] ?? null }, client)
    })
    return this.get(id)
  }

  // ───────────── trustees ─────────────

  async trusteeByToken(client: Queryable, electionId: string, token: string | null) {
    if (!token) throw new UnauthorizedException('Lipsește token-ul de trustee')
    const { rows } = await client.query<{ id: string; name: string; public_key_share: string | null }>(
      'SELECT id, name, public_key_share FROM trustees WHERE election_id = $1 AND token_hash = $2',
      [electionId, sha256(token)],
    )
    if (!rows[0]) throw new UnauthorizedException('Token de trustee invalid pentru acest scrutin')
    return rows[0]
  }

  /** Trustee-ul trimite Yᵢ și dovada Schnorr; când sunt toate, se publică Y = ΣYᵢ. */
  async submitTrusteeKey(id: string, token: string | null, body: unknown): Promise<Election> {
    const key = obj(body, 'cheia') as Partial<TrusteePublicKey>
    await this.db.transaction(async (client) => {
      const e = await this.lock(client, id)
      const trustee = await this.trusteeByToken(client, id, token)
      if (key.trusteeId !== trustee.id) throw new ForbiddenException('Token-ul aparține altui trustee')
      if (e.status !== 'draft') throw new ConflictException('Cheile se trimit doar în configurare')
      if (trustee.public_key_share) throw new ConflictException('Trustee-ul și-a trimis deja cheia')
      if (!verifyTrusteeKey(id, key as TrusteePublicKey)) throw bad('Dovada Schnorr a cheii nu e validă')
      await client.query('UPDATE trustees SET public_key_share = $2, key_proof = $3 WHERE id = $1', [trustee.id, key.publicKeyShare, JSON.stringify(key.proof)])
      const all = await client.query<{ public_key_share: string | null }>('SELECT public_key_share FROM trustees WHERE election_id = $1 ORDER BY position', [id])
      if (all.rows.every((t) => t.public_key_share)) {
        const publicKey = combinePublicKeys(all.rows.map((t) => t.public_key_share!))
        await client.query('UPDATE elections SET public_key = $2 WHERE id = $1', [id, publicKey])
        await this.audit.log('server', 'election.public_key', id, { publicKey }, client)
      }
      await this.audit.log(`trustee:${trustee.id}`, 'trustee.key', id, { publicKeyShare: key.publicKeyShare }, client)
    })
    return this.get(id)
  }
}
