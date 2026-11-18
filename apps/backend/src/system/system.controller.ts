import { Controller, Get } from '@nestjs/common'

/** Rutele de sistem: monitorizare. */
@Controller()
export class SystemController {
  @Get('health')
  health() {
    return { ok: true }
  }
}
