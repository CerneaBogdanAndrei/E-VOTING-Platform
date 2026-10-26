import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import type { BallotReceipt, Registration, VoterCredential } from '../api'

// Starea alegătorului pe acest telefon, per scrutin: credentialul, înregistrarea și
// chitanța, niciodată opțiunea aleasă. Pe Android se păstrează în SecureStore, adică
// criptată cu o cheie din Android Keystore; pe web (doar pentru demonstrații) în localStorage.
export interface VoterSession {
  credential?: VoterCredential
  registration?: Registration
  receipt?: BallotReceipt
}

const INDEX_KEY = 'evoting.sessions'
const keyFor = (electionId: string) => `evoting.session.${electionId.replace(/[^A-Za-z0-9._-]/g, '_')}`

const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null
      return await SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },
  async set(key: string, value: string) {
    try {
      if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value)
      else await SecureStore.setItemAsync(key, value)
    } catch {
      // fără stocare persistentă, sesiunea rămâne doar în memorie
    }
  },
}

interface SessionContextValue {
  sessions: Record<string, VoterSession>
  loaded: boolean
  update: (electionId: string, patch: Partial<VoterSession>) => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Record<string, VoterSession>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ids: string[] = JSON.parse((await storage.get(INDEX_KEY)) ?? '[]')
      const restored: Record<string, VoterSession> = {}
      for (const id of ids) {
        const raw = await storage.get(keyFor(id))
        if (raw) restored[id] = JSON.parse(raw)
      }
      if (!cancelled) {
        setSessions((prev) => ({ ...restored, ...prev }))
        setLoaded(true)
      }
    })().catch(() => setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback((electionId: string, patch: Partial<VoterSession>) => {
    setSessions((prev) => {
      const next = { ...prev, [electionId]: { ...prev[electionId], ...patch } }
      void storage.set(keyFor(electionId), JSON.stringify(next[electionId]))
      void storage.set(INDEX_KEY, JSON.stringify(Object.keys(next)))
      return next
    })
  }, [])

  const value = useMemo(() => ({ sessions, loaded, update }), [sessions, loaded, update])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(electionId: string) {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession în afara SessionProvider')
  const session = ctx.sessions[electionId] ?? {}
  const update = useCallback((patch: Partial<VoterSession>) => ctx.update(electionId, patch), [ctx, electionId])
  return { session, update, loaded: ctx.loaded }
}

export function useAllSessions() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useAllSessions în afara SessionProvider')
  return ctx.sessions
}
