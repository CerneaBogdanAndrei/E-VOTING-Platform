import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  auditBallot,
  ballotDigest,
  ballotSignatureMessage,
  encrypt,
  encryptBallot,
  generateCredential,
  signMessage,
  verifyBallot,
  verifySignature,
  type ElectionParams,
} from '../src/index.js'
import { clone, forgeBallot, testKey } from './helpers.js'

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

  it('o opțiune în afara listei de candidați e refuzată la criptare', () => {
    const cred = generateCredential()
    assert.throws(() => encryptBallot(params, 3, cred.secretKey, cred.publicKey))
    assert.throws(() => encryptBallot(params, -1, cred.secretKey, cred.publicKey))
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

  it('un buletin cu numărul greșit de criptotexte sau cu dovezi lipsă e respins la formă', () => {
    const cred = generateCredential()
    const { ballot } = encryptBallot(params, 0, cred.secretKey, cred.publicKey)
    const short = clone(ballot)
    short.ciphertexts.pop()
    assert.match((verifyBallot(params, short) as { reason: string }).reason, /criptotexte/)
    const noProofs = clone(ballot)
    noProofs.proofs.choices.pop()
    assert.match((verifyBallot(params, noProofs) as { reason: string }).reason, /incomplete/)
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
