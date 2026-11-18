// Autentificarea comisiei. ADMIN_TOKEN e „rădăcina” (rol comisie). Membrii creați de
// comisie au token propriu, păstrat doar ca SHA-256, și un rol: `comisie` (orice) sau
// `observator` (doar citire). Identitatea ajunge în jurnalul de audit ca actor.

import { CanActivate, ForbiddenException, Inject, Injectable, UnauthorizedException, createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { AdminIdentity } from '@evoting/api'
import { bearer, safeEqual, sha256 } from '../common/security.js'
import { CONFIG, type AppConfig } from '../config.js'
import { Database } from '../db/database.service.js'

export const ROOT_ADMIN: AdminIdentity = { id: 'root', name: 'Administrator', role: 'comisie' }

/** Actorul din jurnalul de audit pentru o acțiune a comisiei. */
export const adminActor = (admin: AdminIdentity) => `comisie:${admin.name}`

interface AdminRequest {
  headers: Record<string, string | undefined>
  admin?: AdminIdentity
}

/** Orice membru al comisiei (inclusiv observatorii): rutele de citire. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>()
    req.admin = await this.identify(bearer(req.headers.authorization))
    return true
  }

  async identify(token: string | null): Promise<AdminIdentity> {
    if (!token) throw new UnauthorizedException('Token de comisie lipsă sau greșit')
    if (safeEqual(token, this.config.adminToken)) return ROOT_ADMIN
    const { rows } = await this.db.query<AdminIdentity>('SELECT id, name, role FROM commission_members WHERE token_hash = $1 AND revoked_at IS NULL', [
      sha256(token),
    ])
    if (!rows[0]) throw new UnauthorizedException('Token de comisie lipsă sau greșit')
    return rows[0]
  }
}

/** Doar rolul `comisie`: rutele care schimbă ceva. */
@Injectable()
export class CommissionGuard implements CanActivate {
  constructor(private readonly admin: AdminGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.admin.canActivate(context)
    const req = context.switchToHttp().getRequest<AdminRequest>()
    if (req.admin?.role !== 'comisie') throw new ForbiddenException('Doar membrii comisiei pot face această acțiune; observatorii doar citesc')
    return true
  }
}

/** Parametru de controller: identitatea pusă de AdminGuard pe cerere. */
export const Admin = createParamDecorator((_data: unknown, ctx: ExecutionContext): AdminIdentity => {
  return ctx.switchToHttp().getRequest<AdminRequest>().admin ?? ROOT_ADMIN
})
