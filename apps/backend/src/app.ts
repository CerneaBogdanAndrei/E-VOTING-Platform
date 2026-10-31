import 'reflect-metadata'
import { type INestApplication, Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module.js'
import type { AppConfig } from './config.js'
import { createStorage } from './storage/create-storage.js'
import type { Storage } from './storage/storage.js'

/** Construiește aplicația (folosit de main.ts și de teste). */
export async function createApp(config: AppConfig, storage?: Storage): Promise<INestApplication> {
  const store = storage ?? (await createStorage(config))
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config, store), {
    logger: process.env.NODE_ENV === 'test' ? ['error'] : ['log', 'warn', 'error'],
  })
  app.enableCors({ origin: config.corsOrigin })
  app.useBodyParser('json', { limit: '2mb' })
  app.useBodyParser('text', { type: ['text/csv', 'text/plain'], limit: '20mb' })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.enableShutdownHooks()
  return app
}

export const logger = new Logger('Server')
