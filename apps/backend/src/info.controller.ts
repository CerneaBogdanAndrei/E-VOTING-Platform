import { Controller, Get, Inject } from '@nestjs/common'
import { GROUP_NAME } from '@evoting/crypto'
import type { ServerInfo } from '@evoting/api'
import { CONFIG, type AppConfig } from './config.js'
import { PassiveAuthService } from './nfc/passive-auth.service.js'
import { STORAGE, type Storage } from './storage/storage.js'

@Controller()
export class InfoController {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(PassiveAuthService) private readonly passiveAuth: PassiveAuthService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  @Get('info')
  info(): ServerInfo & { storage: string } {
    return {
      name: 'evoting-backend',
      version: '1.0.0',
      group: GROUP_NAME,
      demoMode: this.config.demoMode,
      nfcPassiveAuth: this.passiveAuth.enabled,
      storage: this.storage.kind,
      time: new Date().toISOString(),
    }
  }

  @Get('health')
  health() {
    return { ok: true }
  }
}
