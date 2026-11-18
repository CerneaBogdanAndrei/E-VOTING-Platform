import { mockTools, type Election } from '../../../api'

type Act = (name: string, fn: () => Promise<unknown>, ok?: (value: unknown) => string) => Promise<void>

/** Doar cu backend-ul simulat: butoane care țin locul CLI-ului de trustee și al alegătorilor. */
export function MockToolsPanel({ election: e, busy, act }: { election: Election; busy: boolean; act: Act }) {
  if (!mockTools) return null
  const tools = mockTools
  const keysMissing = e.trustees.filter((t) => !t.publicKeyShare).length
  return (
    <div className="card card-dev">
      <h3>Unelte de test (doar backend simulat)</h3>
      <p className="hint">Țin locul CLI-ului de trustee și al alegătorilor până există backend-ul și aplicația mobilă.</p>
      <div className="row gap-s">
        <button
          type="button"
          className="btn"
          disabled={busy || e.status !== 'draft' || keysMissing === 0}
          onClick={() =>
            act(
              'keys',
              () => tools.simulateTrusteeKeys(e.id),
              () => 'Trustees au trimis cheile.',
            )
          }
        >
          Simulează cheile trustees
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy || e.status !== 'open'}
          onClick={() =>
            act(
              'voters',
              () => tools.simulateVoters(e.id, 10),
              (n) => `Au votat ${n} alegători simulați.`,
            )
          }
        >
          Simulează 10 alegători
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy || e.status !== 'closed'}
          onClick={() =>
            act(
              'tally',
              () => tools.simulateTally(e.id),
              () => 'Decriptările parțiale au fost trimise, iar rezultatul e publicat.',
            )
          }
        >
          Simulează decriptarea
        </button>
      </div>
    </div>
  )
}
