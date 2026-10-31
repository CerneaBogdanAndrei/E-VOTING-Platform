// Clientul API comun (@evoting/api), configurat pentru panoul web.
// Tokenul comisiei stă în sessionStorage: se pierde la închiderea tab-ului.

import { createApiClient, type ServerInfo } from '@evoting/api'
import { API_URL } from './config'

const TOKEN_KEY = 'evoting.admin'

function readToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const { token, expiresAt } = JSON.parse(raw) as { token: string; expiresAt: string }
    return new Date(expiresAt) > new Date() ? token : null
  } catch {
    return null
  }
}

export const adminSession = {
  token: readToken,
  save(token: string, expiresAt: string) {
    try {
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }))
    } catch {
      // stocare indisponibilă: sesiunea ține doar cât pagina
    }
    memoryToken = token
  },
  clear() {
    try {
      sessionStorage.removeItem(TOKEN_KEY)
    } catch {
      // ignorat
    }
    memoryToken = null
  },
}

let memoryToken: string | null = readToken()

export const api = createApiClient(API_URL, { adminToken: () => memoryToken ?? readToken() })
export const apiUrl = API_URL

let infoPromise: Promise<ServerInfo> | null = null
/** Informații despre server (mod demo, NFC), încărcate o singură dată. */
export const serverInfo = () => (infoPromise ??= api.info().catch((err) => {
  infoPromise = null
  throw err
}))

export * from '@evoting/api'
