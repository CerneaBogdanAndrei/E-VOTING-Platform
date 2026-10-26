import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { checkOwnEntry, normalizeTrackingCode } from '@evoting/crypto'
import { api, ApiError, type BoardEntry } from '../../../api'
import { Button, Card, Field, H2, Notice, P, Screen } from '../../../components/ui'
import { errorMessage, formatDateTime, shortHash } from '../../../lib/format'
import { useSession } from '../../../lib/session'
import { colors, mono } from '../../../lib/theme'

export default function VerifyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useSession(id)
  const [code, setCode] = useState(session.receipt?.trackingCode ?? '')
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState<BoardEntry>()
  const [integrity, setIntegrity] = useState<{ ok: boolean; text: string }>()
  const [error, setError] = useState<{ text: string; notFound: boolean }>()

  const search = async () => {
    setBusy(true)
    setFound(undefined)
    setIntegrity(undefined)
    setError(undefined)
    try {
      const trackingCode = normalizeTrackingCode(code)
      const entry = await api.findBallot(id, trackingCode)
      // telefonul recalculează hash-urile; dacă e buletinul trimis de aici, îl compară și cu amprenta păstrată local
      const own = session.receipt && session.receipt.trackingCode === trackingCode ? session.receipt : undefined
      const check = checkOwnEntry(id, entry, { trackingCode, ballotHash: own?.ballotHash })
      setIntegrity(
        check.ok
          ? { ok: true, text: own ? 'Hash-urile recalculate pe telefon corespund, iar conținutul e identic cu buletinul trimis de pe acest telefon.' : 'Hash-urile recalculate pe telefon corespund codului.' }
          : { ok: false, text: check.reason },
      )
      setFound(entry)
    } catch (err) {
      setError({ text: errorMessage(err), notFound: err instanceof ApiError && err.status === 404 })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <P>
        Board-ul e public: oricine vede toate buletinele criptate. Caută-l pe al tău după codul de urmărire ca să confirmi că a ajuns și n-a fost
        modificat.
      </P>
      <Field
        label="Cod de urmărire"
        value={code}
        onChangeText={setCode}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        placeholder="64 de caractere hex"
        style={[mono, { fontSize: 14, paddingVertical: 12 }]}
      />
      <Button title="Caută pe board" onPress={search} loading={busy} disabled={!code.trim()} />

      {found && (
        <Card style={{ borderColor: colors.okLine, backgroundColor: colors.okSoft }}>
          <H2>Buletinul e pe board</H2>
          <Row label="Poziție" value={`#${found.seq}`} />
          <Row label="Primit" value={formatDateTime(found.receivedAt)} />
          <Row label="Hash anterior" value={shortHash(found.prevHash)} mono />
          <Row label="Criptotexte" value={`${found.ciphertexts.length} × (A, B)`} />
          <Text style={[styles.note, integrity && !integrity.ok && { color: colors.bad }]}>
            {integrity?.text} Codul depinde și de hash-ul anterior, deci o modificare a buletinelor dinaintea lui l-ar schimba.
          </Text>
        </Card>
      )}
      {error && (
        <Notice
          tone="bad"
          text={error.notFound ? 'Niciun buletin cu acest cod. Verifică dacă l-ai copiat întreg; dacă da, raportează comisiei electorale.' : error.text}
        />
      )}
    </Screen>
  )
}

function Row({ label, value, mono: isMono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, isMono && mono]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 14, color: colors.ink2 },
  rowValue: { fontSize: 14, fontWeight: '600', color: colors.ink },
  note: { fontSize: 13, lineHeight: 19, color: '#0b6b4a', marginTop: 4 },
})
