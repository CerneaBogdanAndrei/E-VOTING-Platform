// Acțiunile comisiei asupra unui scrutin: creare, modificare și ștergere (în configurare),
// importul eligibililor, deschiderea și închiderea votului (cu publicarea agregatului).

import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common'
import {
  isValidCnp,
  plural,
  type AdminIdentity,
  type BoardEntry,
  type CreateElectionInput,
  type CreatedElection,
  type Election,
  type EligibleImportResult,
  type UpdateElectionInput,
} from '@evoting/api'
import { cnpHmac, computeAggregate } from '@evoting/crypto'
import { adminActor } from '../admin/admin.guard.js'
import { AuditService } from '../audit/audit.service.js'
import { randomToken, sha256 } from '../common/security.js'
import { arr, bad, isoDate, obj, str } from '../common/validate.js'
import { CONFIG, type AppConfig } from '../config.js'
import { Database, type Queryable } from '../db/database.service.js'
import { candidateRows, slug } from './election.rows.js'
import { ElectionsRepository } from './elections.repository.js'

const IMPORT_CHUNK = 1000
const MAX_INVALID_REPORTED = 1000

function parseCandidates(value: unknown) {
  const candidates = arr(value, 'Candidații', { max: 50 }).map((c, i) => {
    const o = obj(c, `Candidatul ${i + 1}`)
    return {
      name: str(o.name, `Numele candidatului ${i + 1}`, { max: 120 }),
      description: str(o.description ?? '', 'Descrierea', { max: 300, allowEmpty: true }),
    }
  })
  if (candidates.length < 2) throw bad('Sunt necesari cel puțin doi candidați')
  return candidates
}

@Injectable()
export class ElectionsService {
  private readonly logger = new Logger('Elections')

