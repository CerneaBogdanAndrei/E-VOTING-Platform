import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common'
import pg from 'pg'
import { CONFIG, type AppConfig } from '../config.js'
import { pgOptions } from './pg-options.js'

export interface Queryable {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]): Promise<pg.QueryResult<T>>
}

@Injectable()
export class Database implements OnApplicationShutdown {
  readonly pool: pg.Pool

  constructor(@Inject(CONFIG) config: AppConfig) {
    this.pool = new pg.Pool({ ...pgOptions(config.databaseUrl), max: 20 })
  }

  query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]) {
    return this.pool.query<T>(text, values)
  }

  /** Rulează funcția într-o tranzacție; la eroare face ROLLBACK. */
  async transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
  }

  async onApplicationShutdown() {
    await this.pool.end()
  }
}

/** Codul PostgreSQL pentru încălcarea unei constrângeri UNIQUE. */
export const isUniqueViolation = (err: unknown, constraint?: string) =>
  (err as { code?: string })?.code === '23505' && (!constraint || (err as { constraint?: string }).constraint === constraint)
