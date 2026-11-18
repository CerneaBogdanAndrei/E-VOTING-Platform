// Starea în memorie a backend-ului simulat: ce ar sta în tabelele PostgreSQL ale
// serverului real, plus câteva lucruri care există doar în simulator (cheile secrete
// ale trustees și CNP-urile de test în clar, pentru uneltele de test).

import { cnpHmac, type BoardEntry, type Ciphertext, type PartialDecryption, type TrusteeKeyPair } from '@evoting/crypto'
import {
  ApiError,
  BLANK_LABEL_ID,
  type AuditLogEntry,
  type Candidate,
  type CommissionMember,
  type CreateElectionInput,
  type Election,
  type ElectionResult,
  type Registration,
  type TrusteeToken,
} from './contract-helpers.js'
import { clone, mulberry32, randomToken } from './random.js'

export interface ElectionState {
  data: Omit<Election, 'stats'>
  trusteeTokens: Map<string, string>
  /** Doar în mock: cheile secrete ale trustees, ca uneltele de test să țină locul CLI-ului. */
  trusteeSecrets: Map<string, TrusteeKeyPair>
  /** HMAC(CNP) al eligibililor, ca în tabela eligible_voters. */
  eligible: Set<string>
  /** HMAC(CNP) → credentialul înregistrat, ca în tabela registrations. */
  registeredHmacs: Map<string, string>
  registrations: Map<string, Registration>
  board: BoardEntry[]
  aggregate: Ciphertext[] | null
  partials: Map<string, PartialDecryption>
  result: ElectionResult | null
  audit: AuditLogEntry[]
  /** Doar în mock: CNP-uri eligibile în clar, pentru uneltele de test. */
  testCnps: string[]
}

export interface PendingChallenge {
  electionId: string
  credentialPubkey: string
  nonce: string
  expiresAt: number
}

export interface MockSession {
  electionId: string
  credentialPubkey: string
  expiresAt: number
}

export interface MockMember extends CommissionMember {
  token: string
}

/** Tot ce împart între ele clientul simulat, regulile și uneltele de test. */
export interface MockContext {
  store: Map<string, ElectionState>
  challenges: Map<string, PendingChallenge>
  sessions: Map<string, MockSession>
  members: Map<string, MockMember>
  rand: () => number
  hmac(cnp: string): string
  get(id: string): ElectionState
  snapshot(s: ElectionState): Election
  log(s: ElectionState, actor: string, action: string, payload?: unknown): void
  newState(input: CreateElectionInput, id?: string): { state: ElectionState; tokens: TrusteeToken[] }
}

/** Lista de candidați cu pozițiile lor; votul alb, dacă e cerut, e ultimul. */
export function buildCandidates(electionId: string, candidates: { name: string; description: string }[], allowBlank: boolean | undefined): Candidate[] {
  const list: Candidate[] = candidates.map((c, i) => ({
    id: `${electionId}-c${i + 1}`,
    name: c.name,
    description: c.description,
    position: i,
    kind: 'candidate',
  }))
  if (allowBlank) list.push({ id: `${electionId}-${BLANK_LABEL_ID}`, name: 'Vot alb', description: '', position: list.length, kind: 'blank' })
  return list
}

export function createMockContext(): MockContext {
  const store = new Map<string, ElectionState>()
  const hmacKey = randomToken() + randomToken().slice(0, 16)
  let auditId = 0

  return {
    store,
    challenges: new Map(),
    sessions: new Map(),
    members: new Map(),
    rand: mulberry32(2026),
    hmac: (cnp) => cnpHmac(hmacKey, cnp),
    get(id) {
      const s = store.get(id)
      if (!s) throw new ApiError(404, 'Scrutinul nu există')
      return s
    },
    snapshot(s) {
      return clone({
        ...s.data,
        stats: { eligible: s.eligible.size, registered: s.registrations.size, ballots: s.board.length },
      })
    },
    log(s, actor, action, payload = null) {
      s.audit.push({ id: ++auditId, actor, action, payload, createdAt: new Date().toISOString() })
    },
    newState(input, id = `scr-${randomToken().slice(0, 6)}`) {
      const state: ElectionState = {
        data: {
          id,
          title: input.title,
          status: 'draft',
          opensAt: input.opensAt,
          closesAt: input.closesAt,
          publicKey: null,
          candidates: buildCandidates(id, input.candidates, input.allowBlank),
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
        registeredHmacs: new Map(),
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
    },
  }
}
