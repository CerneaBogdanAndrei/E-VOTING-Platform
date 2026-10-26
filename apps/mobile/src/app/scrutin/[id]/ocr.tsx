import { CameraView, useCameraPermissions } from 'expo-camera'
import { router, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { generateCredential } from '@evoting/crypto'
import { api, checkCnp, mockTools, parseMrz, type MrzData } from '../../../api'
import { Button, Card, Field, H2, LinkButton, Notice, P, Screen } from '../../../components/ui'
import { errorMessage } from '../../../lib/format'
import { ocrModule } from '../../../lib/native'
import { useSession } from '../../../lib/session'
import { colors, mono } from '../../../lib/theme'

type Mode = 'camera' | 'mrz' | 'cnp'

export default function OcrScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { update } = useSession(id)
  const [mode, setMode] = useState<Mode>(ocrModule ? 'camera' : 'mrz')
  const [permission, requestPermission] = useCameraPermissions()
  const camera = useRef<CameraView>(null)
  const [mrzText, setMrzText] = useState('')
  const [mrz, setMrz] = useState<MrzData | null>(null)
  const [cnp, setCnp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const readMrz = (text: string) => {
    setMrzText(text)
    const parsed = parseMrz(text)
    setMrz(parsed)
    setError(parsed ? undefined : 'Nu am găsit zona MRZ (2 rânduri de 36 sau 3 rânduri de 30 de caractere).')
    if (parsed?.cnp) setCnp(parsed.cnp)
  }

  /** Fotografiază buletinul și rulează OCR-ul pe telefon (modulul nativ). */
  const scan = async () => {
    if (!camera.current || !ocrModule) return
    setBusy(true)
    setError(undefined)
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.9, skipProcessing: false })
      readMrz(await ocrModule.recognizeText(photo.uri))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const fillTestMrz = async () => {
    const sample = await mockTools?.sampleMrz(id, 'TD2')
    if (sample) readMrz(sample)
    else setError('Nu mai există CNP-uri de test neînregistrate la acest scrutin.')
  }

  const check = checkCnp(cnp)
  const mrzBlocks = mrz && (!mrz.valid || mrz.expired || !mrz.cnp)

  const submit = async () => {
    setBusy(true)
    setError(undefined)
    try {
      // perechea de chei de credential se generează pe telefon; cheia secretă nu pleacă de aici
      const credential = generateCredential()
      const registration = await api.registerOcr(id, { cnp, credentialPubkey: credential.publicKey })
      update({ credential, registration })
      router.dismissTo({ pathname: '/scrutin/[id]', params: { id } })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Screen>
      <View style={styles.tabs}>
        {ocrModule && <Tab label="Cameră" active={mode === 'camera'} onPress={() => setMode('camera')} />}
        <Tab label="Text MRZ" active={mode === 'mrz'} onPress={() => setMode('mrz')} />
        <Tab label="Doar CNP" active={mode === 'cnp'} onPress={() => setMode('cnp')} />
      </View>

      {mode === 'camera' && ocrModule && (
        <>
          {!permission?.granted ? (
            <Card>
              <P>Aplicația are nevoie de cameră ca să citească zona MRZ. Imaginea se procesează doar pe telefon și nu se trimite nicăieri.</P>
              <Button title="Permite accesul la cameră" onPress={requestPermission} />
            </Card>
          ) : (
            <View style={styles.cameraBox}>
              <CameraView ref={camera} style={styles.camera} facing="back" autofocus="on" />
              <View style={styles.frame} pointerEvents="none" />
              <Text style={styles.cameraText}>Încadrează rândurile cu „&lt;&lt;&lt;” de jos ale buletinului.</Text>
            </View>
          )}
          {permission?.granted && <Button title="Scanează" onPress={scan} loading={busy} />}
        </>
      )}

      {mode === 'mrz' && (
        <>
          {!ocrModule && <Notice tone="warn" text="OCR-ul pe cameră are nevoie de modulul nativ (development build). Aici poți introduce rândurile MRZ de mână." />}
          <Field
            label="Rândurile MRZ"
            value={mrzText}
            onChangeText={readMrz}
            autoCapitalize="characters"
            autoCorrect={false}
            multiline
            placeholder={'IDROUPOPESCU<<ANDREI<<<<...\nGL123456<4ROU0403125M3104289...'}
            style={[mono, { fontSize: 13, minHeight: 80 }]}
          />
          {mockTools && <LinkButton title="Folosește un buletin de test" onPress={fillTestMrz} />}
        </>
      )}

      {mode === 'cnp' && (
        <Field
          label="CNP"
          value={cnp}
          onChangeText={(v) => setCnp(v.replace(/\D/g, '').slice(0, 13))}
          keyboardType="number-pad"
          maxLength={13}
          placeholder="13 cifre"
          error={cnp.length === 13 && !check.ok ? check.reason : undefined}
          hint={check.ok ? 'Format valid, cifra de control se potrivește.' : 'Se verifică formatul și cifra de control.'}
          style={mono}
        />
      )}

      {mode !== 'cnp' && mrz && <MrzSummary mrz={mrz} />}

      {error && <Notice tone="bad" text={error} />}
      <Button title="Confirmă și înregistrează-te" onPress={submit} disabled={!check.ok || (mode !== 'cnp' && !!mrzBlocks) || (mode !== 'cnp' && !mrz)} loading={busy && mode !== 'camera'} />
      <P muted>
        Telefonul generează o cheie de credential, iar serverul o leagă de amprenta HMAC a CNP-ului, fără să păstreze CNP-ul. Nivel de încredere:
        optic (un buletin fals bine printat ar trece; pentru verificare criptografică folosește NFC).
      </P>
    </Screen>
  )
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      {label}
    </Text>
  )
}

