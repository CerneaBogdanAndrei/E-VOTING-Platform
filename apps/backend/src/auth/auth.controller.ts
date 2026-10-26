import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { AdminGuard } from '../common/admin.guard.js'
import { SENSITIVE } from '../common/throttle.js'
import { VotingService } from '../voting/voting.service.js'

/** Autentificarea aplicației: semnează cu cheia de credential o provocare de la server. */
@Controller('auth')
export class AuthController {
  constructor(private readonly voting: VotingService) {}

  @Post('challenge')
  @Throttle(SENSITIVE)
  challenge(@Body() body: unknown) {
    return this.voting.challenge(body)
  }

  @Post('verify')
  @Throttle(SENSITIVE)
  verify(@Body() body: unknown) {
    return this.voting.verify(body)
  }
}

@Controller()
export class SystemController {
  @Get('health')
  health() {
    return { ok: true }
  }

  /** Panoul comisiei verifică token-ul înainte să afișeze acțiunile. Încercările greșite sunt limitate. */
  @Get('admin/check')
  @HttpCode(204)
  @Throttle(SENSITIVE)
  @UseGuards(AdminGuard)
  adminCheck() {
    return undefined
  }
}
