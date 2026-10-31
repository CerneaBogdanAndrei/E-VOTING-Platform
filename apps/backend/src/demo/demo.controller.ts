import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common'
import { AdminGuard } from '../auth/admin.guard.js'
import { CountDto } from '../common/dto.js'
import { DemoService } from './demo.service.js'

/** Înregistrat doar cu DEMO_MODE=true (vezi AppModule). */
@Controller('demo/elections/:id')
export class DemoController {
  constructor(@Inject(DemoService) private readonly demo: DemoService) {}

  @Post('eligible')
  @UseGuards(AdminGuard)
  eligible(@Param('id') id: string, @Body() dto: CountDto) {
    return this.demo.generateEligible(id, dto.count)
  }

  @Get('sample-cnp')
  sampleCnp(@Param('id') id: string) {
    return this.demo.sampleCnp(id)
  }

  @Get('nfc-document')
  nfcDocument(@Param('id') id: string) {
    return this.demo.nfcDocument(id)
  }

  @Post('trustee-keys')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  trusteeKeys(@Param('id') id: string) {
    return this.demo.trusteeKeys(id)
  }

  @Post('voters')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  voters(@Param('id') id: string, @Body() dto: CountDto) {
    return this.demo.voters(id, dto.count)
  }

  @Post('tally')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  tally(@Param('id') id: string) {
    return this.demo.runTally(id)
  }
}
