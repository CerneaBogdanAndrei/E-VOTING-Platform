// Comisia: membri cu roluri (comisie / observator), editarea și ștergerea scrutinelor
// în configurare, votul alb.

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { prepareBallot, submitBallot, type ApiClient, type Election } from '@evoting/api'
import { generateCredential, generateTrusteeKey, partialDecrypt } from '@evoting/crypto'
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
})
