// Buletinul de vot: criptarea vectorului de opțiuni, dovezile, semnătura,
// codul de urmărire și provocarea Benaloh.

import { ballotMessage, signMessage, verifySignature } from './credential.js'
import { allowedCounts, type ElectionParams } from './election.js'
import { addCiphertexts, ciphertextFromJson, ciphertextToJson, encrypt, type Ciphertext, type CiphertextPoints } from './elgamal.js'
import { mod, pointFromHex, preparedPoint, randomScalar, scalarFromHex, scalarToHex, type Hex } from './group.js'
import { sha256Hex } from './hash.js'
import { proveOneOf, verifyOneOf, type DisjunctiveProof } from './proofs.js'

export interface BallotProofs {
  /** Pentru fiecare candidat: criptotextul conține 0 sau 1. */
  selections: DisjunctiveProof[]
  /** Suma criptotextelor conține un număr între minSelections și maxSelections. */
  count: DisjunctiveProof
}

export interface BallotBody {
  electionId: string
  credentialPubkey: Hex
  ciphertexts: Ciphertext[]
  proofs: BallotProofs
}

export interface Ballot extends BallotBody {
  /** Semnătura Ed25519 a credentialului peste codul de urmărire. */
  signature: Hex
}

/** Ce știe doar telefonul: opțiunile și valorile aleatoare. Se dezvăluie doar la provocarea Benaloh. */
export interface BallotSecrets {
  plaintexts: number[]
  randomness: Hex[]
}

export interface EncryptedBallot {
  body: BallotBody
  trackingCode: Hex
  secrets: BallotSecrets
}

const selectionContext = (b: Pick<BallotBody, 'electionId' | 'credentialPubkey'>, i: number) => ['sel', b.electionId, b.credentialPubkey, i]
const countContext = (b: Pick<BallotBody, 'electionId' | 'credentialPubkey'>) => ['count', b.electionId, b.credentialPubkey]

/**
 * Criptează un vector de valori (câte una per candidat) și construiește dovezile.
 * Un client corect trimite doar 0/1, cu numărul de 1 permis de scrutin; pentru alte
 * valori (demonstrațiile de atac) dovezile se construiesc „cum se poate” și pică.
 */
export function encryptVector(params: ElectionParams, credentialPubkey: Hex, plaintexts: number[]): EncryptedBallot {
  const Y = preparedPoint(params.publicKey)
  const randomness = plaintexts.map(() => randomScalar())
  const cts = plaintexts.map((m, i) => encrypt(Y, m, randomness[i]))
  const who = { electionId: params.electionId, credentialPubkey }
  const selections = cts.map((ct, i) => proveOneOf(Y, ct, plaintexts[i], randomness[i], [0, 1], selectionContext(who, i)))
  const total = plaintexts.reduce((s, m) => s + m, 0)
  const R = mod(randomness.reduce((s, r) => s + r, 0n))
  const count = proveOneOf(Y, addCiphertexts(cts), total, R, allowedCounts(params), countContext(who))
  const body: BallotBody = { ...who, ciphertexts: cts.map(ciphertextToJson), proofs: { selections, count } }
  return { body, trackingCode: ballotHash(body), secrets: { plaintexts: [...plaintexts], randomness: randomness.map(scalarToHex) } }
}

/** Buletinul pentru o alegere: `choices` sunt pozițiile candidaților bifați. */
export function encryptBallot(params: ElectionParams, credentialPubkey: Hex, choices: number[] | number): EncryptedBallot {
  const picked = new Set(Array.isArray(choices) ? choices : [choices])
  return encryptVector(
    params,
    credentialPubkey,
    params.candidates.map((_, i) => (picked.has(i) ? 1 : 0)),
  )
}

export function signBallot(body: BallotBody, credentialSecretKey: Hex): Ballot {
  return { ...body, signature: signMessage(credentialSecretKey, ballotMessage(body.electionId, ballotHash(body))) }
}

/**
 * Codul de urmărire = SHA-256 peste forma canonică a buletinului (fără semnătură).
 * Telefonul îl cunoaște înainte de trimitere, deci serverul nu-l poate „alege”.
 */
export function ballotHash(body: BallotBody): Hex {
  return sha256Hex(
    JSON.stringify([
      'evoting/v1/ballot',
      body.electionId,
      body.credentialPubkey,
      body.ciphertexts.map((c) => [c.a, c.b]),
      body.proofs.selections.map((p) => [p.c, p.z]),
      [body.proofs.count.c, body.proofs.count.z],
    ]),
  )
}

