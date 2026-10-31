// Testele unitare ale criptografiei (planul, secțiunea „Evaluare → Teste”):
// criptare/decriptare, proprietatea homomorfă, dovezi valide acceptate, dovezi
// pentru vot 2, vot −1 sau sumă 2 respinse, dovadă refolosită respinsă,
// manipularea board-ului și a decriptărilor detectată de verificator.
// Rulare: npm test (din packages/crypto)

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import * as C from '../dist/index.js'

const CANDIDATES = ['Elena Marinescu', 'Victor Constantinescu', 'Ioana Dragomir']

/** Un scrutin complet, în memorie, fără server: trustees, alegători, board, numărare. */
function setupElection({ candidates = CANDIDATES, trustees = 3, minSelections = 1, maxSelections = 1, electionId = 'test-' + Math.random().toString(16).slice(2) } = {}) {
  const keys = Array.from({ length: trustees }, (_, i) => C.generateTrusteeKey(electionId, `t${i + 1}`))
  const params = {
    electionId,
    candidates,
    minSelections,
    maxSelections,
    trustees: keys.map((k, i) => ({ id: k.trusteeId, name: `Trustee ${i + 1}`, publicKeyShare: k.publicKeyShare, proof: k.proof })),
    publicKey: C.combinePublicKeys(keys.map((k) => k.publicKeyShare)),
  }
  return { params, keys }
}

function castVotes(params, choicesList) {
  const board = []
  const registrations = []
  for (const choices of choicesList) {
    const cred = C.generateCredential()
    registrations.push(cred.publicKey)
    const enc = C.encryptBallot(params, cred.publicKey, choices)
    const ballot = C.signBallot(enc.body, cred.secretKey)
    board.push(C.makeEntry(params.electionId, board.at(-1) ?? null, ballot, new Date(Date.UTC(2026, 10, 3, 8, board.length)).toISOString()))
  }
  return { board, registrations }
}

function tallyElection(params, keys, board) {
  const aggregate = C.computeAggregate(params.candidates.length, board.map((e) => e.ballot))
  const partials = keys.map((k) => C.partialDecrypt(k, aggregate))
  const counts = C.combineDecryptions(aggregate, partials, board.length * params.maxSelections)
  return { ballotCount: board.length, aggregate, partials, counts }
}

function record(params, board, registrations, tally = null) {
  return { version: 1, title: 'Test', status: tally ? 'tallied' : 'open', params, registrations, board, tally }
}

const clone = (x) => JSON.parse(JSON.stringify(x))

describe('Grupul ristretto255', () => {
  test('codificarea punctelor și scalarilor e reversibilă; codificările invalide sunt respinse', () => {
    const s = C.randomScalar()
    const P = C.mul(C.G, s)
    assert.ok(C.pointFromHex(C.pointToHex(P)).equals(P))
    assert.equal(C.scalarFromHex(C.scalarToHex(s)), s)
    assert.throws(() => C.pointFromHex('ff'.repeat(32)))
    assert.throws(() => C.pointFromHex('xyz'))
    assert.throws(() => C.scalarFromHex('ff'.repeat(32)), /ordinul/)
    assert.ok(!C.isValidPoint('00'.repeat(31) + '01'))
  })

  test('0·G e elementul neutru, iar q·G = 0', () => {
    assert.ok(C.mul(C.G, 0n).equals(C.ZERO))
    assert.ok(C.G.multiplyUnsafe(C.Q - 1n).add(C.G).equals(C.ZERO))
  })
})

describe('ElGamal exponențial', () => {
  test('criptare și decriptare cu cheia întreagă', () => {
    const x = C.randomScalar()
    const Y = C.mul(C.G, x)
    for (const m of [0, 1, 7, 42]) {
      assert.equal(C.discreteLog(C.decryptToPoint(x, C.encrypt(Y, m)), 100), m)
    }
  })

  test('aceeași valoare dă de fiecare dată alt criptotext (randomizare)', () => {
    const Y = C.mul(C.G, C.randomScalar())
    const a = C.ciphertextToJson(C.encrypt(Y, 1))
    const b = C.ciphertextToJson(C.encrypt(Y, 1))
    assert.notEqual(a.a, b.a)
    assert.notEqual(a.b, b.b)
  })

  test('proprietatea homomorfă: suma criptotextelor criptează suma voturilor', () => {
    const x = C.randomScalar()
    const Y = C.mul(C.G, x)
    const votes = [1, 0, 1, 1, 0, 1]
    const sum = C.addCiphertexts(votes.map((m) => C.encrypt(Y, m)))
    assert.equal(C.discreteLog(C.decryptToPoint(x, sum), 10), 4)
  })

  test('baby-step giant-step găsește totaluri până la 10.000 și refuză valori în afara intervalului', () => {
    for (const m of [0, 1, 99, 100, 101, 9999, 10000]) assert.equal(C.discreteLog(C.gTimes(m), 10000), m)
    assert.equal(C.discreteLog(C.gTimes(10001), 10000), null)
    assert.equal(C.discreteLog(C.gTimes(-1), 10000), null)
  })
})

