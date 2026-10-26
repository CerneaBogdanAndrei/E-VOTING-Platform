import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { api, apiMode } from '../api'
import { getAdminToken, setAdminToken } from '../api/admin'

/**
 * Rutele comisiei cer token-ul de administrator (ADMIN_TOKEN din backend).
 * Cu backend-ul simulat nu e nevoie de el.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'ok' | 'login'>(() => (apiMode.kind === 'mock' ? 'ok' : getAdminToken() ? 'checking' : 'login'))
  const [token, setToken] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (apiMode.kind === 'mock' || !getAdminToken()) return
    api.checkAdmin().then(
      () => setState('ok'),
      () => {
        setAdminToken(null)
        setState('login')
      },
    )
  }, [])

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setBusy(true)
    setError(undefined)
    setAdminToken(token.trim())
    try {
      await api.checkAdmin()
      setState('ok')
    } catch (err) {
      setAdminToken(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (state === 'ok') return <>{children}</>
  if (state === 'checking') return <div className="state">Se verifică accesul…</div>
  return (
    <div className="login">
      <h1>Panoul comisiei</h1>
      <p className="lead">Introdu token-ul comisiei electorale (variabila ADMIN_TOKEN a serverului).</p>
      <form className="card" onSubmit={submit}>
        <label className="field">
          <span>Token</span>
          <input className="input mono" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} required />
        </label>
        {error && <div role="alert" className="alert alert-bad mt-s">{error}</div>}
        <button className="btn btn-primary mt-s" disabled={busy || !token.trim()}>
          {busy ? 'Se verifică…' : 'Intră'}
        </button>
        <p className="hint mt-s">Token-ul rămâne doar în acest tab. Încercările greșite repetate sunt blocate temporar de server.</p>
      </form>
    </div>
  )
}
