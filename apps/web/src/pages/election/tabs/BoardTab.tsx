import { useState, type FormEvent } from 'react'
import { checkOwnEntry } from '@evoting/crypto'
import { api, type BoardEntry, type Election } from '../../../api'
import { ErrorBox, Hash } from '../../../components/ui'
import { formatDateTime } from '../../../lib/format'
import { useAsync } from '../../../lib/useAsync'

const PAGE_SIZE = 50

/** Bulletin board-ul: căutarea după codul de urmărire (verificată local) și intrările, pe pagini. */
export function BoardTab({ election }: { election: Election }) {
  const [page, setPage] = useState(1)
  const board = useAsync(() => api.getBoardPage(election.id, page, PAGE_SIZE), [election.id, election.stats.ballots, page])
  const [code, setCode] = useState('')
  // codul căutat se păstrează lângă intrarea găsită: verificarea se face față de el, nu față de ce scrie acum în câmp
  const [lookup, setLookup] = useState<{ entry?: BoardEntry; code?: string; error?: string; busy?: boolean }>({})

  const search = async (ev: FormEvent) => {
    ev.preventDefault()
    const searched = code.trim()
    if (!searched) return
    setLookup({ busy: true })
    try {
      setLookup({ entry: await api.findBallot(election.id, searched), code: searched })
    } catch (err) {
      setLookup({ error: err instanceof Error ? err.message : String(err) })
    }
  }

  // hash-urile intrării găsite se recalculează în browser și se compară cu codul căutat
  const found = lookup.entry && lookup.code ? { entry: lookup.entry, check: checkOwnEntry(election.id, lookup.entry, { trackingCode: lookup.code }) } : null
  const pages = board.data ? Math.max(1, Math.ceil(board.data.total / PAGE_SIZE)) : 1

  return (
    <section className="section">
      <p className="hint">
        Fiecare intrare conține hash-ul celei anterioare, deci orice modificare a unui buletin rupe lanțul. Alegătorul își caută buletinul după codul de
        urmărire primit în aplicație.
      </p>

      <form className="search" onSubmit={search}>
        <input
          className="input mono"
          placeholder="Cod de urmărire (64 de caractere hex)"
          value={code}
          onChange={(ev) => setCode(ev.target.value)}
          spellCheck={false}
        />
        <button className="btn btn-primary" disabled={lookup.busy}>
          Caută
        </button>
      </form>
      {found && (
        <div role="alert" className={`alert ${found.check.ok ? 'alert-ok' : 'alert-bad'}`}>
          {found.check.ok
            ? `Buletinul #${found.entry.seq} e pe board, primit la ${formatDateTime(found.entry.receivedAt)}. Hash-ul recalculat în browser corespunde codului.`
            : 'Intrarea găsită nu corespunde codului: conținutul a fost modificat. Raportează comisiei.'}
        </div>
      )}
      {lookup.error && (
        <div role="alert" className="alert alert-bad">
          {lookup.error}
        </div>
      )}

      {board.error && <ErrorBox error={board.error} onRetry={board.reload} />}
      {board.data && board.data.total === 0 && <div className="state">Niciun buletin încă.</div>}
      {board.data && board.data.total > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cod de urmărire</th>
                  <th>Hash anterior</th>
                  <th>Credential</th>
                  <th>Criptotexte</th>
                  <th>Primit</th>
                </tr>
              </thead>
              <tbody>
                {board.data.entries.map((b) => (
                  <tr key={b.seq} className={lookup.entry?.seq === b.seq ? 'row-hit' : undefined}>
                    <td className="num">{b.seq}</td>
                    <td>
                      <Hash value={b.hash} />
                    </td>
                    <td>
                      <Hash value={b.prevHash} />
                    </td>
                    <td>
                      <Hash value={b.credentialPubkey} head={6} tail={4} />
                    </td>
                    <td className="muted">{b.ciphertexts.length} × (A, B)</td>
                    <td className="muted nowrap">{formatDateTime(b.receivedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="pager">
              <button type="button" className="btn btn-small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                ← Mai noi
              </button>
              <span className="muted small">
                Pagina {page} din {pages} · {board.data.total} buletine
              </span>
              <button type="button" className="btn btn-small" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Mai vechi →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
