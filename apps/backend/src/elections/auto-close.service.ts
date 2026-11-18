// Închiderea automată: la fiecare AUTO_CLOSE_INTERVAL_MS, scrutinele deschise a căror
// dată de închidere a trecut sunt închise de server (agregatul se publică), fără comisie.

import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { CONFIG, type AppConfig } from '../config.js'
import { ElectionsService } from './elections.service.js'

@Injectable()
export class AutoCloseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AutoClose')
  private timer: NodeJS.Timeout | undefined

  constructor(
    private readonly elections: ElectionsService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit() {
    if (this.config.autoCloseIntervalMs <= 0) return
    this.timer = setInterval(() => void this.tick(), this.config.autoCloseIntervalMs)
    // nu ține procesul în viață doar pentru acest ceas
    this.timer.unref()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  async tick() {
    try {
      const closed = await this.elections.closeExpired()
      for (const id of closed) this.logger.log(`scrutinul ${id} s-a închis automat la data de închidere`)
    } catch (err) {
      this.logger.warn(`închiderea automată a eșuat: ${(err as Error).message}`)
    }
  }
}
