import { API_URL } from './config'
import { createHttpClient } from './http'
import { createMockBackend, type MockTools } from './mock'
import type { ApiClient } from './types'

const mock = API_URL ? null : createMockBackend()

export const api: ApiClient = mock ? mock.client : createHttpClient(API_URL!)

/** Unelte de test, disponibile doar cu backend-ul simulat. */
export const mockTools: MockTools | null = mock ? mock.tools : null

export const apiMode = mock ? ({ kind: 'mock' } as const) : ({ kind: 'http', url: API_URL! } as const)

export * from './types'
