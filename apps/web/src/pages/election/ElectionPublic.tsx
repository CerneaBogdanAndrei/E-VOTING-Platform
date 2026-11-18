// Pagina publică a unui scrutin: statisticile și cele cinci tab-uri (board, rezultat,
// verificare publică, audit Benaloh, parametri). Fiecare tab e în ./tabs.

import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { api } from '../../api'
import { Countdown, ErrorBox, Loading, Stat, StatusBadge } from '../../components/ui'
import { formatInterval, percent } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { BenalohTab } from './tabs/BenalohTab'
import { BoardTab } from './tabs/BoardTab'
import { ParametersTab } from './tabs/ParametersTab'
import { ResultTab } from './tabs/ResultTab'
import { VerificationTab } from './tabs/VerificationTab'

type Tab = 'board' | 'rezultat' | 'verificare' | 'benaloh' | 'parametri'

const TABS: [Tab, string][] = [
  ['board', 'Bulletin board'],
  ['rezultat', 'Rezultat'],
  ['verificare', 'Verificare publică'],
  ['benaloh', 'Audit buletin'],
  ['parametri', 'Parametri publici'],
]

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
          <Countdown status={e.status} opensAt={e.opensAt} closesAt={e.closesAt} />
        </div>
        <div className="row gap-s">
          <Link to={`/scrutin/${e.id}/proces-verbal`} className="btn">
            Proces-verbal
          </Link>
          <button type="button" className="btn" onClick={election.reload}>
            Reîmprospătează
          </button>
        </div>
      </div>

      <div className="stats">
        <Stat label="Eligibili" value={e.stats.eligible} />
        <Stat label="Înregistrați" value={e.stats.registered} />
        <Stat label="Buletine pe board" value={e.stats.ballots} />
        <Stat label="Participare" value={percent(e.stats.ballots, e.stats.eligible)} />
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className="tab" onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'board' && <BoardTab election={e} />}
      {tab === 'rezultat' && <ResultTab election={e} />}
      {tab === 'verificare' && <VerificationTab election={e} />}
      {tab === 'benaloh' && <BenalohTab election={e} />}
      {tab === 'parametri' && <ParametersTab election={e} />}
    </>
  )
}
