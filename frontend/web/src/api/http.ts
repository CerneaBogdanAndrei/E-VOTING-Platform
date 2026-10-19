import { ApiError, type ApiClient } from './types'

export function createHttpClient(baseUrl: string): ApiClient {
  const root = baseUrl.replace(/\/+$/, '')

  async function request<T>(method: string, path: string, body?: unknown, contentType = 'application/json'): Promise<T> {
    let res: Response
    try {
      res = await fetch(root + path, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': contentType },
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
      throw new ApiError(res.status, message)
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  const e = (id: string) => `/elections/${encodeURIComponent(id)}`

  return {
    listElections: () => request('GET', '/elections'),
    getElection: (id) => request('GET', e(id)),
    createElection: (input) => request('POST', '/elections', input),
    importEligible: (id, csv) => request('POST', `${e(id)}/eligible`, csv, 'text/csv'),
    openElection: (id) => request('POST', `${e(id)}/open`),
    closeElection: (id) => request('POST', `${e(id)}/close`),
    registerOcr: (id, input) => request('POST', `${e(id)}/register/ocr`, input),
    registerNfc: (id, input) => request('POST', `${e(id)}/register/nfc`, input),
    castBallot: (id, ballot) => request('POST', `${e(id)}/ballots`, ballot),
    getBoard: (id) => request('GET', `${e(id)}/board`),
    findBallot: (id, code) => request('GET', `${e(id)}/board/${encodeURIComponent(code)}`),
    getResult: (id) => request('GET', `${e(id)}/result`),
  }
}
