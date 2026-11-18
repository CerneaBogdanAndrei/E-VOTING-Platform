// Rutele /elections: citirile publice, acțiunile comisiei, trustees și alegătorul.
// Controller-ul doar leagă rutele de servicii și pune protecțiile (token, rol, limită de rată).

import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { AdminIdentity } from '@evoting/api'
import { Admin, AdminGuard, CommissionGuard, adminActor } from '../admin/admin.guard.js'
import { AuditService } from '../audit/audit.service.js'
import { BallotsService } from '../ballots/ballots.service.js'
import { bearer } from '../common/security.js'
import { SENSITIVE } from '../common/throttle.js'
import { RegistrationService } from '../registration/registration.service.js'
import { TallyService } from '../tally/tally.service.js'
import { TrusteesService } from '../trustees/trustees.service.js'
import { ElectionsRepository } from './elections.repository.js'
import { ElectionsService } from './elections.service.js'

const MAX_PAGE_SIZE = 500

@Controller('elections')
export class ElectionsController {
  constructor(
    private readonly elections: ElectionsRepository,
    private readonly commission: ElectionsService,
    private readonly trustees: TrusteesService,
    private readonly registration: RegistrationService,
    private readonly ballots: BallotsService,
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

  /** Declarată înaintea rutei `:id/board/:hash`, ca „page” să nu fie luat drept cod de urmărire. */
  @Get(':id/board/page')
  boardPage(@Param('id') id: string, @Query('page') page?: string, @Query('size') size?: string) {
    const p = Math.max(1, Math.floor(Number(page) || 1))
    const s = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(size) || 100)))
    return this.elections.boardPage(id, p, s)
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
  @UseGuards(CommissionGuard)
  create(@Body() body: unknown, @Admin() admin: AdminIdentity) {
    return this.commission.create(body, admin)
  }

  @Patch(':id')
  @UseGuards(CommissionGuard)
  update(@Param('id') id: string, @Body() body: unknown, @Admin() admin: AdminIdentity) {
    return this.commission.update(id, body, admin)
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(CommissionGuard)
  async remove(@Param('id') id: string, @Admin() admin: AdminIdentity) {
    await this.commission.remove(id, admin)
  }

  @Post(':id/eligible')
  @HttpCode(200)
  @UseGuards(CommissionGuard)
  importEligible(@Param('id') id: string, @Body() body: unknown, @Admin() admin: AdminIdentity) {
    return this.commission.importEligible(id, body, admin)
  }

  @Post(':id/open')
  @HttpCode(200)
  @UseGuards(CommissionGuard)
  open(@Param('id') id: string, @Admin() admin: AdminIdentity) {
    return this.commission.open(id, admin)
  }

  @Post(':id/close')
  @HttpCode(200)
  @UseGuards(CommissionGuard)
  close(@Param('id') id: string, @Admin() admin: AdminIdentity) {
    return this.commission.close(id, adminActor(admin))
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
    return this.trustees.submitKey(id, bearer(auth), body)
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
    return this.registration.registerOcr(id, body)
  }

  @Post(':id/register/nfc')
  @Throttle(SENSITIVE)
  registerNfc(@Param('id') id: string, @Body() body: unknown) {
    return this.registration.registerNfc(id, body)
  }

  @Post(':id/ballots')
  castBallot(@Param('id') id: string, @Headers('authorization') auth: string | undefined, @Body() body: unknown) {
    return this.ballots.cast(id, bearer(auth), body)
  }
}
