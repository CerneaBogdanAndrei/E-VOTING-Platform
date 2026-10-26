import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addCiphertexts,
  auditBallot,
  babyStepGiantStep,
  ballotDigest,
  ballotSignatureMessage,
  canonicalJson,
  checkOwnEntry,
  cnpHmac,
  combinePartialDecryptions,
  computeAggregate,
  decodeCiphertext,
  decryptToPoint,
  DOMAIN,
  encodeSmall,
  encrypt,
  encryptBallot,
  G,
  generateCredential,
  generateTrusteeKey,
  hmacSha256Hex,
  hexToBytes,
  partialDecrypt,
  pointFromHex,
  pointToHex,
  proveEqualLogs,
  proveZeroOne,
  randomScalar,
  scalarFromHex,
  scalarToHex,
  signMessage,
  verifyBallot,
  verifyElection,
  verifyPartialDecryption,
  verifySignature,
  verifyTrusteeKey,
  type Ballot,
  type ElectionParams,
} from '../src/index.js'
import { clone, simulateElection } from './helpers.js'

/** Cheie de scrutin cu o singură parte secretă, pentru testele de criptare. */
function testKey() {
  const x = randomScalar()
  return { x, publicKey: pointToHex(G.multiply(x)) }
}

/**
 * Buletin „trișat”: criptează valorile date (pot fi 2 sau −1) și încearcă
 * dovezile ca și cum ar fi 0/1. Semnătura e corectă, deci doar dovezile îl pot opri.
 */
function forgeBallot(params: ElectionParams, values: number[]): Ballot {
  const cred = generateCredential()
  const y = pointFromHex(params.publicKey)
  const context = [params.electionId, params.publicKey, String(params.candidateCount), cred.publicKey]
  const rs = values.map(() => randomScalar())
  const ciphertexts = values.map((m, j) => encrypt(params.publicKey, BigInt(m), rs[j]))
  const points = ciphertexts.map((c) => decodeCiphertext(c))
  const choices = points.map((p, j) => proveZeroOne([...context, String(j)], y, p.a, p.b, values[j] === 1 ? 1 : 0, rs[j]))
  const sum = addCiphertexts(points)
  const rSum = rs.reduce((a, b) => a + b, 0n)
  const proofs = { choices, sum: proveEqualLogs(DOMAIN.sum, context, y, sum.a, sum.b.subtract(G), rSum) }
  const unsigned = { electionId: params.electionId, credentialPubkey: cred.publicKey, ciphertexts, proofs }
  return { ...unsigned, signature: signMessage(cred.secretKey, ballotSignatureMessage(ballotDigest(unsigned))) }
}

describe('codificări și hash-uri', () => {
  it('JSON canonic nu depinde de ordinea cheilor', () => {
    assert.equal(canonicalJson({ b: 1, a: [2, { d: 'x', c: null }] }), canonicalJson({ a: [2, { c: null, d: 'x' }], b: 1 }))
    assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}')
  })

  it('HMAC-SHA256 respectă vectorul de test RFC 4231 (cazul 1)', () => {
    const key = hexToBytes('0b'.repeat(20))
    assert.equal(hmacSha256Hex(key, 'Hi There'), 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7')
  })

  it('HMAC(CNP) diferă la chei diferite și e determinist la aceeași cheie', () => {
    const k1 = '11'.repeat(32)
    const k2 = '22'.repeat(32)
    assert.equal(cnpHmac(k1, '5040312170011'), cnpHmac(k1, '5040312170011'))
    assert.notEqual(cnpHmac(k1, '5040312170011'), cnpHmac(k2, '5040312170011'))
  })

  it('scalarii se codifică reversibil și se resping valorile ≥ q', () => {
    const s = randomScalar()
    assert.equal(scalarFromHex(scalarToHex(s)), s)
    assert.throws(() => scalarFromHex('ff'.repeat(32)))
    assert.throws(() => pointFromHex('ff'.repeat(32)))
  })
})

