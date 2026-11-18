// Pagina unui scrutin pentru comisie: starea, acțiunile (deschide/închide/modifică/șterge), trustees,
// candidații, importul eligibililor, hash-ul de publicat independent și jurnalul.
// Bucățile mari sunt în ./parts.

import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { api, mockTools, type TrusteeToken } from '../../api'
import { canEdit, useAdmin } from '../../api/admin'
import { Countdown, ErrorBox, Hash, Loading, Message, Stat, StatusBadge, type MessageKind } from '../../components/ui'
import { candidateLabel, formatInterval, percent, plural } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { AuditLog } from './parts/AuditLog'
import { BoardHead } from './parts/BoardHead'
import { EligibleImport } from './parts/EligibleImport'
import { MockToolsPanel } from './parts/MockToolsPanel'
import { Steps } from './parts/Steps'
import { TrusteeTokens } from './parts/TrusteeTokens'

/** Cvorumul afișat orientativ: o treime din eligibili plus unu. */
const quorumFor = (eligible: number) => Math.floor(eligible / 3) + 1

export function CommissionElection() {
  const { id = '' } = useParams()
  const admin = useAdmin()
  const navigate = useNavigate()
  const election = useAsync(() => api.getElection(id), [id])
  const location = useLocation()
  const trusteeTokens = (location.state as { trusteeTokens?: TrusteeToken[] } | null)?.trusteeTokens
  const [busy, setBusy] = useState<string>()
  const [message, setMessage] = useState<{ kind: MessageKind; text: string }>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  // închiderea e ireversibilă (agregatul se publică, nu se mai poate vota), deci cere confirmare, ca ștergerea
  const [confirmClose, setConfirmClose] = useState(false)

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

  const remove = async () => {
    setBusy('delete')
    try {
      await api.deleteElection(id)
      navigate('/comisie')
    } catch (err) {
      setMessage({ kind: 'bad', text: err instanceof Error ? err.message : String(err) })
      setBusy(undefined)
      setConfirmDelete(false)
    }
  }

  if (election.loading && !election.data) return <Loading />
  if (election.error) return <ErrorBox error={election.error} onRetry={election.reload} />
  const e = election.data!
  const editable = canEdit(admin)
  const keysMissing = e.trustees.filter((t) => !t.publicKeyShare).length
  const quorum = quorumFor(e.stats.eligible)

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
          <Countdown status={e.status} opensAt={e.opensAt} closesAt={e.closesAt} />
        </div>
        <div className="row gap-s">
          <Link to={`/scrutin/${e.id}`} className="btn">
            Pagina publică
          </Link>
          {editable && e.status === 'draft' && (
            <>
              <Link to={`/comisie/${e.id}/editare`} className="btn">
                Modifică
              </Link>
              {confirmDelete ? (
                <>
                  <button type="button" className="btn btn-danger" disabled={!!busy} onClick={remove}>
                    Da, șterge definitiv
                  </button>
                  <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
                    Nu
                  </button>
                </>
              ) : (
                <button type="button" className="btn" disabled={!!busy} onClick={() => setConfirmDelete(true)}>
                  Șterge
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={!!busy}
                onClick={() =>
                  act(
                    'open',
                    () => api.openElection(e.id),
                    () => 'Votul este deschis.',
                  )
                }
              >
                Deschide votul
              </button>
            </>
          )}
          {editable && e.status === 'open' && !confirmClose && (
            <button type="button" className="btn btn-danger" disabled={!!busy} onClick={() => setConfirmClose(true)}>
              Închide votul
            </button>
          )}
          {editable && e.status === 'open' && confirmClose && (
            <>
              <span className="muted small">Închiderea e definitivă: nimeni nu mai poate vota.</span>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!!busy}
                onClick={() =>
                  act(
                    'close',
                    () => api.closeElection(e.id),
                    () => 'Votul este închis. Urmează decriptarea de către trustees.',
                  ).finally(() => setConfirmClose(false))
                }
              >
                Da, închide votul acum
              </button>
              <button type="button" className="btn" onClick={() => setConfirmClose(false)}>
                Nu
              </button>
            </>
          )}
        </div>
      </div>

      {!editable && <Message kind="warn">Ești observator: vezi tot, dar nu poți schimba nimic.</Message>}
      {message && <Message kind={message.kind}>{message.text}</Message>}

      <Steps election={e} />

      {trusteeTokens && e.status === 'draft' && <TrusteeTokens election={e} tokens={trusteeTokens} />}

      <div className="stats">
        <Stat label="Eligibili" value={e.stats.eligible} />
        <Stat label="Înregistrați" value={e.stats.registered} hint={percent(e.stats.registered, e.stats.eligible)} />
        <Stat label="Buletine" value={e.stats.ballots} hint={`participare ${percent(e.stats.ballots, e.stats.eligible)}`} />
        <Stat label="Cvorum (1/3 + 1)" value={quorum} hint={e.stats.ballots >= quorum ? 'atins' : `mai trebuie ${quorum - e.stats.ballots}`} />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Trustees</h3>
          <p className="hint">
            {keysMissing > 0
              ? `${keysMissing === 1 ? 'Lipsește o cheie' : `Lipsesc ${plural(keysMissing, 'cheie', 'chei')}`}. Fiecare trustee rulează CLI-ul și trimite doar Yᵢ; cheia secretă rămâne la el.`
              : 'Toate cheile au fost primite, iar cheia scrutinului e publicată.'}
          </p>
          <ul className="list-plain">
            {e.trustees.map((t) => (
              <li key={t.id} className="trustee">
                <span>{t.name}</span>
                <span className="row gap-s">
                  {t.publicKeyShare ? <Hash value={t.publicKeyShare} /> : <span className="badge badge-warn">așteaptă cheia</span>}
                  {(e.status === 'closed' || e.status === 'tallied') &&
                    (t.partialDecryptionSubmitted ? (
                      <span className="badge badge-ok">decriptare trimisă</span>
                    ) : (
                      <span className="badge badge-warn">așteaptă decriptarea</span>
                    ))}
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
        </div>

        <div className="card">
          <h3>Opțiuni de vot</h3>
          <ol className="list">
            {e.candidates.map((c) => (
              <li key={c.id} className={c.kind === 'blank' ? 'muted' : undefined}>
                <strong>{candidateLabel(c)}</strong> {c.description && <span className="muted">· {c.description}</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {(e.status === 'draft' || e.status === 'open') && editable && <EligibleImport election={e} onImported={election.reload} />}

      {e.status !== 'draft' && <BoardHead election={e} />}

      <AuditLog election={e} />

      {mockTools && editable && <MockToolsPanel election={e} busy={!!busy} act={act} />}
    </>
  )
}
