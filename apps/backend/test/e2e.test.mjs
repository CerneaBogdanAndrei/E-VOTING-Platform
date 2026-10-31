// Teste de integrare: un scrutin complet prin API-ul HTTP real, cu clientul
// @evoting/api, plus încercările de fraudă din modelul de amenințare.
// Rulează pe stocarea în memorie și, dacă TEST_DATABASE_URL e setat, și pe PostgreSQL.
//
//   npm test                                                     (doar memorie)
//   TEST_DATABASE_URL=postgres://postgres@localhost:5433/evoting_test npm test

import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import * as C from '@evoting/crypto'
import { ApiError, createApiClient, electionParams, authenticate, vote } from '@evoting/api'

process.env.NODE_ENV = 'test'
const { createApp } = await import('../dist/app.js')
const { MemoryStorage } = await import('../dist/storage/memory.storage.js')
const { PassiveAuthService } = await import('../dist/nfc/passive-auth.service.js')
const { createTestAuthority, createTestDocument } = await import('../dist/nfc/test-document.js')

const baseConfig = {
  port: 0,
  cnpHmacKey: 'ab'.repeat(32),
  adminPassword: 'parola-test',
  demoMode: false,
  databaseUrl: undefined,
  dataFile: undefined,
  cscaDir: undefined,
  rateLimit: false,
  corsOrigin: true,
  voterSessionTtl: 900,
  adminSessionTtl: 3600,
}

async function start(storage, overrides = {}) {
  const app = await createApp({ ...baseConfig, ...overrides }, storage)
  await app.listen(0, '127.0.0.1')
  const url = await app.getUrl()
  let adminToken = null
  const api = createApiClient(url.replace('[::1]', '127.0.0.1'), { adminToken: () => adminToken })
  return { app, api, setAdmin: (t) => (adminToken = t) }
}

const rejects = async (promise, status, pattern) => {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof ApiError, `se aștepta ApiError, nu ${err}`)
    assert.equal(err.status, status, `status ${err.status}: ${err.message}`)
    if (pattern) assert.match(err.message, pattern)
    return true
  })
}

const storages = [['memorie', async () => new MemoryStorage()]]
if (process.env.TEST_DATABASE_URL) {
  const { PostgresStorage } = await import('../dist/storage/postgres.storage.js')
  storages.push([
    'PostgreSQL',
    async () => {
      const pg = (await import('pg')).default
      const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL })
      await client.connect()
      await client.query('truncate audit_log, results, partial_decryptions, ballots, registrations, eligible_voters, trustees, candidates, elections restart identity cascade')
      await client.end()
      return PostgresStorage.connect(process.env.TEST_DATABASE_URL)
    },
  ])
}

