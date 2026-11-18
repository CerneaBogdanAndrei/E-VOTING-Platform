// Stările paginilor: se încarcă, eroare cu reîncercare, mesaj de acțiune.

export function Loading() {
  return <div className="state">Se încarcă…</div>
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="alert alert-bad">
      <span>{error.message}</span>
      {onRetry && (
        <button type="button" className="btn btn-small" onClick={onRetry}>
          Reîncearcă
        </button>
      )}
    </div>
  )
}

export type MessageKind = 'ok' | 'bad' | 'warn'

export function Message({ kind, children }: { kind: MessageKind; children: React.ReactNode }) {
  return (
    <div role="alert" className={`alert alert-${kind}`}>
      {children}
    </div>
  )
}
