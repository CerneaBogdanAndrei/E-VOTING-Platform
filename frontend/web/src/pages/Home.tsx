import { Link } from 'react-router'
import { api } from '../api'
import { ErrorBox, Loading, StatusBadge } from '../components/ui'
import { formatInterval, percent } from '../lib/format'
import { useAsync } from '../lib/useAsync'

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
        {data?.map((e) => (
          <Link key={e.id} to={`/scrutin/${e.id}`} className="card card-link">
            <div className="card-top">
              <StatusBadge status={e.status} />
              <span className="muted small">{formatInterval(e.opensAt, e.closesAt)}</span>
            </div>
            <h2 className="card-title">{e.title}</h2>
            <div className="card-meta">
              <span>{e.candidates.length} opțiuni</span>
              <span>
                {e.stats.ballots} buletine · participare {percent(e.stats.ballots, e.stats.eligible)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
