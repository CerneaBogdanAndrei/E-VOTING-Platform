import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { AdminLoginDto, AuthChallengeDto, AuthVerifyDto } from '../common/dto.js'
import { AuditService } from '../common/audit.service.js'
import { AuthService } from './auth.service.js'

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Post('challenge')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  challenge(@Body() dto: AuthChallengeDto) {
    return this.auth.challenge(dto.electionId, dto.credentialPubkey)
  }

  @Post('verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  verify(@Body() dto: AuthVerifyDto) {
    return this.auth.verify(dto.electionId, dto.credentialPubkey, dto.nonce, dto.signature)
  }

  /** Autentificarea comisiei. Limitată strict: 5 încercări pe minut per adresă IP. */
  @Post('admin')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async admin(@Body() dto: AdminLoginDto) {
    try {
      const session = this.auth.adminLogin(dto.password)
      await this.audit.log(null, 'comisie', 'autentificare', {})
      return session
    } catch (err) {
      await this.audit.log(null, 'anonim', 'autentificare eșuată', {})
      throw err
    }
  }
}
