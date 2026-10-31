import { useState } from 'react'
import { verifyElectionRecord, type VerificationReport } from '@evoting/crypto'
import { api, type Election } from '../api'

/**
 * Verificatorul public, în browser: același cod ca CLI-ul (@evoting/crypto),
 * pentru observatorii care nu vor să instaleze nimic. Totul rulează local, în pagină.
 */
export function VerifyPanel({ election }: { election: Election }) {
  const [anchor, setAnchor] = useState('')
  const [report, setReport] = useState<VerificationReport>()
  const [progress, setProgress] = useState<{ done: number; total: number }>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    setError(undefined)
    setReport(undefined)
    try {
      const record = await api.getRecord(election.id)
      setProgress({ done: 0, total: record.board.length })
      const anchors = anchor.split(/[\s,]+/).map((a) => a.trim().toLowerCase()).filter(Boolean)
      const r = await verifyElectionRecord(record, {
        anchors,
        yieldEvery: 5,
        onProgress: (done, total) => {
          if (done % 5 === 0 || done === total) setProgress({ done, total })
        },
      })
      setReport(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const download = async () => {
    const record = await api.getRecord(election.id)
    const url = URL.createObjectURL(new Blob([JSON.stringify(record)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${election.id}.registru.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="section">
      <p className="hint">
        Descarcă registrul public al scrutinului și verifică, în acest browser: cheile trustees, lanțul de hash-uri, semnăturile și unicitatea
        credentialelor, dovezile zero-knowledge ale fiecărui buletin, agregatul recalculat de la zero și decriptările parțiale. Același cod rulează
        în CLI-ul de verificare (<span className="mono">evoting-verify</span>).
      </p>
      {election.status === 'draft' ? (
        <div className="state">Verificarea devine posibilă după ce toți trustees și-au trimis cheile.</div>
      ) : (
        <>
          <label className="field">
            <span>Hash publicat independent (opțional, de exemplu de pe site-ul facultății)</span>
            <input className="input mono" value={anchor} onChange={(e) => setAnchor(e.target.value)} placeholder="64 de caractere hex" spellCheck={false} />
          </label>
          <div className="row gap-s">
            <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
              {busy ? `Se verifică… ${progress ? `${progress.done}/${progress.total} buletine` : ''}` : 'Verifică scrutinul'}
            </button>
            <button type="button" className="btn" onClick={download}>
              Descarcă registrul (JSON)
            </button>
          </div>
        </>
      )}
      {error && <div role="alert" className="alert alert-bad mt-s">{error}</div>}
      {report && (
        <div className="verify mt">
          <div className={`alert ${report.ok ? 'alert-ok' : 'alert-bad'}`}>
            <strong>{report.ok ? 'Toate verificările trec.' : 'Verificarea a eșuat: rezultatul nu este de încredere.'}</strong>
            <span className="muted small"> ({(report.ms / 1000).toFixed(1)} s)</span>
          </div>
          <ol className="verify-steps">
            {report.steps.map((s) => (
              <li key={s.key} className={s.skipped ? 'skipped' : s.ok ? 'ok' : 'bad'}>
                <span className="verify-mark">{s.skipped ? '–' : s.ok ? '✓' : '✗'}</span>
                <div>
                  <strong>{s.title}</strong>
                  <div className="muted small">{s.summary}</div>
                  {s.problems.map((p) => (
                    <div key={p} className="verify-problem">
                      {p}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <div className="kv">
            <span>Capul lanțului recalculat</span>
            <span className="mono small">{report.head}</span>
          </div>
        </div>
      )}
    </section>
  )
}
