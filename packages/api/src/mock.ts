// Backend simulat în memorie, cu aceleași reguli ca API-ul real, ca interfața
// să poată fi folosită fără server. Criptografia e cea reală (@evoting/crypto):
// buletinele au dovezi verificate, iar rezultatul vine din decriptarea parțială
// a agregatului. Se pierde la reîncărcare.

import {
  appendEntry,
  authMessage,
  bytesToHex,
  cnpHmac,
  combinePartialDecryptions,
  combinePublicKeys,
  computeAggregate,
  generateCredential,
  generateTrusteeKey,
  genesisHash,
  isCredentialPubkey,
  normalizeTrackingCode,
  partialDecrypt,
  verifyBallot,
  verifyPartialDecryption,
  verifySignature,
  verifyTrusteeKey,
  type Ballot,
  type BoardEntry,
  type Ciphertext,
  type PartialDecryption,
  type TrusteeKeyPair,
} from '@evoting/crypto'
import { generateCnp, isValidCnp } from './cnp.js'
import { base64ToBytes, mrzFromDg1 } from './dg1.js'
import { buildTd1, buildTd2, parseMrz } from './mrz.js'
import {
  ApiError,
  type ApiClient,
  type AuditLogEntry,
  type CreateElectionInput,
  type Election,
  type ElectionResult,
  type Registration,
  type RegistrationMethod,
  type TrusteeToken,
} from './types.js'
import { authenticate, electionParams, prepareBallot } from './voter.js'

interface ElectionState {
  data: Omit<Election, 'stats'>
  trusteeTokens: Map<string, string>
  /** Doar în mock: cheile secrete ale trustees, ca uneltele de test să țină locul CLI-ului. */
  trusteeSecrets: Map<string, TrusteeKeyPair>
  /** HMAC(CNP) al eligibililor, ca în tabela eligible_voters. */
  eligible: Set<string>
  registeredHmacs: Set<string>
  registrations: Map<string, Registration>
  board: BoardEntry[]
  aggregate: Ciphertext[] | null
  partials: Map<string, PartialDecryption>
  result: ElectionResult | null
  audit: AuditLogEntry[]
  /** Doar în mock: CNP-uri eligibile în clar, pentru uneltele de test. */
  testCnps: string[]
}

export interface MockTools {
  /** Un CNP eligibil, încă neînregistrat, sau null. */
  sampleCnp(electionId: string): Promise<string | null>
  /** MRZ-ul unui buletin de test pentru un CNP eligibil neînregistrat. */
  sampleMrz(electionId: string, format: 'TD1' | 'TD2'): Promise<string | null>
  /** Trustees fără cheie își generează și trimit Yᵢ (în locul CLI-ului). */
  simulateTrusteeKeys(electionId: string): Promise<Election>
  /** Înregistrează și votează n alegători aleatori, cu buletine criptate reale. Întoarce câți au votat. */
  simulateVoters(electionId: string, n: number): Promise<number>
  /** Trustees trimit decriptările parțiale, iar rezultatul se publică. */
  simulateTally(electionId: string): Promise<Election>
}

const randomToken = () => bytesToHex(crypto.getRandomValues(new Uint8Array(24)))
const delay = (ms = 80 + Math.random() * 120) => new Promise((r) => setTimeout(r, ms))
// structuredClone lipsește în Hermes (React Native).
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface MockOptions {
  /** Câți alegători votează în scrutinele de demonstrație. Pe telefon, mai puțini (criptarea e mai lentă). */
  seedVoters?: { open: number; tallied: number }
  latency?: boolean
}

