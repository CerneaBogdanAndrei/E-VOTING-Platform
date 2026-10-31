import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { checkCnp, generateCredential, parseMrz } from '@evoting/crypto'
import { api } from '../../../api'
import { Button, Field, LinkButton, Notice, P, Screen } from '../../../components/ui'
import { errorMessage } from '../../../lib/format'
import { useServerInfo } from '../../../lib/useServerInfo'
import { useSession } from '../../../lib/session'
import { mono } from '../../../lib/theme'

export default function OcrScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { update } = useSession(id)
  const info = useServerInfo()
  const [cnp, setCnp] = useState('')
  const [mrz, setMrz] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const check = checkCnp(cnp)
  const fieldError = cnp.length === 13 && !check.ok ? check.reason : undefined
  const parsed = mrz.trim() ? parseMrz(mrz) : null

  // Textul MRZ (ce va produce OCR-ul) se validează cu cifrele de control ICAO, apoi se extrage CNP-ul.
  const useMrz = () => {
    if (!parsed) return setError('Zona MRZ nu are formatul unui act de identitate (2 rânduri × 36 sau 3 × 30 de caractere).')
    const bad = parsed.checks.filter((c) => !c.ok)
    if (bad.length) return setError(`Citire greșită: nu se potrivește cifra de control pentru ${bad.map((c) => c.name).join(', ')}. Rescanează.`)
    if (!parsed.cnp) return setError('CNP-ul nu a putut fi extras din MRZ.')
    setError(undefined)
    setCnp(parsed.cnp)
  }

  const fillTestCnp = async () => {
    try {
      const { cnp: sample } = await api.demo.sampleCnp(id)
      if (sample) setCnp(sample)
      else setError('Nu mai există CNP-uri de test. Generează eligibili din panoul comisiei (unelte de demo).')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const submit = async () => {
    setBusy(true)
    setError(undefined)
    try {
      // Perechea de chei de credential se generează pe telefon; la server ajunge doar cheia publică.
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
      <View style={styles.camera}>
        <View style={styles.frame}>
          <Text style={styles.mrz}>IDROUPOPESCU&lt;&lt;ANDREI&lt;&lt;&lt;&lt;&lt;&lt;</Text>
          <Text style={styles.mrz}>AB123456&lt;4ROU0403125M3104289&lt;</Text>
        </View>
        <Text style={styles.cameraText}>Încadrează zona MRZ, rândurile de jos ale buletinului.</Text>
      </View>
      <Notice
        tone="warn"
        text="Camera cu recunoaștere MRZ vine cu modulul nativ de OCR (Tesseract / ML Kit). Până atunci, lipește textul MRZ sau introdu CNP-ul de mână: restul fluxului e același."
      />

      <Field
        label="Text MRZ (opțional)"
        value={mrz}
        onChangeText={setMrz}
        autoCapitalize="characters"
        autoCorrect={false}
        multiline
        placeholder={'IDROU…\n…'}
        hint={parsed ? `${parsed.format}: cifre de control ${parsed.valid ? 'corecte' : 'GREȘITE'}${parsed.cnp ? ', CNP găsit' : ''}` : 'Cifrele de control din MRZ validează citirea.'}
        style={[mono, { fontSize: 12 }]}
      />
      {mrz.trim() !== '' && <LinkButton title="Extrage CNP-ul din MRZ" onPress={useMrz} />}

      <Field
        label="CNP"
        value={cnp}
        onChangeText={(v) => setCnp(v.replace(/\D/g, '').slice(0, 13))}
        keyboardType="number-pad"
        maxLength={13}
        placeholder="13 cifre"
        error={fieldError}
        hint={check.ok ? 'Format valid, cifra de control se potrivește.' : 'Se verifică formatul și cifra de control.'}
        style={mono}
      />
      {info?.demoMode && <LinkButton title="Completează un CNP de test eligibil" onPress={fillTestCnp} />}

      {error && <Notice tone="bad" text={error} />}
      <Button title="Confirmă și înregistrează-te" onPress={submit} disabled={!check.ok} loading={busy} />
      <P muted>
        Telefonul generează o pereche de chei de credential, iar serverul leagă cheia publică de amprenta HMAC a CNP-ului. CNP-ul nu se stochează.
        Nivel de încredere: optic.
      </P>
    </Screen>
  )
}

const styles = StyleSheet.create({
  camera: {
    backgroundColor: '#0e1726',
    borderRadius: 16,
    padding: 18,
    gap: 14,
    alignItems: 'center',
  },
  frame: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#7ea0ff',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
    gap: 4,
  },
  mrz: { ...mono, color: '#c7d4f5', fontSize: 12, letterSpacing: 1 },
  cameraText: { color: '#c7d4f5', fontSize: 13, textAlign: 'center' },
})
