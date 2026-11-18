import type { Election } from '../../../api'
import { Hash } from '../../../components/ui'
import { candidateLabel } from '../../../lib/format'

/** Parametrii publici: cheia scrutinului, ordinea opțiunilor și cheile trustees. */
export function ParametersTab({ election }: { election: Election }) {
  return (
    <section className="section grid-2">
      <div className="card">
        <h3>Cheia scrutinului</h3>
        <p className="hint">Y = Y₁ + Y₂ + … + Yₙ: se criptează cu ea, dar decriptarea cere toți trustees.</p>
        {election.publicKey ? <Hash value={election.publicKey} head={16} tail={12} /> : <span className="muted">Încă negenerată</span>}
        <h3 className="mt">Opțiunile, în ordinea din vectorul de vot</h3>
        <ol className="list">
          {election.candidates.map((c) => (
            <li key={c.id} className={c.kind === 'blank' ? 'muted' : undefined}>
              <strong>{candidateLabel(c)}</strong> {c.description && <span className="muted">· {c.description}</span>}
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
