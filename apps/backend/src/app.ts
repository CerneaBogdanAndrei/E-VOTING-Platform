import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import helmet from 'helmet'
import { AppModule } from './app.module.js'
import { setSensitiveLimit } from './common/throttle.js'
import type { AppConfig } from './config.js'
import { migrate } from './db/migrate.js'
import { sslWarning } from './db/pg-options.js'

export async function createApp(config: AppConfig, { logger = true }: { logger?: boolean } = {}): Promise<NestExpressApplication> {
  const log = logger ? (m: string) => console.log(m) : () => undefined
  await migrate(config.databaseUrl, log)
  setSensitiveLimit(config.sensitiveLimit)
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forConfig(config), {
    logger: logger ? ['log', 'warn', 'error'] : false,
    bodyParser: false,
  })
  // antete de securitate (HSTS, nosniff, fără sniffing de MIME etc.); API-ul întoarce doar JSON, deci CSP nu are ce proteja
  app.use(helmet({ contentSecurityPolicy: false }))
  if (config.trustProxy) app.set('trust proxy', config.trustProxy)
  app.useBodyParser('json', { limit: '2mb' })
  app.useBodyParser('text', { type: ['text/csv', 'text/plain'], limit: '20mb' })
  app.enableCors({ origin: config.corsOrigins })
  app.enableShutdownHooks()
  if (logger) {
    if (config.production && config.corsOrigins === true) console.warn('CORS_ORIGINS lipsește: orice site poate chema API-ul din browser')
    const ssl = sslWarning(config.databaseUrl)
    if (ssl) console.warn(ssl)
  }
  return app
}
