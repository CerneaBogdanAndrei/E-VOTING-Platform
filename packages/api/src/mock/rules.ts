// Regulile serverului, aplicate pe starea din memorie: aceleași verificări și
// aceleași mesaje ca în apps/backend, cu criptografia reală din @evoting/crypto.

import {
  appendEntry,
  combinePartialDecryptions,
  combinePublicKeys,
  computeAggregate,
  generateCredential,
  generateTrusteeKey,
  isCredentialPubkey,
  partialDecrypt,
  verifyBallot,
  verifyPartialDecryption,
  verifyTrusteeKey,
  type Ballot,
  type PartialDecryption,
} from '@evoting/crypto'
import {
  ApiError,
  type EligibleImportResult,
  type Registration,
  type RegistrationMethod,
  type TrustLevel,
  type UpdateElectionInput,
} from '../contract/index.js'
import { plural } from '../format.js'
import { isValidCnp } from '../identity/cnp.js'
import { electionParams, prepareBallot } from '../voter.js'
import { pickWeighted } from './random.js'
import { buildCandidates, type ElectionState, type MockContext } from './state.js'

const TRUST_RANK: Record<TrustLevel, number> = { optic: 1, criptografic: 2 }

// ───────────── scrutinul (comisia) ─────────────

export function validateInterval(opensAt: string, closesAt: string) {
  if (!(new Date(closesAt) > new Date(opensAt))) throw new ApiError(400, 'Închiderea trebuie să fie după deschidere')
}

/** Doar în `draft`: titlul, intervalul, candidații și votul alb. Trustees rămân (au token-uri emise). */
export function updateElection(ctx: MockContext, s: ElectionState, input: UpdateElectionInput) {
  if (s.data.status !== 'draft') throw new ApiError(409, 'Scrutinul se poate modifica doar în configurare')
  const title = input.title ?? s.data.title
  if (!title.trim()) throw new ApiError(400, 'Titlul este obligatoriu')
  const opensAt = input.opensAt ?? s.data.opensAt
  const closesAt = input.closesAt ?? s.data.closesAt
  validateInterval(opensAt, closesAt)
  if (input.candidates || input.allowBlank !== undefined) {
    const candidates = input.candidates ?? s.data.candidates.filter((c) => c.kind === 'candidate').map((c) => ({ name: c.name, description: c.description }))
    if (candidates.length < 2) throw new ApiError(400, 'Sunt necesari cel puțin doi candidați')
    const allowBlank = input.allowBlank ?? s.data.candidates.some((c) => c.kind === 'blank')
    s.data.candidates = buildCandidates(s.data.id, candidates, allowBlank)
  }
  s.data.title = title
  s.data.opensAt = opensAt
  s.data.closesAt = closesAt
  ctx.log(s, 'comisie', 'election.update', { title, candidates: s.data.candidates.length })
}

export function deleteElection(ctx: MockContext, s: ElectionState) {
  if (s.data.status !== 'draft') throw new ApiError(409, 'Se pot șterge doar scrutinele în configurare')
  ctx.store.delete(s.data.id)
}

export function openElection(ctx: MockContext, s: ElectionState, now = Date.now()) {
  if (s.data.status !== 'draft') throw new ApiError(409, 'Scrutinul nu este în configurare')
  const missing = s.data.trustees.filter((t) => !t.publicKeyShare).length
  if (missing > 0) throw new ApiError(409, missing === 1 ? 'Lipsește cheia unui trustee' : `Lipsesc cheile de la ${plural(missing, 'trustee', 'trustees')}`)
  if (s.eligible.size === 0) throw new ApiError(409, 'Lista alegătorilor eligibili este goală')
  if (new Date(s.data.closesAt).getTime() <= now) throw new ApiError(409, 'Data închiderii a trecut deja; modifică intervalul scrutinului')
  s.data.status = 'open'
  ctx.log(s, 'comisie', 'election.open')
}

/** Ce face serverul la closesAt, fără intervenția comisiei. */
export function autoClose(ctx: MockContext, now = Date.now()) {
  for (const s of ctx.store.values()) {
    if (s.data.status === 'open' && new Date(s.data.closesAt).getTime() <= now) {
      close(s)
      ctx.log(s, 'server', 'election.close', { ballots: s.board.length, automatic: true })
    }
  }
}

// ───────────── trustees ─────────────

export function submitKey(ctx: MockContext, s: ElectionState, trusteeId: string, publicKeyShare: string, proof: { c: string; s: string }) {
  if (s.data.status !== 'draft') throw new ApiError(409, 'Cheile se trimit doar în configurare')
  const t = s.data.trustees.find((x) => x.id === trusteeId)!
  if (t.publicKeyShare) throw new ApiError(409, 'Trustee-ul și-a trimis deja cheia')
  if (!verifyTrusteeKey(s.data.id, { trusteeId, publicKeyShare, proof })) throw new ApiError(400, 'Dovada Schnorr a cheii nu e validă')
  t.publicKeyShare = publicKeyShare
  t.keyProof = proof
  if (s.data.trustees.every((x) => x.publicKeyShare)) s.data.publicKey = combinePublicKeys(s.data.trustees.map((x) => x.publicKeyShare!))
  ctx.log(s, `trustee:${trusteeId}`, 'trustee.key', { publicKeyShare })
}

