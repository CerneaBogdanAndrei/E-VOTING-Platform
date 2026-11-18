// Formularul unui scrutin, folosit la creare și la modificare (în configurare).

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import type { CreateElectionInput, Election } from '../../api'

interface Row {
  key: number
  name: string
  description: string
}

let nextKey = 1
const row = (name = '', description = ''): Row => ({ key: nextKey++, name, description })

/** Valoare pentru <input type="datetime-local">, în ora locală. */
function localInput(date: Date) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return d.toISOString().slice(0, 16)
}

/** Implicit: de mâine la 8:00, timp de trei zile, până la 18:00. */
function defaultInterval() {
  const opens = new Date(Date.now() + 86_400_000)
  opens.setHours(8, 0, 0, 0)
  const closes = new Date(opens.getTime() + 2 * 86_400_000 + 10 * 3_600_000)
  return { opensAt: localInput(opens), closesAt: localInput(closes) }
}

export function ElectionForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  /** Scrutinul existent, la modificare. Fără el, formularul e de creare (cu trustees). */
  initial?: Election
  submitLabel: string
  onSubmit: (input: CreateElectionInput) => Promise<void>
}) {
  const editing = !!initial
  const [title, setTitle] = useState(initial?.title ?? '')
  const [opensAt, setOpensAt] = useState(() => (initial ? localInput(new Date(initial.opensAt)) : defaultInterval().opensAt))
  const [closesAt, setClosesAt] = useState(() => (initial ? localInput(new Date(initial.closesAt)) : defaultInterval().closesAt))
  const [candidates, setCandidates] = useState<Row[]>(() =>
    initial ? initial.candidates.filter((c) => c.kind === 'candidate').map((c) => row(c.name, c.description)) : [row(), row()],
  )
  const [allowBlank, setAllowBlank] = useState(() => initial?.candidates.some((c) => c.kind === 'blank') ?? false)
  const [trustees, setTrustees] = useState<Row[]>([row('Comisia electorală'), row('Observatori independenți'), row('Reprezentanții candidaților')])
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const update = (list: Row[], set: (r: Row[]) => void, key: number, patch: Partial<Row>) => set(list.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const move = (index: number, delta: number) => {
    const next = [...candidates]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    setCandidates(next)
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setError(undefined)
    setBusy(true)
    try {
      await onSubmit({
        title: title.trim(),
        opensAt: new Date(opensAt).toISOString(),
        closesAt: new Date(closesAt).toISOString(),
        candidates: candidates.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), description: c.description.trim() })),
        trustees: trustees.filter((t) => t.name.trim()).map((t) => ({ name: t.name.trim() })),
        allowBlank,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="card">
        <label className="field">
          <span>Titlu</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex. Reprezentanți studenți – Consiliul Facultății"
            required
          />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Deschidere</span>
            <input className="input" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} required />
          </label>
          <label className="field">
            <span>Închidere</span>
            <input className="input" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} required />
          </label>
        </div>
        <p className="hint">
          Votul se poate trimite doar în acest interval. Comisia poate deschide mai devreme sau închide mai devreme; la ora închiderii, serverul închide singur
          scrutinul.
        </p>
      </div>

      <div className="card">
        <h3>Candidați</h3>
        <p className="hint">Ordinea definește poziția în vectorul de vot și nu se mai schimbă după deschidere.</p>
        {candidates.map((c, i) => (
          <div key={c.key} className="row-edit">
            <span className="row-index">{i + 1}</span>
            <input className="input" placeholder="Nume" value={c.name} onChange={(e) => update(candidates, setCandidates, c.key, { name: e.target.value })} />
            <input
              className="input"
              placeholder="Descriere (ex. Calculatoare, anul III)"
              value={c.description}
              onChange={(e) => update(candidates, setCandidates, c.key, { description: e.target.value })}
            />
            <button type="button" className="btn btn-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mută în sus">
              ↑
            </button>
            <button type="button" className="btn btn-icon" onClick={() => move(i, 1)} disabled={i === candidates.length - 1} aria-label="Mută în jos">
              ↓
            </button>
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setCandidates(candidates.filter((x) => x.key !== c.key))}
              disabled={candidates.length <= 2}
              aria-label="Șterge"
            >
              ×
            </button>
          </div>
        ))}
        <div className="row gap-s">
          <button type="button" className="btn btn-small" onClick={() => setCandidates([...candidates, row()])}>
            + Candidat
          </button>
          <label className="check">
            <input type="checkbox" checked={allowBlank} onChange={(e) => setAllowBlank(e.target.checked)} />
            Permite votul alb (apare ca ultimă opțiune, numărat separat)
          </label>
        </div>
      </div>

      {!editing && (
        <div className="card">
          <h3>Trustees</h3>
          <p className="hint">Fiecare generează local o parte din cheie cu CLI-ul de trustee. Decriptarea rezultatului cere toți trustees.</p>
          {trustees.map((t, i) => (
            <div key={t.key} className="row-edit row-edit-short">
              <span className="row-index">{i + 1}</span>
              <input className="input" value={t.name} onChange={(e) => update(trustees, setTrustees, t.key, { name: e.target.value })} />
              <button
                type="button"
                className="btn btn-icon"
                onClick={() => setTrustees(trustees.filter((x) => x.key !== t.key))}
                disabled={trustees.length <= 1}
                aria-label="Șterge"
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-small" onClick={() => setTrustees([...trustees, row()])}>
            + Trustee
          </button>
        </div>
      )}
      {editing && <p className="hint">Trustees nu se pot schimba după creare: au primit deja token-urile. Pentru alți trustees, creează un scrutin nou.</p>}

      {error && (
        <div role="alert" className="alert alert-bad">
          {error}
        </div>
      )}
      <div className="row gap-s">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Se salvează…' : submitLabel}
        </button>
        <Link to={initial ? `/comisie/${initial.id}` : '/comisie'} className="btn">
          Renunță
        </Link>
      </div>
    </form>
  )
}