export interface BallotCheck {
  ok: boolean
  /** Probleme găsite, în limbaj natural, cu locul exact. */
  problems: string[]
}

/** Verifică structura, semnătura și toate dovezile unui buletin. */
export function verifyBallot(params: ElectionParams, ballot: Ballot, { checkSignature = true } = {}): BallotCheck {
  const problems: string[] = []
  const k = params.candidates.length
  try {
    if (ballot?.electionId !== params.electionId) return { ok: false, problems: ['buletinul aparține altui scrutin'] }
    if (!Array.isArray(ballot.ciphertexts) || ballot.ciphertexts.length !== k) {
      return { ok: false, problems: [`buletinul trebuie să conțină ${k} criptotexte`] }
    }
    if (!Array.isArray(ballot.proofs?.selections) || ballot.proofs.selections.length !== k || !ballot.proofs.count) {
      return { ok: false, problems: [`buletinul trebuie să conțină ${k} dovezi „0 sau 1” și dovada numărului de opțiuni`] }
    }
    const Y = preparedPoint(params.publicKey)
    let cts: CiphertextPoints[]
    try {
      cts = ballot.ciphertexts.map(ciphertextFromJson)
    } catch {
      return { ok: false, problems: ['un criptotext nu e un element valid al grupului'] }
    }
    cts.forEach((ct, i) => {
      if (!safe(() => verifyOneOf(Y, ct, ballot.proofs.selections[i], [0, 1], selectionContext(ballot, i)))) {
        problems.push(`${params.candidates[i] ?? `candidatul ${i + 1}`}: dovada „0 sau 1” nu se verifică`)
      }
    })
    if (!safe(() => verifyOneOf(Y, addCiphertexts(cts), ballot.proofs.count, allowedCounts(params), countContext(ballot)))) {
      const range = params.minSelections === params.maxSelections ? `exact ${params.minSelections}` : `între ${params.minSelections} și ${params.maxSelections}`
      problems.push(`dovada că s-au bifat ${range} opțiuni nu se verifică`)
    }
    if (checkSignature && !verifySignature(ballot.credentialPubkey, ballotMessage(ballot.electionId, ballotHash(ballot)), ballot.signature)) {
      problems.push('semnătura credentialului nu se verifică')
    }
  } catch {
    problems.push('buletin în format greșit')
  }
  return { ok: problems.length === 0, problems }
}

function safe(fn: () => boolean): boolean {
  try {
    return fn()
  } catch {
    return false
  }
}

// ───────────── Provocarea Benaloh ─────────────
// Înainte de trimitere, alegătorul poate cere „verifică buletinul”: aplicația
// dezvăluie opțiunile și valorile r, iar oricine recalculează criptotextele.
// Un buletin auditat e „ars”: se aruncă și se recriptează cu valori r noi.

export interface BenalohAudit {
  electionId: string
  publicKey: Hex
  candidates: string[]
  trackingCode: Hex
  ciphertexts: Ciphertext[]
  plaintexts: number[]
  randomness: Hex[]
}

export function createAudit(params: ElectionParams, encrypted: EncryptedBallot): BenalohAudit {
  return {
    electionId: params.electionId,
    publicKey: params.publicKey,
    candidates: [...params.candidates],
    trackingCode: encrypted.trackingCode,
    ciphertexts: encrypted.body.ciphertexts,
    plaintexts: encrypted.secrets.plaintexts,
    randomness: encrypted.secrets.randomness,
  }
}

export interface AuditResult {
  ok: boolean
  /** Candidații pentru care s-a criptat 1. */
  selected: string[]
  problems: string[]
}

/** Verificatorul independent al provocării Benaloh: nu are nevoie de nimic secret în afară de ce dezvăluie auditul. */
export function verifyAudit(audit: BenalohAudit): AuditResult {
  const problems: string[] = []
  try {
    const Y = pointFromHex(audit.publicKey)
    audit.ciphertexts.forEach((ct, i) => {
      const expected = ciphertextToJson(encrypt(Y, audit.plaintexts[i], scalarFromHex(audit.randomness[i])))
      if (expected.a !== ct.a || expected.b !== ct.b) {
        problems.push(`${audit.candidates[i] ?? `poziția ${i + 1}`}: criptotextul NU corespunde opțiunii declarate`)
      }
    })
  } catch {
    problems.push('auditul are un format greșit')
  }
  return {
    ok: problems.length === 0,
    selected: audit.candidates.filter((_, i) => audit.plaintexts[i] === 1),
    problems,
  }
}
