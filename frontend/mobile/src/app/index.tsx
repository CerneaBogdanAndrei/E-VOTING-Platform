import { router } from 'expo-router'
import { RefreshControl, StyleSheet, Text, View } from 'react-native'
import { api } from '../api'
import { Card, H1, Loading, ModeBanner, Notice, P, Screen, StatusTag, Tag } from '../components/ui'
import { formatInterval } from '../lib/format'
import { useAllSessions } from '../lib/session'
import { colors } from '../lib/theme'
import { useAsync } from '../lib/useAsync'

// Scrutinele la care se poate face ceva apar primele.
const ORDER = { open: 0, draft: 1, tallied: 2, closed: 3 }

export default function ElectionsScreen() {
  const { data, error, loading, reload } = useAsync(() => api.listElections(), [])
  const sessions = useAllSessions()
  const elections = data ? [...data].sort((a, b) => ORDER[a.status] - ORDER[b.status]) : []

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} tintColor={colors.accent} />}>
      <ModeBanner />
      <View style={{ gap: 4 }}>
        <H1>Scrutine</H1>
        <P muted>Înregistrează-te cu buletinul, votează, apoi verifică singur că votul tău e pe board.</P>
      </View>

      {loading && !data && <Loading />}
      {error && <Notice tone="bad" text={error.message} />}

      {elections.map((e) => {
        const session = sessions[e.id]
        return (
          <Card key={e.id} onPress={() => router.push({ pathname: '/scrutin/[id]', params: { id: e.id } })}>
            <View style={styles.row}>
              <StatusTag status={e.status} />
              {session?.receipt ? <Tag label="Ai votat" tone="ok" /> : session?.registration ? <Tag label="Înregistrat" tone="accent" /> : null}
            </View>
            <Text style={styles.title}>{e.title}</Text>
            <Text style={styles.meta}>{formatInterval(e.opensAt, e.closesAt)}</Text>
          </Card>
        )
      })}
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 17, fontWeight: '600', color: colors.ink, lineHeight: 23 },
  meta: { fontSize: 13, color: colors.muted },
})
