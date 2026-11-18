// Membrii comisiei: fiecare primește un token propriu (afișat o singură dată) și un rol.

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api, type AdminRole, type CreatedMember } from '../../api'
import { canEdit, useAdmin } from '../../api/admin'
import { ErrorBox, Loading, Message } from '../../components/ui'
import { formatDateTime, roleLabel } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'

export function CommissionMembers() {
  const admin = useAdmin()
  const members = useAsync(() => api.listMembers(), [])
  const [name, setName] = useState('')
  const [role, setRole] = useState<AdminRole>('comisie')
  const [created, setCreated] = useState<CreatedMember>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      setCreated(await api.createMember({ name: name.trim(), role }))
      setName('')
      members.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id: string) => {
    setError(undefined)
    try {
      await api.revokeMember(id)
      members.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <Link to="/comisie" className="back">
        ← Panoul comisiei
      </Link>
      <div className="page-head">
        <div>
          <h1>Membrii comisiei</h1>
          <p className="lead">
            Fiecare membru intră cu token-ul lui, iar jurnalul de audit reține cine a făcut ce. Observatorii văd tot, dar nu pot schimba nimic.
          </p>
        </div>
      </div>

      {canEdit(admin) && (
        <form className="card" onSubmit={submit}>
          <h3>Membru nou</h3>
          <div className="grid-2">
            <label className="field">
              <span>Nume</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Maria Pop" required />
            </label>
            <label className="field">
              <span>Rol</span>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
                <option value="comisie">comisie (poate face orice)</option>
                <option value="observator">observator (doar citire)</option>
              </select>
            </label>
          </div>
          <button className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy ? 'Se creează…' : 'Creează membrul'}
          </button>
          {created && (
            <div className="card card-warn mt-s">
              <h3>Token-ul lui {created.name}: afișat o singură dată</h3>
              <p className="hint">Trimite-l pe un canal separat. Serverul păstrează doar hash-ul lui.</p>
              <code className="mono wrap">{created.token}</code>
            </div>
          )}
        </form>
      )}

      {error && <Message kind="bad">{error}</Message>}
      {members.loading && !members.data && <Loading />}
      {members.error && <ErrorBox error={members.error} onRetry={members.reload} />}
      {members.data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nume</th>
                <th>Rol</th>
                <th>Creat</th>
                <th>Stare</th>
                {canEdit(admin) && <th />}
              </tr>
            </thead>
            <tbody>
              {members.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    Niciun membru încă; doar token-ul rădăcină (ADMIN_TOKEN).
                  </td>
                </tr>
              )}
              {members.data.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{roleLabel[m.role]}</td>
                  <td className="muted nowrap">{formatDateTime(m.createdAt)}</td>
                  <td>{m.revokedAt ? <span className="badge badge-warn">revocat</span> : <span className="badge badge-ok">activ</span>}</td>
                  {canEdit(admin) && (
                    <td className="num">
                      {!m.revokedAt && (
                        <button type="button" className="btn btn-small" onClick={() => revoke(m.id)}>
                          Revocă
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
