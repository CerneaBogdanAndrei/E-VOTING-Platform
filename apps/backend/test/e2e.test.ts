import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import {
  ApiError,
  authenticate,
  buildTd1,
  bytesToBase64,
  base64ToBytes,
  prepareBallot,
  submitBallot,
  verifyOwnBallot,
  type Election,
} from '@evoting/api'
import {
  ballotDigest,
  ballotSignatureMessage,
  generateCredential,
  generateTrusteeKey,
  partialDecrypt,
  pointFromHex,
  pointToHex,
  G,
  signMessage,
  verifyElection,
  type TrusteeKeyPair,
} from '@evoting/crypto'
import { createTestChip, createTestPki } from '../src/nfc/test-pki.js'
import { databaseAvailable, resetDatabase, sql, startServer, type TestServer } from './helpers.js'

const available = await databaseAvailable()
if (!available) console.log('# PostgreSQL de test indisponibil (TEST_DATABASE_URL): testele end-to-end sunt sărite')

const CNPS = ['5040312170018', '6050101400015', '1960101400011', '1960101400021', '2970214460012']

const rejects = (status: number, pattern?: RegExp) => (err: unknown) => {
  assert.ok(err instanceof ApiError, String(err))
  assert.equal(err.status, status, err.message)
  if (pattern) assert.match(err.message, pattern)
  return true
}

