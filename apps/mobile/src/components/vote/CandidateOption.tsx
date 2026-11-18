import { StyleSheet, Text, View } from 'react-native'
import type { Candidate } from '../../api'
import { candidateLabel } from '../../lib/format'
import { colors } from '../../lib/theme'
import { Card } from '../ui'

/** Un candidat (sau votul alb) din lista de vot, cu buton radio. */
export function CandidateOption({ candidate, selected, onSelect }: { candidate: Candidate; selected: boolean; onSelect: () => void }) {
  const blank = candidate.kind === 'blank'
  return (
    <Card onPress={onSelect} selected={selected} style={blank ? styles.blankCard : undefined}>
      <View style={styles.option}>
        <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, blank && { color: colors.ink2 }]}>{candidateLabel(candidate)}</Text>
          <Text style={styles.meta}>{blank ? 'Nu aleg niciun candidat; se numără separat.' : candidate.description}</Text>
        </View>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  name: { fontSize: 17, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  blankCard: { borderStyle: 'dashed' },
})
