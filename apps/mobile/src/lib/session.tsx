import * as SecureStore from 'expo-secure-store'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import type { CredentialKeyPair } from '@evoting/crypto'
import type { BallotReceipt, Registration } from '../api'

// Starea alegătorului pe acest telefon, per scrutin: cheia de credential,
// înregistrarea și chitanța. Niciodată opțiunea aleasă.
// Se păstrează în SecureStore (Android Keystore / iOS Keychain); în browser, în localStorage.
export interface VoterSession {
  credential?: CredentialKeyPair
  registration?: Registration
  receipt?: BallotReceipt
}

interface SessionContextValue {
  ready: boolean
  sessions: Record<string, VoterSession>
  update: (electionId: string, patch: Partial<VoterSession>) => void
}

const INDEX_KEY = 'evoting.sessions'
const keyFor = (electionId: string) => `evoting.session.${electionId.replace(/[^A-Za-z0-9._-]/g, '_')}`

const store = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(key) ?? null
      } catch {
        return null
      }
    }
    return SecureStore.getItemAsync(key)
  },
  async set(key: string, value: string) {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(key, value)
      } catch {
        // stocare indisponibilă: sesiunea rămâne doar în memorie
      }
      return
    }
    await SecureStore.setItemAsync(key, value)
  },
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Record<string, VoterSession>>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const ids = JSON.parse((await store.get(INDEX_KEY)) ?? '[]') as string[]
        const loaded: Record<string, VoterSession> = {}
        for (const id of ids) {
          const raw = await store.get(keyFor(id))
          if (raw) loaded[id] = JSON.parse(raw) as VoterSession
        }
        setSessions(loaded)
      } catch {
        // pornire fără sesiuni salvate
      } finally {
        setReady(true)
      }
    })()
  }, [])

  const update = useCallback((electionId: string, patch: Partial<VoterSession>) => {
    setSessions((prev) => {
      const next = { ...prev, [electionId]: { ...prev[electionId], ...patch } }
      void store.set(keyFor(electionId), JSON.stringify(next[electionId]))
      void store.set(INDEX_KEY, JSON.stringify(Object.keys(next)))
      return next
    })
  }, [])

  const value = useMemo(() => ({ ready, sessions, update }), [ready, sessions, update])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(electionId: string) {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession în afara SessionProvider')
  const session = ctx.sessions[electionId] ?? {}
  const update = useCallback((patch: Partial<VoterSession>) => ctx.update(electionId, patch), [ctx, electionId])
  return { session, update, ready: ctx.ready }
}

export function useAllSessions() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useAllSessions în afara SessionProvider')
  return ctx.sessions
}
