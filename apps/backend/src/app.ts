import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module.js'
import { setSensitiveLimit } from './common/throttle.js'
import type { AppConfig } from './config.js'
import { migrate } from './db/migrate.js'

export async function createApp(config: AppConfig, { logger = true }: { logger?: boolean } = {}): Promise<NestExpressApplication> {
  await migrate(config.databaseUrl, logger ? (m) => console.log(m) : undefined)
  setSensitiveLimit(config.sensitiveLimit)
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forConfig(config), {
    logger: logger ? ['log', 'warn', 'error'] : false,
    bodyParser: false,
  })
  app.useBodyParser('json', { limit: '2mb' })
  app.useBodyParser('text', { type: ['text/csv', 'text/plain'], limit: '20mb' })
  app.enableCors({ origin: config.corsOrigins })
  app.enableShutdownHooks()
  return app
}
