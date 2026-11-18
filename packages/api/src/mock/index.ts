// Backend simulat în memorie, cu aceleași reguli ca API-ul real, ca interfața
// să poată fi folosită fără server. Criptografia e cea reală (@evoting/crypto):
// buletinele au dovezi verificate, iar rezultatul vine din decriptarea parțială
// a agregatului. Se pierde la reîncărcare.
//
//   state.ts   starea (ce ar fi în tabelele serverului) și contextul comun
//   rules.ts   regulile serverului: scrutin, chei, înregistrare, vot, numărare
//   seed.ts    scrutinele de demonstrație
//   client.ts  implementarea ApiClient, rută cu rută
//   tools.ts   uneltele de test (țin locul CLI-ului de trustee și al alegătorilor)

import type { ApiClient } from '../contract/index.js'
import { createMockClient, type Run } from './client.js'
import { delay } from './random.js'
import { autoClose } from './rules.js'
import { seedDemoElections, type SeedVoters } from './seed.js'
import { createMockContext } from './state.js'
import { createMockTools, type MockTools } from './tools.js'

export type { MockTools } from './tools.js'

export interface MockOptions {
  /** Câți alegători votează în scrutinele de demonstrație. Pe telefon, mai puțini (criptarea e mai lentă). */
  seedVoters?: SeedVoters
  latency?: boolean
}

export function createMockBackend(options: MockOptions = {}): { client: ApiClient; tools: MockTools } {
  const ctx = createMockContext()
  const seedVoters = options.seedVoters ?? { open: 6, tallied: 12 }

  let ready: Promise<void> | null = null
  const run: Run = async (fn) => {
    // Datele de demonstrație se generează la prima cerere, nu la importul modulului.
    ready ??= delay(0).then(() => seedDemoElections(ctx, seedVoters))
    await ready
    if (options.latency !== false) await delay()
    // ce face serverul real periodic: închide scrutinele a căror dată de închidere a trecut
    autoClose(ctx)
    return fn()
  }

  const client = createMockClient(ctx, run)
  const tools = createMockTools(ctx, client, run)
  return { client, tools }
}
