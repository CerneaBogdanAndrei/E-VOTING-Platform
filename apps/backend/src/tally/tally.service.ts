import { ConflictException, Injectable } from '@nestjs/common'
import type { Election } from '@evoting/api'
import { combinePartialDecryptions, verifyPartialDecryption, type PartialDecryption } from '@evoting/crypto'
import { AuditService } from '../common/audit.service.js'
import { bad, obj } from '../common/validate.js'
import { Database } from '../db/database.service.js'
import { ElectionsService } from '../elections/elections.service.js'

@Injectable()
export class TallyService {
  constructor(
    private readonly db: Database,
    private readonly elections: ElectionsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Un trustee trimite Dᵢⱼ = xᵢAⱼ cu dovezile. Când le au toți, serverul
   * combină decriptările, află totalurile prin baby-step giant-step și publică rezultatul.
   */
  async submitPartial(electionId: string, token: string | null, body: unknown): Promise<Election> {
    const input = obj(body, 'decriptarea parțială') as Partial<PartialDecryption>
    await this.db.transaction(async (client) => {
      const e = await this.elections.lock(client, electionId)
      const trustee = await this.elections.trusteeByToken(client, electionId, token)
      if (e.status !== 'closed' || !e.aggregate) throw new ConflictException('Decriptarea se face după închiderea votului, înainte de publicarea rezultatului')
      if (input.trusteeId !== undefined && input.trusteeId !== trustee.id) throw bad('Decriptarea e trimisă pentru alt trustee')
      const partial: PartialDecryption = { trusteeId: trustee.id, shares: input.shares as string[], proofs: input.proofs as PartialDecryption['proofs'] }
      const check = verifyPartialDecryption(electionId, trustee.public_key_share!, e.aggregate, partial)
      if (!check.ok) throw bad(`Decriptare respinsă: ${check.reason}`)
      const inserted = await client.query(
        'INSERT INTO partial_decryptions (election_id, trustee_id, shares, proofs) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [electionId, trustee.id, JSON.stringify(partial.shares), JSON.stringify(partial.proofs)],
      )
      if (!inserted.rowCount) throw new ConflictException('Decriptarea parțială a fost deja trimisă')
      await this.audit.log(`trustee:${trustee.id}`, 'tally.partial', electionId, null, client)

      const trustees = await client.query<{ id: string }>('SELECT id FROM trustees WHERE election_id = $1 ORDER BY position', [electionId])
      const partials = await client.query<{ trustee_id: string; shares: string[]; proofs: PartialDecryption['proofs'] }>(
        'SELECT trustee_id, shares, proofs FROM partial_decryptions WHERE election_id = $1',
        [electionId],
      )
      if (partials.rowCount !== trustees.rowCount) return

      const ordered = trustees.rows.map((t) => {
        const p = partials.rows.find((x) => x.trustee_id === t.id)!
        return { trusteeId: p.trustee_id, shares: p.shares, proofs: p.proofs }
      })
      const ballots = Number((await client.query<{ n: string }>('SELECT count(*) AS n FROM ballots WHERE election_id = $1', [electionId])).rows[0].n)
      const counts = combinePartialDecryptions(e.aggregate, ordered, ballots)
      const candidates = await client.query<{ id: string; position: number }>('SELECT id, position FROM candidates WHERE election_id = $1 ORDER BY position', [electionId])
      const result = candidates.rows.map((c) => ({ candidateId: c.id, votes: counts[c.position] }))
      await client.query('INSERT INTO results (election_id, counts, total_ballots) VALUES ($1, $2, $3)', [electionId, JSON.stringify(result), ballots])
      await client.query("UPDATE elections SET status = 'tallied' WHERE id = $1", [electionId])
      await this.audit.log('server', 'tally.result', electionId, { counts: result, totalBallots: ballots }, client)
    })
    return this.elections.get(electionId)
  }
}
