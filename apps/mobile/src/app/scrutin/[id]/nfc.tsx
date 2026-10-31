import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { generateCredential } from '@evoting/crypto'
import { ApiError, api, base64ToBytes, bytesToBase64, dg1FromMrz, mockTools, mrzFromDg1, parseMrz } from '../../../api'
import { Button, Card, Field, H2, LinkButton, Notice, Screen } from '../../../components/ui'
import { errorMessage } from '../../../lib/format'
import { nfcModule } from '../../../lib/native'
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
  /** Cipul citit, păstrat ca înregistrarea să poată fi reluată după adăugarea în lista de test. */
  const [lastRead, setLastRead] = useState<{ dg1: string; sod: string }>()
  const [notEligible, setNotEligible] = useState(false)

  const register = async (dg1: string, sod: string) => {
    setLastRead({ dg1, sod })
    setNotEligible(false)
    const credential = generateCredential()
    const registration = await api.registerNfc(id, { dg1, sod, credentialPubkey: credential.publicKey })
    update({ credential, registration })
    router.dismissTo({ pathname: '/scrutin/[id]', params: { id } })
  }

  /** Citirea reală: modulul nativ deschide PACE cu CAN-ul și citește DG1 și SOD prin JMRTD. */
  const read = async () => {
    if (!nfcModule) return
    setBusy(true)
    setError(undefined)
    try {
      if (!nfcModule.isEnabled()) throw new Error('NFC-ul e oprit. Pornește-l din setările telefonului.')
      const { dg1, sod } = await nfcModule.readDocument(can)
      await register(dg1, sod)
    } catch (err) {
      fail(err)
    }
  }

  const fail = (err: unknown) => {
    setError(errorMessage(err))
    setNotEligible(err instanceof ApiError && err.status === 403)
    setBusy(false)
  }

  // Doar cu backend-ul simulat: pune CNP-ul de pe buletinul tău în lista de eligibili și reia înregistrarea.
  const addSelfAndRetry = async () => {
    if (!mockTools || !lastRead) return
    setBusy(true)
    setError(undefined)
    try {
      const cnp = parseMrz(mrzFromDg1(base64ToBytes(lastRead.dg1)))?.cnp
      if (!cnp) throw new Error('DG1 nu conține un MRZ valid cu CNP')
      await mockTools.addEligibleCnp(id, cnp)
      await register(lastRead.dg1, lastRead.sod)
    } catch (err) {
      fail(err)
    }
  }

  // Fără modulul nativ, cu backend-ul simulat: un „cip” de test cu MRZ-ul unui alegător eligibil.
  const simulate = async () => {
    if (!mockTools) return
    setBusy(true)
    setError(undefined)
    try {
      const mrz = await mockTools.sampleMrz(id, 'TD1')
      if (!mrz) throw new Error('Nu mai există CNP-uri de test neînregistrate la acest scrutin.')
      await register(bytesToBase64(dg1FromMrz(mrz)), '')
    } catch (err) {
      fail(err)
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
      {notEligible && mockTools && lastRead && (
        <LinkButton title="Test: adaugă CNP-ul meu în lista de eligibili și reîncearcă" onPress={addSelfAndRetry} />
      )}
      {nfcModule?.isSupported() ? (
        <Button title={busy ? 'Ține telefonul lângă buletin…' : 'Citește cipul'} onPress={read} disabled={can.length !== 6} loading={busy} />
      ) : mockTools ? (
        <>
          <Notice tone="warn" text="Modulul NFC nativ lipsește (Expo Go sau web). Cu backend-ul simulat, citirea cipului se simulează." />
          <Button title="Simulează citirea cipului" onPress={simulate} disabled={can.length !== 6} loading={busy} />
        </>
      ) : (
        <Notice tone="warn" text="Citirea NFC are nevoie de modulul nativ (JMRTD) dintr-un development build Android: npx expo run:android." />
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
