import { Body, Controller, Inject, Param, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { RegisterNfcDto, RegisterOcrDto } from '../common/dto.js'
import { RegistrationService } from './registration.service.js'

/** Înregistrarea e limitată per IP, ca lista eligibililor să nu poată fi ghicită prin încercări repetate. */
@Controller('elections/:id/register')
export class RegistrationController {
  constructor(@Inject(RegistrationService) private readonly registration: RegistrationService) {}

  @Post('ocr')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  ocr(@Param('id') id: string, @Body() dto: RegisterOcrDto) {
    return this.registration.registerOcr(id, dto.cnp, dto.credentialPubkey)
  }

  @Post('nfc')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  nfc(@Param('id') id: string, @Body() dto: RegisterNfcDto) {
    return this.registration.registerNfc(id, dto.dg1, dto.sod, dto.credentialPubkey)
  }
}
