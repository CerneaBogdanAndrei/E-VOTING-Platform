import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { generateCredential } from '@evoting/crypto'
import { api } from '../../../api'
import { useServerInfo } from '../../../lib/useServerInfo'
import { Button, Card, Field, H2, Notice, Screen } from '../../../components/ui'
import { errorMessage } from '../../../lib/format'
import { useSession } from '../../../lib/session'
import { colors, mono } from '../../../lib/theme'

const STEPS = [
  'Telefonul deschide un canal securizat cu cipul (PACE), folosind CAN-ul.',
  'Citește DG1 (datele din MRZ) și SOD (amprentele semnate de stat). Poza nu se citește.',
  'Serverul verifică semnătura SOD până la certificatul României (Passive Authentication).',
  'Serverul extrage CNP-ul, verifică eligibilitatea și reține doar HMAC(CNP).',
]

export default function NfcScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { update } = useSession(id)
  const [can, setCan] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const info = useServerInfo()

  // Fără modulul nativ (JMRTD) cipul nu se poate citi. În modul demo, serverul dă un „cip” de test
  // (DG1 + SOD semnate de un CSCA de test), iar Passive Authentication rulează pe server exact ca la un buletin real.
  const simulate = async () => {
    setBusy(true)
    setError(undefined)
    try {
      const doc = await api.demo.testDocument(id)
      if (!doc) throw new Error('Serverul nu are un CSCA de test.')
      const credential = generateCredential()
      const registration = await api.registerNfc(id, { dg1: doc.dg1, sod: doc.sod, credentialPubkey: credential.publicKey })
      update({ credential, registration })
      router.dismissTo({ pathname: '/scrutin/[id]', params: { id } })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.card}>
          <View style={styles.chip} />
          <Text style={styles.cardText}>CEI</Text>
        </View>
        <Text style={styles.waves}>)))</Text>
        <View style={styles.phone} />
      </View>
      <Text style={styles.heroText}>Apropie partea de sus a telefonului de spatele buletinului și ține-l nemișcat câteva secunde.</Text>

      <Field
        label="CAN"
        value={can}
        onChangeText={(v) => setCan(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="6 cifre"
        hint="Numărul de 6 cifre din dreapta-jos de pe fața buletinului, sub data expirării."
        style={mono}
      />

      {error && <Notice tone="bad" text={error} />}
      {info?.demoMode ? (
        <Button title="Simulează citirea cipului" onPress={simulate} disabled={can.length !== 6} loading={busy} />
      ) : (
        <Notice tone="warn" text="Citirea NFC are nevoie de modulul nativ (JMRTD), care nu e încă integrat în aplicație." />
      )}

      <Card>
        <H2>Ce se întâmplă</H2>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.step}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 18 },
  card: {
    width: 96,
    height: 62,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentLine,
    padding: 8,
    justifyContent: 'space-between',
  },
  chip: { width: 20, height: 15, borderRadius: 3, backgroundColor: '#d9b44a' },
  cardText: { fontSize: 11, fontWeight: '700', color: colors.accent2, alignSelf: 'flex-end' },
  waves: { fontSize: 22, color: colors.accent, fontWeight: '700' },
  phone: { width: 40, height: 74, borderRadius: 9, borderWidth: 3, borderColor: colors.ink2 },
  heroText: { fontSize: 15, lineHeight: 22, color: colors.ink2, textAlign: 'center' },
  step: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  stepNum: { width: 18, fontSize: 14, fontWeight: '700', color: colors.accent },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink2 },
})
