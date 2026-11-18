// Intervalul scrutinului: votul e refuzat înainte de opensAt și după closesAt,
// iar la closesAt serverul închide singur (închiderea automată). Orele de pe board
// rămân crescătoare și când voturile sosesc deodată.

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { authenticate, generateCnp, prepareBallot, submitBallot } from '@evoting/api'
import { generateCredential, generateTrusteeKey, verifyElection } from '@evoting/crypto'
import { boardTime } from '../src/ballots/ballots.service.js'
import { databaseAvailable, electionInput, rejects, resetDatabase, startServer, type TestServer } from './helpers.js'

const available = await databaseAvailable()

describe('backend: intervalul scrutinului și închiderea automată', { skip: !available }, () => {
  let s: TestServer
  before(async () => {
    await resetDatabase()
    s = await startServer({ autoCloseIntervalMs: 250 })
  })
  after(async () => {
    await s?.close()
  })

  async function ready(over: Parameters<typeof electionInput>[0]) {
    const { election, trusteeTokens } = await s.api.createElection(electionInput({ trustees: [{ name: 'T' }], ...over }))
    await s.api.submitTrusteeKey(election.id, trusteeTokens[0].token, generateTrusteeKey(election.id, trusteeTokens[0].trusteeId).publicKey)
    await s.api.importEligible(election.id, '5040312170018')
    return election
  }

  it('votul nu se poate trimite înainte de deschidere', async () => {
    const e = await ready({ opensAt: new Date(Date.now() + 3600_000).toISOString(), closesAt: new Date(Date.now() + 7200_000).toISOString() })
    const opened = await s.api.openElection(e.id)
    const v = generateCredential()
    await s.api.registerOcr(e.id, { cnp: '5040312170018', credentialPubkey: v.publicKey })
    await assert.rejects(submitBallot(s.api, opened, v, prepareBallot(opened, v, 0)), rejects(409, /nu a început/))
  })

  it('un scrutin cu data închiderii trecută nu se poate deschide', async () => {
    const e = await ready({ opensAt: new Date(Date.now() - 7200_000).toISOString(), closesAt: new Date(Date.now() - 3600_000).toISOString() })
    await assert.rejects(s.api.openElection(e.id), rejects(409, /a trecut/))
  })

  it('voturile trimise în paralel primesc ore crescătoare, în ordinea de pe board, și trec de verificator', async () => {
    const cnps = new Set<string>()
    const rand = (() => {
      let x = 11
      return () => (x = (x * 48271) % 2147483647) / 2147483647
    })()
    while (cnps.size < 16) cnps.add(generateCnp(rand))
    const e = await ready({})
    await s.api.importEligible(e.id, [...cnps].join('\n'))
    const opened = await s.api.openElection(e.id)
    const voters = [...cnps].map(() => generateCredential())
    for (const [i, cnp] of [...cnps].entries()) await s.api.registerOcr(e.id, { cnp, credentialPubkey: voters[i].publicKey })
    // toți alegătorii se autentifică întâi, apoi trimit buletinele deodată
    const prepared = await Promise.all(
      voters.map(async (v, i) => ({ token: await authenticate(s.api, e.id, v), ballot: prepareBallot(opened, v, i % 3).ballot })),
    )
    await Promise.all(prepared.map(({ token, ballot }) => s.api.castBallot(e.id, ballot, token)))

    const bundle = await s.anonymous.getAuditBundle(e.id)
    assert.equal(bundle.board.length, 16)
    const times = bundle.board.map((x) => Date.parse(x.receivedAt))
    assert.ok(
      times.every((t, k) => k === 0 || t >= times[k - 1]),
      'orele de pe board sunt crescătoare',
    )
    const report = await verifyElection(bundle, { publishedHead: bundle.head })
    assert.equal(report.steps.find((x) => x.id === 'chain')!.status, 'ok', JSON.stringify(report.steps.find((x) => x.id === 'chain')!.failures))
    assert.equal(report.steps.find((x) => x.id === 'proofs')!.status, 'ok')
  })

  it('ora unei intrări noi nu e niciodată mai veche decât a celei anterioare (ceasuri diferite pe instanțe)', () => {
    const previous = { receivedAt: '2026-11-18T10:00:00.500Z' }
    assert.equal(boardTime(new Date('2026-11-18T10:00:00.400Z'), previous).toISOString(), previous.receivedAt)
    assert.equal(boardTime(new Date('2026-11-18T10:00:01.000Z'), previous).toISOString(), '2026-11-18T10:00:01.000Z')
    assert.equal(boardTime(new Date('2026-11-18T10:00:01.000Z'), undefined).toISOString(), '2026-11-18T10:00:01.000Z')
  })

  it('după closesAt votul e refuzat, iar serverul închide scrutinul singur', async () => {
    const e = await ready({ closesAt: new Date(Date.now() + 1200).toISOString() })
    const opened = await s.api.openElection(e.id)
    const v = generateCredential()
    await s.api.registerOcr(e.id, { cnp: '5040312170018', credentialPubkey: v.publicKey })
    await sleep(1300)
    await assert.rejects(submitBallot(s.api, opened, v, prepareBallot(opened, v, 0)), rejects(409))
    // ceasul serverului verifică la fiecare 250 ms
    await sleep(600)
    const closedElection = await s.api.getElection(e.id)
    assert.equal(closedElection.status, 'closed')
    const log = await s.api.getAuditLog(e.id)
    const closed = log.find((x) => x.action === 'election.close')!
    assert.equal(closed.actor, 'server')
    assert.equal((closed.payload as { automatic: boolean }).automatic, true)
    assert.equal((await s.api.getTally(e.id)).aggregate!.length, 3)
  })
})