/** Trustees fără cheie își generează xᵢ aici, în locul CLI-ului; cheia secretă rămâne în simulator. */
export function simulateKeys(ctx: MockContext, s: ElectionState) {
  for (const t of s.data.trustees) {
    if (t.publicKeyShare) continue
    const { keyPair, publicKey } = generateTrusteeKey(s.data.id, t.id)
    s.trusteeSecrets.set(t.id, keyPair)
    submitKey(ctx, s, t.id, publicKey.publicKeyShare, publicKey.proof)
  }
}

export function trusteeForToken(s: ElectionState, token: string) {
  for (const [trusteeId, t] of s.trusteeTokens) if (t === token) return s.data.trustees.find((x) => x.id === trusteeId)!
  throw new ApiError(401, 'Token de trustee invalid')
}

// ───────────── eligibili și înregistrare ─────────────

export function addEligible(ctx: MockContext, s: ElectionState, cnps: string[]) {
  for (const cnp of cnps) {
    const h = ctx.hmac(cnp)
    if (!s.eligible.has(h)) {
      s.eligible.add(h)
      s.testCnps.push(cnp)
    }
  }
}

/** CSV cu un CNP pe linie, ca la serverul real: se păstrează HMAC-ul (și, doar aici, CNP-ul pentru uneltele de test). */
export function importCsv(ctx: MockContext, s: ElectionState, csv: string): EligibleImportResult {
  if (s.data.status !== 'draft' && s.data.status !== 'open') throw new ApiError(409, 'Lista se poate completa doar înainte de închiderea votului')
  const result: EligibleImportResult = { imported: 0, duplicates: 0, invalid: [] }
  for (const [i, raw] of csv.split(/\r?\n/).entries()) {
    const value = raw.split(/[,;]/)[0].trim().replace(/^"|"$/g, '')
    if (!value || (i === 0 && /^cnp$/i.test(value))) continue
    if (!isValidCnp(value)) {
      result.invalid.push({ line: i + 1, value })
      continue
    }
    const h = ctx.hmac(value)
    if (s.eligible.has(h)) {
      result.duplicates++
      continue
    }
    s.eligible.add(h)
    s.testCnps.push(value)
    result.imported++
  }
  ctx.log(s, 'comisie', 'eligible.import', { imported: result.imported, duplicates: result.duplicates, invalid: result.invalid.length })
  return result
}

/**
 * Înregistrarea. Dacă persoana e deja înregistrată și n-a votat, credentialul vechi se înlocuiește
 * (de exemplu după schimbarea telefonului), dar doar cu același nivel de încredere sau mai mare.
 */
export function register(ctx: MockContext, s: ElectionState, cnp: string, credentialPubkey: string, method: RegistrationMethod): Registration {
  if (s.data.status !== 'draft' && s.data.status !== 'open') throw new ApiError(409, 'Înregistrarea s-a închis pentru acest scrutin')
  if (!isValidCnp(cnp)) throw new ApiError(400, 'CNP invalid')
  if (!isCredentialPubkey(credentialPubkey)) throw new ApiError(400, 'Cheia de credential nu e o cheie Ed25519 validă')
  const h = ctx.hmac(cnp)
  if (!s.eligible.has(h)) throw new ApiError(403, 'CNP-ul nu figurează în lista alegătorilor eligibili')
  if (s.registrations.has(credentialPubkey)) throw new ApiError(409, 'Credentialul este deja folosit')
  const trustLevel: TrustLevel = method === 'nfc' ? 'criptografic' : 'optic'
  let replacedPrevious = false
  const previous = s.registeredHmacs.get(h)
  if (previous) {
    if (s.board.some((e) => e.credentialPubkey === previous)) throw new ApiError(409, 'Persoana a votat deja; credentialul nu mai poate fi înlocuit')
    const old = s.registrations.get(previous)!
    if (TRUST_RANK[trustLevel] < TRUST_RANK[old.trustLevel]) {
      throw new ApiError(409, 'Înregistrarea existentă are un nivel de încredere mai mare (NFC); reînregistrează-te tot prin NFC')
    }
    s.registrations.delete(previous)
    replacedPrevious = true
  }
  const registration: Registration = { electionId: s.data.id, credentialPubkey, method, trustLevel, registeredAt: new Date().toISOString() }
  s.registeredHmacs.set(h, credentialPubkey)
  s.registrations.set(credentialPubkey, registration)
  ctx.log(s, 'alegător', replacedPrevious ? 'voter.reregister' : 'voter.register', { credentialPubkey, method })
  return replacedPrevious ? { ...registration, replacedPrevious } : registration
}

