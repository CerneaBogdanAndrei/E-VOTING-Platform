import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { api } from '../../../api'
import { buildBallot, CRYPTO_READY } from '../../../api/ballot'
import { Button, Card, H1, Loading, Notice, P, Screen } from '../../../components/ui'
import { errorMessage } from '../../../lib/format'
import { useSession } from '../../../lib/session'
import { colors } from '../../../lib/theme'
import { useAsync } from '../../../lib/useAsync'

export default function VoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const election = useAsync(() => api.getElection(id), [id])
  const { session, update } = useSession(id)
  const [choice, setChoice] = useState<number>()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  if (election.error) return <Screen><Notice tone="bad" text={election.error.message} /></Screen>
  if (!election.data) return <Loading />
  const e = election.data
  const registration = session.registration

  if (!registration) {
    return (
      <Screen>
        <Notice tone="warn" text="Trebuie să te înregistrezi cu buletinul înainte să votezi." />
        <Button title="Înregistrează-te" onPress={() => router.replace({ pathname: '/scrutin/[id]/inregistrare', params: { id } })} />
      </Screen>
    )
  }

  const selected = e.candidates.find((c) => c.position === choice)

  const submit = async () => {
    if (choice === undefined) return
    setBusy(true)
    setError(undefined)
    try {
      const ballot = buildBallot(e.candidates.length, choice, registration.credentialPubkey)
      const receipt = await api.castBallot(id, ballot)
      update({ receipt })
      router.replace({ pathname: '/scrutin/[id]/confirmare', params: { id } })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  if (confirming && selected) {
    return (
      <Screen>
        <H1>Confirmă votul</H1>
        <Card style={{ borderColor: colors.accent, borderWidth: 2, padding: 15 }}>
          <Text style={styles.label}>Ai ales</Text>
          <Text style={styles.chosen}>{selected.name}</Text>
          <Text style={styles.meta}>{selected.description}</Text>
        </Card>
        <P>
          Votul se criptează pe telefon înainte de trimitere, cu cheia publică a scrutinului. Serverul verifică doar că buletinul e valid, fără să afle
          pe cine ai votat. După trimitere votul nu mai poate fi schimbat.
        </P>
        {!CRYPTO_READY && <Notice tone="warn" text="Versiune de test: criptarea și dovezile sunt deocamdată înlocuite de un placeholder." />}
        {error && <Notice tone="bad" text={error} />}
        <Button title="Criptează și trimite" onPress={submit} loading={busy} />
        <Button title="Înapoi la listă" variant="secondary" onPress={() => setConfirming(false)} disabled={busy} />
      </Screen>
    )
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <H1>{e.title}</H1>
        <P muted>Alege un singur candidat.</P>
      </View>
      {e.status !== 'open' && <Notice tone="warn" text="Votul nu este deschis acum." />}
      {e.candidates.map((c) => {
        const isSelected = c.position === choice
        return (
          <Card key={c.id} onPress={() => setChoice(c.position)} selected={isSelected}>
            <View style={styles.option}>
              <View style={[styles.radio, isSelected && styles.radioOn]}>{isSelected && <View style={styles.radioDot} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.meta}>{c.description}</Text>
              </View>
            </View>
          </Card>
        )
      })}
      <Button title="Continuă" onPress={() => setConfirming(true)} disabled={choice === undefined || e.status !== 'open'} />
    </Screen>
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
  label: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  chosen: { fontSize: 22, fontWeight: '700', color: colors.ink },
})
