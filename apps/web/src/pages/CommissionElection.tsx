import { useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router'
import { api, apiUrl, serverInfo, type Election, type EligibleImportResult, type TrusteeInvite } from '../api'
import { ErrorBox, Hash, Loading, Stat, StatusBadge } from '../components/ui'
import { formatInterval, percent } from '../lib/format'
import { useAsync } from '../lib/useAsync'

export function CommissionElection() {
  const { id = '' } = useParams()
  const election = useAsync(() => api.getElection(id), [id])
  const info = useAsync(() => serverInfo(), [])
  const [invite, setInvite] = useState<TrusteeInvite>()
  const [demoCnps, setDemoCnps] = useState<string[]>([])
  const [busy, setBusy] = useState<string>()
  const [message, setMessage] = useState<{ kind: 'ok' | 'bad'; text: string }>()

  /** Rulează o acțiune, afișează rezultatul și reîncarcă scrutinul. */
  const act = async (name: string, fn: () => Promise<unknown>, ok?: (value: unknown) => string) => {
    setBusy(name)
    setMessage(undefined)
    try {
      const value = await fn()
      if (ok) setMessage({ kind: 'ok', text: ok(value) })
      election.reload()
    } catch (err) {
      setMessage({ kind: 'bad', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(undefined)
    }
  }

  if (election.loading && !election.data) return <Loading />
  if (election.error) return <ErrorBox error={election.error} onRetry={election.reload} />
  const e = election.data!
  const keysMissing = e.trustees.filter((t) => !t.publicKeyShare).length
  const quorum = Math.floor(e.stats.eligible / 3) + 1

  return (
    <>
      <Link to="/comisie" className="back">
        ← Panoul comisiei
      </Link>
      <div className="page-head">
        <div>
          <div className="row gap-s">
            <StatusBadge status={e.status} />
            <span className="muted small">{formatInterval(e.opensAt, e.closesAt)}</span>
            <span className="muted small mono">{e.id}</span>
          </div>
          <h1>{e.title}</h1>
        </div>
        <div className="row gap-s">
          <Link to={`/scrutin/${e.id}`} className="btn">
            Pagina publică
          </Link>
          {e.status === 'tallied' && (
            <Link to={`/scrutin/${e.id}/proces-verbal`} className="btn">
              Proces-verbal
            </Link>
          )}
          {e.status === 'draft' && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!!busy}
              onClick={() => act('open', () => api.openElection(e.id), () => 'Votul este deschis.')}
            >
              Deschide votul
            </button>
          )}
          {e.status === 'open' && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={!!busy}
              onClick={() => act('close', () => api.closeElection(e.id), () => 'Votul este închis. Urmează decriptarea de către trustees.')}
            >
              Închide votul
            </button>
          )}
        </div>
      </div>

      {message && <div role="alert" className={`alert alert-${message.kind}`}>{message.text}</div>}

      <Steps election={e} />

      <div className="stats">
        <Stat label="Eligibili" value={e.stats.eligible} />
        <Stat label="Înregistrați" value={e.stats.registered} hint={`${percent(e.stats.registered, e.stats.eligible)} · ${e.stats.registeredNfc} prin NFC`} />
        <Stat label="Buletine" value={e.stats.ballots} hint={`participare ${percent(e.stats.ballots, e.stats.eligible)}`} />
        <Stat label="Cvorum (1/3 + 1)" value={quorum} hint={e.stats.ballots >= quorum ? 'atins' : `mai trebuie ${quorum - e.stats.ballots}`} />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Trustees</h3>
          <p className="hint">
            {keysMissing > 0
              ? `Lipsesc ${keysMissing} chei. Fiecare trustee rulează CLI-ul și trimite doar Yᵢ; cheia secretă rămâne la el.`
              : 'Toate cheile au fost primite, iar cheia scrutinului e publicată.'}
          </p>
          <ul className="list-plain">
            {e.trustees.map((t) => (
              <li key={t.id} className="trustee">
                <span>{t.name}</span>
                <span className="row gap-s">
                  {((!t.publicKeyShare && e.status === 'draft') || (e.status === 'closed' && !t.partialDecryptionSubmitted)) && (
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={!!busy}
                      onClick={() => act('invite', async () => setInvite(await api.trusteeInvite(e.id, t.id)))}
                    >
                      Cod de acces
                    </button>
                  )}
                  {t.publicKeyShare ? <Hash value={t.publicKeyShare} /> : <span className="badge badge-warn">așteaptă cheia</span>}
                  {(e.status === 'closed' || e.status === 'tallied') &&
                    (t.partialDecryptionSubmitted ? <span className="badge badge-ok">decriptare trimisă</span> : <span className="badge badge-warn">așteaptă decriptarea</span>)}
                </span>
              </li>
            ))}
          </ul>
          {e.publicKey && (
            <div className="kv">
              <span>Cheia scrutinului</span>
              <Hash value={e.publicKey} head={12} tail={8} />
            </div>
          )}
          {invite && <InviteBox election={e} invite={invite} onClose={() => setInvite(undefined)} />}
        </div>

        <div className="card">
          <h3>Candidați</h3>
          <ol className="list">
            {e.candidates.map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong>{c.description && <span className="muted"> · {c.description}</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {e.status === 'draft' && <EligibleImport election={e} onImported={election.reload} />}

      {e.status !== 'draft' && (
        <div className="card">
          <h3>Ancorarea board-ului</h3>
          <p className="hint">
            Publicați acest hash într-un loc independent de server (site-ul facultății, un email către comisie). Verificatorul îl caută în
            lanț, deci serverul nu mai poate rescrie istoria board-ului fără să fie prins.
          </p>
          <div className="kv">
            <span>Capul lanțului după {e.boardHead.seq} buletine</span>
            <Hash value={e.boardHead.hash} head={16} tail={12} />
          </div>
        </div>
      )}

      {info.data?.demoMode && (
        <div className="card card-dev">
          <h3>Unelte de demo (DEMO_MODE pe server)</h3>
          <p className="hint">
            Țin locul alegătorilor și al trustees la prezentare. Cheile trustees simulați stau pe server, exact ce sistemul real nu face: pentru
            scrutine adevărate folosiți CLI-ul de trustee.
          </p>
          <div className="row gap-s">
            <button
              type="button"
              className="btn"
              disabled={!!busy || e.status !== 'draft'}
              onClick={() =>
                act('gen', async () => {
                  const r = await api.demo.generateEligible(e.id, 50)
                  setDemoCnps((prev) => [...prev, ...r.cnps])
                  return r.imported
                }, (n) => `Au fost generate și importate ${n} CNP-uri fictive.`)
              }
            >
              Generează 50 de eligibili
            </button>
            <button
              type="button"
              className="btn"
              disabled={!!busy || e.status !== 'draft' || keysMissing === 0}
              onClick={() => act('keys', () => api.demo.trusteeKeys(e.id), () => 'Cheile trustees au fost simulate.')}
            >
              Simulează cheile trustees
            </button>
            <button
              type="button"
              className="btn"
              disabled={!!busy || e.status !== 'open'}
              onClick={() => act('voters', () => api.demo.voters(e.id, 10), (r) => `Au votat ${(r as { voted: number }).voted} alegători simulați (cu criptare și dovezi reale).`)}
            >
              Simulează 10 alegători
            </button>
            <button
              type="button"
              className="btn"
              disabled={!!busy || e.status !== 'closed'}
              onClick={() => act('tally', () => api.demo.tally(e.id), () => 'Decriptările parțiale au fost trimise, iar rezultatul e publicat.')}
            >
              Simulează decriptarea
            </button>
          </div>
          {demoCnps.length > 0 && (
            <details className="mt-s">
              <summary>CNP-uri fictive generate ({demoCnps.length}), de folosit în aplicația mobilă</summary>
              <textarea className="input mono" rows={4} readOnly value={demoCnps.join('\n')} />
            </details>
          )}
        </div>
      )}
    </>
  )
}

const STEPS = [
  { key: 'draft', label: 'Configurare' },
  { key: 'open', label: 'Vot' },
  { key: 'closed', label: 'Numărare' },
  { key: 'tallied', label: 'Rezultat' },
] as const

function Steps({ election }: { election: Election }) {
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

function InviteBox({ election, invite, onClose }: { election: Election; invite: TrusteeInvite; onClose: () => void }) {
  const t = election.trustees.find((x) => x.id === invite.trusteeId)
  const command =
    election.status === 'draft'
      ? `npm run trustee -- keygen --server ${apiUrl} --election ${election.id} --trustee ${invite.trusteeId} --code ${invite.code}`
      : `npm run trustee -- decrypt --server ${apiUrl} --election ${election.id} --trustee ${invite.trusteeId} --code ${invite.code}`
  return (
    <div className="alert alert-warn mt-s invite">
      <div>
        <strong>Cod de acces pentru {t?.name}</strong> (se afișează o singură dată; se transmite trustee-ului pe un canal sigur):
        <pre className="mono code">{command}</pre>
      </div>
      <button type="button" className="btn btn-small" onClick={onClose}>
        Ascunde
      </button>
    </div>
  )
}

function EligibleImport({ election, onImported }: { election: Election; onImported: () => void }) {
  const [csv, setCsv] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<EligibleImportResult>()
  const [error, setError] = useState<string>()

  const readFile = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    if (file) setCsv(await file.text())
  }

  const submit = async () => {
    setBusy(true)
    setError(undefined)
    try {
      setResult(await api.importEligible(election.id, csv))
      setCsv('')
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3>Lista alegătorilor eligibili</h3>
      <p className="hint">
        CSV cu un CNP pe linie. Serverul păstrează doar HMAC(CNP) și aruncă imediat valorile în clar. Acum sunt {election.stats.eligible}{' '}
        eligibili.
      </p>
      <textarea className="input mono" rows={5} value={csv} onChange={(ev) => setCsv(ev.target.value)} placeholder={'cnp\n5040312170011\n...'} spellCheck={false} />
      <div className="row gap-s mt-s">
        <label className="btn">
          Alege fișier CSV
          <input type="file" accept=".csv,text/csv,text/plain" onChange={readFile} hidden />
        </label>
        <button type="button" className="btn btn-primary" disabled={busy || !csv.trim()} onClick={submit}>
          {busy ? 'Se importă…' : 'Importă'}
        </button>
      </div>
      {error && <div role="alert" className="alert alert-bad mt-s">{error}</div>}
      {result && (
        <div role="alert" className={`alert mt-s ${result.invalid.length ? 'alert-warn' : 'alert-ok'}`}>
          <span>
            Importați: {result.imported} · duplicate: {result.duplicates} · invalide: {result.invalid.length}
            {result.invalid.length > 0 && ` (liniile ${result.invalid.slice(0, 8).map((x) => x.line).join(', ')}${result.invalid.length > 8 ? '…' : ''})`}
          </span>
        </div>
      )}
    </div>
  )
}
