import { Module, type DynamicModule } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AuthController, SystemController } from './auth/auth.controller.js'
import { AdminGuard } from './common/admin.guard.js'
import { AuditService } from './common/audit.service.js'
import { CONFIG, type AppConfig } from './config.js'
import { Database } from './db/database.service.js'
import { ElectionsController } from './elections/elections.controller.js'
import { ElectionsService } from './elections/elections.service.js'
import { PassiveAuthService } from './nfc/passive-auth.service.js'
import { TallyService } from './tally/tally.service.js'
import { VotingService } from './voting/voting.service.js'

@Module({})
export class AppModule {
  static forConfig(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit: 600 }],
          skipIf: () => !config.rateLimit,
        }),
      ],
      controllers: [ElectionsController, AuthController, SystemController],
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        Database,
        AuditService,
        AdminGuard,
        ElectionsService,
        VotingService,
        TallyService,
        PassiveAuthService,
      ],
    }
  }
}
