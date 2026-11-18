// Membrii comisiei: creare (token-ul se întoarce o singură dată), listare, revocare.

import { Injectable, NotFoundException } from '@nestjs/common'
import type { AdminIdentity, CommissionMember, CreatedMember } from '@evoting/api'
import { AuditService } from '../audit/audit.service.js'
import { randomToken, sha256 } from '../common/security.js'
import { bad, obj, str } from '../common/validate.js'
import { Database } from '../db/database.service.js'
import { adminActor } from './admin.guard.js'

interface MemberRow {
  id: string
  name: string
  role: CommissionMember['role']
  created_at: Date
  revoked_at: Date | null
}

const toMember = (r: MemberRow): CommissionMember => ({
  id: r.id,
  name: r.name,
  role: r.role,
  createdAt: r.created_at.toISOString(),
  revokedAt: r.revoked_at ? r.revoked_at.toISOString() : null,
})

@Injectable()
export class MembersService {
  constructor(
    private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<CommissionMember[]> {
    const { rows } = await this.db.query<MemberRow>('SELECT id, name, role, created_at, revoked_at FROM commission_members ORDER BY created_at')
    return rows.map(toMember)
  }

  async create(body: unknown, by: AdminIdentity): Promise<CreatedMember> {
    const input = obj(body, 'membrul')
    const name = str(input.name, 'Numele', { max: 120 })
    const role = input.role
    if (role !== 'comisie' && role !== 'observator') throw bad('Rolul e „comisie” sau „observator”')
    const id = `m-${randomToken(4)}`
    const token = randomToken()
    const { rows } = await this.db.query<MemberRow>(
      'INSERT INTO commission_members (id, name, role, token_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, role, created_at, revoked_at',
      [id, name, role, sha256(token)],
    )
    await this.audit.log(adminActor(by), 'member.create', null, { id, name, role })
    return { ...toMember(rows[0]), token }
  }

  /** Token-ul revocat nu mai e acceptat; rândul rămâne, ca jurnalul să poată fi citit în continuare. */
  async revoke(id: string, by: AdminIdentity): Promise<void> {
    const { rowCount } = await this.db.query('UPDATE commission_members SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [id])
    if (!rowCount) throw new NotFoundException('Membrul nu există sau e deja revocat')
    await this.audit.log(adminActor(by), 'member.revoke', null, { id })
  }
}
