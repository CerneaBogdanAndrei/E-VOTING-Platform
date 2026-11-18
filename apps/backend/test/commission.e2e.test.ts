// Comisia: membri cu roluri (comisie / observator), editarea și ștergerea scrutinelor
// în configurare, votul alb, scoaterea din lista de eligibili, scrutinul „doar NFC”.

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { buildTd1, prepareBallot, submitBallot, type ApiClient, type Election } from '@evoting/api'
import { generateCredential, generateTrusteeKey, partialDecrypt, verifyElection } from '@evoting/crypto'
import { createTestChip } from '../src/nfc/test-pki.js'
import { databaseAvailable, electionInput, rejects, resetDatabase, startServer, type TestServer } from './helpers.js'

const available = await databaseAvailable()

describe('backend: comisia', { skip: !available }, () => {
  let s: TestServer
  before(async () => {
    await resetDatabase()
    s = await startServer()
  })
  after(async () => {
    await s?.close()
  })

  it('membrii comisiei: token propriu, rol observator doar cu citire, revocare', async () => {
    assert.deepEqual(await s.api.checkAdmin(), { id: 'root', name: 'Administrator', role: 'comisie' })
    await assert.rejects(s.anonymous.checkAdmin(), rejects(401))

    const member = await s.api.createMember({ name: 'Maria Pop', role: 'comisie' })
    const observer = await s.api.createMember({ name: 'ONG Observator', role: 'observator' })
    await assert.rejects(s.api.createMember({ name: 'x', role: 'admin' as 'comisie' }), rejects(400))
    const asMember: ApiClient = s.as(member.token)
    const asObserver: ApiClient = s.as(observer.token)
    assert.equal((await asMember.checkAdmin()).name, 'Maria Pop')
    assert.equal((await asObserver.checkAdmin()).role, 'observator')

    // observatorul citește, dar nu modifică
    const { election } = await asMember.createElection(electionInput({ title: 'Creat de membru' }))
    assert.ok((await asObserver.listElections()).some((e) => e.id === election.id))
    await asObserver.getAuditLog(election.id)
    await assert.rejects(asObserver.createElection(electionInput()), rejects(403))
    await assert.rejects(asObserver.openElection(election.id), rejects(403))
    await assert.rejects(asObserver.createMember({ name: 'y', role: 'comisie' }), rejects(403))

    // actorul din jurnal e numele membrului
    const log = await s.api.getAuditLog(election.id)
    assert.equal(log.find((x) => x.action === 'election.create')!.actor, 'comisie:Maria Pop')

    // revocarea: token-ul nu mai merge, membrul rămâne în listă
    await s.api.revokeMember(member.id)
    await assert.rejects(asMember.checkAdmin(), rejects(401))
    await assert.rejects(s.api.revokeMember(member.id), rejects(404))
    const members = await s.api.listMembers()
    assert.equal(members.length, 2)
    assert.ok(members.find((m) => m.id === member.id)!.revokedAt)
    assert.ok(!('token' in members[0]))
  })

  it('scrutinul se poate modifica și șterge doar în configurare', async () => {
    const { election } = await s.api.createElection(electionInput())
    const updated = await s.api.updateElection(election.id, {
      title: 'Titlu nou',
      candidates: [
        { name: 'Dan', description: '' },
        { name: 'Elena', description: '' },
      ],
      allowBlank: true,
    })
    assert.equal(updated.title, 'Titlu nou')
    assert.deepEqual(
      updated.candidates.map((c) => [c.name, c.kind, c.position]),
      [
        ['Dan', 'candidate', 0],
        ['Elena', 'candidate', 1],
        ['Vot alb', 'blank', 2],
      ],
    )
    // doar intervalul: candidații rămân
    const later = await s.api.updateElection(election.id, { closesAt: new Date(Date.now() + 48 * 3600_000).toISOString() })
    assert.equal(later.candidates.length, 3)
    await assert.rejects(s.api.updateElection(election.id, { closesAt: election.opensAt }), rejects(400, /după deschidere/))
    await assert.rejects(s.api.updateElection(election.id, { candidates: [{ name: 'singur', description: '' }] }), rejects(400))

    await s.api.deleteElection(election.id)
    await assert.rejects(s.api.getElection(election.id), rejects(404))
    await assert.rejects(s.api.deleteElection(election.id), rejects(404))
    // jurnalul păstrează ștergerea, fără legătură cu scrutinul dispărut
    const { trusteeTokens, election: kept } = await s.api.createElection(electionInput())
    for (const t of trusteeTokens) await s.api.submitTrusteeKey(kept.id, t.token, generateTrusteeKey(kept.id, t.trusteeId).publicKey)
    await s.api.importEligible(kept.id, '5040312170018')
    await s.api.openElection(kept.id)
    await assert.rejects(s.api.updateElection(kept.id, { title: 'x' }), rejects(409))
    await assert.rejects(s.api.deleteElection(kept.id), rejects(409))
  })

  it('votul alb e un candidat special: criptat la fel, numărat separat', async () => {
    const { election, trusteeTokens } = await s.api.createElection(electionInput({ allowBlank: true, trustees: [{ name: 'T' }] }))
    assert.equal(election.candidates.at(-1)!.kind, 'blank')
    const key = generateTrusteeKey(election.id, trusteeTokens[0].trusteeId)
    await s.api.submitTrusteeKey(election.id, trusteeTokens[0].token, key.publicKey)
    await s.api.importEligible(election.id, '5040312170018\n6050101400015')
    const opened: Election = await s.api.openElection(election.id)
    const a = generateCredential()
    const b = generateCredential()
    await s.api.registerOcr(election.id, { cnp: '5040312170018', credentialPubkey: a.publicKey })
    await s.api.registerOcr(election.id, { cnp: '6050101400015', credentialPubkey: b.publicKey })
    await submitBallot(s.api, opened, a, prepareBallot(opened, a, 3))
    await submitBallot(s.api, opened, b, prepareBallot(opened, b, 0))
    await s.api.closeElection(election.id)
    const tally = await s.api.getTally(election.id)
    await s.api.submitPartialDecryption(election.id, trusteeTokens[0].token, partialDecrypt(key.keyPair, tally.aggregate!))
    const result = await s.api.getResult(election.id)
    assert.deepEqual(
      result.counts.map((c) => c.votes),
      [1, 0, 0, 1],
    )
    assert.equal(result.counts[3].candidateId, election.candidates[3].id)
  })

  it('scoaterea din lista de eligibili: înregistrarea nevotată dispare, votul rămâne, verificatorul trece', async () => {
    const VOTED = '5040312170018'
    const REGISTERED = '6050101400015'
    const LISTED = '1800101221144'
    const ABSENT = '2900101400014'
    const { election, trusteeTokens } = await s.api.createElection(electionInput({ trustees: [{ name: 'T' }] }))
    const key = generateTrusteeKey(election.id, trusteeTokens[0].trusteeId)
    await s.api.submitTrusteeKey(election.id, trusteeTokens[0].token, key.publicKey)
    await s.api.importEligible(election.id, [VOTED, REGISTERED, LISTED].join('\n'))
    const opened = await s.api.openElection(election.id)
    const voter = generateCredential()
    const waiting = generateCredential()
    await s.api.registerOcr(election.id, { cnp: VOTED, credentialPubkey: voter.publicKey })
    await s.api.registerOcr(election.id, { cnp: REGISTERED, credentialPubkey: waiting.publicKey })
    await submitBallot(s.api, opened, voter, prepareBallot(opened, voter, 0))

    // observatorul nu poate scoate pe nimeni
    const observer = await s.api.createMember({ name: 'Observator 2', role: 'observator' })
    await assert.rejects(s.as(observer.token).removeEligible(election.id, LISTED), rejects(403))

    const result = await s.api.removeEligible(election.id, ['cnp', VOTED, REGISTERED, LISTED, ABSENT, '123', LISTED].join('\n'))
    assert.deepEqual({ ...result, invalid: result.invalid.map((x) => x.line) }, { removed: 2, registrationsRemoved: 1, notFound: 1, voted: 1, invalid: [6] })
    // CNP-ul invalid apare doar mascat, ca la import
    assert.equal(result.invalid[0].value, '…')

    const afterRemoval = await s.api.getElection(election.id)
    assert.deepEqual(afterRemoval.stats, { eligible: 1, registered: 1, ballots: 1 })
    assert.deepEqual(
      (await s.api.getRegistrations(election.id)).map((r) => r.credentialPubkey),
      [voter.publicKey],
    )
    // credentialul scos nu mai poate vota, iar persoana nu se mai poate înregistra
    await assert.rejects(submitBallot(s.api, opened, waiting, prepareBallot(opened, waiting, 1)), rejects(403))
    await assert.rejects(s.api.registerOcr(election.id, { cnp: REGISTERED, credentialPubkey: generateCredential().publicKey }), rejects(403))
    // poate fi adăugată la loc și se înregistrează din nou
    await s.api.importEligible(election.id, REGISTERED)
    const again = generateCredential()
    await s.api.registerOcr(election.id, { cnp: REGISTERED, credentialPubkey: again.publicKey })
    await submitBallot(s.api, opened, again, prepareBallot(opened, again, 1))

    const log = await s.api.getAuditLog(election.id)
    const entry = log.find((x) => x.action === 'eligible.remove')!
    assert.deepEqual(entry.payload, { removed: 2, registrationsRemoved: 1, notFound: 1, voted: 1, invalid: 1 })
    assert.equal(JSON.stringify(log).includes(REGISTERED), false)

    await s.api.closeElection(election.id)
    await assert.rejects(s.api.removeEligible(election.id, LISTED), rejects(409))
    const tally = await s.api.getTally(election.id)
    await s.api.submitPartialDecryption(election.id, trusteeTokens[0].token, partialDecrypt(key.keyPair, tally.aggregate!))
    const bundle = await s.api.getAuditBundle(election.id)
    const report = await verifyElection(bundle)
    assert.equal(report.ok, true, JSON.stringify(report.steps.filter((x) => x.status === 'fail')))
    assert.deepEqual(
      (await s.api.getResult(election.id)).counts.map((c) => c.votes),
      [1, 1, 0],
    )
  })

  it('scrutinul „doar NFC”: OCR-ul e refuzat, cipul semnat e acceptat; setarea se poate schimba doar în configurare', async () => {
    const CNP = '6050101400015'
    const { election, trusteeTokens } = await s.api.createElection(electionInput({ trustees: [{ name: 'T' }], requireNfc: true }))
    assert.equal(election.requireNfc, true)
    // implicit, un scrutin acceptă ambele metode; setarea se poate schimba cât e în configurare
    const { election: other } = await s.api.createElection(electionInput({ title: 'Ambele metode' }))
    assert.equal(other.requireNfc, false)
    assert.equal((await s.api.updateElection(other.id, { requireNfc: true })).requireNfc, true)
    assert.equal((await s.api.updateElection(other.id, { title: 'Doar titlul' })).requireNfc, true)

    await s.api.submitTrusteeKey(election.id, trusteeTokens[0].token, generateTrusteeKey(election.id, trusteeTokens[0].trusteeId).publicKey)
    await s.api.importEligible(election.id, CNP)
    const opened = await s.api.openElection(election.id)
    await assert.rejects(s.api.updateElection(election.id, { requireNfc: false }), rejects(409))

    const v = generateCredential()
    await assert.rejects(s.api.registerOcr(election.id, { cnp: CNP, credentialPubkey: v.publicKey }), rejects(403, /doar înregistrarea cu cartea electronică/))
    const chip = await createTestChip(s.pki, buildTd1({ surname: 'Ion', givenNames: 'Ana', documentNumber: 'GL1234567', cnp: CNP, sex: 'F', expiry: '330101' }))
    const reg = await s.api.registerNfc(election.id, { ...chip, credentialPubkey: v.publicKey })
    assert.equal(reg.trustLevel, 'criptografic')
    await submitBallot(s.api, opened, v, prepareBallot(opened, v, 1))
    const created = (await s.api.getAuditLog(election.id)).find((x) => x.action === 'election.create')!
    assert.equal((created.payload as { requireNfc: boolean }).requireNfc, true)
  })
})