for (const [label, makeStorage] of storages) {
  describe(`Scrutin complet prin API (${label})`, () => {
    let ctx, storage
    const cnps = Array.from({ length: 30 }, (_, i) => C.generateCnp(C.seededRandom(100 + i)))
    const voters = []
    let election
    const trusteeKeys = {}
    const codes = {}

    before(async () => {
      storage = await makeStorage()
      ctx = await start(storage)
    })
    after(async () => {
      await ctx.app.close()
      await storage.close?.()
    })

    test('comisia: parolă greșită refuzată, rutele comisiei cer autentificare', async () => {
      await rejects(ctx.api.adminLogin('gresit'), 401)
      await rejects(ctx.api.createElection({ title: 'X', opensAt: '', closesAt: '', candidates: [], trustees: [] }), 401)
      ctx.setAdmin((await ctx.api.adminLogin('parola-test')).token)
    })

    test('crearea scrutinului și validarea datelor', async () => {
      await rejects(
        ctx.api.createElection({ title: 'Test', opensAt: '2026-11-03T08:00:00Z', closesAt: '2026-11-05T18:00:00Z', candidates: [{ name: 'A', description: '' }], trustees: [{ name: 'T' }] }),
        400,
        /cel puțin doi candidați/,
      )
      election = await ctx.api.createElection({
        title: 'Reprezentant studenți – Senatul UDJG',
        opensAt: '2026-11-03T08:00:00Z',
        closesAt: '2026-11-05T18:00:00Z',
        candidates: [
          { name: 'Elena Radu', description: 'Științe Economice' },
          { name: 'Vlad Ionescu', description: 'ACIEE' },
          { name: 'Cristina Marin', description: 'Litere' },
        ],
        trustees: [{ name: 'Comisia' }, { name: 'Observatori' }, { name: 'Candidați' }],
      })
      assert.equal(election.status, 'draft')
      assert.match(election.id, /^reprezentant-studenti-senatul-udjg-[0-9a-f]{4}$/)
      assert.deepEqual(election.trustees.map((t) => t.id), ['t1', 't2', 't3'])
    })

    test('lista eligibililor: doar HMAC-uri, cu raport de duplicate și linii invalide', async () => {
      const csv = ['cnp', ...cnps, cnps[0], '1234567890123', ''].join('\n')
      const r = await ctx.api.importEligible(election.id, csv)
      assert.equal(r.imported, 30)
      assert.equal(r.duplicates, 1)
      assert.equal(r.invalid.length, 1)
      assert.ok(!JSON.stringify(r).includes('1234567890123'), 'linia invalidă nu e ecouată în clar')
      const log = await ctx.api.getAuditLog(election.id)
      assert.ok(!JSON.stringify(log).includes(cnps[0]), 'jurnalul nu conține CNP-uri')
    })

    test('deschiderea e refuzată cât timp lipsesc cheile trustees', async () => {
      await rejects(ctx.api.openElection(election.id), 409, /Lipsesc cheile/)
    })

    test('trustees: cod de acces greșit sau dovadă falsă refuzate; cheia scrutinului = ΣYᵢ', async () => {
      for (const t of election.trustees) codes[t.id] = (await ctx.api.trusteeInvite(election.id, t.id)).code
      const key1 = C.generateTrusteeKey(election.id, 't1')
      await rejects(ctx.api.submitTrusteeKey(election.id, 'ff'.repeat(16), { trusteeId: 't1', publicKeyShare: key1.publicKeyShare, proof: key1.proof }), 403)
      const forOther = C.generateTrusteeKey(election.id, 't2')
      await rejects(ctx.api.submitTrusteeKey(election.id, codes.t1, { trusteeId: 't1', publicKeyShare: forOther.publicKeyShare, proof: forOther.proof }), 400, /Dovada/)
      for (const t of election.trustees) {
        trusteeKeys[t.id] = C.generateTrusteeKey(election.id, t.id)
        election = await ctx.api.submitTrusteeKey(election.id, codes[t.id], { trusteeId: t.id, publicKeyShare: trusteeKeys[t.id].publicKeyShare, proof: trusteeKeys[t.id].proof })
      }
      await rejects(ctx.api.submitTrusteeKey(election.id, codes.t1, { trusteeId: 't1', publicKeyShare: key1.publicKeyShare, proof: key1.proof }), 409)
      assert.equal(election.publicKey, C.combinePublicKeys(Object.values(trusteeKeys).map((k) => k.publicKeyShare)))
    })

    test('înregistrarea OCR: CNP invalid, neeligibil, dublu și credential refolosit sunt refuzate', async () => {
      const cred = C.generateCredential()
      await rejects(ctx.api.registerOcr(election.id, { cnp: '1234567890123', credentialPubkey: cred.publicKey }), 400, /CNP invalid/)
      await rejects(ctx.api.registerOcr(election.id, { cnp: C.generateCnp(C.seededRandom(999)), credentialPubkey: cred.publicKey }), 403, /eligibili/)
      const reg = await ctx.api.registerOcr(election.id, { cnp: cnps[0], credentialPubkey: cred.publicKey })
      assert.deepEqual([reg.method, reg.trustLevel], ['ocr', 'optic'])
      assert.ok(!('cnpHmac' in reg))
      voters.push(cred)
      await rejects(ctx.api.registerOcr(election.id, { cnp: cnps[0], credentialPubkey: C.generateCredential().publicKey }), 409, /deja înregistrată/)
      await rejects(ctx.api.registerOcr(election.id, { cnp: cnps[1], credentialPubkey: cred.publicKey }), 409, /Credentialul/)
      for (let i = 1; i < 12; i++) {
        const c = C.generateCredential()
        await ctx.api.registerOcr(election.id, { cnp: cnps[i], credentialPubkey: c.publicKey })
        voters.push(c)
      }
      await ctx.api.openElection(election.id)
      election = await ctx.api.getElection(election.id)
      assert.deepEqual([election.status, election.stats.registered, election.stats.eligible], ['open', 12, 30])
    })

    test('autentificarea: credential neînregistrat, semnătură greșită și nonce refolosit sunt refuzate', async () => {
      await rejects(ctx.api.authChallenge({ electionId: election.id, credentialPubkey: C.generateCredential().publicKey }), 403)
      const v = voters[0]
      const { nonce } = await ctx.api.authChallenge({ electionId: election.id, credentialPubkey: v.publicKey })
      const wrong = C.signMessage(C.generateCredential().secretKey, C.authMessage(election.id, nonce))
      await rejects(ctx.api.authVerify({ electionId: election.id, credentialPubkey: v.publicKey, nonce, signature: wrong }), 401)
      const right = C.signMessage(v.secretKey, C.authMessage(election.id, nonce))
      await rejects(ctx.api.authVerify({ electionId: election.id, credentialPubkey: v.publicKey, nonce, signature: right }), 401, /expirată/)
    })

    test('votul: buletin valid primit, codul de urmărire calculat pe telefon coincide cu cel de pe board', async () => {
      const params = electionParams(election)
      const enc = C.encryptBallot(params, voters[0].publicKey, 1)
      const ballot = C.signBallot(enc.body, voters[0].secretKey)
      await rejects(ctx.api.castBallot(election.id, 'aa'.repeat(32), ballot), 401)
      const token = await authenticate(ctx.api, election.id, voters[0])
      const receipt = await ctx.api.castBallot(election.id, token, ballot)
      assert.equal(receipt.seq, 1)
      assert.equal(receipt.trackingCode, enc.trackingCode)
      const found = await ctx.api.findBallot(election.id, enc.trackingCode)
      assert.equal(found.hash, receipt.entryHash)
      assert.equal((await ctx.api.findBallot(election.id, receipt.entryHash)).seq, 1)
      await rejects(ctx.api.findBallot(election.id, 'ab'.repeat(32)), 404)
    })

    test('vot dublu, buletin invalid și buletinul altcuiva sunt refuzate', async () => {
      const params = electionParams(election)
      await rejects(vote(ctx.api, election, voters[0], 2), 409, /a votat deja/)
      const v = voters[1]
      const bad = C.signBallot(C.encryptVector(params, v.publicKey, [1, 1, 0]).body, v.secretKey)
      await rejects(ctx.api.castBallot(election.id, await authenticate(ctx.api, election.id, v), bad), 400, /Buletin respins: dovada că s-au bifat exact 1/)
      const minus = C.signBallot(C.encryptVector(params, v.publicKey, [2, -1, 0]).body, v.secretKey)
      await rejects(ctx.api.castBallot(election.id, await authenticate(ctx.api, election.id, v), minus), 400, /0 sau 1/)
      const other = voters[2]
      const theirs = C.signBallot(C.encryptBallot(params, other.publicKey, 0).body, other.secretKey)
      await rejects(ctx.api.castBallot(election.id, await authenticate(ctx.api, election.id, v), theirs), 403, /altui credential/)
      const forged = { ...C.encryptBallot(params, v.publicKey, 0).body, signature: theirs.signature }
      await rejects(ctx.api.castBallot(election.id, await authenticate(ctx.api, election.id, v), forged), 400, /semnătura/)
    })

    test('voturi trimise în paralel: lanțul rămâne consistent', async () => {
      const choices = [0, 2, 1, 1, 0, 1, 2, 1, 1, 0, 1]
      const receipts = await Promise.all(voters.slice(1).map((v, i) => vote(ctx.api, election, v, choices[i])))
      assert.deepEqual(receipts.map((r) => r.seq).sort((a, b) => a - b), Array.from({ length: 11 }, (_, i) => i + 2))
      const board = await ctx.api.getBoard(election.id)
      assert.ok(C.verifyChain(election.id, board).ok)
      assert.equal((await ctx.api.getBoardHead(election.id)).hash, board.at(-1).hash)
    })

    test('închiderea: agregatul se publică, votul ulterior e refuzat', async () => {
      await rejects(ctx.api.getResult(election.id), 404)
      election = await ctx.api.closeElection(election.id)
      assert.equal(election.status, 'closed')
      const tally = await ctx.api.getTally(election.id)
      assert.equal(tally.ballotCount, 12)
      assert.equal(tally.aggregate.length, 3)
      const late = C.generateCredential()
      await rejects(ctx.api.registerOcr(election.id, { cnp: cnps[20], credentialPubkey: late.publicKey }), 409, /s-a închis/)
    })

    test('numărarea: trustee cu cod greșit sau decriptare falsă refuzat; rezultatul corect cu toți trustees', async () => {
      const { aggregate } = await ctx.api.getTally(election.id)
      const p1 = C.partialDecrypt(trusteeKeys.t1, aggregate)
      await rejects(ctx.api.submitPartialDecryption(election.id, codes.t2, p1), 403)
      const cheat = structuredClone(C.partialDecrypt(trusteeKeys.t2, aggregate))
      cheat.shares[0].d = C.pointToHex(C.pointFromHex(cheat.shares[0].d).subtract(C.G))
      await rejects(ctx.api.submitPartialDecryption(election.id, codes.t2, cheat), 400, /Comisia|Observatori/)
      await ctx.api.submitPartialDecryption(election.id, codes.t1, p1)
      await rejects(ctx.api.submitPartialDecryption(election.id, codes.t1, p1), 409)
      await ctx.api.submitPartialDecryption(election.id, codes.t2, C.partialDecrypt(trusteeKeys.t2, aggregate))
      await rejects(ctx.api.getResult(election.id), 404)
      const state = await ctx.api.submitPartialDecryption(election.id, codes.t3, C.partialDecrypt(trusteeKeys.t3, aggregate))
      assert.equal(state.status, 'tallied')
      const result = await ctx.api.getResult(election.id)
      // voters[0] → 1; restul: [0, 2, 1, 1, 0, 1, 2, 1, 1, 0, 1]
      assert.deepEqual(result.counts.map((c) => c.votes), [3, 7, 2])
      assert.equal(result.totalBallots, 12)
      assert.equal(result.quorum, 11)
      assert.equal(result.quorumReached, true)
    })

    test('verificarea publică a registrului descărcat trece toți pașii', async () => {
      const record = await ctx.api.getRecord(election.id)
      const report = await C.verifyElectionRecord(record, { anchors: [(await ctx.api.getBoardHead(election.id)).hash] })
      assert.equal(report.ok, true, JSON.stringify(report.steps.filter((s) => !s.ok)))
      assert.deepEqual(report.counts, [3, 7, 2])
      assert.equal(record.registrations.length, 12)
    })

    test('jurnalul de audit păstrează acțiunile comisiei și ale trustees', async () => {
      const actions = (await ctx.api.getAuditLog(election.id)).map((a) => a.action)
      for (const a of ['scrutin creat', 'listă eligibili importată', 'cheie publică trimisă', 'cheia scrutinului publicată', 'vot deschis', 'vot închis', 'decriptare parțială trimisă', 'rezultat publicat']) {
        assert.ok(actions.includes(a), `lipsește „${a}”`)
      }
    })

    test('NFC: Passive Authentication acceptă un document semnat de CSCA-ul de încredere și refuză restul', async () => {
      const e2 = await ctx.api.createElection({
        title: 'Consultare NFC',
        opensAt: '2026-11-03T08:00:00Z',
        closesAt: '2026-11-05T18:00:00Z',
        candidates: [{ name: 'Da', description: '' }, { name: 'Nu', description: '' }],
        trustees: [{ name: 'T' }],
      })
      const people = [C.generateCnp(C.seededRandom(1)), C.generateCnp(C.seededRandom(2)), C.generateCnp(C.seededRandom(3))]
      await ctx.api.importEligible(e2.id, people.join('\n'))
      const cred = () => C.generateCredential().publicKey
      const trusted = await createTestAuthority()
      const rogue = await createTestAuthority('CSCA fals')
      const doc = await createTestDocument(trusted, people[0])

      await rejects(ctx.api.registerNfc(e2.id, { ...doc, credentialPubkey: cred() }), 403, /nu e configurată/)
      ctx.app.get(PassiveAuthService).trust(trusted.csca)

      const reg = await ctx.api.registerNfc(e2.id, { ...doc, credentialPubkey: cred() })
      assert.deepEqual([reg.method, reg.trustLevel], ['nfc', 'criptografic'])
      await rejects(ctx.api.registerOcr(e2.id, { cnp: people[0], credentialPubkey: cred() }), 409, /deja înregistrată/)

      const fake = await createTestDocument(rogue, people[1])
      await rejects(ctx.api.registerNfc(e2.id, { ...fake, credentialPubkey: cred() }), 400, /Passive Authentication a eșuat/)
      const tampered = await createTestDocument(trusted, people[2], { tamperAfterSigning: true })
      await rejects(ctx.api.registerNfc(e2.id, { ...tampered, credentialPubkey: cred() }), 400, /Hash-ul DG1/)
      const mixed = { dg1: (await createTestDocument(trusted, people[2])).dg1, sod: doc.sod }
      await rejects(ctx.api.registerNfc(e2.id, { ...mixed, credentialPubkey: cred() }), 400, /Hash-ul DG1/)
      await rejects(ctx.api.registerNfc(e2.id, { dg1: 'AAAA', sod: 'AAAA', credentialPubkey: cred() }), 400)
      assert.equal((await ctx.api.getElection(e2.id)).stats.registeredNfc, 1)
    })
  })
}

