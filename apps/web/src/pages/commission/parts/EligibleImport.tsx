import { useState, type ChangeEvent } from 'react'
import { api, type Election, type EligibleImportResult } from '../../../api'

/** Importul listei de eligibili: CSV cu un CNP pe linie, lipit sau încărcat din fișier. Merge și cu votul deschis. */
export function EligibleImport({ election, onImported }: { election: Election; onImported: () => void }) {
  const [csv, setCsv] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<EligibleImportResult>()
  const [error, setError] = useState<string>()

  const readFile = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    if (file) setCsv(await file.text())
  }

  const submit = async () => {
    setBusy(true)
    setError(undefined)
    try {
      setResult(await api.importEligible(election.id, csv))
      setCsv('')
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3>Lista alegătorilor eligibili</h3>
      <p className="hint">
        CSV cu un CNP pe linie. Serverul păstrează doar HMAC(CNP) și aruncă imediat valorile în clar. Acum sunt {election.stats.eligible} eligibili.
        {election.status === 'open' && ' Votul e deschis: cei adăugați acum se pot înregistra imediat.'}
      </p>
      <textarea
        className="input mono"
        rows={5}
        value={csv}
        onChange={(ev) => setCsv(ev.target.value)}
        placeholder={'cnp\n5040312170018\n...'}
        spellCheck={false}
      />
      <div className="row gap-s mt-s">
        <label className="btn">
          Alege fișier CSV
          <input type="file" accept=".csv,text/csv,text/plain" onChange={readFile} hidden />
        </label>
        <button type="button" className="btn btn-primary" disabled={busy || !csv.trim()} onClick={submit}>
          {busy ? 'Se importă…' : 'Importă'}
        </button>
      </div>
      {error && (
        <div role="alert" className="alert alert-bad mt-s">
          {error}
        </div>
      )}
      {result && (
        <div role="alert" className={`alert mt-s ${result.invalid.length ? 'alert-warn' : 'alert-ok'}`}>
          <span>
            Importați: {result.imported} · duplicate: {result.duplicates} · invalide: {result.invalid.length}
            {result.invalid.length > 0 &&
              ` (liniile ${result.invalid
                .slice(0, 8)
                .map((x) => x.line)
                .join(', ')}${result.invalid.length > 8 ? '…' : ''})`}
          </span>
        </div>
      )}
    </div>
  )
}
