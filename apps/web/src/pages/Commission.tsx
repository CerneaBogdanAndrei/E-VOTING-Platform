import { Link } from 'react-router'
import { api } from '../api'
import { ErrorBox, Loading, StatusBadge } from '../components/ui'
import { formatInterval } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { logout } from '../components/RequireAdmin'

export function Commission() {
  const { data, error, loading, reload } = useAsync(() => api.listElections(), [])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Panoul comisiei</h1>
          <p className="lead">Creează scrutine, importă lista eligibililor și deschide sau închide votul.</p>
        </div>
        <div className="row gap-s">
          <button type="button" className="btn" onClick={logout}>
            Ieșire
          </button>
          <Link to="/comisie/nou" className="btn btn-primary">
            Scrutin nou
          </Link>
        </div>
      </div>

      {loading && !data && <Loading />}
      {error && <ErrorBox error={error} onRetry={reload} />}

      {data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Scrutin</th>
                <th>Stare</th>
                <th>Interval</th>
                <th className="num">Eligibili</th>
                <th className="num">Înregistrați</th>
                <th className="num">Buletine</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link to={`/comisie/${e.id}`} className="strong-link">
                      {e.title}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="muted nowrap">{formatInterval(e.opensAt, e.closesAt)}</td>
                  <td className="num">{e.stats.eligible}</td>
                  <td className="num">{e.stats.registered}</td>
                  <td className="num">{e.stats.ballots}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
