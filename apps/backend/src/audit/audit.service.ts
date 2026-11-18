import { Injectable } from '@nestjs/common'
import type { AuditLogEntry } from '@evoting/api'
import { Database, type Queryable } from '../db/database.service.js'

/** Jurnalul de audit: acțiunile comisiei, ale trustees și ale serverului, cu ora lor. */
@Injectable()
export class AuditService {
  constructor(private readonly db: Database) {}

  async log(actor: string, action: string, electionId: string | null, payload: unknown = null, client: Queryable = this.db) {
    await client.query('INSERT INTO audit_log (election_id, actor, action, payload) VALUES ($1, $2, $3, $4)', [
      electionId,
      actor,
      action,
      payload === null ? null : JSON.stringify(payload),
    ])
  }

  async list(electionId: string): Promise<AuditLogEntry[]> {
    const { rows } = await this.db.query<{ id: string; actor: string; action: string; payload: unknown; created_at: Date }>(
      'SELECT id, actor, action, payload, created_at FROM audit_log WHERE election_id = $1 ORDER BY id',
      [electionId],
    )
    return rows.map((r) => ({ id: Number(r.id), actor: r.actor, action: r.action, payload: r.payload, createdAt: r.created_at.toISOString() }))
  }
}
