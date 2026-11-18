import { Link } from 'react-router'
import { api } from '../api'
import { ErrorBox, Loading, StatusBadge } from '../components/ui'
import { formatDuration, formatInterval, intervalPhase, percent } from '../lib/format'
import { useAsync } from '../lib/useAsync'

/** O propoziție scurtă despre interval: „se închide peste 2 zile”, „începe peste 3 ore”. */
function phaseText(status: string, opensAt: string, closesAt: string) {
  if (status !== 'open' && status !== 'draft') return null
  const { phase, remainingMs } = intervalPhase(opensAt, closesAt)
  if (phase === 'before') return `începe peste ${formatDuration(remainingMs)}`
  if (phase === 'during') return status === 'open' ? `se închide peste ${formatDuration(remainingMs)}` : null
  return null
}

export function Home() {
  const { data, error, loading, reload } = useAsync(() => api.listElections(), [])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Scrutine</h1>
          <p className="lead">Bulletin board-ul și rezultatul fiecărui scrutin sunt publice: oricine le poate verifica.</p>
        </div>
      </div>

      {loading && !data && <Loading />}
      {error && <ErrorBox error={error} onRetry={reload} />}

      <div className="cards">
        {data?.map((e) => {
          const phase = phaseText(e.status, e.opensAt, e.closesAt)
          return (
            <Link key={e.id} to={`/scrutin/${e.id}`} className="card card-link">
              <div className="card-top">
                <StatusBadge status={e.status} />
                <span className="muted small">{formatInterval(e.opensAt, e.closesAt)}</span>
              </div>
              <h2 className="card-title">{e.title}</h2>
              <div className="card-meta">
                <span>
                  {e.candidates.filter((c) => c.kind === 'candidate').length} candidați{e.candidates.some((c) => c.kind === 'blank') ? ' + vot alb' : ''}
                  {e.requireNfc ? ' · doar NFC' : ''}
                  {phase ? ` · ${phase}` : ''}
                </span>
                <span>
                  {e.stats.ballots} buletine · participare {percent(e.stats.ballots, e.stats.eligible)}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
