import { StyleSheet, Text, View } from 'react-native'
import { api, type Election } from '../../api'
import { candidateLabel, percent } from '../../lib/format'
import { colors } from '../../lib/theme'
import { useAsync } from '../../lib/useAsync'
import { Card, H2, Loading, Notice, P } from '../ui'

/** Rezultatul publicat, cu bare proporționale; candidatul cu cele mai multe voturi e evidențiat, votul alb apare la final. */
export function ResultCard({ election }: { election: Election }) {
  const result = useAsync(() => api.getResult(election.id), [election.id])
  if (result.error) return <Notice tone="bad" text={result.error.message} />
  if (!result.data) return <Loading />
  const r = result.data
  const rows = election.candidates.map((c) => ({ c, votes: r.counts.find((x) => x.candidateId === c.id)?.votes ?? 0 }))
  const candidates = rows.filter((x) => x.c.kind === 'candidate').sort((a, b) => b.votes - a.votes)
  const blank = rows.find((x) => x.c.kind === 'blank')
  const max = Math.max(1, ...candidates.map((x) => x.votes))

  return (
    <Card>
      <H2>Rezultat</H2>
      <P muted>Din {r.totalBallots} buletine, decriptat împreună de toți trustees.</P>
      {candidates.map(({ c, votes }, i) => (
        <View key={c.id} style={{ gap: 6, paddingVertical: 6 }}>
          <View style={styles.head}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.name}>
              {votes} <Text style={styles.meta}>({percent(votes, r.totalBallots)})</Text>
            </Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${(votes / max) * 100}%` }, i === 0 && { backgroundColor: colors.accent }]} />
          </View>
        </View>
      ))}
      {blank && (
        <View style={[styles.head, styles.blank]}>
          <Text style={styles.meta}>{candidateLabel(blank.c)}</Text>
          <Text style={styles.meta}>
            {blank.votes} ({percent(blank.votes, r.totalBallots)})
          </Text>
        </View>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  bar: { height: 10, borderRadius: 5, backgroundColor: colors.surface2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: '#a9bdf5' },
  blank: { paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.line },
})
