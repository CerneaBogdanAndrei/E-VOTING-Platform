import { type DynamicModule, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'
import { AdminGuard } from './auth/admin.guard.js'
import { AuthController } from './auth/auth.controller.js'
import { AuthService } from './auth/auth.service.js'
import { BallotsService } from './ballots/ballots.service.js'
import { AuditService } from './common/audit.service.js'
import { AppThrottlerGuard } from './common/throttle.guard.js'
import { CONFIG, type AppConfig } from './config.js'
import { DemoController } from './demo/demo.controller.js'
import { DemoService } from './demo/demo.service.js'
import { ElectionsController } from './elections/elections.controller.js'
import { ElectionsService } from './elections/elections.service.js'
import { InfoController } from './info.controller.js'
import { PassiveAuthService } from './nfc/passive-auth.service.js'
import { RegistrationController } from './registration/registration.controller.js'
import { RegistrationService } from './registration/registration.service.js'
import { STORAGE, type Storage } from './storage/storage.js'
import { TallyService } from './tally/tally.service.js'

@Module({})
export class AppModule {
  static register(config: AppConfig, storage: Storage): DynamicModule {
    AppThrottlerGuard.enabled = config.rateLimit
    return {
      module: AppModule,
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 600 }])],
      controllers: [InfoController, ElectionsController, RegistrationController, AuthController, ...(config.demoMode ? [DemoController] : [])],
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: STORAGE, useValue: storage },
        { provide: APP_GUARD, useClass: AppThrottlerGuard },
        AuditService,
        AuthService,
        AdminGuard,
        ElectionsService,
        PassiveAuthService,
        RegistrationService,
        BallotsService,
        TallyService,
        ...(config.demoMode ? [DemoService] : []),
      ],
    }
  }
}
