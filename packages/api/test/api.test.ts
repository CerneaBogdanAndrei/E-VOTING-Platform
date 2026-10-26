import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generateCredential, verifyElection } from '@evoting/crypto'
import {
  authenticate,
  buildTd1,
  buildTd2,
  checkCnp,
  createMockBackend,
  dg1FromMrz,
  bytesToBase64,
  generateCnp,
  mrzCheckDigit,
  mrzFromDg1,
  parseMrz,
  prepareBallot,
  submitBallot,
  verifyOwnBallot,
  ApiError,
} from '../src/index.js'

const NOW = new Date('2026-10-26T12:00:00Z')

describe('CNP', () => {
  it('validează cifra de control și data', () => {
    assert.deepEqual(checkCnp('1960101400011'), { ok: true })
    assert.equal(checkCnp('1960101400017').ok, false)
    assert.equal(checkCnp('1961301400011').ok, false)
  })

  it('generatorul produce doar CNP-uri valide', () => {
    let seed = 1
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 200; i++) assert.ok(checkCnp(generateCnp(rand)).ok)
  })
})

describe('MRZ', () => {
  it('cifra de control ICAO pe exemplele din documentul 9303', () => {
    assert.equal(mrzCheckDigit('D23145890'), 7)
    assert.equal(mrzCheckDigit('740812'), 2)
    assert.equal(mrzCheckDigit('120415'), 9)
  })

  it('exemplul ICAO TD1 trece toate cifrele de control', () => {
    const mrz = parseMrz('I<UTOD231458907<<<<<<<<<<<<<<<\n7408122F1204159UTO<<<<<<<<<<<6\nERIKSSON<<ANNA<MARIA<<<<<<<<<<', NOW)!
    assert.equal(mrz.format, 'TD1')
    assert.equal(mrz.valid, true)
    assert.equal(mrz.surname, 'ERIKSSON')
    assert.equal(mrz.givenNames, 'ANNA MARIA')
    assert.equal(mrz.birthDate, '1974-08-12')
    assert.equal(mrz.documentNumber, 'D23145890')
  })

  it('exemplul ICAO TD2 trece toate cifrele de control', () => {
    const mrz = parseMrz('I<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<\nD231458907UTO7408122F1204159<<<<<<<6', NOW)!
    assert.equal(mrz.format, 'TD2')
    assert.equal(mrz.valid, true)
    assert.equal(mrz.expiryDate, '2012-04-15')
    assert.equal(mrz.expired, true)
  })

  const person = { surname: 'Popescu', givenNames: 'Andrei Mihai', documentNumber: 'GL123456', cnp: '5040312170018', sex: 'M' as const, expiry: '310428' }

  it('buletinul vechi (TD2): CNP-ul se reconstituie din prima cifră, data nașterii și ultimele șase cifre', () => {
    const text = buildTd2(person)
    assert.equal(text.split('\n')[1].length, 36)
    const mrz = parseMrz(text, NOW)!
    assert.equal(mrz.valid, true)
    assert.equal(mrz.cnp, person.cnp)
    assert.equal(mrz.surname, 'POPESCU')
    assert.equal(mrz.expired, false)
  })

  it('CEI (TD1): CNP-ul din câmpul opțional', () => {
    const mrz = parseMrz(buildTd1(person), NOW)!
    assert.equal(mrz.format, 'TD1')
    assert.equal(mrz.valid, true)
    assert.equal(mrz.cnp, person.cnp)
  })

  it('textul OCR cu zgomot și confuzii O/0 se citește, iar o cifră greșită e prinsă', () => {
    const [l1, l2] = buildTd2(person).split('\n')
    const mrz = parseMrz(`ROMANIA CARTE DE IDENTITATE\n${l1.replace(/<</, '« ')}\n${l2.replace(/0/, 'O')}`, NOW)
    assert.ok(mrz)
    assert.equal(mrz!.cnp, person.cnp)
    const broken = l2.slice(0, 15) + ((Number(l2[15]) + 1) % 10) + l2.slice(16)
    assert.equal(parseMrz(`${l1}\n${broken}`, NOW)!.valid, false)
  })

  it('DG1 împachetează și despachetează MRZ-ul', () => {
    const text = buildTd1(person)
    assert.equal(mrzFromDg1(dg1FromMrz(text)), text)
  })
})

describe('backend-ul simulat, cu criptografie reală', () => {
  it('scrutin complet: chei, înregistrare, vot, numărare, verificare publică', { timeout: 120_000 }, async () => {
    const { client: api, tools } = createMockBackend({ latency: false, seedVoters: { open: 2, tallied: 3 } })
    const { election, trusteeTokens } = await api.createElection({
      title: 'Test',
      opensAt: '2026-11-01T08:00:00Z',
      closesAt: '2026-11-02T18:00:00Z',
      candidates: [
        { name: 'A', description: '' },
        { name: 'B', description: '' },
      ],
      trustees: [{ name: 'T1' }, { name: 'T2' }],
    })
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
    await assert.rejects(api.registerOcr(election.id, { cnp: '5040312170018', credentialPubkey: generateCredential().publicKey }), /deja/)
    await assert.rejects(api.registerOcr(election.id, { cnp: '1960101400021', credentialPubkey: generateCredential().publicKey }))
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
    await assert.rejects(api.castBallot(election.id, prepareBallot(opened, carol, 0).ballot, tokenAlice), (e: unknown) => e instanceof ApiError && e.status === 403)

    await api.closeElection(election.id)
    await tools.simulateTally(election.id)
    const result = await api.getResult(election.id)
    assert.deepEqual(result.counts.map((c) => c.votes), [0, 2])

    const bundle = await api.getAuditBundle(election.id)
    const report = await verifyElection({
      election: { ...bundle.election, trustees: bundle.election.trustees.map((t) => ({ ...t })) },
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
})
