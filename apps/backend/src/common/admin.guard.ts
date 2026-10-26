import { CanActivate, Inject, Injectable, UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import { CONFIG, type AppConfig } from '../config.js'
import { bearer, safeEqual } from './security.js'

/** Rutele comisiei cer token-ul de administrator în antetul Authorization. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>()
    const token = bearer(req.headers.authorization)
    if (!token || !safeEqual(token, this.config.adminToken)) {
      throw new UnauthorizedException('Token de comisie lipsă sau greșit')
    }
    return true
  }
}