/** Un CNP eligibil, încă neînregistrat, sau null. */
export const freshCnp = (ctx: MockContext, s: ElectionState) => s.testCnps.find((cnp) => !s.registeredHmacs.has(ctx.hmac(cnp))) ?? null

// ───────────── votul ─────────────

export function cast(ctx: MockContext, s: ElectionState, ballot: Ballot, receivedAt = new Date().toISOString(), verify = true) {
  if (s.data.status !== 'open') throw new ApiError(409, 'Scrutinul nu este deschis')
  const t = new Date(receivedAt).getTime()
  if (t < new Date(s.data.opensAt).getTime()) throw new ApiError(409, 'Votul nu a început încă')
  if (t > new Date(s.data.closesAt).getTime()) throw new ApiError(409, 'Votul s-a încheiat')
  if (!s.registrations.has(ballot.credentialPubkey)) throw new ApiError(403, 'Credential neînregistrat la acest scrutin')
  if (s.board.some((e) => e.credentialPubkey === ballot.credentialPubkey)) throw new ApiError(409, 'Acest credential a votat deja')
  if (verify) {
    const check = verifyBallot(electionParams(ctx.snapshot(s)), ballot)
    if (!check.ok) throw new ApiError(400, `Buletin respins: ${check.reason}`)
  }
  const entry = appendEntry(s.data.id, s.board.at(-1), ballot, receivedAt)
  s.board.push(entry)
  return entry
}

/** Înregistrează și votează alegători sintetici (pentru scrutinele de demonstrație). Întoarce câți au votat. */
export function voteRandomly(ctx: MockContext, s: ElectionState, count: number, weights: number[], start?: Date, spanMs = 0, verify = true) {
  let done = 0
  const election = ctx.snapshot(s)
  for (const cnp of s.testCnps) {
    if (done >= count) break
    if (s.registeredHmacs.has(ctx.hmac(cnp))) continue
    const cred = generateCredential()
    register(ctx, s, cnp, cred.publicKey, ctx.rand() < 0.35 ? 'nfc' : 'ocr')
    const { ballot } = prepareBallot(election, cred, pickWeighted(ctx.rand, weights))
    const at = start ? new Date(start.getTime() + (spanMs * (done + 1)) / (count + 1)).toISOString() : undefined
    cast(ctx, s, ballot, at, verify)
    done++
  }
  return done
}

// ───────────── numărarea ─────────────

export function close(s: ElectionState) {
  s.data.status = 'closed'
  s.aggregate = computeAggregate(s.data.candidates.length, s.board)
}

export function submitPartial(ctx: MockContext, s: ElectionState, trusteeId: string, partial: PartialDecryption) {
  if (s.data.status !== 'closed' || !s.aggregate) throw new ApiError(409, 'Decriptarea se face după închiderea votului')
  const t = s.data.trustees.find((x) => x.id === trusteeId)!
  if (t.partialDecryptionSubmitted) throw new ApiError(409, 'Decriptarea parțială a fost deja trimisă')
  const check = verifyPartialDecryption(s.data.id, t.publicKeyShare!, s.aggregate, { ...partial, trusteeId })
  if (!check.ok) throw new ApiError(400, `Decriptare respinsă: ${check.reason}`)
  s.partials.set(trusteeId, { ...partial, trusteeId })
  t.partialDecryptionSubmitted = true
  ctx.log(s, `trustee:${trusteeId}`, 'tally.partial')
  if (s.data.trustees.every((x) => x.partialDecryptionSubmitted)) {
    const ordered = s.data.trustees.map((x) => s.partials.get(x.id)!)
    const counts = combinePartialDecryptions(s.aggregate, ordered, s.board.length)
    s.result = {
      electionId: s.data.id,
      counts: s.data.candidates.map((c) => ({ candidateId: c.id, votes: counts[c.position] })),
      totalBallots: s.board.length,
      publishedAt: new Date().toISOString(),
    }
    s.data.status = 'tallied'
    ctx.log(s, 'server', 'tally.result', { counts })
  }
}

/** Trustees cu cheia în simulator trimit decriptările parțiale, în locul CLI-ului. */
export function simulateTallyNow(ctx: MockContext, s: ElectionState) {
  for (const t of s.data.trustees) {
    if (t.partialDecryptionSubmitted) continue
    const key = s.trusteeSecrets.get(t.id)
    if (!key) throw new ApiError(409, `Cheia secretă a lui ${t.name} nu e în simulator (a fost generată cu CLI-ul)`)
    submitPartial(ctx, s, t.id, partialDecrypt(key, s.aggregate!))
  }
}
