import { createHttpClient, createMockBackend, type ApiClient, type MockTools } from '@evoting/api'
import { getAdminToken } from './admin'
import { API_URL } from './config'

const mock = API_URL ? null : createMockBackend()

export const api: ApiClient = mock ? mock.client : createHttpClient(API_URL!, { getAdminToken })

/** Unelte de test, disponibile doar cu backend-ul simulat. */
export const mockTools: MockTools | null = mock ? mock.tools : null

export const apiMode = mock ? ({ kind: 'mock' } as const) : ({ kind: 'http', url: API_URL! } as const)

export * from '@evoting/api'
