import { createHttpClient, createMockBackend, type ApiClient, type MockTools } from '@evoting/api'
import { API_URL } from './config'

// Pe telefon criptarea e mai lentă decât în browser, deci scrutinele de demonstrație au mai puțini votanți.
const mock = API_URL ? null : createMockBackend({ seedVoters: { open: 3, tallied: 5 } })

export const api: ApiClient = mock ? mock.client : createHttpClient(API_URL!)

/** Unelte de test, disponibile doar cu backend-ul simulat. */
export const mockTools: MockTools | null = mock ? mock.tools : null

export const apiMode = mock ? ({ kind: 'mock' } as const) : ({ kind: 'http', url: API_URL! } as const)

export * from '@evoting/api'
