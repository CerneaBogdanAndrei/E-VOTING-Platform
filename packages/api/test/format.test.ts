import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatDuration, intervalPhase, plural } from '../src/index.js'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('formatări în română', () => {
  it('plural: „de” apare de la 20 în sus și la sutele rotunde, nu la 2–19 sau 101–119', () => {
    assert.equal(plural(1, 'cheie', 'chei'), '1 cheie')
    assert.equal(plural(2, 'cheie', 'chei'), '2 chei')
    assert.equal(plural(19, 'cheie', 'chei'), '19 chei')
    assert.equal(plural(20, 'cheie', 'chei'), '20 de chei')
    assert.equal(plural(21, 'linie', 'linii'), '21 de linii')
    assert.equal(plural(100, 'vot', 'voturi'), '100 de voturi')
    assert.equal(plural(105, 'vot', 'voturi'), '105 voturi')
    assert.equal(plural(120, 'vot', 'voturi'), '120 de voturi')
    assert.equal(plural(0, 'vot', 'voturi'), '0 voturi')
  })

  it('durata: forme corecte pentru minute, ore și zile', () => {
    assert.equal(formatDuration(30_000), 'sub un minut')
    assert.equal(formatDuration(MIN), 'un minut')
    assert.equal(formatDuration(5 * MIN), '5 minute')
    assert.equal(formatDuration(45 * MIN), '45 de minute')
    assert.equal(formatDuration(HOUR + 2 * MIN), 'o oră și 2 minute')
    assert.equal(formatDuration(21 * HOUR), '21 de ore')
    assert.equal(formatDuration(2 * DAY + 3 * HOUR + 10 * MIN), '2 zile și 3 ore')
    assert.equal(formatDuration(25 * DAY), '25 de zile')
  })

  it('faza intervalului: înainte, în timpul și după, cu marginile incluse', () => {
    const opens = '2026-11-20T08:00:00.000Z'
    const closes = '2026-11-20T18:00:00.000Z'
    assert.deepEqual(intervalPhase(opens, closes, Date.parse(opens) - HOUR), { phase: 'before', remainingMs: HOUR })
    assert.deepEqual(intervalPhase(opens, closes, Date.parse(closes)), { phase: 'during', remainingMs: 0 })
    assert.deepEqual(intervalPhase(opens, closes, Date.parse(closes) + 1), { phase: 'after', remainingMs: 0 })
  })
})
