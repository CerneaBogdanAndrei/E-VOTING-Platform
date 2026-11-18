import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { api, apiMode, type AdminIdentity } from '../../api'
import { AdminContext, getAdminToken, setAdminToken } from '../../api/admin'

/**
 * Rutele comisiei cer un token: ADMIN_TOKEN al serverului sau token-ul unui membru.
 * Cu backend-ul simulat nu e nevoie de el. Identitatea (nume, rol) ajunge în AdminContext.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'ok' | 'login'>(() => (apiMode.kind === 'mock' || getAdminToken() ? 'checking' : 'login'))
  const [identity, setIdentity] = useState<AdminIdentity>()
  const [token, setToken] = useState('')
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (state !== 'checking') return
    let cancelled = false
    api.checkAdmin().then(
      (id) => {
        if (cancelled) return
        setIdentity(id)
        setState('ok')
      },
      (err: unknown) => {
        if (cancelled) return
        setAdminToken(null)
        setError(err instanceof Error ? err.message : String(err))
        setState('login')
      },
    )
    return () => {
      cancelled = true
    }
  }, [state])

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    setError(undefined)
    setAdminToken(token.trim())
    setState('checking')
  }

  if (state === 'ok' && identity) return <AdminContext.Provider value={identity}>{children}</AdminContext.Provider>
  if (state === 'checking') return <div className="state">Se verifică accesul…</div>
  return (
    <div className="login">
      <h1>Panoul comisiei</h1>
      <p className="lead">Introdu token-ul comisiei (ADMIN_TOKEN al serverului sau token-ul tău de membru).</p>
      <form className="card" onSubmit={submit}>
        <label className="field">
          <span>Token</span>
          <input className="input mono" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} required />
        </label>
        {error && (
          <div role="alert" className="alert alert-bad mt-s">
            {error}
          </div>
        )}
        <button className="btn btn-primary mt-s" disabled={!token.trim()}>
          Intră
        </button>
        <p className="hint mt-s">Token-ul rămâne doar în acest tab. Încercările greșite repetate sunt blocate temporar de server.</p>
      </form>
    </div>
  )
}
