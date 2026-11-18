import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import { describe, it } from 'node:test'
import { generateCredential, verifyElection } from '@evoting/crypto'
import {
  ApiError,
  authenticate,
  buildTd1,
  bytesToBase64,
  createMockBackend,
  dg1FromMrz,
  prepareBallot,
  submitBallot,
  verifyOwnBallot,
  type CreateElectionInput,
} from '../src/index.js'

const HOUR = 3600_000
const input = (over: Partial<CreateElectionInput> = {}): CreateElectionInput => ({
  title: 'Test',
  opensAt: new Date(Date.now() - HOUR).toISOString(),
  closesAt: new Date(Date.now() + 24 * HOUR).toISOString(),
  candidates: [
    { name: 'A', description: '' },
    { name: 'B', description: '' },
  ],
  trustees: [{ name: 'T1' }, { name: 'T2' }],
  ...over,
})
const status = (code: number) => (e: unknown) => e instanceof ApiError && e.status === code

describe('backend-ul simulat, cu criptografie reală', () => {
  it('scrutin complet: chei, înregistrare, vot, numărare, verificare publică', { timeout: 120_000 }, async () => {
    const { client: api, tools } = createMockBackend({ latency: false, seedVoters: { open: 2, tallied: 3 } })
    const { election, trusteeTokens } = await api.createElection(input())
    assert.equal(trusteeTokens.length, 2)
    await assert.rejects(api.openElection(election.id), /chei/)

    await tools.simulateTrusteeKeys(election.id)
    const csv = ['cnp', '5040312170018', '6050101400015', '1960101400011', '1960101400017'].join('\n')
    const imported = await api.importEligible(election.id, csv)
    assert.deepEqual([imported.imported, imported.invalid.length], [3, 1])
    const opened = await api.openElection(election.id)
    assert.equal(opened.status, 'open')
    assert.ok(opened.publicKey)

    // înregistrare OCR și NFC
    const alice = generateCredential()
    await api.registerOcr(election.id, { cnp: '5040312170018', credentialPubkey: alice.publicKey })
    await assert.rejects(api.registerOcr(election.id, { cnp: '1960101400021', credentialPubkey: generateCredential().publicKey }), status(403))
    const bob = generateCredential()
    const dg1 = dg1FromMrz(buildTd1({ surname: 'Ion', givenNames: 'Ana', documentNumber: 'GL1', cnp: '6050101400015', sex: 'F', expiry: '330101' }))
    const reg = await api.registerNfc(election.id, { dg1: bytesToBase64(dg1), sod: '', credentialPubkey: bob.publicKey })
    assert.equal(reg.trustLevel, 'criptografic')

    // vot
    const receipt = await submitBallot(api, opened, alice, prepareBallot(opened, alice, 1))
    assert.equal(receipt.seq, 1)
    await assert.rejects(submitBallot(api, opened, alice, prepareBallot(opened, alice, 0)), /a votat deja/)
    await submitBallot(api, opened, bob, prepareBallot(opened, bob, 1))
    assert.deepEqual(await verifyOwnBallot(api, election.id, receipt), { status: 'ok', seq: 1 })

    // buletin trimis cu sesiunea altui credential
    const carol = generateCredential()
    await api.registerOcr(election.id, { cnp: '1960101400011', credentialPubkey: carol.publicKey })
    const tokenAlice = await authenticate(api, election.id, alice)
    await assert.rejects(api.castBallot(election.id, prepareBallot(opened, carol, 0).ballot, tokenAlice), status(403))

    await api.closeElection(election.id)
    await tools.simulateTally(election.id)
    const result = await api.getResult(election.id)
    assert.deepEqual(
      result.counts.map((c) => c.votes),
      [0, 2],
    )

    const bundle = await api.getAuditBundle(election.id)
    const report = await verifyElection({
      election: bundle.election,
      registrations: bundle.registrations,
      board: bundle.board,
      tally: bundle.tally,
      result: bundle.result,
    })
    assert.equal(report.ok, true, JSON.stringify(report.steps, null, 2))
  })

  it('scrutinele de demonstrație trec verificatorul public', { timeout: 120_000 }, async () => {
    const { client: api } = createMockBackend({ latency: false, seedVoters: { open: 3, tallied: 4 } })
    for (const id of ['consiliu-aciee-2026', 'consultare-liga-2026']) {
      const b = await api.getAuditBundle(id)
      const report = await verifyElection({ election: b.election, registrations: b.registrations, board: b.board, tally: b.tally, result: b.result })
      assert.equal(report.ok, true, id)
    }
  })

  it('re-înregistrarea înlocuiește credentialul dacă persoana n-a votat, dar nu coboară nivelul de încredere', { timeout: 60_000 }, async () => {
    const { client: api, tools } = createMockBackend({ latency: false, seedVoters: { open: 1, tallied: 1 } })
    const { election } = await api.createElection(input())
    await tools.simulateTrusteeKeys(election.id)
    await api.importEligible(election.id, '5040312170018\n6050101400015')
    const opened = await api.openElection(election.id)

    const phone1 = generateCredential()
    const phone2 = generateCredential()
    await api.registerOcr(election.id, { cnp: '5040312170018', credentialPubkey: phone1.publicKey })
    const again = await api.registerOcr(election.id, { cnp: '5040312170018', credentialPubkey: phone2.publicKey })
    assert.equal(again.replacedPrevious, true)
    // credentialul vechi nu mai e înregistrat
    await assert.rejects(api.authChallenge(election.id, phone1.publicKey), status(403))
    await submitBallot(api, opened, phone2, prepareBallot(opened, phone2, 0))
    // după vot, nu se mai poate înlocui
    await assert.rejects(api.registerOcr(election.id, { cnp: '5040312170018', credentialPubkey: generateCredential().publicKey }), /a votat deja/)

    // NFC nu poate fi înlocuit de OCR
    const nfc = generateCredential()
    const dg1 = dg1FromMrz(buildTd1({ surname: 'Ion', givenNames: 'Ana', documentNumber: 'GL1', cnp: '6050101400015', sex: 'F', expiry: '330101' }))
    await api.registerNfc(election.id, { dg1: bytesToBase64(dg1), sod: '', credentialPubkey: nfc.publicKey })
    await assert.rejects(api.registerOcr(election.id, { cnp: '6050101400015', credentialPubkey: generateCredential().publicKey }), /nivel de încredere/)
  })

  it('votul alb e o opțiune criptată ca oricare alta și apare în rezultat', { timeout: 60_000 }, async () => {
    const { client: api, tools } = createMockBackend({ latency: false, seedVoters: { open: 1, tallied: 1 } })
    const { election } = await api.createElection(input({ allowBlank: true }))
    assert.equal(election.candidates.length, 3)
    assert.equal(election.candidates[2].kind, 'blank')
    await tools.simulateTrusteeKeys(election.id)
    await api.importEligible(election.id, '5040312170018')
    const opened = await api.openElection(election.id)
    const v = generateCredential()
    await api.registerOcr(election.id, { cnp: '5040312170018', credentialPubkey: v.publicKey })
    await submitBallot(api, opened, v, prepareBallot(opened, v, 2))
    await api.closeElection(election.id)
    await tools.simulateTally(election.id)
    const result = await api.getResult(election.id)
    assert.deepEqual(
      result.counts.map((c) => c.votes),
      [0, 0, 1],
    )
  })

  it('scrutinul se poate modifica și șterge doar în configurare', { timeout: 60_000 }, async () => {
    const { client: api, tools } = createMockBackend({ latency: false, seedVoters: { open: 1, tallied: 1 } })
    const { election } = await api.createElection(input())
    const updated = await api.updateElection(election.id, { title: 'Alt titlu', allowBlank: true })
    assert.equal(updated.title, 'Alt titlu')
    assert.equal(updated.candidates.length, 3)
    await assert.rejects(api.updateElection(election.id, { closesAt: election.opensAt }), /după deschidere/)
    await tools.simulateTrusteeKeys(election.id)
    await api.importEligible(election.id, '5040312170018')
    await api.openElection(election.id)
    await assert.rejects(api.updateElection(election.id, { title: 'x' }), status(409))
    await assert.rejects(api.deleteElection(election.id), status(409))
    // lista de eligibili se poate completa și după deschidere
    assert.equal((await api.importEligible(election.id, '6050101400015')).imported, 1)

    const { election: draft } = await api.createElection(input())
    await api.deleteElection(draft.id)
    await assert.rejects(api.getElection(draft.id), status(404))
  })

  it('scoaterea din lista de eligibili: ca pe serverul real (înregistrarea nevotată dispare, votul rămâne)', { timeout: 60_000 }, async () => {
    const { client: api, tools } = createMockBackend({ latency: false, seedVoters: { open: 1, tallied: 1 } })
    const { election } = await api.createElection(input())
    await tools.simulateTrusteeKeys(election.id)
    await api.importEligible(election.id, '5040312170018\n6050101400015\n1960101400011')
    const opened = await api.openElection(election.id)
    const voter = generateCredential()
    const waiting = generateCredential()
    await api.registerOcr(election.id, { cnp: '5040312170018', credentialPubkey: voter.publicKey })
    await api.registerOcr(election.id, { cnp: '6050101400015', credentialPubkey: waiting.publicKey })
    await submitBallot(api, opened, voter, prepareBallot(opened, voter, 0))
    const result = await api.removeEligible(election.id, '5040312170018\n6050101400015\n1960101400011\n2900101400014\n123')
    assert.deepEqual({ ...result, invalid: result.invalid.length }, { removed: 2, registrationsRemoved: 1, notFound: 1, voted: 1, invalid: 1 })
    assert.deepEqual((await api.getElection(election.id)).stats, { eligible: 1, registered: 1, ballots: 1 })
    await assert.rejects(submitBallot(api, opened, waiting, prepareBallot(opened, waiting, 1)), status(403))
    await api.closeElection(election.id)
    await assert.rejects(api.removeEligible(election.id, '5040312170018'), status(409))
  })

  it('scrutinul „doar NFC”: OCR-ul refuzat, NFC acceptat, alegătorii simulați trec prin NFC', { timeout: 60_000 }, async () => {
    const { client: api, tools } = createMockBackend({ latency: false, seedVoters: { open: 1, tallied: 1 } })
    const { election } = await api.createElection(input({ requireNfc: true }))
    assert.equal(election.requireNfc, true)
    await tools.simulateTrusteeKeys(election.id)
    await api.importEligible(election.id, '5040312170018\n6050101400015\n1960101400011')
    await api.openElection(election.id)
    await assert.rejects(api.registerOcr(election.id, { cnp: '5040312170018', credentialPubkey: generateCredential().publicKey }), status(403))
    const dg1 = dg1FromMrz(buildTd1({ surname: 'Ion', givenNames: 'Ana', documentNumber: 'GL1', cnp: '6050101400015', sex: 'F', expiry: '330101' }))
    const reg = await api.registerNfc(election.id, { dg1: bytesToBase64(dg1), sod: '', credentialPubkey: generateCredential().publicKey })
    assert.equal(reg.trustLevel, 'criptografic')
    assert.equal(await tools.simulateVoters(election.id, 2), 2)
    const regs = await api.getRegistrations(election.id)
    assert.equal(regs.length, 3)
    assert.ok(regs.every((r) => r.method === 'nfc'))
  })

  it('votul e refuzat în afara intervalului, iar la closesAt serverul închide singur', { timeout: 60_000 }, async () => {
    const { client: api, tools } = createMockBackend({ latency: false, seedVoters: { open: 1, tallied: 1 } })
    const { election } = await api.createElection(input({ closesAt: new Date(Date.now() + 1200).toISOString() }))
    await tools.simulateTrusteeKeys(election.id)
    await api.importEligible(election.id, '5040312170018')
    const opened = await api.openElection(election.id)
    const v = generateCredential()
    await api.registerOcr(election.id, { cnp: '5040312170018', credentialPubkey: v.publicKey })
    await sleep(1400)
    await assert.rejects(submitBallot(api, opened, v, prepareBallot(opened, v, 0)), status(409))
    assert.equal((await api.getElection(election.id)).status, 'closed')
    const log = await api.getAuditLog(election.id)
    assert.ok(log.some((x) => x.action === 'election.close' && x.actor === 'server'))

    // un scrutin cu data închiderii trecută nu se poate deschide
    const { election: late } = await api.createElection(
      input({ opensAt: new Date(Date.now() - 2 * HOUR).toISOString(), closesAt: new Date(Date.now() - HOUR).toISOString() }),
    )
    await tools.simulateTrusteeKeys(late.id)
    await api.importEligible(late.id, '5040312170018')
    await assert.rejects(api.openElection(late.id), /a trecut/)
  })

  it('uneltele de test: alegători simulați, CNP propriu adăugat, membrii comisiei', { timeout: 120_000 }, async () => {
    const { client: api, tools } = createMockBackend({ latency: false, seedVoters: { open: 1, tallied: 1 } })
    const before = (await api.getElection('consiliu-aciee-2026')).stats.ballots
    assert.equal(await tools.simulateVoters('consiliu-aciee-2026', 2), 2)
    assert.equal((await api.getElection('consiliu-aciee-2026')).stats.ballots, before + 2)
    const page = await api.getBoardPage('consiliu-aciee-2026', 1, 2)
    assert.equal(page.entries.length, 2)
    assert.equal(page.total, before + 2)
    assert.equal(page.entries[0].seq, before + 2)

    const mine = generateCredential()
    await assert.rejects(api.registerOcr('consiliu-aciee-2026', { cnp: '2970214460012', credentialPubkey: mine.publicKey }), status(403))
    await tools.addEligibleCnp('consiliu-aciee-2026', '2970214460012')
    const reg = await api.registerOcr('consiliu-aciee-2026', { cnp: '2970214460012', credentialPubkey: mine.publicKey })
    assert.equal(reg.method, 'ocr')

    assert.equal((await api.checkAdmin()).role, 'comisie')
    const member = await api.createMember({ name: 'Observator ONG', role: 'observator' })
    assert.ok(member.token)
    assert.equal((await api.listMembers()).length, 1)
    await api.revokeMember(member.id)
    assert.ok((await api.listMembers())[0].revokedAt)
  })
})
