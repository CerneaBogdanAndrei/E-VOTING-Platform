import { StyleSheet, Text, View } from 'react-native'
import type { Election } from '../../api'
import { colors } from '../../lib/theme'
import { Card, H2, P } from '../ui'

export function CandidateList({ election }: { election: Election }) {
  const candidates = election.candidates.filter((c) => c.kind === 'candidate')
  const blank = election.candidates.some((c) => c.kind === 'blank')
  return (
    <Card>
      <H2>Candidați</H2>
      {candidates.map((c) => (
        <View key={c.id} style={styles.candidate}>
          <Text style={styles.name}>{c.name}</Text>
          <Text style={styles.meta}>{c.description}</Text>
        </View>
      ))}
      {blank && <P muted>Se poate vota și „vot alb” (niciun candidat), numărat separat.</P>}
    </Card>
  )
}

const styles = StyleSheet.create({
  candidate: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 18 },
})
