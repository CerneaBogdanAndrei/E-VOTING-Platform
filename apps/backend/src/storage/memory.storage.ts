// Implementarea în memorie a stocării. Opțional, starea se salvează într-un
// fișier JSON (DATA_FILE), ca datele să supraviețuiască unei reporniri în demo.
// Nu e gândită pentru producție: totul stă în RAM și există un singur proces.

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import type { BoardEntry } from '@evoting/crypto'
import {
  UniqueViolation,
  type AuditRow,
  type CandidateRow,
  type ElectionRow,
  type PartialDecryptionRow,
  type RegistrationRow,
  type ResultRow,
  type Storage,
  type TrusteeRow,
} from './storage.js'

interface State {
  elections: ElectionRow[]
  candidates: CandidateRow[]
  trustees: TrusteeRow[]
  /** electionId → amprente HMAC */
  eligible: Record<string, string[]>
  registrations: RegistrationRow[]
  /** electionId → intrările board-ului, în ordine */
  ballots: Record<string, BoardEntry[]>
  partialDecryptions: PartialDecryptionRow[]
  results: ResultRow[]
  auditLog: AuditRow[]
}

const emptyState = (): State => ({
  elections: [],
  candidates: [],
  trustees: [],
  eligible: {},
  registrations: [],
  ballots: {},
  partialDecryptions: [],
  results: [],
  auditLog: [],
})

// Rândurile se copiază la intrare și la ieșire, ca un serviciu să nu poată
// modifica „baza de date” prin referință (cum nici cu PostgreSQL nu poate).
const copy = <T>(x: T): T => (x === null || x === undefined ? x : structuredClone(x))

/** Coadă de așteptare per cheie: apelurile cu aceeași cheie rulează pe rând. */
class KeyedMutex {
  private tails = new Map<string, Promise<unknown>>()

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve()
    const next = prev.then(fn, fn)
    const tail = next.catch(() => undefined)
    this.tails.set(key, tail)
    tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key)
    })
    return next
  }
}

