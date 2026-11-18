import { useEffect, useState } from 'react'
import type { ElectionStatus } from '../../api'
import { formatDateTime, formatDuration, intervalPhase } from '../../lib/format'

/** Ora curentă, reîmprospătată la fiecare minut, ca textul „peste X minute” să rămână corect. */
function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(t)
  }, [everyMs])
  return now
}

/** Unde ne aflăm față de intervalul scrutinului: „se închide peste 2 zile”, „începe peste 3 ore”. */
export function Countdown({ status, opensAt, closesAt }: { status: ElectionStatus; opensAt: string; closesAt: string }) {
  const now = useNow()
  if (status === 'closed' || status === 'tallied') return null
  const { phase, remainingMs } = intervalPhase(opensAt, closesAt, now)
  let text: string
  if (phase === 'before') text = `Votul începe pe ${formatDateTime(opensAt)}, peste ${formatDuration(remainingMs)}.`
  else if (phase === 'during')
    text = status === 'open' ? `Votul se închide peste ${formatDuration(remainingMs)}.` : `Intervalul de vot a început; scrutinul nu e încă deschis de comisie.`
  else
    text =
      status === 'open'
        ? 'Intervalul de vot s-a încheiat: serverul închide scrutinul în cel mult un minut.'
        : 'Intervalul de vot a trecut; modifică datele înainte de deschidere.'
  return <p className={`countdown${phase === 'after' ? ' countdown-over' : ''}`}>{text}</p>
}
