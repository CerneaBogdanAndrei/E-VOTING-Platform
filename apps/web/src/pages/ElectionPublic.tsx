import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { auditBallot, checkOwnEntry, verifyElection, STEP_TITLES, type StepId, type VerificationReport } from '@evoting/crypto'
import { api, apiMode, ApiError, type BoardEntry, type Election } from '../api'
import { ErrorBox, Hash, Loading, Stat, StatusBadge } from '../components/ui'
import { formatDateTime, formatInterval, percent } from '../lib/format'
import { useAsync } from '../lib/useAsync'

type Tab = 'board' | 'rezultat' | 'verificare' | 'benaloh' | 'parametri'

export function ElectionPublic() {
  const { id = '' } = useParams()
  const [tab, setTab] = useState<Tab>('board')
  const election = useAsync(() => api.getElection(id), [id])

  if (election.loading && !election.data) return <Loading />
  if (election.error) return <ErrorBox error={election.error} onRetry={election.reload} />
  const e = election.data!

  return (
    <>
      <Link to="/" className="back">
        ← Scrutine
      </Link>
      <div className="page-head">
        <div>
          <div className="row gap-s">
            <StatusBadge status={e.status} />
            <span className="muted small">{formatInterval(e.opensAt, e.closesAt)}</span>
          </div>
          <h1>{e.title}</h1>
        </div>
        <button type="button" className="btn" onClick={election.reload}>
          Reîmprospătează
        </button>
      </div>

      <div className="stats">
        <Stat label="Eligibili" value={e.stats.eligible} />
        <Stat label="Înregistrați" value={e.stats.registered} />
        <Stat label="Buletine pe board" value={e.stats.ballots} />
        <Stat label="Participare" value={percent(e.stats.ballots, e.stats.eligible)} />
      </div>

      <div className="tabs" role="tablist">
        {(
          [
            ['board', 'Bulletin board'],
            ['rezultat', 'Rezultat'],
            ['verificare', 'Verificare publică'],
            ['benaloh', 'Audit buletin'],
            ['parametri', 'Parametri publici'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className="tab" onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'board' && <Board election={e} />}
      {tab === 'rezultat' && <Result election={e} />}
      {tab === 'verificare' && <Verification election={e} />}
      {tab === 'benaloh' && <BenalohAudit election={e} />}
      {tab === 'parametri' && <Parameters election={e} />}
    </>
  )
}

function Board({ election }: { election: Election }) {
  const board = useAsync(() => api.getBoard(election.id), [election.id, election.stats.ballots])
  const [code, setCode] = useState('')
  const [lookup, setLookup] = useState<{ entry?: BoardEntry; error?: string; busy?: boolean }>({})

  const search = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!code.trim()) return
    setLookup({ busy: true })
    try {
      setLookup({ entry: await api.findBallot(election.id, code) })
    } catch (err) {
      setLookup({ error: err instanceof ApiError || err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <section className="section">
      <p className="hint">
        Fiecare intrare conține hash-ul celei anterioare, deci orice modificare a unui buletin rupe lanțul. Alegătorul își caută
        buletinul după codul de urmărire primit în aplicație.
      </p>

      <form className="search" onSubmit={search}>
        <input
          className="input mono"
          placeholder="Cod de urmărire (64 de caractere hex)"
          value={code}
          onChange={(ev) => setCode(ev.target.value)}
          spellCheck={false}
        />
        <button className="btn btn-primary" disabled={lookup.busy}>
          Caută
        </button>
      </form>
      {lookup.entry && (
        <div role="alert" className={`alert ${checkOwnEntry(election.id, lookup.entry, { trackingCode: code }).ok ? 'alert-ok' : 'alert-bad'}`}>
          {checkOwnEntry(election.id, lookup.entry, { trackingCode: code }).ok
            ? `Buletinul #${lookup.entry.seq} e pe board, primit la ${formatDateTime(lookup.entry.receivedAt)}. Hash-ul recalculat în browser corespunde codului.`
            : 'Intrarea găsită nu corespunde codului: conținutul a fost modificat. Raportează comisiei.'}
        </div>
      )}
      {lookup.error && <div role="alert" className="alert alert-bad">{lookup.error}</div>}

      {board.error && <ErrorBox error={board.error} onRetry={board.reload} />}
      {board.data && board.data.length === 0 && <div className="state">Niciun buletin încă.</div>}
      {board.data && board.data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Cod de urmărire</th>
                <th>Hash anterior</th>
                <th>Credential</th>
                <th>Criptotexte</th>
                <th>Primit</th>
              </tr>
            </thead>
            <tbody>
              {[...board.data].reverse().map((b) => (
                <tr key={b.seq} className={lookup.entry?.seq === b.seq ? 'row-hit' : undefined}>
                  <td className="num">{b.seq}</td>
                  <td>
                    <Hash value={b.hash} />
                  </td>
                  <td>
                    <Hash value={b.prevHash} />
                  </td>
                  <td>
                    <Hash value={b.credentialPubkey} head={6} tail={4} />
                  </td>
                  <td className="muted">{b.ciphertexts.length} × (A, B)</td>
                  <td className="muted nowrap">{formatDateTime(b.receivedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Result({ election }: { election: Election }) {
  const result = useAsync(
    () => (election.status === 'tallied' ? api.getResult(election.id) : Promise.resolve(null)),
    [election.id, election.status],
  )

  if (election.status !== 'tallied') {
    return (
      <section className="section">
        <div className="state">
          Rezultatul apare după închiderea votului și după ce toți cei {election.trustees.length} trustees își trimit decriptarea
          parțială. Până atunci, nimeni nu poate vedea cum s-a votat.
        </div>
      </section>
    )
  }
  if (result.error) return <ErrorBox error={result.error} onRetry={result.reload} />
  if (!result.data) return <Loading />

  const r = result.data
  const max = Math.max(1, ...r.counts.map((c) => c.votes))
  const rows = election.candidates
    .map((c) => ({ c, votes: r.counts.find((x) => x.candidateId === c.id)?.votes ?? 0 }))
    .sort((a, b) => b.votes - a.votes)

  return (
    <section className="section">
      <p className="hint">
        Totalurile vin din agregarea homomorfă a criptotextelor de pe board, decriptată împreună de trustees. Publicat la{' '}
        {formatDateTime(r.publishedAt)}, din {r.totalBallots} buletine.
      </p>
      <div className="results">
        {rows.map(({ c, votes }, i) => (
          <div key={c.id} className="result-row">
            <div className="result-name">
              <strong>{c.name}</strong>
              <span className="muted small">{c.description}</span>
            </div>
            <div className="result-bar">
              <div className={`result-fill${i === 0 ? ' result-lead' : ''}`} style={{ width: `${(votes / max) * 100}%` }} />
            </div>
            <div className="result-num">
              <strong>{votes}</strong>
              <span className="muted small">{percent(votes, r.totalBallots)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Parameters({ election }: { election: Election }) {
  return (
    <section className="section grid-2">
      <div className="card">
        <h3>Cheia scrutinului</h3>
        <p className="hint">Y = Y₁ + Y₂ + Y₃: se criptează cu ea, dar decriptarea cere toți trustees.</p>
        {election.publicKey ? <Hash value={election.publicKey} head={16} tail={12} /> : <span className="muted">Încă negenerată</span>}
        <h3 className="mt">Candidați, în ordinea din vectorul de vot</h3>
        <ol className="list">
          {election.candidates.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong> <span className="muted">· {c.description}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="card">
        <h3>Trustees</h3>
        <ul className="list-plain">
          {election.trustees.map((t) => (
            <li key={t.id} className="trustee">
              <span>{t.name}</span>
              {t.publicKeyShare ? <Hash value={t.publicKeyShare} /> : <span className="muted small">fără cheie</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Verification({ election }: { election: Election }) {
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
        Verificatorul rulează în browserul tău, cu aceeași bibliotecă folosită de server și de aplicație. Descarcă board-ul și reface fiecare
        pas: cheile, lanțul de hash-uri, semnăturile, dovezile zero-knowledge, agregatul și decriptarea. Nu ai nevoie de niciun drept special.
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
      {error && <div role="alert" className="alert alert-bad">{error}</div>}
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
          Din linia de comandă: <code className="mono">npx evoting-verify --api {apiMode.url} --election {election.id}</code>
        </p>
      )}
    </section>
  )
}

function BenalohAudit({ election }: { election: Election }) {
  const [text, setText] = useState('')
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string }>()

  const check = () => {
    try {
      if (!election.publicKey) throw new Error('Scrutinul nu are încă o cheie publică')
      const data = JSON.parse(text)
      if (data.electionId && data.electionId !== election.id) throw new Error('Fișierul de audit aparține altui scrutin')
      const r = auditBallot({ electionId: election.id, publicKey: election.publicKey, candidateCount: election.candidates.length }, data.ciphertexts, data.secrets)
      if (r.ok) {
        const c = election.candidates.find((x) => x.position === r.choice)
        setOutcome({ ok: true, text: `Buletinul criptează exact opțiunea declarată: ${c?.name ?? r.choice}. Aplicația a criptat corect.` })
      } else setOutcome({ ok: false, text: `${r.reason}. Aplicația NU a criptat opțiunea aleasă: raportează comisiei.` })
    } catch (err) {
      setOutcome({ ok: false, text: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <section className="section">
      <p className="hint">
        Provocarea Benaloh: înainte de trimitere, aplicația poate dezvălui numerele aleatoare r ale unui buletin. Lipește aici datele de audit
        exportate din aplicație; browserul recriptează opțiunea declarată și compară. Un buletin auditat nu se mai trimite: aplicația îl
        recriptează cu r noi, deci secretul votului rămâne.
      </p>
      <textarea className="input mono" rows={8} value={text} onChange={(ev) => setText(ev.target.value)} placeholder='{"electionId": "...", "ciphertexts": [...], "secrets": {"choice": 1, "randomness": [...]}}' spellCheck={false} />
      <div className="row gap-s mt-s">
        <button type="button" className="btn btn-primary" onClick={check} disabled={!text.trim()}>
          Verifică buletinul auditat
        </button>
      </div>
      {outcome && <div role="alert" className={`alert mt-s ${outcome.ok ? 'alert-ok' : 'alert-bad'}`}>{outcome.text}</div>}
    </section>
  )
}