describe('ElGamal exponențial', () => {
  it('criptare și decriptare', () => {
    const { x, publicKey } = testKey()
    for (const m of [0, 1, 7]) {
      const ct = decodeCiphertext(encrypt(publicKey, m))
      assert.ok(decryptToPoint(x, ct).equals(encodeSmall(m)))
    }
  })

  it('același vot dă de fiecare dată alt criptotext', () => {
    const { publicKey } = testKey()
    const a = encrypt(publicKey, 1)
    const b = encrypt(publicKey, 1)
    assert.notEqual(a.a, b.a)
    assert.notEqual(a.b, b.b)
  })

  it('proprietatea homomorfă: suma criptotextelor criptează suma voturilor', () => {
    const { x, publicKey } = testKey()
    const votes = [1, 0, 1, 1, 0, 1]
    const sum = addCiphertexts(votes.map((m) => decodeCiphertext(encrypt(publicKey, m))))
    assert.ok(decryptToPoint(x, sum).equals(encodeSmall(4)))
  })

  it('baby-step giant-step găsește totaluri mici, inclusiv 0 și maximul', () => {
    for (const [t, max] of [
      [0, 0],
      [0, 10],
      [10, 10],
      [37, 100],
      [999, 1000],
      [4321, 10000],
    ]) {
      assert.equal(babyStepGiantStep(encodeSmall(t), max), t)
    }
    assert.equal(babyStepGiantStep(encodeSmall(11), 10), null)
  })
})

describe('buletinul și dovezile zero-knowledge', () => {
  const { publicKey } = testKey()
  const params: ElectionParams = { electionId: 'test-2026', publicKey, candidateCount: 3 }

  it('un buletin corect trece verificarea', () => {
    const cred = generateCredential()
    for (let choice = 0; choice < 3; choice++) {
      const { ballot } = encryptBallot(params, choice, cred.secretKey, cred.publicKey)
      assert.deepEqual(verifyBallot(params, ballot), { ok: true })
    }
  })

  it('vot 2 pentru un candidat: dovada 0/1 pică', () => {
    const r = verifyBallot(params, forgeBallot(params, [2, 0, 0]))
    assert.equal(r.ok, false)
    assert.match((r as { reason: string }).reason, /0 sau 1/)
  })

  it('vot −1: dovada 0/1 pică', () => {
    const r = verifyBallot(params, forgeBallot(params, [-1, 1, 1]))
    assert.equal(r.ok, false)
  })

  it('două voturi (suma 2): fiecare dovadă 0/1 trece, dar dovada sumei pică', () => {
    const r = verifyBallot(params, forgeBallot(params, [1, 1, 0]))
    assert.equal(r.ok, false)
    assert.match((r as { reason: string }).reason, /suma/)
  })

  it('buletin gol (suma 0): dovada sumei pică', () => {
    assert.equal(verifyBallot(params, forgeBallot(params, [0, 0, 0])).ok, false)
  })

  it('buletin „viclean” +2 / −1 (suma 1): dovada sumei trece, dar dovezile 0/1 pică', () => {
    const r = verifyBallot(params, forgeBallot(params, [2, -1, 0]))
    assert.equal(r.ok, false)
    assert.match((r as { reason: string }).reason, /0 sau 1/)
  })

  it('dovezile refolosite în alt scrutin sunt respinse, chiar cu semnătură refăcută', () => {
    const cred = generateCredential()
    const { ballot } = encryptBallot(params, 1, cred.secretKey, cred.publicKey)
    const other: ElectionParams = { ...params, electionId: 'alt-scrutin' }
    const moved = { ...clone(ballot), electionId: other.electionId }
    moved.signature = signMessage(cred.secretKey, ballotSignatureMessage(ballotDigest(moved)))
    const r = verifyBallot(other, moved)
    assert.equal(r.ok, false)
    assert.match((r as { reason: string }).reason, /Dovada/)
  })

  it('un buletin copiat de pe board și semnat de alt credential e respins', () => {
    const alice = generateCredential()
    const mallory = generateCredential()
    const { ballot } = encryptBallot(params, 0, alice.secretKey, alice.publicKey)
    const copy = { ...clone(ballot), credentialPubkey: mallory.publicKey }
    copy.signature = signMessage(mallory.secretKey, ballotSignatureMessage(ballotDigest(copy)))
    assert.equal(verifyBallot(params, copy).ok, false)
  })

  it('o modificare a criptotextului invalidează semnătura', () => {
    const cred = generateCredential()
    const { ballot } = encryptBallot(params, 2, cred.secretKey, cred.publicKey)
    const tampered = clone(ballot)
    tampered.ciphertexts[0] = encrypt(publicKey, 1)
    const r = verifyBallot(params, tampered)
    assert.equal(r.ok, false)
    assert.match((r as { reason: string }).reason, /Semnătura/)
  })

  it('semnătura Ed25519 a provocării de autentificare', () => {
    const cred = generateCredential()
    const sig = signMessage(cred.secretKey, 'mesaj')
    assert.ok(verifySignature(cred.publicKey, 'mesaj', sig))
    assert.ok(!verifySignature(cred.publicKey, 'alt mesaj', sig))
    assert.ok(!verifySignature(generateCredential().publicKey, 'mesaj', sig))
  })

  it('provocarea Benaloh confirmă opțiunea și prinde o aplicație care criptează altceva', () => {
    const cred = generateCredential()
    const { ballot, secrets } = encryptBallot(params, 1, cred.secretKey, cred.publicKey)
    assert.deepEqual(auditBallot(params, ballot.ciphertexts, secrets), { ok: true, choice: 1 })
    // aplicația pretinde că a criptat candidatul 0, dar a criptat 1
    assert.equal(auditBallot(params, ballot.ciphertexts, { ...secrets, choice: 0 }).ok, false)
  })
})