describe('backend: scrutin complet pe PostgreSQL', { skip: !available }, () => {
  let s: TestServer
  let election: Election
  let trusteeTokens: { trusteeId: string; token: string }[]
  const keys: TrusteeKeyPair[] = []
  const voters = CNPS.map(() => generateCredential())

  before(async () => {
    await resetDatabase()
    s = await startServer()
  })
  after(async () => {
    await s?.close()
  })

  it('comisia creează scrutinul; fără token de comisie, cererea e refuzată', async () => {
    const input = {
      title: 'Consiliul Facultății – test',
      opensAt: '2026-11-01T08:00:00Z',
      closesAt: '2026-11-02T18:00:00Z',
      candidates: [
        { name: 'Ana', description: 'Calculatoare' },
        { name: 'Bogdan', description: 'Automatică' },
        { name: 'Corina', description: 'Electronică' },
      ],
      trustees: [{ name: 'Comisia' }, { name: 'Observatori' }],
    }
    await assert.rejects(s.anonymous.createElection(input), rejects(401))
    await assert.rejects(s.api.createElection({ ...input, candidates: input.candidates.slice(0, 1) }), rejects(400))
    const created = await s.api.createElection(input)
    election = created.election
    trusteeTokens = created.trusteeTokens
    assert.equal(election.status, 'draft')
    assert.equal(trusteeTokens.length, 2)
    const stored = await sql<{ token_hash: string }>('SELECT token_hash FROM trustees')
    assert.ok(stored.rows.every((r) => !trusteeTokens.some((t) => t.token === r.token_hash)), 'token-urile nu se păstrează în clar')
  })

  it('trustees trimit Yᵢ cu dovadă Schnorr; token greșit sau dovadă invalidă sunt refuzate', async () => {
    const [t1, t2] = trusteeTokens
    const k1 = generateTrusteeKey(election.id, t1.trusteeId)
    const k2 = generateTrusteeKey(election.id, t2.trusteeId)
    await assert.rejects(s.api.submitTrusteeKey(election.id, 'token-gresit', k1.publicKey), rejects(401))
    await assert.rejects(s.api.submitTrusteeKey(election.id, t2.token, k1.publicKey), rejects(403))
    await assert.rejects(s.api.submitTrusteeKey(election.id, t1.token, { ...k1.publicKey, proof: k2.publicKey.proof }), rejects(400, /Schnorr/))
    await s.api.submitTrusteeKey(election.id, t1.token, k1.publicKey)
    await assert.rejects(s.api.submitTrusteeKey(election.id, t1.token, k1.publicKey), rejects(409))
    await assert.rejects(s.api.openElection(election.id), rejects(409, /cheile/))
    election = await s.api.submitTrusteeKey(election.id, t2.token, k2.publicKey)
    keys.push(k1.keyPair, k2.keyPair)
    assert.ok(election.publicKey)
    assert.equal(pointToHex(pointFromHex(k1.publicKey.publicKeyShare).add(pointFromHex(k2.publicKey.publicKeyShare))), election.publicKey)
  })

  it('importul de eligibili păstrează doar HMAC(CNP)', async () => {
    const csv = ['cnp', ...CNPS, CNPS[0], '1234567890123', ''].join('\n')
    const r = await s.api.importEligible(election.id, csv)
    assert.deepEqual([r.imported, r.duplicates, r.invalid.length], [5, 1, 1])
    const rows = await sql<{ cnp_hmac: string }>('SELECT cnp_hmac FROM eligible_voters')
    assert.equal(rows.rowCount, 5)
    assert.ok(rows.rows.every((x) => /^[0-9a-f]{64}$/.test(x.cnp_hmac) && !CNPS.includes(x.cnp_hmac)))
    election = await s.api.openElection(election.id)
    assert.equal(election.status, 'open')
    await assert.rejects(s.api.importEligible(election.id, CNPS[0]), rejects(409))
  })

  it('înregistrarea optică: eligibilitate, o singură înregistrare per persoană', async () => {
    const reg = await s.api.registerOcr(election.id, { cnp: CNPS[0], credentialPubkey: voters[0].publicKey })
    assert.equal(reg.trustLevel, 'optic')
    await assert.rejects(s.api.registerOcr(election.id, { cnp: CNPS[0], credentialPubkey: generateCredential().publicKey }), rejects(409, /deja înregistrată/))
    await assert.rejects(s.api.registerOcr(election.id, { cnp: '5000101400012', credentialPubkey: generateCredential().publicKey }), rejects(403))
    await assert.rejects(s.api.registerOcr(election.id, { cnp: CNPS[1], credentialPubkey: voters[0].publicKey }), rejects(409, /Credentialul/))
    await assert.rejects(s.api.registerOcr(election.id, { cnp: CNPS[1], credentialPubkey: 'zz' }), rejects(400))
    await s.api.registerOcr(election.id, { cnp: CNPS[2], credentialPubkey: voters[2].publicKey })
    await s.api.registerOcr(election.id, { cnp: CNPS[3], credentialPubkey: voters[3].publicKey })
  })

  it('înregistrarea NFC: Passive Authentication acceptă cipul semnat și respinge DG1 modificat sau CSCA străin', async () => {
    const mrz = buildTd1({ surname: 'Ionescu', givenNames: 'Maria', documentNumber: 'GL7654321', cnp: CNPS[1], sex: 'F', expiry: '330101' })
    const chip = await createTestChip(s.pki, mrz)

    // DG1 modificat (alt CNP), cu același SOD
    const other = buildTd1({ surname: 'Ionescu', givenNames: 'Maria', documentNumber: 'GL7654321', cnp: CNPS[4], sex: 'F', expiry: '330101' })
    const forgedDg1 = (await createTestChip(s.pki, other)).dg1
    await assert.rejects(s.api.registerNfc(election.id, { dg1: forgedDg1, sod: chip.sod, credentialPubkey: voters[1].publicKey }), rejects(400, /hash-ul DG1/))

    // cip semnat de un CSCA în care serverul nu are încredere
    const rogue = await createTestChip(await createTestPki(), mrz)
    await assert.rejects(s.api.registerNfc(election.id, { ...rogue, credentialPubkey: voters[1].publicKey }), rejects(400, /CSCA/))

    // SOD cu semnătura alterată
    const sod = base64ToBytes(chip.sod)
    sod[sod.length - 5] ^= 0xff
    await assert.rejects(s.api.registerNfc(election.id, { dg1: chip.dg1, sod: bytesToBase64(sod), credentialPubkey: voters[1].publicKey }), rejects(400))

    const reg = await s.api.registerNfc(election.id, { ...chip, credentialPubkey: voters[1].publicKey })
    assert.equal(reg.method, 'nfc')
    assert.equal(reg.trustLevel, 'criptografic')
  })

  it('votul: autentificare cu provocare semnată, buletin verificat, cod de urmărire', async () => {
    election = await s.api.getElection(election.id)
    const receipt = await submitBallot(s.api, election, voters[0], prepareBallot(election, voters[0], 1))
    assert.equal(receipt.seq, 1)
    assert.deepEqual(await verifyOwnBallot(s.api, election.id, receipt), { status: 'ok', seq: 1 })
    await assert.rejects(submitBallot(s.api, election, voters[0], prepareBallot(election, voters[0], 2)), rejects(409, /a votat deja/))
  })

  it('autentificarea respinge semnături greșite, provocări refolosite și credentiale neînregistrate', async () => {
    const intruder = generateCredential()
    await assert.rejects(s.api.authChallenge(election.id, intruder.publicKey), rejects(403))
    const ch = await s.api.authChallenge(election.id, voters[2].publicKey)
    await assert.rejects(s.api.authVerify(ch.challengeId, signMessage(intruder.secretKey, 'altceva')), rejects(401))
    // provocarea s-a consumat
    await assert.rejects(s.api.authVerify(ch.challengeId, signMessage(voters[2].secretKey, 'altceva')), rejects(401))
    await assert.rejects(s.api.castBallot(election.id, prepareBallot(election, voters[2], 0).ballot, 'sesiune-falsa'), rejects(401))
    const token = await authenticate(s.api, election.id, voters[3])
    await assert.rejects(s.api.castBallot(election.id, prepareBallot(election, voters[2], 0).ballot, token), rejects(403))
  })

  it('buletine invalide sunt respinse: semnătură greșită, dovezi pentru alt scrutin, criptotext înlocuit', async () => {
    const token = await authenticate(s.api, election.id, voters[2])
    const { ballot } = prepareBallot(election, voters[2], 0)
    const tampered = structuredClone(ballot)
    tampered.ciphertexts[0] = structuredClone(ballot.ciphertexts[1])
    await assert.rejects(s.api.castBallot(election.id, tampered, token), rejects(400, /Semnătura/))
    // re-semnat de alegător, dar dovezile nu mai corespund criptotextelor
    tampered.signature = signMessage(voters[2].secretKey, ballotSignatureMessage(ballotDigest(tampered)))
    await assert.rejects(s.api.castBallot(election.id, tampered, token), rejects(400, /Dovada/))
    // buletin construit pentru alt scrutin (alt ID în contextul Fiat-Shamir)
    const foreign = prepareBallot({ ...election, id: 'alt-scrutin' }, voters[2], 0).ballot
    await assert.rejects(s.api.castBallot(election.id, { ...foreign, electionId: election.id }, token), rejects(400))
  })

  it('două voturi trimise simultan cu același credential: doar unul intră pe board', async () => {
    const [t1, t2] = await Promise.all([authenticate(s.api, election.id, voters[2]), authenticate(s.api, election.id, voters[2])])
    const results = await Promise.allSettled([
      s.api.castBallot(election.id, prepareBallot(election, voters[2], 0).ballot, t1),
      s.api.castBallot(election.id, prepareBallot(election, voters[2], 2).ballot, t2),
    ])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    assert.equal((rejected.reason as ApiError).status, 409)
  })

  it('board-ul e append-only chiar și pentru cine are acces la baza de date (fără a dezactiva trigger-ul)', async () => {
    await assert.rejects(sql("UPDATE ballots SET signature = 'x' WHERE seq = 1"), /append-only/)
    await assert.rejects(sql('DELETE FROM ballots WHERE seq = 1'), /append-only/)
  })

  it('la închidere se publică agregatul; trustees decriptează; rezultatul se publică', async () => {
    await submitBallot(s.api, election, voters[1], prepareBallot(election, voters[1], 1))
    await submitBallot(s.api, election, voters[3], prepareBallot(election, voters[3], 2))
    await assert.rejects(s.api.submitPartialDecryption(election.id, trusteeTokens[0].token, partialDecrypt(keys[0], [])), rejects(409))
    election = await s.api.closeElection(election.id)
    assert.equal(election.status, 'closed')
    await assert.rejects(s.api.registerOcr(election.id, { cnp: CNPS[4], credentialPubkey: voters[4].publicKey }), rejects(409))
    const tally = await s.api.getTally(election.id)
    assert.equal(tally.aggregate!.length, 3)

    // trustee care trișează: o decriptare parțială modificată e respinsă
    const cheat = partialDecrypt(keys[0], tally.aggregate!)
    cheat.shares[0] = pointToHex(pointFromHex(cheat.shares[0]).add(G))
    await assert.rejects(s.api.submitPartialDecryption(election.id, trusteeTokens[0].token, cheat), rejects(400, /Dovada/))

    await s.api.submitPartialDecryption(election.id, trusteeTokens[0].token, partialDecrypt(keys[0], tally.aggregate!))
    await assert.rejects(s.api.getResult(election.id), rejects(404))
    election = await s.api.submitPartialDecryption(election.id, trusteeTokens[1].token, partialDecrypt(keys[1], tally.aggregate!))
    assert.equal(election.status, 'tallied')
    const result = await s.api.getResult(election.id)
    assert.deepEqual(result.counts.map((c) => c.votes), [1, 2, 1])
    assert.equal(result.totalBallots, 4)
  })

  it('verificatorul public trece pe datele publicate', async () => {
    const b = await s.anonymous.getAuditBundle(election.id)
    const report = await verifyElection(
      { election: b.election, registrations: b.registrations, board: b.board, tally: b.tally, result: b.result },
      { publishedHead: b.head },
    )
    assert.equal(report.ok, true, JSON.stringify(report.steps.filter((x) => x.status === 'fail'), null, 2))
  })

  it('CNP-urile nu apar nicăieri în clar în baza de date', async () => {
    const dump = await sql<{ t: string }>(`
      SELECT string_agg(x::text, ' ') AS t FROM (
        SELECT row_to_json(e)::text AS x FROM eligible_voters e UNION ALL
        SELECT row_to_json(r)::text FROM registrations r UNION ALL
        SELECT row_to_json(a)::text FROM audit_log a UNION ALL
        SELECT row_to_json(b)::text FROM ballots b
      ) s`)
    for (const cnp of CNPS) assert.ok(!dump.rows[0].t.includes(cnp), `CNP-ul ${cnp} apare în baza de date`)
  })

  it('un administrator rău-intenționat care modifică board-ul direct în baza de date e prins de verificator', async () => {
    await sql('ALTER TABLE ballots DISABLE TRIGGER ballots_append_only')
    try {
      const { rows } = await sql<{ ciphertexts: unknown[] }>('SELECT ciphertexts FROM ballots WHERE election_id = $1 AND seq = 3', [election.id])
      const swapped = [rows[0].ciphertexts[1], rows[0].ciphertexts[0], rows[0].ciphertexts[2]]
      await sql('UPDATE ballots SET ciphertexts = $2 WHERE election_id = $1 AND seq = 3', [election.id, JSON.stringify(swapped)])
    } finally {
      await sql('ALTER TABLE ballots ENABLE TRIGGER ballots_append_only')
    }
    const b = await s.anonymous.getAuditBundle(election.id)
    const report = await verifyElection({ election: b.election, registrations: b.registrations, board: b.board, tally: b.tally, result: b.result })
    assert.equal(report.ok, false)
    const chain = report.steps.find((x) => x.id === 'chain')!
    assert.equal(chain.failures[0].where, 'buletinul #3')
  })

  it('jurnalul de audit înregistrează acțiunile comisiei și ale trustees, doar pentru comisie', async () => {
    await assert.rejects(s.anonymous.getAuditLog(election.id), rejects(401))
    const log = await s.api.getAuditLog(election.id)
    const actions = log.map((x) => x.action)
    for (const a of ['election.create', 'trustee.key', 'election.public_key', 'eligible.import', 'election.open', 'voter.register', 'election.close', 'tally.partial', 'tally.result']) {
      assert.ok(actions.includes(a), `lipsește ${a}`)
    }
  })
})

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
    assert.ok(statuses.slice(5).every((x) => x === 429), statuses.join(','))
  })

  it('rutele publice de citire nu sunt afectate', async () => {
    const res = await fetch(`${s.url}/elections`)
    assert.equal(res.status, 200)
  })
})
