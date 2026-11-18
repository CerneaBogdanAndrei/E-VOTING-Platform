// Opțiunile de conexiune PostgreSQL: când se cere SSL și când se verifică certificatul.
// Test fără bază de date: rulează mereu, și fără TEST_DATABASE_URL.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pgOptions, sslWarning } from '../src/db/pg-options.js'

const REMOTE = 'postgresql://u:p@db.example.com:5432/postgres'
const LOCAL = 'postgres://evoting:evoting@localhost:5432/evoting'

describe('backend: opțiunile de conexiune la baza de date', () => {
  it('local fără SSL, la distanță cu SSL (fără verificarea certificatului, cu avertisment)', () => {
    assert.equal(pgOptions(LOCAL, {}).ssl, false)
    assert.deepEqual(pgOptions(REMOTE, {}).ssl, { rejectUnauthorized: false })
    assert.match(sslWarning(REMOTE, {}) ?? '', /certificatul serverului nu e verificat/)
    assert.equal(sslWarning(LOCAL, {}), null)
  })

  it('sslmode=disable din URL oprește SSL și la un server la distanță; sslmode dispare din URL', () => {
    const opts = pgOptions(`${REMOTE}?sslmode=disable`, {})
    assert.equal(opts.ssl, false)
    assert.equal(opts.connectionString?.includes('sslmode'), false)
    assert.deepEqual(pgOptions(`${LOCAL}?sslmode=require`, {}).ssl, { rejectUnauthorized: false })
  })

  it('DATABASE_SSL are întâietate, iar DATABASE_CA pornește verificarea certificatului', () => {
    assert.equal(pgOptions(`${REMOTE}?sslmode=require`, { DATABASE_SSL: 'off' }).ssl, false)
    assert.deepEqual(pgOptions(`${LOCAL}?sslmode=disable`, { DATABASE_SSL: 'on' }).ssl, { rejectUnauthorized: false })
    const ca = '-----BEGIN CERTIFICATE-----\\nAAAA\\n-----END CERTIFICATE-----'
    assert.deepEqual(pgOptions(REMOTE, { DATABASE_CA: ca }).ssl, { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true })
    assert.equal(sslWarning(REMOTE, { DATABASE_CA: ca }), null)
  })
})
