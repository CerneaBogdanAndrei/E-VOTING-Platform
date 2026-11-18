import { useState } from 'react'
import { STEP_TITLES, verifyElection, type StepId, type VerificationReport } from '@evoting/crypto'
import { api, apiMode, type Election } from '../../../api'

/** Verificatorul public rulează în browser, cu aceeași bibliotecă ca serverul și aplicația. */
export function VerificationTab({ election }: { election: Election }) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ step: StepId; done: number; total: number }>()
  const [report, setReport] = useState<VerificationReport>()
  const [error, setError] = useState<string>()
  const [head, setHead] = useState('')
  const [elapsed, setElapsed] = useState(0)

  const run = async () => {
    setRunning(true)
    setReport(undefined)
    setError(undefined)
    const t = performance.now()
    try {
      const b = await api.getAuditBundle(election.id)
      const m = /^(\d+):([0-9a-fA-F]{64})$/.exec(head.trim())
      if (head.trim() && !m) throw new Error('Hash-ul publicat se scrie ca SEQ:HASH')
      const r = await verifyElection(
        { election: b.election, registrations: b.registrations, board: b.board, tally: b.tally, result: b.result },
        {
          publishedHead: m ? { seq: Number(m[1]), hash: m[2] } : undefined,
          onProgress: (step, done, total) => setProgress({ step, done, total }),
          yieldEvery: 4,
        },
      )
      setReport(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setElapsed(performance.now() - t)
      setRunning(false)
      setProgress(undefined)
    }
  }

  const download = async () => {
    const b = await api.getAuditBundle(election.id)
    const url = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${election.id}-audit.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="section">
      <p className="hint">
        Verificatorul rulează în browserul tău, cu aceeași bibliotecă folosită de server și de aplicație. Descarcă board-ul și reface fiecare pas: cheile,
        lanțul de hash-uri, semnăturile, dovezile zero-knowledge, agregatul și decriptarea. Nu ai nevoie de niciun drept special.
      </p>
      <div className="search">
        <input
          className="input mono"
          placeholder="Opțional: hash publicat independent, ca SEQ:HASH"
          value={head}
          onChange={(ev) => setHead(ev.target.value)}
          spellCheck={false}
        />
        <button type="button" className="btn btn-primary" onClick={run} disabled={running}>
          {running ? 'Se verifică…' : 'Verifică tot'}
        </button>
        <button type="button" className="btn" onClick={download}>
          Descarcă JSON
        </button>
      </div>
      {progress && (
        <div className="progress">
          <div className="progress-label">
            {STEP_TITLES[progress.step]}: {progress.done}/{progress.total}
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          </div>
        </div>
      )}
      {error && (
        <div role="alert" className="alert alert-bad">
          {error}
        </div>
      )}
      {report && (
        <>
          <div role="alert" className={`alert ${report.ok ? 'alert-ok' : 'alert-bad'}`}>
            {report.ok
              ? `Toate verificările trec (${report.ballots} buletine, ${(elapsed / 1000).toFixed(1)} s).`
              : 'Verificarea a picat: rezultatul nu este de încredere. Detaliile arată exact unde.'}
          </div>
          <ol className="report">
            {report.steps.map((st) => (
              <li key={st.id} className={`report-step report-${st.status}`}>
                <span className="report-icon">{st.status === 'ok' ? '✓' : st.status === 'fail' ? '✗' : '–'}</span>
                <div>
                  <strong>{st.title}</strong>
                  {st.details.map((d) => (
                    <div key={d} className="muted small">
                      {d}
                    </div>
                  ))}
                  {st.failures.map((f, i) => (
                    <div key={i} className="report-failure small">
                      <strong>{f.where}:</strong> {f.message}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <p className="hint mono wrap">Ultimul hash: {report.head}</p>
        </>
      )}
      {apiMode.kind === 'http' && (
        <p className="hint">
          Din linia de comandă:{' '}
          <code className="mono">
            npx evoting-verify --api {apiMode.url} --election {election.id}
          </code>
        </p>
      )}
    </section>
  )
}
