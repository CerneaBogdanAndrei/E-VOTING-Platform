import { Link, useNavigate } from 'react-router'
import { api } from '../../api'
import { ElectionForm } from './ElectionForm'

export function CommissionNew() {
  const navigate = useNavigate()
  return (
    <>
      <Link to="/comisie" className="back">
        ← Panoul comisiei
      </Link>
      <div className="page-head">
        <h1>Scrutin nou</h1>
      </div>
      <ElectionForm
        submitLabel="Creează scrutinul"
        onSubmit={async (input) => {
          const created = await api.createElection(input)
          // token-urile trustees se afișează o singură dată, pe pagina scrutinului
          navigate(`/comisie/${created.election.id}`, { state: { trusteeTokens: created.trusteeTokens } })
        }}
      />
    </>
  )
}
