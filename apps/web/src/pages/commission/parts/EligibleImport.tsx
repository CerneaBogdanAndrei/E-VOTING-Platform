import { useState, type ChangeEvent } from 'react'
import { api, type Election, type EligibleImportResult, type EligibleRemoveResult } from '../../../api'
import { plural } from '../../../lib/format'

type Mode = 'add' | 'remove'
type Outcome = { mode: 'add'; result: EligibleImportResult } | { mode: 'remove'; result: EligibleRemoveResult }

/** „(linia 4)”, „(liniile 4, 7, 9…)”: unde sunt CNP-urile invalide din CSV. */
function invalidLines(invalid: { line: number }[]) {
  if (!invalid.length) return ''
  const shown = invalid
    .slice(0, 8)
    .map((x) => x.line)
    .join(', ')
  return ` (${invalid.length === 1 ? 'linia' : 'liniile'} ${shown}${invalid.length > 8 ? '…' : ''})`
}

/**
 * Lista de eligibili: CSV cu un CNP pe linie, lipit sau încărcat din fișier, pentru adăugare sau pentru scoatere
 * (o persoană adăugată din greșeală). Merge și cu votul deschis. Cine a votat deja nu mai poate fi scos.
 */
export function EligibleImport({ election, onImported }: { election: Election; onImported: () => void }) {
  const [mode, setMode] = useState<Mode>('add')
  const [csv, setCsv] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>()
  const [error, setError] = useState<string>()

  const readFile = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    if (file) setCsv(await file.text())
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setConfirmRemove(false)
    setOutcome(undefined)
    setError(undefined)
  }

  const submit = async () => {
    // scoaterea poate șterge înregistrări: cere a doua apăsare
    if (mode === 'remove' && !confirmRemove) return setConfirmRemove(true)
    setBusy(true)
    setError(undefined)
    try {
      setOutcome(mode === 'add' ? { mode, result: await api.importEligible(election.id, csv) } : { mode, result: await api.removeEligible(election.id, csv) })
      setCsv('')
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      setConfirmRemove(false)
    }
  }

  const label = mode === 'add' ? (busy ? 'Se importă…' : 'Importă') : busy ? 'Se scot…' : confirmRemove ? 'Da, scoate-i din listă' : 'Scoate din listă'

  return (
    <div className="card">
      <div className="row space-between">
        <h3>Lista alegătorilor eligibili</h3>
        <div className="row gap-s" role="group" aria-label="Ce faci cu lista">
          <button
            type="button"
            className={`btn btn-small${mode === 'add' ? ' btn-primary' : ''}`}
            aria-pressed={mode === 'add'}
            onClick={() => switchMode('add')}
          >
            Adaugă
          </button>
          <button
            type="button"
            className={`btn btn-small${mode === 'remove' ? ' btn-primary' : ''}`}
            aria-pressed={mode === 'remove'}
            onClick={() => switchMode('remove')}
          >
            Scoate
          </button>
        </div>
      </div>
      <p className="hint">
        CSV cu un CNP pe linie. Serverul păstrează doar HMAC(CNP) și aruncă imediat valorile în clar. Acum sunt{' '}
        {plural(election.stats.eligible, 'eligibil', 'eligibili')}.
        {mode === 'add' && election.status === 'open' && ' Votul e deschis: cei adăugați acum se pot înregistra imediat.'}
        {mode === 'remove' &&
          ' Cine e scos nu se mai poate înregistra; dacă s-a înregistrat, dar n-a votat, înregistrarea lui se șterge și ea. Cine a votat deja rămâne: votul de pe board nu se mai scoate. Totul apare în jurnal, fără CNP-uri.'}
      </p>
      <textarea
        className="input mono"
        rows={5}
        value={csv}
        onChange={(ev) => {
          setCsv(ev.target.value)
          setConfirmRemove(false)
        }}
        placeholder={'cnp\n5040312170018\n...'}
        spellCheck={false}
        aria-label={mode === 'add' ? 'CNP-urile de adăugat' : 'CNP-urile de scos'}
      />
      <div className="row gap-s mt-s">
        <label className="btn">
          Alege fișier CSV
          <input type="file" accept=".csv,text/csv,text/plain" onChange={readFile} hidden />
        </label>
        <button type="button" className={`btn ${mode === 'remove' ? 'btn-danger' : 'btn-primary'}`} disabled={busy || !csv.trim()} onClick={submit}>
          {label}
        </button>
        {confirmRemove && (
          <button type="button" className="btn" onClick={() => setConfirmRemove(false)}>
            Nu
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="alert alert-bad mt-s">
          {error}
        </div>
      )}
      {outcome?.mode === 'add' && (
        <div role="alert" className={`alert mt-s ${outcome.result.invalid.length ? 'alert-warn' : 'alert-ok'}`}>
          <span>
            Importați: {outcome.result.imported} · duplicate: {outcome.result.duplicates} · invalide: {outcome.result.invalid.length}
            {invalidLines(outcome.result.invalid)}
          </span>
        </div>
      )}
      {outcome?.mode === 'remove' && (
        <div role="alert" className={`alert mt-s ${outcome.result.invalid.length || outcome.result.voted ? 'alert-warn' : 'alert-ok'}`}>
          <span>
            Scoși: {outcome.result.removed} (dintre care cu înregistrarea ștearsă: {outcome.result.registrationsRemoved}) · nu erau în listă:{' '}
            {outcome.result.notFound} · păstrați pentru că au votat deja: {outcome.result.voted} · invalide: {outcome.result.invalid.length}
            {invalidLines(outcome.result.invalid)}
          </span>
        </div>
      )}
    </div>
  )
}
