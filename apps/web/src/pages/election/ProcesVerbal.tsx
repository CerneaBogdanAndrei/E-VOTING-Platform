// Procesul-verbal al unui scrutin: un document de tipărit (sau salvat ca PDF din browser) cu tot ce e
// public: parametrii, participarea, rezultatul, hash-ul board-ului și, la cerere, verificarea publică
// rulată chiar acum, în browser. Nu conține nimic ce nu se poate citi deja de pe site sau din API.

import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { verifyElection, type VerificationReport } from '@evoting/crypto'
import { api, type BoardHead, type ElectionResult, type PublicRegistration } from '../../api'
import { ErrorBox, Loading } from '../../components/ui'
import { candidateLabel, decimal, formatDateTime, percent, plural, statusLabel } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { browserThreads, createBrowserWork, workersAvailable } from '../../lib/verify-workers'

/** Cvorumul afișat orientativ, ca în panoul comisiei: o treime din eligibili plus unu. */
const quorumFor = (eligible: number) => Math.floor(eligible / 3) + 1

interface Extra {
  registrations: PublicRegistration[]
  head: BoardHead
  result: ElectionResult | null
}

export function ProcesVerbal() {
  const { id = '' } = useParams()
  const election = useAsync(() => api.getElection(id), [id])
  const extra = useAsync<Extra>(async () => {
    const e = await api.getElection(id)
    const [registrations, head, result] = await Promise.all([
      api.getRegistrations(id),
      api.getBoardHead(id),
      e.status === 'tallied' ? api.getResult(id) : Promise.resolve(null),
    ])
    return { registrations, head, result }
  }, [id])
  const [verification, setVerification] = useState<{ report: VerificationReport; at: string; seconds: number; threads: number }>()
  const [verifying, setVerifying] = useState(false)
  // ora documentului: fixată la deschidere, nu recalculată la fiecare afișare
  const [generatedAt] = useState(() => new Date().toISOString())
  const [verifyError, setVerifyError] = useState<string>()

  const verify = async () => {
    setVerifying(true)
    setVerifyError(undefined)
    const work = workersAvailable && browserThreads() > 1 ? createBrowserWork() : undefined
    const started = performance.now()
    try {
      const b = await api.getAuditBundle(id)
      const report = await verifyElection(
        { election: b.election, registrations: b.registrations, board: b.board, tally: b.tally, result: b.result },
        { work, yieldEvery: 8 },
      )
      setVerification({ report, at: new Date().toISOString(), seconds: (performance.now() - started) / 1000, threads: work?.threads ?? 1 })
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : String(err))
    } finally {
      await work?.close()
      setVerifying(false)
    }
  }

  if ((election.loading && !election.data) || (extra.loading && !extra.data)) return <Loading />
  if (election.error) return <ErrorBox error={election.error} onRetry={election.reload} />
  if (extra.error) return <ErrorBox error={extra.error} onRetry={extra.reload} />
  const e = election.data!
  const { registrations, head, result } = extra.data!
  const nfc = registrations.filter((r) => r.method === 'nfc').length
  const quorum = quorumFor(e.stats.eligible)
  const rows = result ? e.candidates.map((c) => ({ c, votes: result.counts.find((x) => x.candidateId === c.id)?.votes ?? 0 })) : []

  return (
    <article className="pv">
      <div className="row space-between no-print">
        <Link to={`/scrutin/${e.id}`} className="back">
          ← Pagina scrutinului
        </Link>
        <div className="row gap-s">
          <button type="button" className="btn" onClick={verify} disabled={verifying}>
            {verifying ? 'Se verifică…' : verification ? 'Verifică din nou' : 'Rulează verificarea publică'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            Tipărește / salvează PDF
          </button>
        </div>
      </div>

      <header className="pv-head">
        <p className="pv-kicker">Proces-verbal al scrutinului electronic</p>
        <h1>{e.title}</h1>
        <p className="muted small mono">{e.id}</p>
      </header>

      <section className="pv-section">
        <h2>1. Date generale</h2>
        <table className="table pv-table">
          <tbody>
            <tr>
              <th>Starea</th>
              <td>{statusLabel[e.status]}</td>
            </tr>
            <tr>
              <th>Intervalul de vot</th>
              <td>
                {formatDateTime(e.opensAt)} – {formatDateTime(e.closesAt)}
              </td>
            </tr>
            <tr>
              <th>Înregistrarea alegătorilor</th>
              <td>{e.requireNfc ? 'doar cu cartea electronică (NFC)' : 'scanarea buletinului (OCR) sau cartea electronică (NFC)'}</td>
            </tr>
            <tr>
              <th>Opțiuni de vot</th>
              <td>{e.candidates.map((c) => candidateLabel(c)).join(', ')}</td>
            </tr>
            <tr>
              <th>Trustees</th>
              <td>
                {e.trustees.map((t) => t.name).join(', ')} ({plural(e.trustees.length, 'parte', 'părți')} de cheie; decriptarea le cere pe toate)
              </td>
            </tr>
            <tr>
              <th>Cheia publică a scrutinului</th>
              <td className="mono wrap">{e.publicKey ?? 'încă negenerată'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="pv-section">
        <h2>2. Participarea</h2>
        <table className="table pv-table">
          <tbody>
            <tr>
              <th>Alegători eligibili</th>
              <td className="num">{e.stats.eligible}</td>
            </tr>
            <tr>
              <th>Alegători înregistrați</th>
              <td className="num">
                {e.stats.registered} ({nfc} prin NFC, {e.stats.registered - nfc} prin scanare optică)
              </td>
            </tr>
            <tr>
              <th>Buletine pe bulletin board</th>
              <td className="num">{e.stats.ballots}</td>
            </tr>
            <tr>
              <th>Participare</th>
              <td className="num">{percent(e.stats.ballots, e.stats.eligible)}</td>
            </tr>
            <tr>
              <th>Cvorum orientativ (1/3 + 1)</th>
              <td className="num">
                {quorum} · {e.stats.ballots >= quorum ? 'atins' : 'neatins'}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="pv-section">
        <h2>3. Rezultatul</h2>
        {result ? (
          <>
            <table className="table pv-table">
              <thead>
                <tr>
                  <th>Opțiunea</th>
                  <th className="num">Voturi</th>
                  <th className="num">Procent</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ c, votes }) => (
                  <tr key={c.id}>
                    <td>{candidateLabel(c)}</td>
                    <td className="num">{votes}</td>
                    <td className="num">{percent(votes, result.totalBallots)}</td>
                  </tr>
                ))}
                <tr>
                  <th>Total buletine</th>
                  <th className="num">{result.totalBallots}</th>
                  <th />
                </tr>
              </tbody>
            </table>
            <p className="hint">
              Publicat la {formatDateTime(result.publishedAt)}, din decriptarea agregatului homomorf de către toți trustees, fiecare cu dovezi Chaum-Pedersen.
            </p>
          </>
        ) : (
          <p className="hint">Rezultatul nu a fost publicat încă: apare după închiderea votului și decriptarea de către toți trustees.</p>
        )}
      </section>

      <section className="pv-section">
        <h2>4. Integritatea</h2>
        <table className="table pv-table">
          <tbody>
            <tr>
              <th>Ultima intrare de pe board</th>
              <td className="mono wrap">
                {head.seq}:{head.hash}
              </td>
            </tr>
            <tr>
              <th>Verificarea publică</th>
              <td>
                {verification
                  ? `${verification.report.ok ? 'Toate verificările trec' : 'VERIFICAREA A PICAT'} (${verification.report.steps.filter((s) => s.status === 'ok').length} pași trecuți din ${verification.report.steps.length}, ${verification.report.ballots} buletine), rulată în browser la ${formatDateTime(verification.at)}, în ${decimal(verification.seconds)} s, ${verification.threads === 1 ? 'pe un fir' : `pe ${verification.threads} fire`}.`
                  : 'Nerulată în acest document. Oricine o poate rula: butonul de mai sus, tab-ul „Verificare publică” sau `npx evoting-verify`.'}
              </td>
            </tr>
          </tbody>
        </table>
        {verifyError && (
          <div role="alert" className="alert alert-bad no-print">
            {verifyError}
          </div>
        )}
        {verification && !verification.report.ok && (
          <ul className="pv-failures">
            {verification.report.steps
              .filter((s) => s.status === 'fail')
              .flatMap((s) => s.failures.slice(0, 5).map((f, i) => <li key={`${s.id}-${i}`}>{`${s.title} · ${f.where}: ${f.message}`}</li>))}
          </ul>
        )}
        <p className="hint">
          Valoarea „poziție:hash” se publică independent (de exemplu pe site-ul facultății). Dacă istoria board-ului ar fi rescrisă ulterior, verificatorul,
          primind această valoare, ar semnala diferența.
        </p>
      </section>

      <section className="pv-section pv-signatures">
        <h2>5. Semnăturile comisiei</h2>
        <div className="pv-sign">
          <span>Președinte: ______________________</span>
          <span>Membru: ______________________</span>
          <span>Membru: ______________________</span>
        </div>
      </section>

      <p className="muted small">Document generat la {formatDateTime(generatedAt)}, din datele publice ale scrutinului.</p>
    </article>
  )
}