describe('Trustees (n-din-n)', () => {
  test('dovada Schnorr a cheii se verifică doar pentru scrutinul și trustee-ul ei', () => {
    const k = C.generateTrusteeKey('scrutin-A', 't1')
    assert.ok(C.verifyTrusteeKey('scrutin-A', 't1', k.publicKeyShare, k.proof))
    assert.ok(!C.verifyTrusteeKey('scrutin-B', 't1', k.publicKeyShare, k.proof), 'refolosită în alt scrutin')
    assert.ok(!C.verifyTrusteeKey('scrutin-A', 't2', k.publicKeyShare, k.proof), 'refolosită de alt trustee')
    const other = C.generateTrusteeKey('scrutin-A', 't1')
    assert.ok(!C.verifyTrusteeKey('scrutin-A', 't1', other.publicKeyShare, k.proof), 'dovadă pentru altă cheie')
  })

  test('cu o decriptare parțială lipsă, totalul rămâne ascuns', () => {
    const { params, keys } = setupElection()
    const { board } = castVotes(params, [0, 1, 1, 2, 1])
    const aggregate = C.computeAggregate(3, board.map((e) => e.ballot))
    const partials = keys.slice(0, 2).map((k) => C.partialDecrypt(k, aggregate))
    // Fără al treilea trustee, Bⱼ − D₁ⱼ − D₂ⱼ = TⱼG + x₃Aⱼ nu e un multiplu mic al lui G.
    assert.deepEqual(C.combineDecryptions(aggregate, partials, 5), [null, null, null])
    const all = keys.map((k) => C.partialDecrypt(k, aggregate))
    assert.deepEqual(C.combineDecryptions(aggregate, all, 5), [1, 3, 1])
  })
})

