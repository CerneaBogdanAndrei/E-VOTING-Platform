import { useState, type FormEvent, type ReactNode } from 'react'
import { adminSession, api, ApiError } from '../api'

/** Paginile comisiei cer parola; tokenul primit ține până la închiderea tab-ului. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => adminSession.token())
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  if (token) return <>{children}</>

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      const s = await api.adminLogin(password)
      adminSession.save(s.token, s.expiresAt)
      setToken(s.token)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? 'Prea multe încercări. Așteaptă un minut.' : err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <h1>Comisia electorală</h1>
        <p className="hint">Autentificarea e limitată la 5 încercări pe minut, ca parola să nu poată fi ghicită prin încercări repetate.</p>
        <label className="field">
          <span>Parola comisiei</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
        </label>
        {error && <div role="alert" className="alert alert-bad">{error}</div>}
        <button className="btn btn-primary" disabled={busy || !password}>
          {busy ? 'Se verifică…' : 'Intră'}
        </button>
      </form>
    </div>
  )
}

export function logout() {
  adminSession.clear()
  window.location.assign('/')
}
