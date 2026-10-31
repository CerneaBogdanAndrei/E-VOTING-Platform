import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import { AuthService, bearerToken } from './auth.service.js'

/** Rutele comisiei cer tokenul obținut cu parola (POST /auth/admin). */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>()
    if (!this.auth.isAdmin(bearerToken(req.headers.authorization))) {
      throw new UnauthorizedException('Doar comisia electorală poate face această acțiune (autentificare necesară)')
    }
    return true
  }
}
