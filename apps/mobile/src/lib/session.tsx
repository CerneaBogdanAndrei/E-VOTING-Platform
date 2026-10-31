import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { BallotReceipt, Registration } from '../api'

// Starea alegătorului pe acest telefon, per scrutin. Ține doar credentialul și
// chitanța, niciodată opțiunea aleasă. Deocamdată în memorie; cheia de credential
// va sta în Android Keystore.
export interface VoterSession {
  registration?: Registration
  receipt?: BallotReceipt
}

interface SessionContextValue {
  sessions: Record<string, VoterSession>
  update: (electionId: string, patch: Partial<VoterSession>) => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Record<string, VoterSession>>({})
  const update = useCallback((electionId: string, patch: Partial<VoterSession>) => {
    setSessions((prev) => ({ ...prev, [electionId]: { ...prev[electionId], ...patch } }))
  }, [])
  const value = useMemo(() => ({ sessions, update }), [sessions, update])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(electionId: string) {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession în afara SessionProvider')
  const session = ctx.sessions[electionId] ?? {}
  const update = useCallback((patch: Partial<VoterSession>) => ctx.update(electionId, patch), [ctx, electionId])
  return { session, update }
}

export function useAllSessions() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useAllSessions în afara SessionProvider')
  return ctx.sessions
}
