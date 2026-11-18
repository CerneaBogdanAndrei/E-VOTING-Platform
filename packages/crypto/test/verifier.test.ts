import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { appendEntry, checkOwnEntry, encryptBallot, entryToBallot, G, generateCredential, pointFromHex, pointToHex, verifyElection } from '../src/index.js'
import { clone, simulateElection } from './helpers.js'

describe('verificatorul public', () => {
  const sim = simulateElection('scrutin-test', 3, [0, 1, 2, 1, 1, 0, 1, 2, 1, 1, 0, 1])

  it('un scrutin corect trece toți pașii', async () => {
    const report = await verifyElection(sim.bundle)
    assert.equal(
      report.ok,
      true,
      JSON.stringify(
        report.steps.filter((s) => s.status !== 'ok'),
        null,
        2,
      ),
    )
    assert.deepEqual(
      report.steps.map((s) => s.status),
      ['ok', 'ok', 'ok', 'ok', 'ok', 'ok'],
    )
    assert.deepEqual(
      sim.bundle.result!.counts.map((c) => c.votes),
      [3, 7, 2],
    )
  })

  it('un scrutin încă deschis: agregatul și decriptarea apar ca sărite, nu picate', async () => {
    const bundle = clone(sim.bundle)
    bundle.tally = null
    bundle.result = null
    const report = await verifyElection(bundle)
    assert.equal(report.ok, true)
    assert.equal(report.steps.find((s) => s.id === 'aggregate')!.status, 'skipped')
    assert.equal(report.steps.find((s) => s.id === 'decryption')!.status, 'skipped')
  })

  it('un buletin modificat pe board: verificarea pică exact la el', async () => {
    const bundle = clone(sim.bundle)
    bundle.board[6].ciphertexts[0] = bundle.board[7].ciphertexts[0]
    const report = await verifyElection(bundle)
    assert.equal(report.ok, false)
    const chain = report.steps.find((s) => s.id === 'chain')!
    assert.equal(chain.status, 'fail')
    assert.equal(chain.failures[0].where, 'buletinul #7')
  })

  it('un buletin modificat cu hash-urile refăcute: semnătura îl trădează', async () => {
    const bundle = clone(sim.bundle)
    const ballots = bundle.board.map((e) => entryToBallot(bundle.election.id, e))
    ballots[4].ciphertexts[2] = ballots[5].ciphertexts[2]
    const rebuilt: typeof bundle.board = []
    ballots.forEach((b, k) => rebuilt.push(appendEntry(bundle.election.id, rebuilt.at(-1), b, bundle.board[k].receivedAt)))
    bundle.board = rebuilt
    const report = await verifyElection(bundle)
    assert.equal(report.ok, false)
    const creds = report.steps.find((s) => s.id === 'credentials')!
    assert.equal(creds.failures[0].where, 'buletinul #5')
  })

  it('ordinea schimbată pe board e detectată', async () => {
    const bundle = clone(sim.bundle)
    ;[bundle.board[2], bundle.board[3]] = [bundle.board[3], bundle.board[2]]
    const report = await verifyElection(bundle)
    assert.equal(report.steps.find((s) => s.id === 'chain')!.status, 'fail')
  })

  it('un buletin șters e detectat', async () => {
    const bundle = clone(sim.bundle)
    bundle.board.splice(5, 1)
    const report = await verifyElection(bundle)
    assert.equal(report.ok, false)
  })

  it('un vot adăugat de un credential neînregistrat (ballot stuffing) e detectat', async () => {
    const bundle = clone(sim.bundle)
    const intruder = generateCredential()
    const { ballot } = encryptBallot(sim.params, 0, intruder.secretKey, intruder.publicKey)
    bundle.board.push(appendEntry(bundle.election.id, bundle.board.at(-1), ballot, new Date().toISOString()))
    const report = await verifyElection(bundle)
    const creds = report.steps.find((s) => s.id === 'credentials')!
    assert.equal(creds.status, 'fail')
    assert.equal(creds.failures[0].where, `buletinul #${bundle.board.length}`)
  })

  it('un credential care votează de două ori e detectat', async () => {
    const bundle = clone(sim.bundle)
    const cred = generateCredential()
    bundle.registrations.push({ credentialPubkey: cred.publicKey })
    for (const choice of [0, 1]) {
      const { ballot } = encryptBallot(sim.params, choice, cred.secretKey, cred.publicKey)
      bundle.board.push(appendEntry(bundle.election.id, bundle.board.at(-1), ballot, new Date().toISOString()))
    }
    const report = await verifyElection(bundle)
    const creds = report.steps.find((s) => s.id === 'credentials')!
    assert.equal(creds.status, 'fail')
    assert.match(creds.failures[0].message, /a mai votat/)
  })

  it('o decriptare parțială modificată e detectată și atribuită trustee-ului', async () => {
    const bundle = clone(sim.bundle)
    const p = bundle.tally!.partials[1]
    p.shares[0] = pointToHex(pointFromHex(p.shares[0]).add(G))
    const report = await verifyElection(bundle)
    const dec = report.steps.find((s) => s.id === 'decryption')!
    assert.equal(dec.status, 'fail')
    assert.match(dec.failures[0].where, /t2/)
  })

  it('un rezultat falsificat e detectat', async () => {
    const bundle = clone(sim.bundle)
    bundle.result!.counts[0].votes += 1
    bundle.result!.counts[1].votes -= 1
    const report = await verifyElection(bundle)
    assert.equal(report.steps.find((s) => s.id === 'decryption')!.status, 'fail')
  })

  it('un agregat publicat greșit e detectat', async () => {
    const bundle = clone(sim.bundle)
    bundle.tally!.aggregate![0] = bundle.board[0].ciphertexts[0]
    const report = await verifyElection(bundle)
    assert.equal(report.steps.find((s) => s.id === 'aggregate')!.status, 'fail')
  })

  it('board-ul rescris față de hash-ul publicat independent e detectat', async () => {
    const ok = await verifyElection(sim.bundle, { publishedHead: { seq: 5, hash: sim.bundle.board[4].hash } })
    assert.equal(ok.ok, true)
    const bad = await verifyElection(sim.bundle, { publishedHead: { seq: 5, hash: sim.bundle.board[5].hash } })
    assert.equal(bad.steps.find((s) => s.id === 'chain')!.status, 'fail')
  })

  it('alegătorul își verifică propriul buletin după codul de urmărire', () => {
    const entry = sim.bundle.board[3]
    assert.deepEqual(checkOwnEntry(sim.bundle.election.id, entry, { trackingCode: entry.hash, ballotHash: entry.ballotHash }), { ok: true })
    const changed = clone(entry)
    changed.ciphertexts[1] = sim.bundle.board[4].ciphertexts[1]
    assert.equal(checkOwnEntry(sim.bundle.election.id, changed, { trackingCode: entry.hash, ballotHash: entry.ballotHash }).ok, false)
  })

  it('o cheie de trustee fără dovadă validă e detectată', async () => {
    const bundle = clone(sim.bundle)
    bundle.election.trustees[2].keyProof = bundle.election.trustees[1].keyProof
    const report = await verifyElection(bundle)
    assert.equal(report.steps.find((s) => s.id === 'keys')!.status, 'fail')
  })

  it('timpii primirii trebuie să fie ordonați și în intervalul scrutinului', async () => {
    // intrări reconstruite cu timpi descrescători: lanțul e valid, dar ordinea în timp e încălcată
    const bundle = clone(sim.bundle)
    const ballots = bundle.board.map((e) => entryToBallot(bundle.election.id, e))
    const rebuilt: typeof bundle.board = []
    ballots.forEach((b, k) => rebuilt.push(appendEntry(bundle.election.id, rebuilt.at(-1), b, new Date(Date.UTC(2026, 10, 3, 8, 0, 60 - k)).toISOString())))
    bundle.board = rebuilt
    const report = await verifyElection(bundle)
    const chain = report.steps.find((s) => s.id === 'chain')!
    assert.equal(chain.status, 'fail')
    assert.match(chain.failures[0].message, /ordinea în timp/)

    // interval publicat: primele intrări sunt înainte de deschidere
    const bounded = clone(sim.bundle)
    bounded.election.opensAt = new Date(Date.UTC(2026, 10, 3, 8, 0, 5)).toISOString()
    bounded.election.closesAt = new Date(Date.UTC(2026, 10, 3, 9, 0, 0)).toISOString()
    const early = await verifyElection(bounded)
    assert.match(early.steps.find((s) => s.id === 'chain')!.failures[0].message, /înainte de deschiderea/)
    bounded.election.opensAt = new Date(Date.UTC(2026, 10, 3, 7, 0, 0)).toISOString()
    assert.equal((await verifyElection(bounded)).ok, true)
  })

  it('progresul e raportat și verificatorul cedează controlul periodic', async () => {
    const seen: string[] = []
    const perBallot: string[] = []
    const report = await verifyElection(sim.bundle, {
      yieldEvery: 3,
      onProgress: (step, done) => {
        seen.push(step)
        if (done > 0) perBallot.push(step)
      },
    })
    assert.equal(report.ok, true)
    // fiecare pas își anunță începutul (0 din total), în ordine; pașii care parcurg board-ul raportează și cât au terminat
    assert.deepEqual([...new Set(seen)], ['keys', 'chain', 'credentials', 'proofs', 'aggregate', 'decryption'])
    assert.deepEqual([...new Set(perBallot)], ['chain', 'credentials', 'proofs', 'aggregate'])
  })
})