export function createMockBackend(options: MockOptions = {}): { client: ApiClient; tools: MockTools } {
  const store = new Map<string, ElectionState>()
  const challenges = new Map<string, { electionId: string; credentialPubkey: string; nonce: string; expiresAt: number }>()
  const sessions = new Map<string, { electionId: string; credentialPubkey: string; expiresAt: number }>()
  const hmacKey = randomToken() + randomToken().slice(0, 16)
  const rand = mulberry32(2026)
  let auditId = 0
  const seedVoters = options.seedVoters ?? { open: 6, tallied: 12 }

  const hmac = (cnp: string) => cnpHmac(hmacKey, cnp)

  function snapshot(s: ElectionState): Election {
    return clone({
      ...s.data,
      stats: { eligible: s.eligible.size, registered: s.registrations.size, ballots: s.board.length },
    })
  }

  function get(id: string): ElectionState {
    const s = store.get(id)
    if (!s) throw new ApiError(404, 'Scrutinul nu există')
    return s
  }

  function log(s: ElectionState, actor: string, action: string, payload: unknown = null) {
    s.audit.push({ id: ++auditId, actor, action, payload, createdAt: new Date().toISOString() })
  }

  function trusteeFor(s: ElectionState, token: string) {
    for (const [trusteeId, t] of s.trusteeTokens) if (t === token) return s.data.trustees.find((x) => x.id === trusteeId)!
    throw new ApiError(401, 'Token de trustee invalid')
  }

  function newState(input: CreateElectionInput, id = `scr-${randomToken().slice(0, 6)}`): { state: ElectionState; tokens: TrusteeToken[] } {
    const state: ElectionState = {
      data: {
        id,
        title: input.title,
        status: 'draft',
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        publicKey: null,
        candidates: input.candidates.map((c, i) => ({ id: `${id}-c${i + 1}`, name: c.name, description: c.description, position: i })),
        trustees: input.trustees.map((t, i) => ({
          id: `${id}-t${i + 1}`,
          name: t.name,
          publicKeyShare: null,
          keyProof: null,
          partialDecryptionSubmitted: false,
        })),
      },
      trusteeTokens: new Map(),
      trusteeSecrets: new Map(),
      eligible: new Set(),
      registeredHmacs: new Set(),
      registrations: new Map(),
      board: [],
      aggregate: null,
      partials: new Map(),
      result: null,
      audit: [],
      testCnps: [],
    }
    const tokens = state.data.trustees.map((t) => {
      const token = randomToken()
      state.trusteeTokens.set(t.id, token)
      return { trusteeId: t.id, name: t.name, token }
    })
    return { state, tokens }
  }

  function addEligible(s: ElectionState, cnps: string[]) {
    for (const cnp of cnps) {
      const h = hmac(cnp)
      if (!s.eligible.has(h)) {
        s.eligible.add(h)
        s.testCnps.push(cnp)
      }
    }
  }

  function submitKey(s: ElectionState, trusteeId: string, publicKeyShare: string, proof: { c: string; s: string }) {
    if (s.data.status !== 'draft') throw new ApiError(409, 'Cheile se trimit doar în configurare')
    const t = s.data.trustees.find((x) => x.id === trusteeId)!
    if (t.publicKeyShare) throw new ApiError(409, 'Trustee-ul și-a trimis deja cheia')
    if (!verifyTrusteeKey(s.data.id, { trusteeId, publicKeyShare, proof })) throw new ApiError(400, 'Dovada Schnorr a cheii nu e validă')
    t.publicKeyShare = publicKeyShare
    t.keyProof = proof
    if (s.data.trustees.every((x) => x.publicKeyShare)) s.data.publicKey = combinePublicKeys(s.data.trustees.map((x) => x.publicKeyShare!))
    log(s, `trustee:${trusteeId}`, 'trustee.key', { publicKeyShare })
  }

  function simulateKeys(s: ElectionState) {
    for (const t of s.data.trustees) {
      if (t.publicKeyShare) continue
      const { keyPair, publicKey } = generateTrusteeKey(s.data.id, t.id)
      s.trusteeSecrets.set(t.id, keyPair)
      submitKey(s, t.id, publicKey.publicKeyShare, publicKey.proof)
    }
  }

  function register(s: ElectionState, cnp: string, credentialPubkey: string, method: RegistrationMethod): Registration {
    if (s.data.status !== 'draft' && s.data.status !== 'open') throw new ApiError(409, 'Înregistrarea s-a închis pentru acest scrutin')
    if (!isValidCnp(cnp)) throw new ApiError(400, 'CNP invalid')
    if (!isCredentialPubkey(credentialPubkey)) throw new ApiError(400, 'Cheia de credential nu e o cheie Ed25519 validă')
    const h = hmac(cnp)
    if (!s.eligible.has(h)) throw new ApiError(403, 'CNP-ul nu figurează în lista alegătorilor eligibili')
    if (s.registeredHmacs.has(h)) throw new ApiError(409, 'Persoana este deja înregistrată la acest scrutin')
    if (s.registrations.has(credentialPubkey)) throw new ApiError(409, 'Credentialul este deja folosit')
    const registration: Registration = {
      electionId: s.data.id,
      credentialPubkey,
      method,
      trustLevel: method === 'nfc' ? 'criptografic' : 'optic',
      registeredAt: new Date().toISOString(),
    }
    s.registeredHmacs.add(h)
    s.registrations.set(credentialPubkey, registration)
    return registration
  }

  function cast(s: ElectionState, ballot: Ballot, receivedAt = new Date().toISOString(), verify = true) {
    if (s.data.status !== 'open') throw new ApiError(409, 'Scrutinul nu este deschis')
    if (!s.registrations.has(ballot.credentialPubkey)) throw new ApiError(403, 'Credential neînregistrat la acest scrutin')
    if (s.board.some((e) => e.credentialPubkey === ballot.credentialPubkey)) throw new ApiError(409, 'Acest credential a votat deja')
    if (verify) {
      const check = verifyBallot(electionParams(snapshot(s)), ballot)
      if (!check.ok) throw new ApiError(400, `Buletin respins: ${check.reason}`)
    }
    const entry = appendEntry(s.data.id, s.board.at(-1), ballot, receivedAt)
    s.board.push(entry)
    return entry
  }

  function close(s: ElectionState) {
    s.data.status = 'closed'
    s.aggregate = computeAggregate(s.data.candidates.length, s.board)
  }

  function submitPartial(s: ElectionState, trusteeId: string, partial: PartialDecryption) {
    if (s.data.status !== 'closed' || !s.aggregate) throw new ApiError(409, 'Decriptarea se face după închiderea votului')
    const t = s.data.trustees.find((x) => x.id === trusteeId)!
    if (t.partialDecryptionSubmitted) throw new ApiError(409, 'Decriptarea parțială a fost deja trimisă')
    const check = verifyPartialDecryption(s.data.id, t.publicKeyShare!, s.aggregate, { ...partial, trusteeId })
    if (!check.ok) throw new ApiError(400, `Decriptare respinsă: ${check.reason}`)
    s.partials.set(trusteeId, { ...partial, trusteeId })
    t.partialDecryptionSubmitted = true
    log(s, `trustee:${trusteeId}`, 'tally.partial')
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
      log(s, 'server', 'tally.result', { counts })
    }
  }

  function simulateTallyNow(s: ElectionState) {
    for (const t of s.data.trustees) {
      if (t.partialDecryptionSubmitted) continue
      const key = s.trusteeSecrets.get(t.id)
      if (!key) throw new ApiError(409, `Cheia secretă a lui ${t.name} nu e în simulator (a fost generată cu CLI-ul)`)
      submitPartial(s, t.id, partialDecrypt(key, s.aggregate!))
    }
  }

  function pick(weights: number[]) {
    let r = rand() * weights.reduce((a, b) => a + b, 0)
    const i = weights.findIndex((w) => (r -= w) < 0)
    return i === -1 ? weights.length - 1 : i
  }

  function voteRandomly(s: ElectionState, count: number, weights: number[], start?: Date, spanMs = 0, verify = true) {
    let done = 0
    const election = snapshot(s)
    for (const cnp of s.testCnps) {
      if (done >= count) break
      if (s.registeredHmacs.has(hmac(cnp))) continue
      const cred = generateCredential()
      register(s, cnp, cred.publicKey, rand() < 0.35 ? 'nfc' : 'ocr')
      const { ballot } = prepareBallot(election, cred, pick(weights))
      const at = start ? new Date(start.getTime() + (spanMs * (done + 1)) / (count + 1)).toISOString() : undefined
      cast(s, ballot, at, verify)
      done++
    }
    return done
  }

  const trustees = [{ name: 'Comisia electorală' }, { name: 'Observatori independenți' }, { name: 'Reprezentanții candidaților' }]

  function seed() {
    const cnps = (n: number) => Array.from({ length: n }, () => generateCnp(rand))

    const consiliu = newState(
      {
        title: 'Reprezentanți studenți – Consiliul Facultății ACIEE',
        opensAt: '2026-10-13T08:00:00.000Z',
        closesAt: '2026-10-20T18:00:00.000Z',
        candidates: [
          { name: 'Andrei Munteanu', description: 'Calculatoare, anul III' },
          { name: 'Ioana Dumitrescu', description: 'Automatică, anul II' },
          { name: 'Mihai Stoica', description: 'Electronică, anul IV' },
        ],
        trustees,
      },
      'consiliu-aciee-2026',
    ).state
    addEligible(consiliu, cnps(150))
    simulateKeys(consiliu)
    consiliu.data.status = 'open'
    voteRandomly(consiliu, seedVoters.open, [5, 4, 3], new Date('2026-10-13T08:30:00.000Z'), 26 * 3600_000, false)

    const senat = newState(
      {
        title: 'Reprezentant studenți – Senatul UDJG',
        opensAt: '2026-11-03T08:00:00.000Z',
        closesAt: '2026-11-05T18:00:00.000Z',
        candidates: [
          { name: 'Elena Radu', description: 'Științe Economice, master' },
          { name: 'Vlad Ionescu', description: 'ACIEE, anul IV' },
          { name: 'Cristina Marin', description: 'Litere, anul III' },
        ],
        trustees,
      },
      'senat-udjg-2026',
    ).state

    const consultare = newState(
      {
        title: 'Consultare: proiectul finanțat de Liga Studenților',
        opensAt: '2026-10-01T08:00:00.000Z',
        closesAt: '2026-10-03T18:00:00.000Z',
        candidates: [
          { name: 'Hackathon studențesc', description: 'Eveniment de 48 de ore, premii' },
          { name: 'Sala de lectură', description: 'Renovare și program prelungit' },
          { name: 'Burse de mobilitate', description: 'Cinci burse pentru conferințe' },
        ],
        trustees,
      },
      'consultare-liga-2026',
    ).state
    addEligible(consultare, cnps(60))
    simulateKeys(consultare)
    consultare.data.status = 'open'
    voteRandomly(consultare, seedVoters.tallied, [3, 5, 2], new Date('2026-10-01T08:10:00.000Z'), 56 * 3600_000, false)
    close(consultare)
    simulateTallyNow(consultare)

    for (const s of [consiliu, senat, consultare]) store.set(s.data.id, s)
  }

  let ready: Promise<void> | null = null
  const run = async <T>(fn: () => T | Promise<T>): Promise<T> => {
    // Datele de demonstrație se generează la prima cerere, nu la importul modulului.
    ready ??= delay(0).then(seed)
    await ready
    if (options.latency !== false) await delay()
    return fn()
  }

  const client: ApiClient = {
    listElections: () => run(() => [...store.values()].map(snapshot)),
    getElection: (id) => run(() => snapshot(get(id))),
    getBoard: (id) => run(() => clone(get(id).board)),
    findBallot: (id, code) =>
      run(() => {
        const needle = normalizeTrackingCode(code)
        const entry = get(id).board.find((b) => b.hash === needle)
        if (!entry) throw new ApiError(404, 'Niciun buletin cu acest cod de urmărire')
        return clone(entry)
      }),
    getBoardHead: (id) =>
      run(() => {
        const s = get(id)
        const last = s.board.at(-1)
        return last ? { seq: last.seq, hash: last.hash } : { seq: 0, hash: genesisHash(id) }
      }),
    getRegistrations: (id) => run(() => [...get(id).registrations.values()].map(({ electionId: _e, ...r }) => clone(r))),
    getTally: (id) =>
      run(() => {
        const s = get(id)
        return clone({ aggregate: s.aggregate, partials: [...s.partials.values()] })
      }),
    getResult: (id) =>
      run(() => {
        const s = get(id)
        if (!s.result) throw new ApiError(404, 'Rezultatul nu a fost publicat încă')
        return clone(s.result)
      }),
    getAuditBundle: (id) =>
      run(() => {
        const s = get(id)
        const last = s.board.at(-1)
        return clone({
          election: snapshot(s),
          registrations: [...s.registrations.values()].map(({ electionId: _e, ...r }) => r),
          board: s.board,
          tally: { aggregate: s.aggregate, partials: [...s.partials.values()] },
          result: s.result,
          head: last ? { seq: last.seq, hash: last.hash } : { seq: 0, hash: genesisHash(id) },
        })
      }),

    createElection: (input) =>
      run(() => {
        if (!input.title.trim()) throw new ApiError(400, 'Titlul este obligatoriu')
        if (input.candidates.length < 2) throw new ApiError(400, 'Sunt necesari cel puțin doi candidați')
        if (input.trustees.length < 1) throw new ApiError(400, 'Este necesar cel puțin un trustee')
        if (!(new Date(input.closesAt) > new Date(input.opensAt))) throw new ApiError(400, 'Închiderea trebuie să fie după deschidere')
        const { state, tokens } = newState(input)
        store.set(state.data.id, state)
        log(state, 'comisie', 'election.create', { title: input.title })
        return { election: snapshot(state), trusteeTokens: tokens }
      }),
    importEligible: (id, csv) =>
      run(() => {
        const s = get(id)
        if (s.data.status !== 'draft') throw new ApiError(409, 'Lista se poate importa doar înainte de deschiderea votului')
        const result = { imported: 0, duplicates: 0, invalid: [] as { line: number; value: string }[] }
        for (const [i, raw] of csv.split(/\r?\n/).entries()) {
          const value = raw.split(/[,;]/)[0].trim().replace(/^"|"$/g, '')
          if (!value || (i === 0 && /^cnp$/i.test(value))) continue
          if (!isValidCnp(value)) {
            result.invalid.push({ line: i + 1, value })
            continue
          }
          const h = hmac(value)
          if (s.eligible.has(h)) {
            result.duplicates++
            continue
          }
          s.eligible.add(h)
          s.testCnps.push(value)
          result.imported++
        }
        log(s, 'comisie', 'eligible.import', { imported: result.imported, duplicates: result.duplicates, invalid: result.invalid.length })
        return result
      }),
    openElection: (id) =>
      run(() => {
        const s = get(id)
        if (s.data.status !== 'draft') throw new ApiError(409, 'Scrutinul nu este în configurare')
        const missing = s.data.trustees.filter((t) => !t.publicKeyShare).length
        if (missing > 0) throw new ApiError(409, `Lipsesc cheile de la ${missing} trustee(s)`)
        if (s.eligible.size === 0) throw new ApiError(409, 'Lista alegătorilor eligibili este goală')
        s.data.status = 'open'
        log(s, 'comisie', 'election.open')
        return snapshot(s)
      }),
    closeElection: (id) =>
      run(() => {
        const s = get(id)
        if (s.data.status !== 'open') throw new ApiError(409, 'Scrutinul nu este deschis')
        close(s)
        log(s, 'comisie', 'election.close', { ballots: s.board.length })
        return snapshot(s)
      }),
    getAuditLog: (id) => run(() => clone(get(id).audit)),
    checkAdmin: () => run(() => undefined),

    submitTrusteeKey: (id, token, key) =>
      run(() => {
        const s = get(id)
        const t = trusteeFor(s, token)
        if (key.trusteeId !== t.id) throw new ApiError(403, 'Token-ul aparține altui trustee')
        submitKey(s, t.id, key.publicKeyShare, key.proof)
        return snapshot(s)
      }),
    submitPartialDecryption: (id, token, partial) =>
      run(() => {
        const s = get(id)
        const t = trusteeFor(s, token)
        submitPartial(s, t.id, partial)
        return snapshot(s)
      }),

    registerOcr: (id, input) => run(() => register(get(id), input.cnp, input.credentialPubkey, 'ocr')),
    registerNfc: (id, input) =>
      run(() => {
        // Passive Authentication nu se face în simulator: SOD-ul se verifică doar pe serverul real.
        let mrz
        try {
          mrz = parseMrz(mrzFromDg1(base64ToBytes(input.dg1)))
        } catch (err) {
          throw new ApiError(400, err instanceof Error ? err.message : 'DG1 invalid')
        }
        if (!mrz?.valid || !mrz.cnp) throw new ApiError(400, 'DG1 nu conține un MRZ valid cu CNP')
        return register(get(id), mrz.cnp, input.credentialPubkey, 'nfc')
      }),
    authChallenge: (id, credentialPubkey) =>
      run(() => {
        const s = get(id)
        if (!s.registrations.has(credentialPubkey)) throw new ApiError(403, 'Credential neînregistrat la acest scrutin')
        const challengeId = randomToken()
        const nonce = randomToken()
        const expiresAt = Date.now() + 120_000
        challenges.set(challengeId, { electionId: id, credentialPubkey, nonce, expiresAt })
        return { challengeId, nonce, expiresAt: new Date(expiresAt).toISOString() }
      }),
    authVerify: (challengeId, signature) =>
      run(() => {
        const c = challenges.get(challengeId)
        challenges.delete(challengeId)
        if (!c || c.expiresAt < Date.now()) throw new ApiError(401, 'Provocare expirată sau necunoscută')
        if (!verifySignature(c.credentialPubkey, authMessage(c.electionId, c.credentialPubkey, c.nonce), signature)) {
          throw new ApiError(401, 'Semnătura provocării nu e validă')
        }
        const token = randomToken()
        const expiresAt = Date.now() + 10 * 60_000
        sessions.set(token, { electionId: c.electionId, credentialPubkey: c.credentialPubkey, expiresAt })
        return { token, expiresAt: new Date(expiresAt).toISOString() }
      }),
    castBallot: (id, ballot, sessionToken) =>
      run(() => {
        const session = sessions.get(sessionToken)
        if (!session || session.expiresAt < Date.now()) throw new ApiError(401, 'Sesiune expirată; autentifică-te din nou')
        if (session.electionId !== id || session.credentialPubkey !== ballot.credentialPubkey) {
          throw new ApiError(403, 'Sesiunea aparține altui credential')
        }
        const entry = cast(get(id), ballot)
        sessions.delete(sessionToken)
        return { seq: entry.seq, trackingCode: entry.hash, ballotHash: entry.ballotHash, receivedAt: entry.receivedAt }
      }),
  }

  const freshCnp = (s: ElectionState) => s.testCnps.find((cnp) => !s.registeredHmacs.has(hmac(cnp))) ?? null

  const tools: MockTools = {
    sampleCnp: (id) => run(() => freshCnp(get(id))),
    sampleMrz: (id, format) =>
      run(() => {
        const cnp = freshCnp(get(id))
        if (!cnp) return null
        const input = { surname: 'Popescu', givenNames: 'Andrei', documentNumber: format === 'TD1' ? 'GL123456' : 'GL654321', cnp, sex: (Number(cnp[0]) % 2 ? 'M' : 'F') as 'M' | 'F', expiry: '310428' }
        return format === 'TD1' ? buildTd1(input) : buildTd2(input)
      }),
    simulateTrusteeKeys: (id) =>
      run(() => {
        const s = get(id)
        if (s.data.status !== 'draft') throw new ApiError(409, 'Cheile se generează doar în configurare')
        simulateKeys(s)
        return snapshot(s)
      }),
    simulateVoters: (id, n) =>
      run(async () => {
        const s = get(id)
        if (s.data.status !== 'open') throw new ApiError(409, 'Scrutinul nu este deschis')
        let done = 0
        for (const cnp of [...s.testCnps]) {
          if (done >= n) break
          if (s.registeredHmacs.has(hmac(cnp))) continue
          // același drum ca aplicația: înregistrare, autentificare, criptare, trimitere
          const cred = generateCredential()
          await client.registerOcr(id, { cnp, credentialPubkey: cred.publicKey })
          const election = snapshot(s)
          const { ballot } = prepareBallot(election, cred, pick(election.candidates.map(() => 1)))
          const token = await authenticate(client, id, cred)
          await client.castBallot(id, ballot, token)
          done++
        }
        return done
      }),
    simulateTally: (id) =>
      run(() => {
        const s = get(id)
        if (s.data.status !== 'closed') throw new ApiError(409, 'Numărarea începe după închiderea votului')
        simulateTallyNow(s)
        return snapshot(s)
      }),
  }

  return { client, tools }
}
