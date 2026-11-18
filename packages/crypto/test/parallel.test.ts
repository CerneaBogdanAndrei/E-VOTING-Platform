import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createNodeWork } from '../src/node/parallel.js'
import {
  appendEntry,
  auditBallot,
  createParallelWork,
  encryptBallot,
  generateCredential,
  handleWorkRequest,
  isCredentialPubkey,
  verifyElection,
  type BoardEntry,
  type WorkerPort,
  type WorkRequest,
  type WorkResponse,
} from '../src/index.js'
import { clone, forgeBallot, simulateElection } from './helpers.js'

/** Un lucrător în același proces, care răspunde după o întârziere aleatoare (deci în altă ordine). */
function fakeWorker(spawned: { count: number }, crashOn?: (req: WorkRequest) => boolean): WorkerPort {
  spawned.count++
  let respond: (r: WorkResponse) => void = () => undefined
  let crash: (e: Error) => void = () => undefined
  return {
    post: (req) => {
      if (crashOn?.(req)) setTimeout(() => crash(new Error('lucrătorul a căzut')), 1)
      else setTimeout(() => respond(handleWorkRequest(structuredClone(req))), Math.random() * 5)
    },
    onResponse: (fn) => (respond = fn),
    onError: (fn) => (crash = fn),
    terminate: () => undefined,
  }
}

/** Un scrutin cu un buletin trișat (votează de două ori) și o semnătură stricată, pentru rapoarte cu eșecuri. */
function tamperedBundle() {
  const sim = simulateElection('scrutin-paralel', 3, [0, 1, 2, 1, 1, 0, 1, 2, 1, 1])
  const bundle = clone(sim.bundle)
  const forged = forgeBallot(sim.params, [1, 1, 0])
  bundle.registrations.push({ credentialPubkey: forged.credentialPubkey })
  const board: BoardEntry[] = [...bundle.board]
  board.push(appendEntry(bundle.election.id, board.at(-1), forged, '2026-11-03T08:01:00.000Z'))
  board[3] = { ...board[3], signature: board[4].signature }
  bundle.board = board
  bundle.tally = null
  bundle.result = null
  return bundle
}

describe('verificarea în paralel', () => {
  const sim = simulateElection('scrutin-paralel', 3, [0, 1, 2, 1, 1, 0, 1, 2, 1, 1, 0, 2])

  it('pe worker_threads reale, raportul e identic cu cel de pe un singur fir', { timeout: 60_000 }, async () => {
    const sequential = await verifyElection(sim.bundle)
    const work = createNodeWork(3, { chunkSize: 2 })
    try {
      const parallel = await verifyElection(sim.bundle, { work })
      assert.equal(parallel.ok, true)
      assert.deepEqual(parallel, sequential)
    } finally {
      await work.close()
    }
  })

  it('cu un buletin trișat și o semnătură furată, eșecurile sunt aceleași, în aceeași ordine', { timeout: 60_000 }, async () => {
    const bundle = tamperedBundle()
    const sequential = await verifyElection(bundle)
    const work = createNodeWork(4, { chunkSize: 3 })
    try {
      const parallel = await verifyElection(bundle, { work })
      assert.equal(parallel.ok, false)
      assert.deepEqual(parallel, sequential)
      const creds = parallel.steps.find((s) => s.id === 'credentials')!
      assert.equal(creds.failures[0].where, 'buletinul #4')
      const proofs = parallel.steps.find((s) => s.id === 'proofs')!
      assert.equal(proofs.failures[0].where.startsWith('buletinul #11'), true)
    } finally {
      await work.close()
    }
  })

  it('rezultatele revin în ordinea intrărilor chiar dacă bucățile se termină în altă ordine; progresul ajunge la total', async () => {
    const bundle = tamperedBundle()
    const spawned = { count: 0 }
    const work = createParallelWork(() => fakeWorker(spawned), 3, { chunkSize: 1 })
    const seen: number[] = []
    const report = await verifyElection(bundle, {
      work,
      onProgress: (step, done, total) => {
        if (step !== 'proofs') return
        assert.ok(done <= total)
        seen.push(done)
      },
    })
    assert.equal(spawned.count, 3)
    // începutul pasului (0), apoi câte un eveniment per bucată
    assert.equal(seen[0], 0)
    assert.equal(seen.length, 12)
    assert.equal(seen.at(-1), 11)
    assert.deepEqual(report, await verifyElection(bundle))
    await work.close()
  })

  it('agregatul adunat pe bucăți e identic; un buletin trunchiat dă aceeași eroare ca pe un fir', { timeout: 60_000 }, async () => {
    const bundle = clone(sim.bundle)
    const work = createNodeWork(3, { chunkSize: 2 })
    try {
      assert.deepEqual(await work.aggregate(3, bundle.board), bundle.tally!.aggregate)
      // două buletine stricate, în bucăți diferite: se raportează primul de pe board, ca la un singur fir
      bundle.board[9].ciphertexts.pop()
      bundle.board[5].ciphertexts.pop()
      const sequential = await verifyElection(bundle)
      const parallel = await verifyElection(bundle, { work })
      assert.deepEqual(parallel, sequential)
      const aggregate = parallel.steps.find((s) => s.id === 'aggregate')!
      assert.equal(aggregate.status, 'fail')
      assert.equal(aggregate.failures[0].message, 'Buletinul 6 are 2 criptotexte')
    } finally {
      await work.close()
    }
  })

  it('un fir care cade oprește verificarea cu eroare, nu cu un rezultat inventat', async () => {
    const work = createParallelWork(() => fakeWorker({ count: 0 }, (req) => req.kind === 'proofs'), 2)
    await assert.rejects(verifyElection(sim.bundle, { work }), /Un fir de verificare s-a oprit: lucrătorul a căzut/)
    await work.close()
  })
})

