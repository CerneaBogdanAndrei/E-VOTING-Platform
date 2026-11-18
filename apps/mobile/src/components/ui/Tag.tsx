import { StyleSheet, Text, View } from 'react-native'
import type { ElectionStatus } from '../../api'
import { statusLabel } from '../../lib/format'
import { toneColors, type Tone } from './tones'

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const c = toneColors[tone]
  return (
    <View style={[styles.tag, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.tagText, { color: c.fg }]}>{label}</Text>
    </View>
  )
}

const statusTone: Record<ElectionStatus, Tone> = { draft: 'neutral', open: 'ok', closed: 'warn', tallied: 'accent' }

export function StatusTag({ status }: { status: ElectionStatus }) {
  return <Tag label={statusLabel[status]} tone={statusTone[status]} />
}

const styles = StyleSheet.create({
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  tagText: { fontSize: 12, fontWeight: '600' },
})
