import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { api, ApiError, type BoardEntry, type Election } from '../api'
import { VerifyPanel } from '../components/VerifyPanel'
import { ErrorBox, Hash, Loading, Stat, StatusBadge } from '../components/ui'
import { formatDateTime, formatInterval, percent } from '../lib/format'
import { useAsync } from '../lib/useAsync'

type Tab = 'board' | 'rezultat' | 'verificare' | 'parametri' | 'jurnal'

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
            ['parametri', 'Parametri publici'],
            ['jurnal', 'Jurnal de audit'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className="tab" onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'board' && <Board election={e} />}
      {tab === 'rezultat' && <Result election={e} />}
      {tab === 'verificare' && <VerifyPanel election={e} />}
      {tab === 'parametri' && <Parameters election={e} />}
      {tab === 'jurnal' && <AuditLog election={e} />}
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
        <div role="alert" className="alert alert-ok">
          Buletinul #{lookup.entry.seq} e pe board, primit la {formatDateTime(lookup.entry.receivedAt)}. Codul de urmărire e hash-ul conținutului său,
          deci orice modificare l-ar fi schimbat.
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
                <th>Hash intrare</th>
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
                    <Hash value={b.trackingCode} />
                  </td>
                  <td>
                    <Hash value={b.hash} />
                  </td>
                  <td>
                    <Hash value={b.prevHash} />
                  </td>
                  <td>
                    <Hash value={b.ballot.credentialPubkey} head={6} tail={4} />
                  </td>
                  <td className="muted">{b.ballot.ciphertexts.length} × (A, B)</td>
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
        {formatDateTime(r.publishedAt)}, din {r.totalBallots} buletine. Verificați-le singuri în tab-ul „Verificare publică”.
      </p>
      <div className={`alert ${r.quorumReached ? 'alert-ok' : 'alert-warn'}`}>
        Cvorum (1/3 + 1 din {r.eligible} eligibili): {r.quorum} · participare {r.totalBallots} ({percent(r.totalBallots, r.eligible)}) ·{' '}
        {r.quorumReached ? 'atins' : 'neatins'}
      </div>
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
        <div className="kv mt-s">
          <span>Opțiuni permise per buletin</span>
          <span>{election.minSelections === election.maxSelections ? `exact ${election.maxSelections}` : `între ${election.minSelections} și ${election.maxSelections}`}</span>
        </div>
        <div className="kv">
          <span>Grup</span>
          <span>ristretto255 (ElGamal exponențial)</span>
        </div>
        <h3 className="mt">Candidați, în ordinea din vectorul de vot</h3>
        <ol className="list">
          {election.candidates.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong>{c.description && <span className="muted"> · {c.description}</span>}
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

function AuditLog({ election }: { election: Election }) {
  const log = useAsync(() => api.getAuditLog(election.id), [election.id, election.status, election.stats.eligible])
  if (log.error) return <ErrorBox error={log.error} onRetry={log.reload} />
  if (!log.data) return <Loading />
  return (
    <section className="section">
      <p className="hint">Acțiunile comisiei, ale trustees și ale serverului, în ordine. Lista eligibililor apare doar ca număr: CNP-urile nu se păstrează.</p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Când</th>
              <th>Cine</th>
              <th>Acțiune</th>
              <th>Detalii</th>
            </tr>
          </thead>
          <tbody>
            {log.data.map((a) => (
              <tr key={a.id}>
                <td className="num">{a.id}</td>
                <td className="muted nowrap">{formatDateTime(a.createdAt)}</td>
                <td>{a.actor}</td>
                <td>{a.action}</td>
                <td className="muted small mono">{Object.keys(a.payload).length ? JSON.stringify(a.payload).slice(0, 140) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
