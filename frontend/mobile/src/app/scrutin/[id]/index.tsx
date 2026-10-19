import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { api, type Election } from '../../../api'
import { Button, Card, H1, H2, Loading, Notice, P, Screen, StatusTag } from '../../../components/ui'
import { formatDateTime, formatInterval, percent, shortHash, trustLabel } from '../../../lib/format'
import { useSession, type VoterSession } from '../../../lib/session'
import { colors } from '../../../lib/theme'
import { useAsync } from '../../../lib/useAsync'

export default function ElectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const election = useAsync(() => api.getElection(id), [id])
  const { session } = useSession(id)

  // Reîncarcă la revenirea pe ecran (după înregistrare sau vot), nu și la prima afișare.
  const { reload } = election
  const firstFocus = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false
      else reload()
    }, [reload]),
  )

  if (election.error) return <Screen><Notice tone="bad" text={election.error.message} /></Screen>
  if (!election.data) return <Loading />
  const e = election.data
  const go = (pathname: '/scrutin/[id]/inregistrare' | '/scrutin/[id]/vot' | '/scrutin/[id]/verifica') =>
    router.push({ pathname, params: { id } })

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <StatusTag status={e.status} />
        <H1>{e.title}</H1>
        <Text style={styles.meta}>{formatInterval(e.opensAt, e.closesAt)}</Text>
      </View>

      <Card>
        <H2>Pașii tăi</H2>
        <Step n={1} done={!!session.registration} title="Înregistrare cu buletinul" detail={registrationDetail(session)} />
        <Step n={2} done={!!session.receipt} title="Vot criptat" detail={session.receipt ? `Buletinul #${session.receipt.seq}, trimis la ${formatDateTime(session.receipt.receivedAt)}` : undefined} />
        <Step n={3} done={false} title="Verificare pe board" detail={session.receipt ? `Cod: ${shortHash(session.receipt.trackingCode)}` : undefined} last />
      </Card>

      <PrimaryAction election={e} session={session} go={go} />

      {e.status === 'tallied' ? <Result election={e} /> : <Candidates election={e} />}

      <Text style={styles.footer}>
        {e.stats.ballots} buletine pe board din {e.stats.eligible} alegători eligibili ({percent(e.stats.ballots, e.stats.eligible)}).
      </Text>
    </Screen>
  )
}

function registrationDetail(session: VoterSession) {
  const r = session.registration
  if (!r) return undefined
  return `${r.method === 'nfc' ? 'Prin NFC' : 'Prin scanare'} · ${trustLabel[r.trustLevel]}`
}

function PrimaryAction({
  election: e,
  session,
  go,
}: {
  election: Election
  session: VoterSession
  go: (p: '/scrutin/[id]/inregistrare' | '/scrutin/[id]/vot' | '/scrutin/[id]/verifica') => void
}) {
  const canRegister = e.status === 'draft' || e.status === 'open'
  if (session.receipt) return <Button title="Verifică votul pe board" onPress={() => go('/scrutin/[id]/verifica')} />
  if (!session.registration && canRegister) return <Button title="Înregistrează-te" onPress={() => go('/scrutin/[id]/inregistrare')} />
  if (session.registration && e.status === 'open') return <Button title="Votează" onPress={() => go('/scrutin/[id]/vot')} />
  if (session.registration && e.status === 'draft') return <Notice tone="accent" text={`Ești înregistrat. Votul se deschide pe ${formatDateTime(e.opensAt)}.`} />
  return (
    <View style={{ gap: 10 }}>
      <Notice text={e.status === 'tallied' ? 'Votul s-a încheiat, iar rezultatul e publicat.' : 'Votul s-a încheiat. Rezultatul apare după decriptarea de către trustees.'} />
      {e.stats.ballots > 0 && <Button title="Caută un cod de urmărire" variant="secondary" onPress={() => go('/scrutin/[id]/verifica')} />}
    </View>
  )
}

function Step({ n, done, title, detail, last }: { n: number; done: boolean; title: string; detail?: string; last?: boolean }) {
  return (
    <View style={[styles.step, !last && styles.stepBorder]}>
      <View style={[styles.dot, done && styles.dotDone]}>
        <Text style={[styles.dotText, done && { color: colors.ok }]}>{done ? '✓' : n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stepTitle, done && { color: colors.ink }]}>{title}</Text>
        {detail && <Text style={styles.meta}>{detail}</Text>}
      </View>
    </View>
  )
}

function Candidates({ election }: { election: Election }) {
  return (
    <Card>
      <H2>Candidați</H2>
      {election.candidates.map((c) => (
        <View key={c.id} style={styles.candidate}>
          <Text style={styles.candidateName}>{c.name}</Text>
          <Text style={styles.meta}>{c.description}</Text>
        </View>
      ))}
    </Card>
  )
}

function Result({ election }: { election: Election }) {
  const result = useAsync(() => api.getResult(election.id), [election.id])
  if (result.error) return <Notice tone="bad" text={result.error.message} />
  if (!result.data) return <Loading />
  const r = result.data
  const rows = election.candidates
    .map((c) => ({ c, votes: r.counts.find((x) => x.candidateId === c.id)?.votes ?? 0 }))
    .sort((a, b) => b.votes - a.votes)
  const max = Math.max(1, ...rows.map((x) => x.votes))

  return (
    <Card>
      <H2>Rezultat</H2>
      <P muted>Din {r.totalBallots} buletine, decriptat împreună de toți trustees.</P>
      {rows.map(({ c, votes }, i) => (
        <View key={c.id} style={{ gap: 6, paddingVertical: 6 }}>
          <View style={styles.resultHead}>
            <Text style={styles.candidateName}>{c.name}</Text>
            <Text style={styles.candidateName}>
              {votes} <Text style={styles.meta}>({percent(votes, r.totalBallots)})</Text>
            </Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${(votes / max) * 100}%` }, i === 0 && { backgroundColor: colors.accent }]} />
          </View>
        </View>
      ))}
    </Card>
  )
}

const styles = StyleSheet.create({
  meta: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  footer: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  step: { flexDirection: 'row', gap: 12, paddingVertical: 10, alignItems: 'flex-start' },
  stepBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.okSoft, borderColor: colors.okLine },
  dotText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  stepTitle: { fontSize: 15, fontWeight: '600', color: colors.ink2 },
  candidate: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  candidateName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  resultHead: { flexDirection: 'row', justifyContent: 'space-between' },
  bar: { height: 10, borderRadius: 5, backgroundColor: colors.surface2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: '#a9bdf5' },
})
