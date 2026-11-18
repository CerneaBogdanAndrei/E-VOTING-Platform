// Limitarea de rată pe rutele sensibile: ghicirea token-ului comisiei e oprită cu 429,
// iar rutele publice de citire rămân neafectate.

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { databaseAvailable, resetDatabase, startServer, type TestServer } from './helpers.js'

const available = await databaseAvailable()

describe('backend: limitarea de rată', { skip: !available }, () => {
  let s: TestServer
  before(async () => {
    await resetDatabase()
    s = await startServer({ rateLimit: true, sensitiveLimit: 5 })
  })
  after(async () => {
    await s?.close()
  })

  it('ghicirea token-ului comisiei e oprită după câteva încercări (429)', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 8; i++) {
      const res = await fetch(`${s.url}/admin/check`, { headers: { Authorization: `Bearer ghicit-${i}` } })
      statuses.push(res.status)
    }
    assert.deepEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401])
    assert.ok(
      statuses.slice(5).every((x) => x === 429),
      statuses.join(','),
    )
  })

  it('rutele publice de citire nu sunt afectate', async () => {
    const res = await fetch(`${s.url}/elections`)
    assert.equal(res.status, 200)
  })

  it('/health răspunde fără token', async () => {
    const res = await fetch(`${s.url}/health`)
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { ok: true })
  })
})
