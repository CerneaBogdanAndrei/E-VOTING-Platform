// Leagă totul: controllerele, serviciile fiecărui modul, baza de date și limitarea de rată.
//
//   admin/         autentificarea comisiei (token rădăcină sau membru cu rol), membrii, /admin/*
//   elections/     citirile publice (repository), acțiunile comisiei (service), închiderea automată
//   trustees/      token-urile trustees și cheile Yᵢ
//   registration/  înregistrarea prin OCR sau NFC (și re-înregistrarea)
//   auth/          provocarea semnată (în bază) și sesiunea alegătorului
//   ballots/       primirea buletinului pe board, în intervalul scrutinului
//   tally/         decriptările parțiale și rezultatul
//   nfc/           Passive Authentication și PKI-ul de test
//   audit/         jurnalul de audit
//   system/        /health

import { Module, type DynamicModule } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AdminController } from './admin/admin.controller.js'
import { AdminGuard, CommissionGuard } from './admin/admin.guard.js'
import { MembersService } from './admin/members.service.js'
import { AuditService } from './audit/audit.service.js'
import { AuthController } from './auth/auth.controller.js'
import { AuthService } from './auth/auth.service.js'
import { BallotsService } from './ballots/ballots.service.js'
import { CONFIG, type AppConfig } from './config.js'
import { Database } from './db/database.service.js'
import { AutoCloseService } from './elections/auto-close.service.js'
import { ElectionsController } from './elections/elections.controller.js'
import { ElectionsRepository } from './elections/elections.repository.js'
import { ElectionsService } from './elections/elections.service.js'
import { PassiveAuthService } from './nfc/passive-auth.service.js'
import { RegistrationService } from './registration/registration.service.js'
import { SystemController } from './system/system.controller.js'
import { TallyService } from './tally/tally.service.js'
import { TrusteesService } from './trustees/trustees.service.js'

/** Limita generală: 600 de cereri pe minut per IP. Rutele sensibile au limita strictă din common/throttle.ts. */
const GENERAL_LIMIT = { ttl: 60_000, limit: 600 }

@Module({})
export class AppModule {
  static forConfig(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ...GENERAL_LIMIT }],
          skipIf: () => !config.rateLimit,
        }),
      ],
      controllers: [ElectionsController, AuthController, AdminController, SystemController],
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        Database,
        AuditService,
        AdminGuard,
        CommissionGuard,
        MembersService,
        PassiveAuthService,
        ElectionsRepository,
        ElectionsService,
        AutoCloseService,
        TrusteesService,
        RegistrationService,
        AuthService,
        BallotsService,
        TallyService,
      ],
    }
  }
}