describe('Buletinul și dovezile ZK', () => {
  const { params } = setupElection()
  const cred = C.generateCredential()

  test('un buletin corect trece toate verificările', () => {
    for (const choice of [0, 1, 2]) {
      const enc = C.encryptBallot(params, cred.publicKey, choice)
      const r = C.verifyBallot(params, C.signBallot(enc.body, cred.secretKey))
      assert.deepEqual(r, { ok: true, problems: [] })
    }
  })

  test('vot 2 pentru un candidat: dovada „0 sau 1” pică', () => {
    const enc = C.encryptVector(params, cred.publicKey, [2, 0, 0])
    const r = C.verifyBallot(params, C.signBallot(enc.body, cred.secretKey))
    assert.equal(r.ok, false)
    assert.match(r.problems.join(), /Elena Marinescu: dovada „0 sau 1”/)
  })

  test('vot −1 (ca să scadă un adversar): dovada pică', () => {
    const enc = C.encryptVector(params, cred.publicKey, [1, -1, 1])
    const r = C.verifyBallot(params, C.signBallot(enc.body, cred.secretKey))
    assert.equal(r.ok, false)
    assert.match(r.problems.join(), /Victor Constantinescu/)
  })

  test('două opțiuni bifate când e permisă una: dovada sumei pică', () => {
    const enc = C.encryptVector(params, cred.publicKey, [1, 1, 0])
    const r = C.verifyBallot(params, C.signBallot(enc.body, cred.secretKey))
    assert.equal(r.ok, false)
    assert.deepEqual(r.problems, ['dovada că s-au bifat exact 1 opțiuni nu se verifică'])
  })

  test('buletin gol când e obligatorie o opțiune: dovada sumei pică', () => {
    const enc = C.encryptVector(params, cred.publicKey, [0, 0, 0])
    assert.equal(C.verifyBallot(params, C.signBallot(enc.body, cred.secretKey)).ok, false)
  })

  test('vot pentru până la k candidați: 0…k opțiuni acceptate, k+1 respinse', () => {
    const multi = setupElection({ candidates: ['A', 'B', 'C', 'D', 'E'], minSelections: 0, maxSelections: 3 }).params
    for (const v of [[0, 0, 0, 0, 0], [1, 0, 0, 0, 0], [1, 1, 0, 1, 0]]) {
      const enc = C.encryptVector(multi, cred.publicKey, v)
      assert.ok(C.verifyBallot(multi, C.signBallot(enc.body, cred.secretKey)).ok, `vector ${v}`)
    }
    const bad = C.encryptVector(multi, cred.publicKey, [1, 1, 1, 1, 0])
    assert.equal(C.verifyBallot(multi, C.signBallot(bad.body, cred.secretKey)).ok, false)
  })

  test('dovezile refolosite de alt alegător sau în alt scrutin sunt respinse (Fiat–Shamir legat de context)', () => {
    const enc = C.encryptBallot(params, cred.publicKey, 1)
    const thief = C.generateCredential()
    const stolen = C.signBallot({ ...enc.body, credentialPubkey: thief.publicKey }, thief.secretKey)
    const r1 = C.verifyBallot(params, stolen)
    assert.equal(r1.ok, false)
    assert.equal(r1.problems.length, 4, 'toate cele 3 dovezi per candidat + dovada sumei pică')

    const { params: other } = setupElection()
    const moved = C.signBallot({ ...enc.body, electionId: other.electionId }, cred.secretKey)
    assert.equal(C.verifyBallot({ ...other, publicKey: params.publicKey }, moved).ok, false)
  })

  test('semnătura falsă sau buletinul modificat după semnare sunt respinse', () => {
    const enc = C.encryptBallot(params, cred.publicKey, 0)
    const ballot = C.signBallot(enc.body, cred.secretKey)
    const other = C.generateCredential()
    assert.deepEqual(C.verifyBallot(params, { ...ballot, signature: C.signBallot(enc.body, other.secretKey).signature }).problems, ['semnătura credentialului nu se verifică'])
    const swapped = clone(ballot)
    ;[swapped.ciphertexts[0], swapped.ciphertexts[1]] = [swapped.ciphertexts[1], swapped.ciphertexts[0]]
    assert.equal(C.verifyBallot(params, swapped).ok, false)
  })

  test('format greșit (criptotext lipsă, punct invalid) e respins fără excepții', () => {
    const enc = C.encryptBallot(params, cred.publicKey, 0)
    const ballot = C.signBallot(enc.body, cred.secretKey)
    assert.equal(C.verifyBallot(params, { ...ballot, ciphertexts: ballot.ciphertexts.slice(0, 2) }).ok, false)
    const broken = clone(ballot)
    broken.ciphertexts[0].a = 'ff'.repeat(32)
    assert.equal(C.verifyBallot(params, broken).ok, false)
    assert.equal(C.verifyBallot(params, null).ok, false)
  })

  test('codul de urmărire e determinist și se schimbă la orice modificare', () => {
    const enc = C.encryptBallot(params, cred.publicKey, 2)
    assert.equal(C.ballotHash(enc.body), enc.trackingCode)
    const changed = clone(enc.body)
    changed.proofs.count.z[0] = C.scalarToHex(1n)
    assert.notEqual(C.ballotHash(changed), enc.trackingCode)
  })
})

describe('Provocarea Benaloh', () => {
  const { params } = setupElection()
  const cred = C.generateCredential()

  test('auditul unui buletin corect confirmă opțiunea aleasă', () => {
    const enc = C.encryptBallot(params, cred.publicKey, 1)
    const r = C.verifyAudit(C.createAudit(params, enc))
    assert.equal(r.ok, true)
    assert.deepEqual(r.selected, ['Victor Constantinescu'])
  })

  test('o aplicație compromisă care criptează alt vot e prinsă la audit', () => {
    const enc = C.encryptBallot(params, cred.publicKey, 2) // aplicația criptează candidatul 3
    const audit = C.createAudit(params, enc)
    audit.plaintexts = [1, 0, 0] // dar îi „arată” alegătorului candidatul 1
    const r = C.verifyAudit(audit)
    assert.equal(r.ok, false)
    assert.equal(r.problems.length, 2)
  })
})

