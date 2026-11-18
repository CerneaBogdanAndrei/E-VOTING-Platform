// Scrutinele de demonstrație: unul deschis (cu câteva voturi), unul în configurare
// și unul numărat. Se generează la prima cerere, cu CNP-uri fictive. Datele sunt
// relative la „acum”, ca scrutinul deschis să fie mereu în intervalul lui de vot.

import { generateCnp } from '../identity/cnp.js'
import { addEligible, close, simulateKeys, simulateTallyNow, voteRandomly } from './rules.js'
import type { MockContext } from './state.js'

export interface SeedVoters {
  /** Câți alegători au votat deja în scrutinul deschis. */
  open: number
  /** Câți alegători au votat în scrutinul numărat. */
  tallied: number
}

const TRUSTEES = [{ name: 'Comisia electorală' }, { name: 'Observatori independenți' }, { name: 'Reprezentanții candidaților' }]
const DAY = 24 * 3600_000

const at = (now: number, days: number, hours = 0) => new Date(now + days * DAY + hours * 3600_000).toISOString()

export function seedDemoElections(ctx: MockContext, seedVoters: SeedVoters, now = Date.now()) {
  const cnps = (n: number) => Array.from({ length: n }, () => generateCnp(ctx.rand))

  // deschis de trei zile, se închide peste patru
  const consiliu = ctx.newState(
    {
      title: 'Reprezentanți studenți – Consiliul Facultății ACIEE',
      opensAt: at(now, -3),
      closesAt: at(now, 4),
      candidates: [
        { name: 'Andrei Munteanu', description: 'Calculatoare, anul III' },
        { name: 'Ioana Dumitrescu', description: 'Automatică, anul II' },
        { name: 'Mihai Stoica', description: 'Electronică, anul IV' },
      ],
      trustees: TRUSTEES,
      allowBlank: true,
    },
    'consiliu-aciee-2026',
  ).state
  addEligible(ctx, consiliu, cnps(150))
  simulateKeys(ctx, consiliu)
  consiliu.data.status = 'open'
  voteRandomly(ctx, consiliu, seedVoters.open, [5, 4, 3, 1], new Date(now - 2 * DAY), 26 * 3600_000, false)

  // în configurare, se deschide peste cinci zile
  const senat = ctx.newState(
    {
      title: 'Reprezentant studenți – Senatul UDJG',
      opensAt: at(now, 5, 8),
      closesAt: at(now, 7, 18),
      candidates: [
        { name: 'Elena Radu', description: 'Științe Economice, master' },
        { name: 'Vlad Ionescu', description: 'ACIEE, anul IV' },
        { name: 'Cristina Marin', description: 'Litere, anul III' },
      ],
      trustees: TRUSTEES,
    },
    'senat-udjg-2026',
  ).state

  // încheiat și numărat acum trei săptămâni
  const consultare = ctx.newState(
    {
      title: 'Consultare: proiectul finanțat de Liga Studenților',
      opensAt: at(now, -23),
      closesAt: at(now, -21),
      candidates: [
        { name: 'Hackathon studențesc', description: 'Eveniment de 48 de ore, premii' },
        { name: 'Sala de lectură', description: 'Renovare și program prelungit' },
        { name: 'Burse de mobilitate', description: 'Cinci burse pentru conferințe' },
      ],
      trustees: TRUSTEES,
    },
    'consultare-liga-2026',
  ).state
  addEligible(ctx, consultare, cnps(60))
  simulateKeys(ctx, consultare)
  consultare.data.status = 'open'
  voteRandomly(ctx, consultare, seedVoters.tallied, [3, 5, 2], new Date(now - 23 * DAY + 3600_000), 40 * 3600_000, false)
  close(consultare)
  simulateTallyNow(ctx, consultare)

  for (const s of [consiliu, senat, consultare]) ctx.store.set(s.data.id, s)
}
