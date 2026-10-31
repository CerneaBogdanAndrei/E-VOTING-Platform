// Clientul HTTP al API-ului, folosit de web, mobil și CLI-uri.
// Folosește doar fetch, deci merge în browser, React Native și Node ≥ 18.

import {
  ApiError,
  type AdminSession,
  type AuditLogEntry,
  type AuthChallenge,
  type AuthChallengeInput,
  type AuthSession,
  type AuthVerifyInput,
  type Ballot,
  type BallotReceipt,
  type BoardEntry,
  type BoardHead,
  type CreateElectionInput,
  type Election,
  type ElectionRecord,
  type ElectionResult,
  type EligibleImportResult,
  type PartialDecryption,
  type RegisterNfcInput,
  type RegisterOcrInput,
  type Registration,
  type ServerInfo,
  type TallyState,
  type TrusteeInvite,
  type TrusteeKeySubmission,
} from './types.js'

export interface ClientOptions {
  /** Tokenul comisiei (panoul web), dacă există. */
  adminToken?: () => string | null | undefined
  /** fetch alternativ (teste). */
  fetch?: typeof fetch
}

export type ApiClient = ReturnType<typeof createApiClient>

export function createApiClient(baseUrl: string, options: ClientOptions = {}) {
  const root = baseUrl.replace(/\/+$/, '')
  const doFetch = options.fetch ?? ((input: string, init?: RequestInit) => fetch(input, init))

  interface RequestOptions {
    body?: unknown
    contentType?: string
    headers?: Record<string, string>
    admin?: boolean
  }

  async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { ...opts.headers }
    let body: string | undefined
    if (opts.body !== undefined) {
      const type = opts.contentType ?? 'application/json'
      headers['Content-Type'] = type
      body = type === 'application/json' ? JSON.stringify(opts.body) : String(opts.body)
    }
    if (opts.admin) {
      const token = options.adminToken?.()
      if (token) headers.Authorization = `Bearer ${token}`
    }
    let res: Response
    try {
      res = await doFetch(root + path, { method, headers, body })
    } catch {
      throw new ApiError(0, `Backend-ul nu răspunde (${root})`)
    }
    if (!res.ok) {
      let message = res.statusText || `Eroare ${res.status}`
      try {
        // Format NestJS: { statusCode, message, error }, cu message șir sau listă.
        const data = (await res.json()) as { message?: unknown }
        if (Array.isArray(data?.message)) message = data.message.join('; ')
        else if (typeof data?.message === 'string') message = data.message
      } catch {
        // răspuns fără JSON
      }
      throw new ApiError(res.status, message)
    }
    if (res.status === 204) return undefined as T
    const text = await res.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  const e = (id: string) => `/elections/${encodeURIComponent(id)}`
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
  const trusteeCode = (code: string) => ({ 'X-Trustee-Code': code })

  return {
    baseUrl: root,
    info: () => request<ServerInfo>('GET', '/info'),

    // ── Public ──
    listElections: () => request<Election[]>('GET', '/elections'),
    getElection: (id: string) => request<Election>('GET', e(id)),
    getBoard: (id: string) => request<BoardEntry[]>('GET', `${e(id)}/board`),
    getBoardHead: (id: string) => request<BoardHead>('GET', `${e(id)}/board/head`),
    /** 404 dacă nu există niciun buletin cu acest cod (cod de urmărire sau hash de intrare). */
    findBallot: (id: string, code: string) => request<BoardEntry>('GET', `${e(id)}/board/${encodeURIComponent(code.trim().toLowerCase())}`),
    getTally: (id: string) => request<TallyState>('GET', `${e(id)}/tally`),
    /** 404 până la publicarea rezultatului. */
    getResult: (id: string) => request<ElectionResult>('GET', `${e(id)}/result`),
    getRecord: (id: string) => request<ElectionRecord>('GET', `${e(id)}/record`),
    getAuditLog: (id: string) => request<AuditLogEntry[]>('GET', `${e(id)}/audit-log`),

    // ── Comisia ──
    adminLogin: (password: string) => request<AdminSession>('POST', '/auth/admin', { body: { password } }),
    createElection: (input: CreateElectionInput) => request<Election>('POST', '/elections', { body: input, admin: true }),
    importEligible: (id: string, csv: string) => request<EligibleImportResult>('POST', `${e(id)}/eligible`, { body: csv, contentType: 'text/csv', admin: true }),
    trusteeInvite: (id: string, trusteeId: string) => request<TrusteeInvite>('POST', `${e(id)}/trustees/${encodeURIComponent(trusteeId)}/invite`, { admin: true }),
    openElection: (id: string) => request<Election>('POST', `${e(id)}/open`, { admin: true }),
    closeElection: (id: string) => request<Election>('POST', `${e(id)}/close`, { admin: true }),

    // ── Trustees (CLI) ──
    submitTrusteeKey: (id: string, code: string, input: TrusteeKeySubmission) =>
      request<Election>('POST', `${e(id)}/trustees`, { body: input, headers: trusteeCode(code) }),
    submitPartialDecryption: (id: string, code: string, partial: PartialDecryption) =>
      request<TallyState>('POST', `${e(id)}/tally/partial`, { body: partial, headers: trusteeCode(code) }),

    // ── Alegătorul (aplicația) ──
    registerOcr: (id: string, input: RegisterOcrInput) => request<Registration>('POST', `${e(id)}/register/ocr`, { body: input }),
    registerNfc: (id: string, input: RegisterNfcInput) => request<Registration>('POST', `${e(id)}/register/nfc`, { body: input }),
    authChallenge: (input: AuthChallengeInput) => request<AuthChallenge>('POST', '/auth/challenge', { body: input }),
    authVerify: (input: AuthVerifyInput) => request<AuthSession>('POST', '/auth/verify', { body: input }),
    castBallot: (id: string, token: string, ballot: Ballot) => request<BallotReceipt>('POST', `${e(id)}/ballots`, { body: ballot, headers: bearer(token) }),

    // ── Demo (doar cu DEMO_MODE=true pe server) ──
    demo: {
      generateEligible: (id: string, count: number) => request<{ cnps: string[]; imported: number }>('POST', `/demo${e(id)}/eligible`, { body: { count }, admin: true }),
      sampleCnp: (id: string) => request<{ cnp: string | null }>('GET', `/demo${e(id)}/sample-cnp`),
      trusteeKeys: (id: string) => request<Election>('POST', `/demo${e(id)}/trustee-keys`, { admin: true }),
      voters: (id: string, count: number) => request<{ voted: number }>('POST', `/demo${e(id)}/voters`, { body: { count }, admin: true }),
      tally: (id: string) => request<Election>('POST', `/demo${e(id)}/tally`, { admin: true }),
      testDocument: (id: string) => request<{ dg1: string; sod: string; cnp: string } | null>('GET', `/demo${e(id)}/nfc-document`),
    },
  }
}
