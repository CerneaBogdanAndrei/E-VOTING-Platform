// Backend simulat în memorie, cu aceleași reguli ca API-ul real, ca interfața
// să poată fi folosită înainte să existe backend-ul. Se pierde la reîncărcare.

import type { PlaceholderProofs } from './ballot'
import { generateCnp, isValidCnp } from './cnp'
import { randomHex, sha256Hex } from './platform'
import {
  ApiError,
  type ApiClient,
  type BallotSubmission,
  type BoardEntry,
  type CreateElectionInput,
  type Election,
  type ElectionResult,
  type Registration,
  type RegistrationMethod,
} from './types'

interface ElectionState {
  data: Omit<Election, 'stats'>
  /** HMAC(CNP) al eligibililor, ca în tabela eligible_voters. */
  eligible: Set<string>
  registeredHmacs: Set<string>
  registrations: Map<string, Registration>
  voted: Set<string>
  ballots: BoardEntry[]
  /** Doar în mock: voturile în clar, ca să poată fi „numărate” fără criptografie. */
  plaintexts: number[][]
  result: ElectionResult | null
  /** Doar în mock: CNP-uri eligibile în clar, pentru uneltele de test. */
  testCnps: string[]
}

export interface MockTools {
  /** Un CNP eligibil, încă neînregistrat, sau null. */
  sampleCnp(electionId: string): Promise<string | null>
  /** Trustees fără cheie își „trimit” Yᵢ. */
  simulateTrusteeKeys(electionId: string): Promise<Election>
  /** Înregistrează și votează n alegători aleatori. Întoarce câți au votat. */
  simulateVoters(electionId: string, n: number): Promise<number>
  /** Trustees trimit decriptările parțiale, iar rezultatul se publică. */
  simulateTally(electionId: string): Promise<Election>
}

const HMAC_KEY = 'mock-hmac-key'
const GENESIS = '0'.repeat(64)

// structuredClone lipsește în Hermes (React Native).
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const hmacCnp = (cnp: string) => sha256Hex(`${HMAC_KEY}:${cnp}`)
const delay = (ms = 120 + Math.random() * 180) => new Promise((r) => setTimeout(r, ms))

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

