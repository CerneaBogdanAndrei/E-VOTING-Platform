import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../../api'
import { ErrorBox, Loading } from '../../components/ui'
import { useAsync } from '../../lib/useAsync'
import { ElectionForm } from './ElectionForm'

/** Modificarea unui scrutin în configurare: titlu, interval, candidați, vot alb. */
export function CommissionEdit() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const election = useAsync(() => api.getElection(id), [id])

  if (election.loading && !election.data) return <Loading />
  if (election.error) return <ErrorBox error={election.error} onRetry={election.reload} />
  const e = election.data!

  return (
    <>
      <Link to={`/comisie/${e.id}`} className="back">
        ← {e.title}
      </Link>
      <div className="page-head">
        <h1>Modifică scrutinul</h1>
      </div>
      {e.status !== 'draft' ? (
        <div className="state">Scrutinul se poate modifica doar în configurare.</div>
      ) : (
        <ElectionForm
          initial={e}
          submitLabel="Salvează modificările"
          onSubmit={async ({ title, opensAt, closesAt, candidates, allowBlank }) => {
            await api.updateElection(e.id, { title, opensAt, closesAt, candidates, allowBlank })
            navigate(`/comisie/${e.id}`)
          }}
        />
      )}
    </>
  )
}
