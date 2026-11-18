import { Body, Controller, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { SENSITIVE } from '../common/throttle.js'
import { AuthService } from './auth.service.js'

/** Autentificarea aplicației: semnează cu cheia de credential o provocare de la server. */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('challenge')
  @Throttle(SENSITIVE)
  challenge(@Body() body: unknown) {
    return this.auth.challenge(body)
  }

  @Post('verify')
  @Throttle(SENSITIVE)
  verify(@Body() body: unknown) {
    return this.auth.verify(body)
  }
}