describe('verificatorul și datele malformate', () => {
  it('o intrare care nu are forma unei intrări e raportată, fără ca verificarea să se oprească', async () => {
    const sim = simulateElection('scrutin-malformat', 2, [0, 1, 1])
    const bundle = clone(sim.bundle)
    ;(bundle.board as unknown[])[1] = null
    const report = await verifyElection(bundle)
    assert.equal(report.ok, false)
    const chain = report.steps.find((s) => s.id === 'chain')!
    assert.equal(chain.failures[0].where, 'buletinul #2')
    assert.match(chain.failures[0].message, /Intrare malformată/)
    assert.equal(report.steps.find((s) => s.id === 'credentials')!.status, 'fail')
  })
})

describe('auditul Benaloh: date incomplete ≠ aplicație necinstită', () => {
  const sim = simulateElection('scrutin-audit', 3, [0])
  const cred = generateCredential()
  const { ballot, secrets } = encryptBallot(sim.params, 2, cred.secretKey, cred.publicKey)

  it('datele corecte trec, iar o opțiune declarată greșit pică fără „malformed”', () => {
    assert.deepEqual(auditBallot(sim.params, ballot.ciphertexts, secrets), { ok: true, choice: 2 })
    const wrong = auditBallot(sim.params, ballot.ciphertexts, { ...secrets, choice: 0 })
    assert.equal(wrong.ok, false)
    assert.equal(!wrong.ok && wrong.malformed, undefined)
  })

  it('lipsa criptotextelor sau a r-urilor, ori un r care nu e hex, sunt „malformed”, în română', () => {
    const cases = [
      auditBallot(sim.params, undefined as never, secrets),
      auditBallot(sim.params, ballot.ciphertexts, { choice: 0 } as never),
      auditBallot(sim.params, ballot.ciphertexts, { ...secrets, randomness: ['xyz', ...secrets.randomness.slice(1)] }),
      auditBallot(sim.params, ballot.ciphertexts.slice(1), secrets),
      auditBallot(sim.params, ballot.ciphertexts, { ...secrets, choice: 7 }),
    ]
    for (const r of cases) {
      assert.equal(r.ok, false)
      assert.equal(!r.ok && r.malformed, true)
      assert.match(!r.ok ? r.reason : '', /^Datele de audit sunt incomplete/)
    }
  })
})

describe('credentialul: chei Ed25519 de ordin mic', () => {
  it('identitatea și punctul de ordin 2 sunt respinse; o cheie generată normal e acceptată', () => {
    assert.equal(isCredentialPubkey('01' + '00'.repeat(31)), false)
    assert.equal(isCredentialPubkey('ec' + 'ff'.repeat(30) + '7f'), false)
    assert.equal(isCredentialPubkey(generateCredential().publicKey), true)
  })
})
