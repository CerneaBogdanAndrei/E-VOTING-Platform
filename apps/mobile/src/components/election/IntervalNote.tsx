import { StyleSheet, Text } from 'react-native'
import type { Election } from '../../api'
import { formatDateTime, formatDuration, intervalPhase } from '../../lib/format'
import { colors } from '../../lib/theme'

/** „Votul se închide peste 2 zile”, „începe pe … peste 3 ore”; nimic după închidere. */
export function IntervalNote({ election: e }: { election: Election }) {
  if (e.status === 'closed' || e.status === 'tallied') return null
  const { phase, remainingMs } = intervalPhase(e.opensAt, e.closesAt)
  let text: string
  let warn = false
  if (phase === 'before') text = `Votul începe pe ${formatDateTime(e.opensAt)}, peste ${formatDuration(remainingMs)}.`
  else if (phase === 'during') text = e.status === 'open' ? `Votul se închide peste ${formatDuration(remainingMs)}.` : 'Comisia nu a deschis încă votul.'
  else {
    text = 'Intervalul de vot s-a încheiat.'
    warn = true
  }
  return <Text style={[styles.note, warn && { color: colors.warn }]}>{text}</Text>
}

const styles = StyleSheet.create({
  note: { fontSize: 13, color: colors.accent2, lineHeight: 18 },
})