export function createMockBackend(): { client: ApiClient; tools: MockTools } {
  const store = new Map<string, ElectionState>()
  const rand = mulberry32(2026)

  function snapshot(s: ElectionState): Election {
    return clone({
      ...s.data,
      stats: { eligible: s.eligible.size, registered: s.registrations.size, ballots: s.ballots.length },
    })
  }

  function get(id: string): ElectionState {
    const s = store.get(id)
    if (!s) throw new ApiError(404, 'Scrutinul nu există')
    return s
  }

  async function addEligible(s: ElectionState, cnps: string[]) {
    for (const cnp of cnps) {
      const h = await hmacCnp(cnp)
      if (!s.eligible.has(h)) {
        s.eligible.add(h)
        s.testCnps.push(cnp)
      }
    }
  }

  async function register(s: ElectionState, cnp: string, credentialPubkey: string, method: RegistrationMethod) {
    if (s.data.status !== 'draft' && s.data.status !== 'open') {
      throw new ApiError(409, 'Înregistrarea s-a închis pentru acest scrutin')
    }
    if (!isValidCnp(cnp)) throw new ApiError(400, 'CNP invalid')
    const h = await hmacCnp(cnp)
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

  async function appendBallot(s: ElectionState, ballot: BallotSubmission, plaintext: number[], at = new Date()) {
    const seq = s.ballots.length + 1
    const prevHash = s.ballots.at(-1)?.hash ?? GENESIS
    const hash = await sha256Hex(`${prevHash}|${seq}|${ballot.credentialPubkey}|${JSON.stringify(ballot.ciphertexts)}`)
    const entry: BoardEntry = {
      seq,
      hash,
      prevHash,
      credentialPubkey: ballot.credentialPubkey,
      ciphertexts: ballot.ciphertexts,
      receivedAt: at.toISOString(),
    }
    s.ballots.push(entry)
    s.plaintexts.push(plaintext)
    s.voted.add(ballot.credentialPubkey)
    return entry
  }

  function fakeBallot(candidateCount: number, choice: number) {
    const plaintext = Array.from({ length: candidateCount }, (_, i) => (i === choice ? 1 : 0))
    const ballot: BallotSubmission = {
      credentialPubkey: randomHex(32),
      ciphertexts: plaintext.map(() => ({ a: randomHex(32), b: randomHex(32) })),
      proofs: { kind: 'placeholder', plaintext } satisfies PlaceholderProofs,
      signature: '',
    }
    return { ballot, plaintext }
  }

  function setTrusteeKeys(s: ElectionState) {
    for (const t of s.data.trustees) t.publicKeyShare ??= randomHex(32)
    s.data.publicKey = randomHex(32)
  }

  function publishResult(s: ElectionState, at = new Date()) {
    for (const t of s.data.trustees) t.partialDecryptionSubmitted = true
    s.result = {
      electionId: s.data.id,
      counts: s.data.candidates.map((c) => ({
        candidateId: c.id,
        votes: s.plaintexts.reduce((sum, p) => sum + (p[c.position] ?? 0), 0),
      })),
      totalBallots: s.ballots.length,
      publishedAt: at.toISOString(),
    }
    s.data.status = 'tallied'
  }

  function newState(input: CreateElectionInput, id = `scr-${randomHex(3)}`): ElectionState {
    return {
      data: {
        id,
        title: input.title,
        status: 'draft',
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        publicKey: null,
        candidates: input.candidates.map((c, i) => ({ id: `${id}-c${i + 1}`, name: c.name, description: c.description, position: i })),
        trustees: input.trustees.map((t, i) => ({ id: `${id}-t${i + 1}`, name: t.name, publicKeyShare: null, partialDecryptionSubmitted: false })),
      },
      eligible: new Set(),
      registeredHmacs: new Set(),
      registrations: new Map(),
      voted: new Set(),
      ballots: [],
      plaintexts: [],
      result: null,
      testCnps: [],
    }
  }

  async function voteRandomly(s: ElectionState, count: number, weights: number[], start: Date, spanMs: number) {
    let done = 0
    for (const cnp of s.testCnps) {
      if (done >= count) break
      const h = await hmacCnp(cnp)
      if (s.registeredHmacs.has(h)) continue
      let r = rand() * weights.reduce((a, b) => a + b, 0)
      const picked = weights.findIndex((w) => (r -= w) < 0)
      const choice = picked === -1 ? weights.length - 1 : picked
      const { ballot, plaintext } = fakeBallot(s.data.candidates.length, choice)
      await register(s, cnp, ballot.credentialPubkey, rand() < 0.35 ? 'nfc' : 'ocr')
      await appendBallot(s, ballot, plaintext, new Date(start.getTime() + (spanMs * (done + 1)) / (count + 1)))
      done++
    }
    return done
  }

  const trustees = [{ name: 'Comisia electorală' }, { name: 'Observatori independenți' }, { name: 'Reprezentanții candidaților' }]

  async function seed() {
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
    )
    await addEligible(consiliu, cnps(150))
    setTrusteeKeys(consiliu)
    consiliu.data.status = 'open'
    await voteRandomly(consiliu, 14, [5, 4, 3], new Date('2026-10-13T08:30:00.000Z'), 26 * 3600_000)

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
    )

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
    )
    await addEligible(consultare, cnps(60))
    setTrusteeKeys(consultare)
    consultare.data.status = 'open'
    await voteRandomly(consultare, 41, [3, 5, 2], new Date('2026-10-01T08:10:00.000Z'), 56 * 3600_000)
    consultare.data.status = 'closed'
    publishResult(consultare, new Date('2026-10-03T19:30:00.000Z'))

    for (const s of [consiliu, senat, consultare]) store.set(s.data.id, s)
  }

  const ready = seed()
  const run = async <T>(fn: () => T | Promise<T>): Promise<T> => {
    await ready
    await delay()
    return fn()
  }

  const client: ApiClient = {
    listElections: () => run(() => [...store.values()].map(snapshot)),

    getElection: (id) => run(() => snapshot(get(id))),

    createElection: (input) =>
      run(() => {
        if (!input.title.trim()) throw new ApiError(400, 'Titlul este obligatoriu')
        if (input.candidates.length < 2) throw new ApiError(400, 'Sunt necesari cel puțin doi candidați')
        if (input.trustees.length < 1) throw new ApiError(400, 'Este necesar cel puțin un trustee')
        if (!(new Date(input.closesAt) > new Date(input.opensAt))) {
          throw new ApiError(400, 'Închiderea trebuie să fie după deschidere')
        }
        const s = newState(input)
        store.set(s.data.id, s)
        return snapshot(s)
      }),

    importEligible: (id, csv) =>
      run(async () => {
        const s = get(id)
        if (s.data.status !== 'draft') throw new ApiError(409, 'Lista se poate importa doar înainte de deschiderea votului')
        const result = { imported: 0, duplicates: 0, invalid: [] as { line: number; value: string }[] }
        const lines = csv.split(/\r?\n/)
        for (const [i, raw] of lines.entries()) {
          const value = raw.split(/[,;]/)[0].trim().replace(/^"|"$/g, '')
          if (!value || (i === 0 && /^cnp$/i.test(value))) continue
          if (!isValidCnp(value)) {
            result.invalid.push({ line: i + 1, value })
            continue
          }
          const h = await hmacCnp(value)
          if (s.eligible.has(h)) {
            result.duplicates++
            continue
          }
          s.eligible.add(h)
          s.testCnps.push(value)
          result.imported++
        }
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
        return snapshot(s)
      }),

    closeElection: (id) =>
      run(() => {
        const s = get(id)
        if (s.data.status !== 'open') throw new ApiError(409, 'Scrutinul nu este deschis')
        s.data.status = 'closed'
        return snapshot(s)
      }),

    registerOcr: (id, input) => run(() => register(get(id), input.cnp, input.credentialPubkey, 'ocr')),

    registerNfc: (id, input) =>
      run(() => {
        // Passive Authentication e simulată: SOD-ul nu se verifică, iar CNP-ul se ia din DG1.
        const cnp = atob(input.dg1).match(/\d{13}/)?.[0]
        if (!cnp) throw new ApiError(400, 'DG1 nu conține un CNP')
        return register(get(id), cnp, input.credentialPubkey, 'nfc')
      }),

    castBallot: (id, ballot) =>
      run(async () => {
        const s = get(id)
        if (s.data.status !== 'open') throw new ApiError(409, 'Scrutinul nu este deschis')
        if (!s.registrations.has(ballot.credentialPubkey)) throw new ApiError(403, 'Credential neînregistrat la acest scrutin')
        if (s.voted.has(ballot.credentialPubkey)) throw new ApiError(409, 'Acest credential a votat deja')
        if (ballot.ciphertexts.length !== s.data.candidates.length) throw new ApiError(400, 'Numărul de criptotexte nu se potrivește')
        // Ține locul verificării dovezilor ZK: fiecare poziție e 0 sau 1, iar suma e 1.
        const plaintext = (ballot.proofs as PlaceholderProofs | null)?.plaintext
        const valid =
          Array.isArray(plaintext) &&
          plaintext.length === s.data.candidates.length &&
          plaintext.every((v) => v === 0 || v === 1) &&
          plaintext.reduce<number>((a, b) => a + b, 0) === 1
        if (!valid) throw new ApiError(400, 'Dovezile buletinului nu sunt valide')
        const entry = await appendBallot(s, ballot, plaintext)
        return { seq: entry.seq, trackingCode: entry.hash, receivedAt: entry.receivedAt }
      }),

    getBoard: (id) => run(() => clone(get(id).ballots)),

    findBallot: (id, code) =>
      run(() => {
        const needle = code.trim().toLowerCase()
        const entry = get(id).ballots.find((b) => b.hash === needle)
        if (!entry) throw new ApiError(404, 'Niciun buletin cu acest cod de urmărire')
        return clone(entry)
      }),

    getResult: (id) =>
      run(() => {
        const s = get(id)
        if (!s.result) throw new ApiError(404, 'Rezultatul nu a fost publicat încă')
        return clone(s.result)
      }),
  }

  const tools: MockTools = {
    sampleCnp: (id) =>
      run(async () => {
        const s = get(id)
        for (const cnp of s.testCnps) if (!s.registeredHmacs.has(await hmacCnp(cnp))) return cnp
        return null
      }),

    simulateTrusteeKeys: (id) =>
      run(() => {
        const s = get(id)
        if (s.data.status !== 'draft') throw new ApiError(409, 'Cheile se generează doar în configurare')
        setTrusteeKeys(s)
        return snapshot(s)
      }),

    simulateVoters: (id, n) =>
      run(() => {
        const s = get(id)
        if (s.data.status !== 'open') throw new ApiError(409, 'Scrutinul nu este deschis')
        return voteRandomly(s, n, s.data.candidates.map(() => 1), new Date(), 0)
      }),

    simulateTally: (id) =>
      run(() => {
        const s = get(id)
        if (s.data.status !== 'closed') throw new ApiError(409, 'Numărarea începe după închiderea votului')
        publishResult(s)
        return snapshot(s)
      }),
  }

  return { client, tools }
}
