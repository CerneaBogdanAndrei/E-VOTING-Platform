// Pagina unui scrutin: pașii alegătorului, acțiunea principală, candidații sau rezultatul.

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { api } from '../../../api'
import { CandidateList } from '../../../components/election/CandidateList'
import { IntervalNote } from '../../../components/election/IntervalNote'
import { PrimaryAction, type VoterRoute } from '../../../components/election/PrimaryAction'
import { ResultCard } from '../../../components/election/ResultCard'
import { VoterSteps } from '../../../components/election/VoterSteps'
import { H1, Loading, Notice, Screen, StatusTag } from '../../../components/ui'
import { formatInterval, percent } from '../../../lib/format'
import { useSession } from '../../../lib/session'
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

  if (election.error)
    return (
      <Screen>
        <Notice tone="bad" text={election.error.message} />
      </Screen>
    )
  if (!election.data) return <Loading />
  const e = election.data
  const go = (pathname: VoterRoute) => router.push({ pathname, params: { id } })

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <StatusTag status={e.status} />
        <H1>{e.title}</H1>
        <Text style={styles.meta}>{formatInterval(e.opensAt, e.closesAt)}</Text>
        <IntervalNote election={e} />
      </View>

      <VoterSteps session={session} />

      <PrimaryAction election={e} session={session} go={go} />

      {e.status === 'tallied' ? <ResultCard election={e} /> : <CandidateList election={e} />}

      <Text style={styles.footer}>
        {e.stats.ballots} buletine pe board din {e.stats.eligible} alegători eligibili ({percent(e.stats.ballots, e.stats.eligible)}).
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  meta: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  footer: { fontSize: 13, color: colors.muted, textAlign: 'center' },
})