describe('trustees și decriptarea', () => {
  it('dovada Schnorr a cheii e legată de scrutin și de trustee', () => {
    const { publicKey } = generateTrusteeKey('e1', 't1')
    assert.ok(verifyTrusteeKey('e1', publicKey))
    assert.ok(!verifyTrusteeKey('e2', publicKey))
    assert.ok(!verifyTrusteeKey('e1', { ...publicKey, trusteeId: 't2' }))
  })

  it('decriptarea cere toți trustees și dă totalurile corecte', () => {
    const sim = simulateElection('e-dec', 3, [0, 1, 1, 2, 1, 0, 1])
    const aggregate = sim.bundle.tally!.aggregate!
    const partials = sim.trusteeKeys.map((k) => partialDecrypt(k, aggregate))
    assert.deepEqual(combinePartialDecryptions(aggregate, partials, 7), [2, 4, 1])
    // fără un trustee, rezultatul nu se poate afla
    assert.throws(() => combinePartialDecryptions(aggregate, partials.slice(0, 2), 7))
  })

  it('un trustee care trișează la decriptarea parțială e detectat', () => {
    const sim = simulateElection('e-cheat', 2, [0, 1, 1])
    const aggregate = sim.bundle.tally!.aggregate!
    const honest = partialDecrypt(sim.trusteeKeys[0], aggregate)
    const cheat = clone(honest)
    cheat.shares[1] = pointToHex(pointFromHex(cheat.shares[1]).add(G))
    const y = sim.bundle.election.trustees[0].publicKeyShare!
    assert.deepEqual(verifyPartialDecryption('e-cheat', y, aggregate, honest), { ok: true })
    assert.equal(verifyPartialDecryption('e-cheat', y, aggregate, cheat).ok, false)
  })

  it('agregatul nu se poate decripta fără cheia completă', () => {
    const sim = simulateElection('e-agg', 2, [1, 1, 0])
    const ct = decodeCiphertext(computeAggregate(2, sim.bundle.board)[0])
    const x1 = scalarFromHex(sim.trusteeKeys[0].secretKey)
    assert.ok(!decryptToPoint(x1, ct).equals(encodeSmall(1)))
  })
})

describe('verificatorul public', () => {
  const sim = simulateElection('scrutin-test', 3, [0, 1, 2, 1, 1, 0, 1, 2, 1, 1, 0, 1])

  it('un scrutin corect trece toți pașii', async () => {
    const report = await verifyElection(sim.bundle)
    assert.equal(report.ok, true, JSON.stringify(report.steps.filter((s) => s.status !== 'ok'), null, 2))
    assert.deepEqual(
      report.steps.map((s) => s.status),
      ['ok', 'ok', 'ok', 'ok', 'ok', 'ok'],
    )
    assert.deepEqual(
      sim.bundle.result!.counts.map((c) => c.votes),
      [3, 7, 2],
    )
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
    const { appendEntry, entryToBallot } = await import('../src/index.js')
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
    const { appendEntry } = await import('../src/index.js')
    const bundle = clone(sim.bundle)
    const intruder = generateCredential()
    const { ballot } = encryptBallot(sim.params, 0, intruder.secretKey, intruder.publicKey)
    bundle.board.push(appendEntry(bundle.election.id, bundle.board.at(-1), ballot, new Date().toISOString()))
    const report = await verifyElection(bundle)
    const creds = report.steps.find((s) => s.id === 'credentials')!
    assert.equal(creds.status, 'fail')
    assert.equal(creds.failures[0].where, `buletinul #${bundle.board.length}`)
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
})