export class MemoryStorage implements Storage {
  readonly kind: string
  private state: State
  private readonly mutex = new KeyedMutex()
  // Indexuri, ca operațiile frecvente să nu parcurgă tot board-ul.
  private eligibleIndex = new Map<string, Set<string>>()
  private codeIndex = new Map<string, Map<string, BoardEntry>>()
  private credentialIndex = new Map<string, Set<string>>()
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly file?: string) {
    this.kind = file ? `memorie + fișier (${file})` : 'memorie'
    this.state = file && existsSync(file) ? { ...emptyState(), ...JSON.parse(readFileSync(file, 'utf8')) } : emptyState()
    this.rebuildIndexes()
  }

  private rebuildIndexes() {
    for (const [id, list] of Object.entries(this.state.eligible)) this.eligibleIndex.set(id, new Set(list))
    for (const [id, entries] of Object.entries(this.state.ballots)) for (const e of entries) this.indexEntry(id, e)
  }

  private indexEntry(electionId: string, e: BoardEntry) {
    let codes = this.codeIndex.get(electionId)
    if (!codes) this.codeIndex.set(electionId, (codes = new Map()))
    codes.set(e.trackingCode, e)
    codes.set(e.hash, e)
    let creds = this.credentialIndex.get(electionId)
    if (!creds) this.credentialIndex.set(electionId, (creds = new Set()))
    creds.add(e.ballot.credentialPubkey)
  }

  /** Salvare amânată (cel mult o dată la 200 ms), scrisă atomic prin redenumire. */
  private changed() {
    if (!this.file || this.saveTimer) return
    this.saveTimer = setTimeout(() => this.flush(), 200)
  }

  flush() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    if (!this.file) return
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file + '.tmp', JSON.stringify(this.state))
    renameSync(this.file + '.tmp', this.file)
  }

  exclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    return this.mutex.run(`x:${key}`, fn)
  }

  elections = {
    insert: async (election: ElectionRow, candidates: CandidateRow[], trustees: TrusteeRow[]) => {
      if (this.state.elections.some((e) => e.id === election.id)) throw new UniqueViolation('elections_pkey')
      this.state.elections.push(copy(election))
      this.state.candidates.push(...copy(candidates))
      this.state.trustees.push(...copy(trustees))
      this.changed()
    },
    findById: async (id: string) => copy(this.state.elections.find((e) => e.id === id) ?? null),
    list: async () => copy([...this.state.elections].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    update: async (id: string, patch: Partial<Omit<ElectionRow, 'id'>>) => {
      const row = this.state.elections.find((e) => e.id === id)
      if (!row) throw new Error(`election ${id} not found`)
      Object.assign(row, copy(patch))
      this.changed()
      return copy(row)
    },
    candidates: async (electionId: string) =>
      copy(this.state.candidates.filter((c) => c.electionId === electionId).sort((a, b) => a.position - b.position)),
  }

  trustees = {
    listByElection: async (electionId: string) => copy(this.state.trustees.filter((t) => t.electionId === electionId)),
    findById: async (electionId: string, trusteeId: string) =>
      copy(this.state.trustees.find((t) => t.electionId === electionId && t.id === trusteeId) ?? null),
    update: async (electionId: string, trusteeId: string, patch: Partial<Omit<TrusteeRow, 'id' | 'electionId'>>) => {
      const row = this.state.trustees.find((t) => t.electionId === electionId && t.id === trusteeId)
      if (!row) throw new Error(`trustee ${trusteeId} not found`)
      Object.assign(row, copy(patch))
      this.changed()
      return copy(row)
    },
  }

  eligibleVoters = {
    addMany: async (electionId: string, cnpHmacs: string[]) => {
      let set = this.eligibleIndex.get(electionId)
      if (!set) this.eligibleIndex.set(electionId, (set = new Set()))
      const list = (this.state.eligible[electionId] ??= [])
      let inserted = 0
      for (const h of cnpHmacs) {
        if (set.has(h)) continue
        set.add(h)
        list.push(h)
        inserted++
      }
      this.changed()
      return { inserted, duplicates: cnpHmacs.length - inserted }
    },
    exists: async (electionId: string, cnpHmac: string) => this.eligibleIndex.get(electionId)?.has(cnpHmac) ?? false,
    count: async (electionId: string) => this.eligibleIndex.get(electionId)?.size ?? 0,
  }

  registrations = {
    insert: async (row: RegistrationRow) => {
      const same = this.state.registrations.filter((r) => r.electionId === row.electionId)
      if (same.some((r) => r.cnpHmac === row.cnpHmac)) throw new UniqueViolation('registrations_cnp')
      if (same.some((r) => r.credentialPubkey === row.credentialPubkey)) throw new UniqueViolation('registrations_credential')
      this.state.registrations.push(copy(row))
      this.changed()
    },
    findByCredential: async (electionId: string, credentialPubkey: string) =>
      copy(this.state.registrations.find((r) => r.electionId === electionId && r.credentialPubkey === credentialPubkey) ?? null),
    count: async (electionId: string) => {
      const same = this.state.registrations.filter((r) => r.electionId === electionId)
      return { total: same.length, nfc: same.filter((r) => r.method === 'nfc').length }
    },
    credentials: async (electionId: string) =>
      this.state.registrations.filter((r) => r.electionId === electionId).map((r) => r.credentialPubkey),
  }

  ballots = {
    append: (electionId: string, build: (last: BoardEntry | null) => BoardEntry | Promise<BoardEntry>) =>
      this.mutex.run(`ballots:${electionId}`, async () => {
        const list = (this.state.ballots[electionId] ??= [])
        const entry = await build(copy(list.at(-1) ?? null))
        if (this.credentialIndex.get(electionId)?.has(entry.ballot.credentialPubkey)) throw new UniqueViolation('ballots_credential')
        if (entry.seq !== list.length + 1) throw new UniqueViolation('ballots_seq')
        const stored = copy(entry)
        list.push(stored)
        this.indexEntry(electionId, stored)
        this.changed()
        return copy(stored)
      }),
    list: async (electionId: string) => copy(this.state.ballots[electionId] ?? []),
    last: async (electionId: string) => copy(this.state.ballots[electionId]?.at(-1) ?? null),
    count: async (electionId: string) => this.state.ballots[electionId]?.length ?? 0,
    findByCode: async (electionId: string, code: string) => copy(this.codeIndex.get(electionId)?.get(code) ?? null),
    hasCredential: async (electionId: string, credentialPubkey: string) => this.credentialIndex.get(electionId)?.has(credentialPubkey) ?? false,
  }

  partialDecryptions = {
    insert: async (row: PartialDecryptionRow) => {
      if (this.state.partialDecryptions.some((p) => p.electionId === row.electionId && p.trusteeId === row.trusteeId)) {
        throw new UniqueViolation('partial_decryptions_trustee')
      }
      this.state.partialDecryptions.push(copy(row))
      this.changed()
    },
    list: async (electionId: string) => copy(this.state.partialDecryptions.filter((p) => p.electionId === electionId)),
  }

  results = {
    insert: async (row: ResultRow) => {
      if (this.state.results.some((r) => r.electionId === row.electionId)) throw new UniqueViolation('results_pkey')
      this.state.results.push(copy(row))
      this.changed()
    },
    find: async (electionId: string) => copy(this.state.results.find((r) => r.electionId === electionId) ?? null),
  }

  auditLog = {
    append: async (row: Omit<AuditRow, 'id'>) => {
      const full: AuditRow = { id: this.state.auditLog.length + 1, ...copy(row) }
      this.state.auditLog.push(full)
      this.changed()
      return copy(full)
    },
    list: async (electionId: string) => copy(this.state.auditLog.filter((a) => a.electionId === electionId)),
  }
}
