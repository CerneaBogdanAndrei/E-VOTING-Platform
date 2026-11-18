// Trustees: autentificarea cu token-ul primit la crearea scrutinului și
// trimiterea cheii publice Yᵢ cu dovada Schnorr. Decriptarea parțială e în tally/.

import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import type { Election } from '@evoting/api'
import { combinePublicKeys, verifyTrusteeKey, type TrusteePublicKey } from '@evoting/crypto'
import { AuditService } from '../audit/audit.service.js'
import { sha256 } from '../common/security.js'
import { bad, obj } from '../common/validate.js'
import { Database, type Queryable } from '../db/database.service.js'
import { ElectionsRepository } from '../elections/elections.repository.js'

export interface TrusteeRow {
  id: string
  name: string
  public_key_share: string | null
}

@Injectable()
export class TrusteesService {
  constructor(
    private readonly db: Database,
    private readonly elections: ElectionsRepository,
    private readonly audit: AuditService,
  ) {}

  /** Serverul păstrează doar SHA-256(token); token-ul în clar a fost afișat o singură dată comisiei. */
  async byToken(client: Queryable, electionId: string, token: string | null): Promise<TrusteeRow> {
    if (!token) throw new UnauthorizedException('Lipsește token-ul de trustee')
    const { rows } = await client.query<TrusteeRow>('SELECT id, name, public_key_share FROM trustees WHERE election_id = $1 AND token_hash = $2', [
      electionId,
      sha256(token),
    ])
    if (!rows[0]) throw new UnauthorizedException('Token de trustee invalid pentru acest scrutin')
    return rows[0]
  }

  /** Trustee-ul trimite Yᵢ și dovada Schnorr; când sunt toate, se publică Y = ΣYᵢ. */
  async submitKey(id: string, token: string | null, body: unknown): Promise<Election> {
    const key = obj(body, 'cheia') as Partial<TrusteePublicKey>
    await this.db.transaction(async (client) => {
      const e = await this.elections.lock(client, id)
      const trustee = await this.byToken(client, id, token)
      if (key.trusteeId !== trustee.id) throw new ForbiddenException('Token-ul aparține altui trustee')
      if (e.status !== 'draft') throw new ConflictException('Cheile se trimit doar în configurare')
      if (trustee.public_key_share) throw new ConflictException('Trustee-ul și-a trimis deja cheia')
      if (!verifyTrusteeKey(id, key as TrusteePublicKey)) throw bad('Dovada Schnorr a cheii nu e validă')
      await client.query('UPDATE trustees SET public_key_share = $2, key_proof = $3 WHERE id = $1', [trustee.id, key.publicKeyShare, JSON.stringify(key.proof)])
      const all = await client.query<{ public_key_share: string | null }>('SELECT public_key_share FROM trustees WHERE election_id = $1 ORDER BY position', [
        id,
      ])
      if (all.rows.every((t) => t.public_key_share)) {
        const publicKey = combinePublicKeys(all.rows.map((t) => t.public_key_share!))
        await client.query('UPDATE elections SET public_key = $2 WHERE id = $1', [id, publicKey])
        await this.audit.log('server', 'election.public_key', id, { publicKey }, client)
      }
      await this.audit.log(`trustee:${trustee.id}`, 'trustee.key', id, { publicKeyShare: key.publicKeyShare }, client)
    })
    return this.elections.get(id)
  }
}