  constructor(
    private readonly db: Database,
    private readonly elections: ElectionsRepository,
    private readonly audit: AuditService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /** Validează cererea, creează scrutinul, candidații și trustees; token-urile se întorc în clar o singură dată. */
  async create(body: unknown, by: AdminIdentity): Promise<CreatedElection> {
    const input = obj(body, 'scrutin') as Partial<CreateElectionInput>
    const title = str(input.title, 'Titlul', { max: 200 })
    const opensAt = isoDate(input.opensAt, 'Deschiderea')
    const closesAt = isoDate(input.closesAt, 'Închiderea')
    if (closesAt <= opensAt) throw bad('Închiderea trebuie să fie după deschidere')
    const candidates = parseCandidates(input.candidates)
    const trustees = arr(input.trustees, 'Trustees', { max: 10 }).map((t, i) => ({
      name: str(obj(t, `Trustee ${i + 1}`).name, `Numele trustee-ului ${i + 1}`, { max: 120 }),
    }))
    if (trustees.length < 1) throw bad('Este necesar cel puțin un trustee')
    const allowBlank = input.allowBlank === true

    const id = `${slug(title)}-${randomToken(3)}`
    const tokens = trustees.map((t, i) => ({ trusteeId: `${id}-t${i + 1}`, name: t.name, token: randomToken() }))
    await this.db.transaction(async (client) => {
      await client.query('INSERT INTO elections (id, title, opens_at, closes_at) VALUES ($1, $2, $3, $4)', [id, title, opensAt, closesAt])
      await this.insertCandidates(client, id, candidates, allowBlank)
      for (const [i, t] of tokens.entries()) {
        // doar hash-ul token-ului intră în bază
        await client.query('INSERT INTO trustees (id, election_id, name, position, token_hash) VALUES ($1, $2, $3, $4, $5)', [
          t.trusteeId,
          id,
          t.name,
          i,
          sha256(t.token),
        ])
      }
      await this.audit.log(adminActor(by), 'election.create', id, { title, candidates: candidates.length, allowBlank, trustees: trustees.length }, client)
    })
    return { election: await this.elections.get(id), trusteeTokens: tokens }
  }

  private async insertCandidates(client: Queryable, id: string, candidates: { name: string; description: string }[], allowBlank: boolean) {
    for (const c of candidateRows(id, candidates, allowBlank)) {
      await client.query('INSERT INTO candidates (id, election_id, name, description, position, kind) VALUES ($1, $2, $3, $4, $5, $6)', [
        c.id,
        id,
        c.name,
        c.description,
        c.position,
        c.kind,
      ])
    }
  }

  /** Doar în `draft`: titlul, intervalul, candidații și votul alb. Trustees rămân (au token-uri emise). */
  async update(id: string, body: unknown, by: AdminIdentity): Promise<Election> {
    const input = obj(body, 'scrutin') as UpdateElectionInput
    await this.db.transaction(async (client) => {
      const e = await this.elections.lock(client, id)
      if (e.status !== 'draft') throw new ConflictException('Scrutinul se poate modifica doar în configurare')
      const title = input.title === undefined ? undefined : str(input.title, 'Titlul', { max: 200 })
      const opensAt = input.opensAt === undefined ? e.opens_at : isoDate(input.opensAt, 'Deschiderea')
      const closesAt = input.closesAt === undefined ? e.closes_at : isoDate(input.closesAt, 'Închiderea')
      if (closesAt <= opensAt) throw bad('Închiderea trebuie să fie după deschidere')
      await client.query('UPDATE elections SET title = COALESCE($2, title), opens_at = $3, closes_at = $4 WHERE id = $1', [
        id,
        title ?? null,
        opensAt,
        closesAt,
      ])
      if (input.candidates !== undefined || input.allowBlank !== undefined) {
        const current = await client.query<{ name: string; description: string; kind: string }>(
          'SELECT name, description, kind FROM candidates WHERE election_id = $1 ORDER BY position',
          [id],
        )
        const candidates = input.candidates === undefined ? current.rows.filter((c) => c.kind === 'candidate') : parseCandidates(input.candidates)
        const allowBlank = input.allowBlank === undefined ? current.rows.some((c) => c.kind === 'blank') : input.allowBlank === true
        await client.query('DELETE FROM candidates WHERE election_id = $1', [id])
        await this.insertCandidates(client, id, candidates, allowBlank)
      }
      await this.audit.log(adminActor(by), 'election.update', id, { fields: Object.keys(input) }, client)
    })
    return this.elections.get(id)
  }

  /** Doar în `draft`: șterge scrutinul și tot ce ține de el. Jurnalul rămâne, cu election_id gol. */
  async remove(id: string, by: AdminIdentity): Promise<void> {
    await this.db.transaction(async (client) => {
      const e = await this.elections.lock(client, id)
      if (e.status !== 'draft') throw new ConflictException('Se pot șterge doar scrutinele în configurare')
      const { rows } = await client.query<{ title: string }>('SELECT title FROM elections WHERE id = $1', [id])
      for (const table of ['registrations', 'eligible_voters', 'trustees', 'candidates', 'auth_challenges']) {
        await client.query(`DELETE FROM ${table} WHERE election_id = $1`, [id])
      }
      await client.query('UPDATE audit_log SET election_id = NULL WHERE election_id = $1', [id])
      await client.query('DELETE FROM elections WHERE id = $1', [id])
      await this.audit.log(adminActor(by), 'election.delete', null, { id, title: rows[0]?.title }, client)
    })
  }

  /** CSV cu un CNP pe linie. CNP-urile în clar nu se salvează și nu se loghează: intră doar HMAC-ul. */
  async importEligible(id: string, csv: unknown, by: AdminIdentity): Promise<EligibleImportResult> {
    if (typeof csv !== 'string') throw bad('Se așteaptă un fișier CSV (Content-Type: text/csv)')
    const result: EligibleImportResult = { imported: 0, duplicates: 0, invalid: [] }
    const hmacs: string[] = []
    for (const [i, raw] of csv.split(/\r?\n/).entries()) {
      const value = raw.split(/[,;]/)[0].trim().replace(/^"|"$/g, '')
      if (!value || (i === 0 && /^cnp$/i.test(value))) continue
      if (!isValidCnp(value)) {
        // în răspuns apare doar numărul liniei și o mască, ca un CNP greșit să nu ajungă în loguri
        if (result.invalid.length < MAX_INVALID_REPORTED) {
          result.invalid.push({ line: i + 1, value: value.length > 4 ? `${value.slice(0, 2)}…${value.slice(-2)}` : '…' })
        }
        continue
      }
      hmacs.push(cnpHmac(this.config.cnpHmacKey, value))
    }
    await this.db.transaction(async (client) => {
      const e = await this.elections.lock(client, id)
      if (e.status !== 'draft' && e.status !== 'open') throw new ConflictException('Lista se poate completa doar înainte de închiderea votului')
      const unique = [...new Set(hmacs)]
      result.duplicates += hmacs.length - unique.length
      for (let k = 0; k < unique.length; k += IMPORT_CHUNK) {
        const chunk = unique.slice(k, k + IMPORT_CHUNK)
        const { rowCount } = await client.query('INSERT INTO eligible_voters (election_id, cnp_hmac) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING', [
          id,
          chunk,
        ])
        result.imported += rowCount ?? 0
        result.duplicates += chunk.length - (rowCount ?? 0)
      }
      await this.audit.log(
        adminActor(by),
        'eligible.import',
        id,
        { imported: result.imported, duplicates: result.duplicates, invalid: result.invalid.length },
        client,
      )
    })
    return result
  }

  /** Deschiderea cere toate cheile trustees, o listă de eligibili nevidă și o dată de închidere încă în viitor. */
  async open(id: string, by: AdminIdentity): Promise<Election> {
    await this.db.transaction(async (client) => {
      const e = await this.elections.lock(client, id)
      if (e.status !== 'draft') throw new ConflictException('Scrutinul nu este în configurare')
      const missing = await client.query('SELECT 1 FROM trustees WHERE election_id = $1 AND public_key_share IS NULL', [id])
      const n = missing.rowCount ?? 0
      if (n) throw new ConflictException(n === 1 ? 'Lipsește cheia unui trustee' : `Lipsesc cheile de la ${plural(n, 'trustee', 'trustees')}`)
      const eligible = await client.query('SELECT 1 FROM eligible_voters WHERE election_id = $1 LIMIT 1', [id])
      if (!eligible.rowCount) throw new ConflictException('Lista alegătorilor eligibili este goală')
      if (e.closes_at.getTime() <= Date.now()) throw new ConflictException('Data închiderii a trecut deja; modifică intervalul scrutinului')
      await client.query("UPDATE elections SET status = 'open' WHERE id = $1", [id])
      await this.audit.log(adminActor(by), 'election.open', id, { publicKey: e.public_key }, client)
    })
    return this.elections.get(id)
  }

  /** La închidere, serverul calculează și publică criptotextele agregate per candidat. */
  async close(id: string, actor: string, extra: Record<string, unknown> = {}): Promise<Election> {
    await this.db.transaction(async (client) => {
      const e = await this.elections.lock(client, id)
      if (e.status !== 'open') throw new ConflictException('Scrutinul nu este deschis')
      const n = Number((await client.query<{ n: string }>('SELECT count(*) AS n FROM candidates WHERE election_id = $1', [id])).rows[0].n)
      const ballots = await client.query<{ ciphertexts: BoardEntry['ciphertexts'] }>('SELECT ciphertexts FROM ballots WHERE election_id = $1 ORDER BY seq', [
        id,
      ])
      const aggregate = computeAggregate(n, ballots.rows)
      await client.query("UPDATE elections SET status = 'closed', aggregate = $2 WHERE id = $1", [id, JSON.stringify(aggregate)])
      const head = await this.elections.head(id, client)
      await this.audit.log(actor, 'election.close', id, { ballots: ballots.rowCount, head: head.seq ? head : null, ...extra }, client)
    })
    return this.elections.get(id)
  }

  /** Scrutinele deschise a căror dată de închidere a trecut; le închide serverul, nu comisia. */
  async closeExpired(): Promise<string[]> {
    const { rows } = await this.db.query<{ id: string }>("SELECT id FROM elections WHERE status = 'open' AND closes_at <= now()")
    const closed: string[] = []
    for (const r of rows) {
      try {
        await this.close(r.id, 'server', { automatic: true })
        closed.push(r.id)
      } catch (err) {
        // 409: altă instanță l-a închis între timp. Orice altă eroare apare în log, iar celelalte scrutine se închid în continuare.
        if (!(err instanceof ConflictException)) this.logger.warn(`scrutinul ${r.id} nu s-a putut închide automat: ${(err as Error).message}`)
      }
    }
    return closed
  }
}
