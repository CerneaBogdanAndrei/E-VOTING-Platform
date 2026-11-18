import type { ElectionStatus } from '../../api'
import { statusLabel } from '../../lib/format'

export function StatusBadge({ status }: { status: ElectionStatus }) {
  return <span className={`badge badge-${status}`}>{statusLabel[status]}</span>
}
