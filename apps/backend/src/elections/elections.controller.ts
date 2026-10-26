import { Body, Controller, Get, Headers, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { AdminGuard } from '../common/admin.guard.js'
import { AuditService } from '../common/audit.service.js'
import { SENSITIVE } from '../common/throttle.js'
import { bearer } from '../common/security.js'
import { TallyService } from '../tally/tally.service.js'
import { VotingService } from '../voting/voting.service.js'
import { ElectionsService } from './elections.service.js'

@Controller('elections')
export class ElectionsController {
  constructor(
    private readonly elections: ElectionsService,
    private readonly voting: VotingService,
    private readonly tally: TallyService,
    private readonly audit: AuditService,
  ) {}

  // ───────────── public ─────────────

  @Get()
  list() {
    return this.elections.list()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.elections.get(id)
  }

  @Get(':id/board')
  board(@Param('id') id: string) {
    return this.elections.board(id)
  }

  @Get(':id/board/:hash')
  findBallot(@Param('id') id: string, @Param('hash') hash: string) {
    return this.elections.findBallot(id, hash)
  }

  @Get(':id/board-head')
  head(@Param('id') id: string) {
    return this.elections.head(id)
  }

  @Get(':id/registrations')
  registrations(@Param('id') id: string) {
    return this.elections.registrations(id)
  }

  @Get(':id/tally')
  getTally(@Param('id') id: string) {
    return this.elections.tally(id)
  }

  @Get(':id/result')
  result(@Param('id') id: string) {
    return this.elections.result(id)
  }

  @Get(':id/audit-bundle')
  auditBundle(@Param('id') id: string) {
    return this.elections.auditBundle(id)
  }

  // ───────────── comisia ─────────────

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() body: unknown) {
    return this.elections.create(body)
  }

  @Post(':id/eligible')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  importEligible(@Param('id') id: string, @Body() body: unknown) {
    return this.elections.importEligible(id, body)
  }

  @Post(':id/open')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  open(@Param('id') id: string) {
    return this.elections.open(id)
  }

  @Post(':id/close')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  close(@Param('id') id: string) {
    return this.elections.close(id)
  }

  @Get(':id/audit-log')
  @UseGuards(AdminGuard)
  auditLog(@Param('id') id: string) {
    return this.audit.list(id)
  }

  // ───────────── trustees ─────────────

  @Post(':id/trustees')
  @HttpCode(200)
  @Throttle(SENSITIVE)
  submitTrusteeKey(@Param('id') id: string, @Headers('authorization') auth: string | undefined, @Body() body: unknown) {
    return this.elections.submitTrusteeKey(id, bearer(auth), body)
  }

  @Post(':id/tally/partial')
  @HttpCode(200)
  @Throttle(SENSITIVE)
  submitPartial(@Param('id') id: string, @Headers('authorization') auth: string | undefined, @Body() body: unknown) {
    return this.tally.submitPartial(id, bearer(auth), body)
  }

  // ───────────── alegătorul ─────────────

  @Post(':id/register/ocr')
  @Throttle(SENSITIVE)
  registerOcr(@Param('id') id: string, @Body() body: unknown) {
    return this.voting.registerOcr(id, body)
  }

  @Post(':id/register/nfc')
  @Throttle(SENSITIVE)
  registerNfc(@Param('id') id: string, @Body() body: unknown) {
    return this.voting.registerNfc(id, body)
  }

  @Post(':id/ballots')
  castBallot(@Param('id') id: string, @Headers('authorization') auth: string | undefined, @Body() body: unknown) {
    return this.voting.cast(id, bearer(auth), body)
  }
}