function MrzSummary({ mrz }: { mrz: MrzData }) {
  return (
    <Card style={{ borderColor: mrz.valid && mrz.cnp && !mrz.expired ? colors.okLine : colors.line2 }}>
      <H2>Date citite ({mrz.format === 'TD2' ? 'buletin' : mrz.format === 'TD1' ? 'CEI' : 'pașaport'})</H2>
      <Row label="Nume" value={`${mrz.surname} ${mrz.givenNames}`.trim()} />
      <Row label="Document" value={mrz.documentNumber} />
      <Row label="Data nașterii" value={mrz.birthDate} />
      <Row label="Expiră" value={mrz.expiryDate} bad={mrz.expired} />
      <Row label="CNP" value={mrz.cnp ?? 'nu a putut fi reconstituit'} bad={!mrz.cnp} />
      {mrz.checks.map((c) => (
        <Row key={c.field} label={`Control: ${c.field}`} value={c.ok ? '✓' : '✗'} bad={!c.ok} />
      ))}
      {!mrz.valid && <Notice tone="bad" text="Cifrele de control nu se potrivesc: citirea e greșită. Rescanează sau corectează textul." />}
      {mrz.expired && <Notice tone="bad" text="Documentul este expirat." />}
    </Card>
  )
}

function Row({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bad && { color: colors.bad }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.surface2, color: colors.ink2, fontWeight: '600', overflow: 'hidden' },
  tabActive: { backgroundColor: colors.accent, color: '#fff' },
  cameraBox: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#0e1726' },
  camera: { width: '100%', aspectRatio: 1.4 },
  frame: { position: 'absolute', left: 16, right: 16, bottom: 40, height: 70, borderWidth: 2, borderColor: '#7ea0ff', borderStyle: 'dashed', borderRadius: 10 },
  cameraText: { color: '#c7d4f5', fontSize: 13, textAlign: 'center', padding: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 2 },
  rowLabel: { fontSize: 14, color: colors.ink2 },
  rowValue: { fontSize: 14, fontWeight: '600', color: colors.ink, flexShrink: 1, textAlign: 'right' },
})
