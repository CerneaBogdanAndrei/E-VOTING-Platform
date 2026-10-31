import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common'
import { AdminGuard } from '../auth/admin.guard.js'
import { BallotsService } from '../ballots/ballots.service.js'
import { BallotDto, CreateElectionDto, PartialDecryptionDto, TrusteeKeyDto } from '../common/dto.js'
import { STORAGE, type Storage } from '../storage/storage.js'
import { TallyService } from '../tally/tally.service.js'
import { bearerToken } from '../auth/auth.service.js'
import { ElectionsService } from './elections.service.js'

@Controller('elections')
export class ElectionsController {
  constructor(
    @Inject(ElectionsService) private readonly elections: ElectionsService,
    @Inject(BallotsService) private readonly ballots: BallotsService,
    @Inject(TallyService) private readonly tally: TallyService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  // ── Public ──

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
    return this.ballots.board(id)
  }

  @Get(':id/board/head')
  head(@Param('id') id: string) {
    return this.ballots.head(id)
  }

  @Get(':id/board/:code')
  find(@Param('id') id: string, @Param('code') code: string) {
    return this.ballots.find(id, code)
  }

  @Get(':id/tally')
  tallyState(@Param('id') id: string) {
    return this.tally.state(id)
  }

  @Get(':id/result')
  result(@Param('id') id: string) {
    return this.tally.result(id)
  }

  @Get(':id/record')
  record(@Param('id') id: string) {
    return this.tally.record(id)
  }

  @Get(':id/audit-log')
  async auditLog(@Param('id') id: string) {
    await this.elections.row(id)
    return (await this.storage.auditLog.list(id)).map(({ electionId: _e, ...rest }) => rest)
  }

  // ── Comisia ──

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateElectionDto) {
    return this.elections.create(dto)
  }

  @Post(':id/eligible')
  @UseGuards(AdminGuard)
  importEligible(@Param('id') id: string, @Body() csv: string) {
    return this.elections.importEligible(id, typeof csv === 'string' ? csv : '')
  }

  @Post(':id/trustees/:trusteeId/invite')
  @UseGuards(AdminGuard)
  invite(@Param('id') id: string, @Param('trusteeId') trusteeId: string) {
    return this.elections.trusteeInvite(id, trusteeId)
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

  // ── Trustees (CLI) ──

  @Post(':id/trustees')
  submitKey(@Param('id') id: string, @Headers('x-trustee-code') code: string | undefined, @Body() dto: TrusteeKeyDto) {
    return this.elections.submitTrusteeKey(id, code, dto)
  }

  @Post(':id/tally/partial')
  submitPartial(@Param('id') id: string, @Headers('x-trustee-code') code: string | undefined, @Body() dto: PartialDecryptionDto) {
    return this.tally.submitPartial(id, code, dto)
  }

  // ── Alegătorul ──

  @Post(':id/ballots')
  cast(@Param('id') id: string, @Headers('authorization') auth: string | undefined, @Body() dto: BallotDto) {
    return this.ballots.cast(id, bearerToken(auth), dto)
  }
}
