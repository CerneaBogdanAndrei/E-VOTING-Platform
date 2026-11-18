import type { Election } from '../../../api'

const STEPS = [
  { key: 'draft', label: 'Configurare' },
  { key: 'open', label: 'Vot' },
  { key: 'closed', label: 'Numărare' },
  { key: 'tallied', label: 'Rezultat' },
] as const

/** Etapele scrutinului, cu cea curentă evidențiată. */
export function Steps({ election }: { election: Election }) {
  const current = STEPS.findIndex((s) => s.key === election.status)
  return (
    <ol className="steps">
      {STEPS.map((s, i) => (
        <li key={s.key} className={i < current ? 'step done' : i === current ? 'step current' : 'step'}>
          <span className="step-dot">{i < current ? '✓' : i + 1}</span>
          {s.label}
        </li>
      ))}
    </ol>
  )
}
