import { useState, type ReactNode } from 'react'
import type { ElectionStatus } from '../api'
import { shortHash, statusLabel } from '../lib/format'

export function StatusBadge({ status }: { status: ElectionStatus }) {
  return <span className={`badge badge-${status}`}>{statusLabel[status]}</span>
}

/** Hash afișat trunchiat; la click se copiază întreg. */
export function Hash({ value, head, tail }: { value: string; head?: number; tail?: number }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }
  return (
    <button type="button" className="hash" title={value} onClick={copy}>
      {copied ? 'copiat' : shortHash(value, head, tail)}
    </button>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}

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
