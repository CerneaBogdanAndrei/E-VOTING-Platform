import { Inject, Injectable } from '@nestjs/common'
import { STORAGE, type Storage } from '../storage/storage.js'
import { nowIso } from './time.js'

/** Jurnalul de audit: acțiunile comisiei și ale trustees, public per scrutin. */
@Injectable()
export class AuditService {
  constructor(@Inject(STORAGE) private readonly storage: Storage) {}

  log(electionId: string | null, actor: string, action: string, payload: Record<string, unknown> = {}) {
    return this.storage.auditLog.append({ electionId, actor, action, payload, createdAt: nowIso() })
  }
}
