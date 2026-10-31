import { serverInfo } from '../api'
import { useAsync } from './useAsync'

/** Informații despre server: dacă e în mod demo și dacă are NFC configurat. */
export function useServerInfo() {
  return useAsync(() => serverInfo(), []).data
}
