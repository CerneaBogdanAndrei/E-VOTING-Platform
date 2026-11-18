import { api, type Election } from '../../../api'
import { ErrorBox, Loading } from '../../../components/ui'
import { candidateLabel, formatDateTime, percent } from '../../../lib/format'
import { useAsync } from '../../../lib/useAsync'

/** Rezultatul, după decriptarea de către toți trustees; până atunci, o explicație. Votul alb apare separat, la final. */
export function ResultTab({ election }: { election: Election }) {
  const result = useAsync(() => (election.status === 'tallied' ? api.getResult(election.id) : Promise.resolve(null)), [election.id, election.status])

  if (election.status !== 'tallied') {
    return (
      <section className="section">
        <div className="state">
          Rezultatul apare după închiderea votului și după ce toți cei {election.trustees.length} trustees își trimit decriptarea parțială. Până atunci, nimeni
          nu poate vedea cum s-a votat.
        </div>
      </section>
    )
  }
  if (result.error) return <ErrorBox error={result.error} onRetry={result.reload} />
  if (!result.data) return <Loading />

  const r = result.data
  const rows = election.candidates.map((c) => ({ c, votes: r.counts.find((x) => x.candidateId === c.id)?.votes ?? 0 }))
  const candidates = rows.filter((x) => x.c.kind === 'candidate').sort((a, b) => b.votes - a.votes)
  const blank = rows.find((x) => x.c.kind === 'blank')
  const max = Math.max(1, ...candidates.map((x) => x.votes))

  return (
    <section className="section">
      <p className="hint">
        Totalurile vin din agregarea homomorfă a criptotextelor de pe board, decriptată împreună de trustees. Publicat la {formatDateTime(r.publishedAt)}, din{' '}
        {r.totalBallots} buletine.
      </p>
      <div className="results">
        {candidates.map(({ c, votes }, i) => (
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
        {blank && (
          <div className="result-row result-blank">
            <div className="result-name">
              <strong>{candidateLabel(blank.c)}</strong>
              <span className="muted small">niciun candidat ales</span>
            </div>
            <div />
            <div className="result-num">
              <strong>{blank.votes}</strong>
              <span className="muted small">{percent(blank.votes, r.totalBallots)}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
