import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { api, mockTools } from '../../../api'
import { newCredential } from '../../../api/ballot'
import { checkCnp } from '../../../api/cnp'
import { Button, Field, LinkButton, Notice, P, Screen } from '../../../components/ui'
import { errorMessage } from '../../../lib/format'
import { useSession } from '../../../lib/session'
import { mono } from '../../../lib/theme'

export default function OcrScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { update } = useSession(id)
  const [cnp, setCnp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const check = checkCnp(cnp)
  const fieldError = cnp.length === 13 && !check.ok ? check.reason : undefined

  const fillTestCnp = async () => {
    const sample = await mockTools?.sampleCnp(id)
    if (sample) setCnp(sample)
    else setError('Nu mai există CNP-uri de test neînregistrate la acest scrutin.')
  }

  const submit = async () => {
    setBusy(true)
    setError(undefined)
    try {
      const registration = await api.registerOcr(id, { cnp, credentialPubkey: newCredential() })
      update({ registration })
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
        text="Camera și recunoașterea MRZ vin cu modulul nativ de OCR. Până atunci, introdu CNP-ul de mână: restul fluxului e același."
      />

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
      {mockTools && <LinkButton title="Completează un CNP de test eligibil" onPress={fillTestCnp} />}

      {error && <Notice tone="bad" text={error} />}
      <Button title="Confirmă și înregistrează-te" onPress={submit} disabled={!check.ok} loading={busy} />
      <P muted>Telefonul generează o cheie de credential, iar serverul o leagă de amprenta HMAC a CNP-ului. Nivel de încredere: optic.</P>
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
