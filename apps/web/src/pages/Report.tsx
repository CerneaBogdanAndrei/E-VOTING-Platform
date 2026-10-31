import { useParams } from 'react-router'
import { api } from '../api'
import { ErrorBox, Loading } from '../components/ui'
import { formatDateTime, percent } from '../lib/format'
import { useAsync } from '../lib/useAsync'

/** Procesul-verbal generat automat din rezultatul verificat, gata de tipărit și semnat de comisie. */
export function Report() {
  const { id = '' } = useParams()
  const data = useAsync(async () => {
    const [election, result, record] = await Promise.all([api.getElection(id), api.getResult(id), api.getRecord(id)])
    return { election, result, record }
  }, [id])

  if (data.error) return <div className="page"><ErrorBox error={data.error} onRetry={data.reload} /></div>
  if (!data.data) return <Loading />
  const { election: e, result: r } = data.data
  const rows = e.candidates.map((c) => ({ c, votes: r.counts.find((x) => x.candidateId === c.id)?.votes ?? 0 }))

  return (
    <div className="report">
      <div className="report-actions no-print">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Tipărește
        </button>
      </div>
      <h1>PROCES-VERBAL</h1>
      <p className="report-sub">privind rezultatul votului electronic</p>
      <p>
        <strong>Scrutin:</strong> {e.title}
        <br />
        <strong>Identificator:</strong> <span className="mono">{e.id}</span>
        <br />
        <strong>Perioada de vot:</strong> {formatDateTime(e.opensAt)} – {formatDateTime(e.closesAt)}
        <br />
        <strong>Rezultat publicat la:</strong> {formatDateTime(r.publishedAt)}
      </p>

      <table className="report-table">
        <tbody>
          <tr><td>a) Numărul alegătorilor înscriși pe lista eligibililor</td><td>{r.eligible}</td></tr>
          <tr><td>b) Numărul alegătorilor înregistrați în aplicație</td><td>{e.stats.registered} (din care {e.stats.registeredNfc} prin NFC)</td></tr>
          <tr><td>c) Numărul buletinelor valabil exprimate (pe bulletin board)</td><td>{r.totalBallots}</td></tr>
          <tr><td>d) Prezența la vot</td><td>{percent(r.totalBallots, r.eligible)}</td></tr>
          <tr><td>e) Cvorumul necesar (1/3 + 1)</td><td>{r.quorum} – {r.quorumReached ? 'ATINS' : 'NEATINS'}</td></tr>
        </tbody>
      </table>

      <h2>Voturi obținute</h2>
      <table className="report-table">
        <thead><tr><th>Nr.</th><th>Candidat / opțiune</th><th>Voturi</th><th>%</th></tr></thead>
        <tbody>
          {rows.map(({ c, votes }, i) => (
            <tr key={c.id}><td>{i + 1}</td><td>{c.name}{c.description ? ` (${c.description})` : ''}</td><td>{votes}</td><td>{percent(votes, r.totalBallots)}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Elemente de verificare</h2>
      <p className="small">
        Rezultatul a fost obținut prin numărare homomorfă a buletinelor criptate și decriptare comună de către {e.trustees.length} trustees
        ({e.trustees.map((t) => t.name).join(', ')}), fără decriptarea vreunui vot individual. Oricine îl poate verifica cu registrul public al
        scrutinului.
      </p>
      <p className="small">
        Capul lanțului bulletin board-ului: <span className="mono">{e.boardHead.hash}</span>
        <br />
        Cheia publică a scrutinului: <span className="mono">{e.publicKey}</span>
      </p>

      <div className="report-signatures">
        <div>Președintele comisiei electorale<br /><br />...............................</div>
        <div>Membri<br /><br />...............................<br /><br />...............................</div>
      </div>
    </div>
  )
}
