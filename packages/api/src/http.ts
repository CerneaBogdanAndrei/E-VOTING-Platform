import { ApiError, type ApiClient } from './types.js'

export interface HttpClientOptions {
  /** Token-ul comisiei, citit la fiecare cerere (se poate schimba după autentificare). */
  getAdminToken?: () => string | null | undefined
}

export function createHttpClient(baseUrl: string, options: HttpClientOptions = {}): ApiClient {
  const root = baseUrl.replace(/\/+$/, '')

  async function request<T>(
    method: string,
    path: string,
    { body, contentType = 'application/json', token }: { body?: unknown; contentType?: string; token?: string | null } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = contentType
    if (token) headers.Authorization = `Bearer ${token}`
    let res: Response
    try {
      res = await fetch(root + path, {
        method,
        headers,
        body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : String(body),
      })
    } catch {
      throw new ApiError(0, `Backend-ul nu răspunde (${root})`)
    }
    if (!res.ok) {
      let message = res.statusText || `Eroare ${res.status}`
      try {
        // Format NestJS: { statusCode, message, error }, cu message șir sau listă.
        const data = await res.json()
        if (Array.isArray(data?.message)) message = data.message.join('; ')
        else if (typeof data?.message === 'string') message = data.message
      } catch {
        // răspuns fără JSON
      }
      if (res.status === 429) message = 'Prea multe încercări. Așteaptă puțin și încearcă din nou.'
      throw new ApiError(res.status, message)
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  const e = (id: string) => `/elections/${encodeURIComponent(id)}`
  const admin = () => options.getAdminToken?.() ?? null

  return {
    listElections: () => request('GET', '/elections'),
    getElection: (id) => request('GET', e(id)),
    getBoard: (id) => request('GET', `${e(id)}/board`),
    findBallot: (id, code) => request('GET', `${e(id)}/board/${encodeURIComponent(code.trim().toLowerCase())}`),
    getBoardHead: (id) => request('GET', `${e(id)}/board-head`),
    getRegistrations: (id) => request('GET', `${e(id)}/registrations`),
    getTally: (id) => request('GET', `${e(id)}/tally`),
    getResult: (id) => request('GET', `${e(id)}/result`),
    getAuditBundle: (id) => request('GET', `${e(id)}/audit-bundle`),

    createElection: (input) => request('POST', '/elections', { body: input, token: admin() }),
    importEligible: (id, csv) => request('POST', `${e(id)}/eligible`, { body: csv, contentType: 'text/csv', token: admin() }),
    openElection: (id) => request('POST', `${e(id)}/open`, { token: admin() }),
    closeElection: (id) => request('POST', `${e(id)}/close`, { token: admin() }),
    getAuditLog: (id) => request('GET', `${e(id)}/audit-log`, { token: admin() }),
    checkAdmin: () => request('GET', '/admin/check', { token: admin() }),

    submitTrusteeKey: (id, token, key) => request('POST', `${e(id)}/trustees`, { body: key, token }),
    submitPartialDecryption: (id, token, partial) => request('POST', `${e(id)}/tally/partial`, { body: partial, token }),

    registerOcr: (id, input) => request('POST', `${e(id)}/register/ocr`, { body: input }),
    registerNfc: (id, input) => request('POST', `${e(id)}/register/nfc`, { body: input }),
    authChallenge: (id, credentialPubkey) => request('POST', '/auth/challenge', { body: { electionId: id, credentialPubkey } }),
    authVerify: (challengeId, signature) => request('POST', '/auth/verify', { body: { challengeId, signature } }),
    castBallot: (id, ballot, sessionToken) => request('POST', `${e(id)}/ballots`, { body: ballot, token: sessionToken }),
  }
}
