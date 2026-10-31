import { createApiClient, type ServerInfo } from '@evoting/api'
import { API_URL } from './config'

export const api = createApiClient(API_URL)
export const apiUrl = API_URL

let infoPromise: Promise<ServerInfo> | null = null
/** Informații despre server (mod demo, NFC configurat), încărcate o singură dată. */
export const serverInfo = () =>
  (infoPromise ??= api.info().catch((err) => {
    infoPromise = null
    throw err
  }))

export * from '@evoting/api'
