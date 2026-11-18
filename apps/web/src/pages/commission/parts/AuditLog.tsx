import { useState } from 'react'
import { api, type Election } from '../../../api'
import { ErrorBox } from '../../../components/ui'
import { useAsync } from '../../../lib/useAsync'

const ACTIONS: Record<string, string> = {
  'election.create': 'Scrutin creat',
  'election.update': 'Scrutin modificat',
  'election.delete': 'Scrutin șters',
  'eligible.import': 'Listă de eligibili importată',
  'trustee.key': 'Cheie de trustee primită',
  'election.public_key': 'Cheia scrutinului publicată',
  'election.open': 'Vot deschis',
  'voter.register': 'Alegător înregistrat',
  'voter.reregister': 'Alegător reînregistrat (credential înlocuit)',
  'election.close': 'Vot închis, agregat publicat',
  'tally.partial': 'Decriptare parțială primită',
  'tally.result': 'Rezultat publicat',
  'member.create': 'Membru al comisiei creat',
  'member.revoke': 'Membru al comisiei revocat',
}

/** Jurnalul de audit al scrutinului (pentru comisie și observatori). Înregistrările alegătorilor sunt doar numărate. */
export function AuditLog({ election }: { election: Election }) {
  const [open, setOpen] = useState(false)
  const log = useAsync(() => (open ? api.getAuditLog(election.id) : Promise.resolve([])), [election.id, open, election.status, election.stats.registered])
  const rows = (log.data ?? []).filter((x) => x.action !== 'voter.register' && x.action !== 'voter.reregister')
  const registrations = (log.data ?? []).length - rows.length
  return (
    <div className="card">
      <div className="row space-between">
        <h3>Jurnal de audit</h3>
        <button type="button" className="btn btn-small" onClick={() => setOpen(!open)}>
          {open ? 'Ascunde' : 'Arată'}
        </button>
      </div>
      {open && log.error && <ErrorBox error={log.error} />}
      {open && log.data && (
        <ul className="list-plain audit">
          {rows.map((x) => (
            <li key={x.id}>
              <span className="muted small nowrap">{new Date(x.createdAt).toLocaleString('ro-RO')}</span>
              <span>
                {ACTIONS[x.action] ?? x.action}
                {x.action === 'election.close' && (x.payload as { automatic?: boolean } | null)?.automatic && (
                  <span className="muted small"> (automat, la ora închiderii)</span>
                )}
              </span>
              <span className="muted small">{x.actor}</span>
            </li>
          ))}
          {registrations > 0 && <li className="muted small">+ {registrations} înregistrări de alegători (fără date personale)</li>}
        </ul>
      )}
    </div>
  )
}