describe('Scrutin complet și verificarea publică', () => {
  test('20 de alegători, 3 trustees: rezultatul e corect și verificatorul trece toți pașii', async () => {
    const { params, keys } = setupElection()
    const choices = Array.from({ length: 20 }, (_, i) => [0, 1, 1, 2, 1][i % 5])
    const { board, registrations } = castVotes(params, choices)
    const tally = tallyElection(params, keys, board)
    assert.deepEqual(tally.counts, [4, 12, 4])
    const report = await C.verifyElectionRecord(record(params, board, registrations, tally), { anchors: [board[9].hash, board.at(-1).hash] })
    assert.equal(report.ok, true, JSON.stringify(report.steps.filter((s) => !s.ok)))
    assert.deepEqual(report.steps.map((s) => s.key), ['keys', 'chain', 'credentials', 'proofs', 'aggregate', 'decryption'])
  })

  test('înainte de numărare, pașii 4 și 5 sunt săriți', async () => {
    const { params } = setupElection()
    const { board, registrations } = castVotes(params, [0, 1])
    const report = await C.verifyElectionRecord(record(params, board, registrations))
    assert.equal(report.ok, true)
    assert.deepEqual(report.steps.filter((s) => s.skipped).map((s) => s.key), ['aggregate', 'decryption'])
  })

  describe('manipulări: verificatorul pică și spune unde', () => {
    const { params, keys } = setupElection()
    const { board, registrations } = castVotes(params, [0, 1, 2, 1, 0, 1, 1, 2])
    const tally = tallyElection(params, keys, board)
    const base = record(params, board, registrations, tally)
    const failing = async (rec, opts) => {
      const r = await C.verifyElectionRecord(rec, opts)
      assert.equal(r.ok, false)
      return Object.fromEntries(r.steps.filter((s) => !s.ok).map((s) => [s.key, s.problems]))
    }

    test('un vot adăugat într-un criptotext (B + G) rupe lanțul, dovezile și agregatul', async () => {
      const rec = clone(base)
      const ct = rec.board[3].ballot.ciphertexts[1]
      ct.b = C.pointToHex(C.pointFromHex(ct.b).add(C.G))
      const failed = await failing(rec)
      assert.match(failed.chain.join(), /Buletinul #4: conținutul a fost modificat/)
      assert.match(failed.proofs.join(), /Buletinul #4/)
      assert.match(failed.aggregate.join(), /Victor Constantinescu/)
    })

    test('ștergerea unui buletin rupe lanțul și numărarea', async () => {
      const rec = clone(base)
      rec.board.splice(2, 1)
      const failed = await failing(rec)
      assert.match(failed.chain.join(), /poziția nu corespunde|legătura/)
      assert.match(failed.aggregate.join(), /numărarea a inclus 8 buletine, dar board-ul are 7/)
    })

    test('reordonarea board-ului e detectată', async () => {
      const rec = clone(base)
      ;[rec.board[1], rec.board[2]] = [rec.board[2], rec.board[1]]
      assert.ok((await failing(rec)).chain.length > 0)
    })

    test('rescrierea întregului lanț (recalculat corect) e prinsă de hash-ul publicat independent', async () => {
      const anchor = base.board[4].hash
      const rec = clone(base)
      rec.board = rec.board.slice(0, 4)
      for (const extra of castVotes(params, [2]).board) rec.board.push(C.makeEntry(params.electionId, rec.board.at(-1), extra.ballot, extra.receivedAt))
      const failed = await failing(rec, { anchors: [anchor] })
      assert.match(failed.chain.join(), /nu apare în lanț/)
    })

    test('ballot stuffing cu un credential neînregistrat e semnalat', async () => {
      const rec = clone(base)
      rec.registrations = rec.registrations.slice(1)
      assert.match((await failing(rec)).credentials.join(), /Buletinul #1: credentialul nu e în lista/)
    })

    test('același credential de două ori e semnalat', async () => {
      const rec = clone(base)
      const again = C.encryptBallot(params, rec.board[0].ballot.credentialPubkey, 2)
      // Fără cheia secretă, semnătura nu poate fi refăcută: serverul ar trebui să o falsifice.
      rec.board.push(C.makeEntry(params.electionId, rec.board.at(-1), { ...again.body, signature: rec.board[0].ballot.signature }, new Date().toISOString()))
      const failed = await failing(rec)
      assert.match(failed.credentials.join(), /Buletinul #9: credentialul a mai votat, în buletinul #1/)
      assert.match(failed.credentials.join(), /Buletinul #9: semnătura/)
    })

    test('un trustee care trișează la decriptare e prins de dovada Chaum–Pedersen', async () => {
      const rec = clone(base)
      const share = rec.tally.partials[1].shares[0]
      share.d = C.pointToHex(C.pointFromHex(share.d).subtract(C.G)) // +1 vot pentru candidatul 1
      const failed = await failing(rec)
      assert.match(failed.decryption.join(), /Trustee 2, Elena Marinescu: dovada decriptării parțiale nu se verifică/)
    })

    test('un rezultat publicat greșit e detectat', async () => {
      const rec = clone(base)
      rec.tally.counts = [3, 3, 2]
      assert.match((await failing(rec)).decryption.join(), /rezultatul publicat \(3\) ≠ rezultatul decriptat \(2\)/)
    })

    test('o cheie de trustee înlocuită (atacul cheii necinstite) e detectată', async () => {
      const rec = clone(base)
      rec.params.trustees[2].publicKeyShare = C.pointToHex(C.mul(C.G, C.randomScalar()))
      assert.ok((await failing(rec)).keys.length > 0)
    })
  })
})

describe('CNP și HMAC', () => {
  test('validarea CNP-ului: cifra de control, data, județul', () => {
    const rand = C.seededRandom(7)
    for (let i = 0; i < 200; i++) assert.ok(C.isValidCnp(C.generateCnp(rand)))
    assert.equal(C.checkCnp('1234').ok, false)
    assert.match(C.checkCnp('5040231170017').reason, /data/)
    const good = C.generateCnp(rand)
    const wrongControl = good.slice(0, 12) + ((Number(good[12]) + 1) % 10)
    assert.match(C.checkCnp(wrongControl).reason, /control/)
  })

  test('atacul de dicționar: SHA-256 simplu se sparge, HMAC cu cheie secretă nu', () => {
    const birthDate = '2004-03-12'
    const space = C.cnpSearchSpace(birthDate)
    assert.equal(space.length, 2 * 48 * 999)
    const victim = space[54321]
    const leakedSha = C.cnpPlainSha256(victim)
    const t0 = Date.now()
    const found = space.find((c) => C.cnpPlainSha256(c) === leakedSha)
    assert.equal(found, victim)
    assert.ok(Date.now() - t0 < 30_000)

    const serverKey = C.bytesToHex(C.randomBytes(32))
    const leakedHmac = C.cnpFingerprint(serverKey, victim)
    const attackerKey = C.bytesToHex(C.randomBytes(32))
    assert.equal(space.slice(0, 5000).find((c) => C.cnpFingerprint(attackerKey, c) === leakedHmac), undefined)
    assert.equal(C.cnpFingerprint(serverKey, victim), leakedHmac, 'cu cheia corectă amprenta e stabilă')
  })
})

describe('MRZ (ICAO 9303)', () => {
  test('cifra de control 7-3-1 pe exemplul din standard', () => {
    assert.equal(C.mrzCheckDigit('L898902C3'), 6)
    assert.equal(C.mrzCheckDigit('740812'), 2)
    assert.equal(C.mrzCheckDigit('120415'), 9)
  })

  test('TD1 (CEI): se parsează, cifrele de control trec, CNP-ul e extras', () => {
    const cnp = C.generateCnp(C.seededRandom(11))
    const lines = C.buildTd1({ documentNumber: 'RX123456', birthDate: cnp.slice(1, 7), sex: 'F', expiryDate: '351231', surname: 'Ionescu', givenNames: 'Maria', cnp })
    const p = C.parseMrz(lines.join('\n'))
    assert.equal(p.format, 'TD1')
    assert.equal(p.valid, true)
    assert.equal(p.cnp, cnp)
    assert.equal(p.surname, 'IONESCU')
    assert.equal(C.parseMrz(lines.join('')).cnp, cnp, 'și dintr-un singur șir (DG1)')
  })

  test('o eroare de OCR într-o cifră e prinsă de cifra de control', () => {
    const cnp = C.generateCnp(C.seededRandom(12))
    const lines = C.buildTd1({ documentNumber: 'RX123456', birthDate: cnp.slice(1, 7), sex: 'M', expiryDate: '351231', surname: 'Pop', givenNames: 'Ion', cnp })
    const misread = [lines[0], lines[1].slice(0, 9) + ((Number(lines[1][9]) + 1) % 10) + lines[1].slice(10), lines[2]]
    const p = C.parseMrz(misread.join('\n'))
    assert.equal(p.valid, false)
    assert.ok(p.checks.some((c) => !c.ok && c.name === 'data expirării'))
  })

  test('TD2 (buletinul vechi): CNP reconstruit din prima cifră, data nașterii și ultimele 6 cifre', () => {
    const cnp = C.generateCnp(C.seededRandom(13))
    const doc = 'AB1234567', dob = cnp.slice(1, 7), exp = '301231', opt = (cnp[0] + cnp.slice(7)).padEnd(7, '<')
    const l1 = 'IDROUPOPESCU<<ANDREI'.padEnd(36, '<')
    const head = `${doc}${C.mrzCheckDigit(doc)}ROU${dob}${C.mrzCheckDigit(dob)}M${exp}${C.mrzCheckDigit(exp)}${opt}`
    const l2 = head + C.mrzCheckDigit(head.slice(0, 10) + head.slice(13, 20) + head.slice(21, 35))
    const p = C.parseMrz(`${l1}\n${l2}`)
    assert.equal(p.format, 'TD2')
    assert.equal(p.valid, true)
    assert.equal(p.cnp, cnp)
  })
})
