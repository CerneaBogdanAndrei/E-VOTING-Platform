import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { AdminIdentity } from '@evoting/api'
import { SENSITIVE } from '../common/throttle.js'
import { Admin, AdminGuard, CommissionGuard } from './admin.guard.js'
import { MembersService } from './members.service.js'

/** Rutele comisiei care nu țin de un scrutin anume: cine sunt și membrii. */
@Controller('admin')
export class AdminController {
  constructor(private readonly members: MembersService) {}

  /** Panoul comisiei verifică token-ul înainte să afișeze acțiunile; încercările greșite sunt limitate. */
  @Get('check')
  @Throttle(SENSITIVE)
  @UseGuards(AdminGuard)
  check(@Admin() admin: AdminIdentity): AdminIdentity {
    return admin
  }

  @Get('members')
  @UseGuards(AdminGuard)
  list() {
    return this.members.list()
  }

  @Post('members')
  @Throttle(SENSITIVE)
  @UseGuards(CommissionGuard)
  create(@Body() body: unknown, @Admin() admin: AdminIdentity) {
    return this.members.create(body, admin)
  }

  @Delete('members/:id')
  @HttpCode(204)
  @UseGuards(CommissionGuard)
  async revoke(@Param('id') id: string, @Admin() admin: AdminIdentity) {
    await this.members.revoke(id, admin)
  }
}