describe('Protecții', () => {
  test('rate limiting: după 5 parole greșite pe minut, autentificarea comisiei e blocată (429)', async () => {
    const ctx = await start(new MemoryStorage(), { rateLimit: true })
    try {
      for (let i = 0; i < 5; i++) await rejects(ctx.api.adminLogin(`incercare-${i}`), 401)
      await rejects(ctx.api.adminLogin('parola-test'), 429)
    } finally {
      await ctx.app.close()
    }
  })

  test('stocarea în fișier supraviețuiește unei reporniri', async () => {
    const { mkdtempSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const file = `${mkdtempSync(`${tmpdir()}/evoting-`)}/data.json`
    const s1 = new MemoryStorage(file)
    let ctx = await start(s1)
    ctx.setAdmin((await ctx.api.adminLogin('parola-test')).token)
    const e = await ctx.api.createElection({ title: 'Persistență', opensAt: '2026-11-03T08:00:00Z', closesAt: '2026-11-04T08:00:00Z', candidates: [{ name: 'A', description: '' }, { name: 'B', description: '' }], trustees: [{ name: 'T' }] })
    await ctx.api.importEligible(e.id, C.generateCnp())
    await ctx.app.close()
    s1.flush()
    ctx = await start(new MemoryStorage(file))
    try {
      const again = await ctx.api.getElection(e.id)
      assert.equal(again.stats.eligible, 1)
    } finally {
      await ctx.app.close()
    }
  })

  test('modul demo: un scrutin parcurs cap-coadă cu uneltele de demo, inclusiv NFC', async () => {
    const ctx = await start(new MemoryStorage(), { demoMode: true })
    try {
      ctx.setAdmin((await ctx.api.adminLogin('parola-test')).token)
      const e = await ctx.api.createElection({ title: 'Demo', opensAt: '2026-11-03T08:00:00Z', closesAt: '2026-11-04T08:00:00Z', candidates: [{ name: 'A', description: '' }, { name: 'B', description: '' }, { name: 'C', description: '' }], trustees: [{ name: 'T1' }, { name: 'T2' }] })
      await ctx.api.demo.generateEligible(e.id, 40)
      await ctx.api.demo.trusteeKeys(e.id)
      await ctx.api.openElection(e.id)
      const doc = await ctx.api.demo.testDocument(e.id)
      const cred = C.generateCredential()
      await ctx.api.registerNfc(e.id, { dg1: doc.dg1, sod: doc.sod, credentialPubkey: cred.publicKey })
      await vote(ctx.api, await ctx.api.getElection(e.id), cred, 2)
      assert.equal((await ctx.api.demo.voters(e.id, 15)).voted, 15)
      await ctx.api.closeElection(e.id)
      const done = await ctx.api.demo.tally(e.id)
      assert.equal(done.status, 'tallied')
      const result = await ctx.api.getResult(e.id)
      assert.equal(result.counts.reduce((s, c) => s + c.votes, 0), 16)
      const report = await C.verifyElectionRecord(await ctx.api.getRecord(e.id))
      assert.equal(report.ok, true)
    } finally {
      await ctx.app.close()
    }
  })
})
