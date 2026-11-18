import { api, type Election } from '../../../api'
import { useAsync } from '../../../lib/useAsync'

/** Hash-ul ultimei intrări, de publicat periodic într-un loc independent (de exemplu pe site-ul facultății). */
export function BoardHead({ election }: { election: Election }) {
  const head = useAsync(() => api.getBoardHead(election.id), [election.id, election.stats.ballots])
  if (!head.data) return null
  return (
    <div className="card">
      <h3>Hash-ul board-ului de publicat independent</h3>
      <p className="hint">
        Publică periodic această valoare pe site-ul facultății sau într-un anunț semnat. Dacă serverul ar rescrie ulterior istoria board-ului, verificatorul ar
        observa nepotrivirea cu valoarea publicată.
      </p>
      <div className="kv">
        <span>Intrarea #{head.data.seq}</span>
        <code className="mono wrap">
          {head.data.seq}:{head.data.hash}
        </code>
      </div>
    </div>
  )
}
