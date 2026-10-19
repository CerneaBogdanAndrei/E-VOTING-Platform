import * as Clipboard from 'expo-clipboard'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Button, Card, H1, LinkButton, Notice, P, Screen } from '../../../components/ui'
import { formatDateTime, groupHash } from '../../../lib/format'
import { useSession } from '../../../lib/session'
import { colors, mono } from '../../../lib/theme'

export default function ConfirmationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useSession(id)
  const [copied, setCopied] = useState(false)
  const receipt = session.receipt

  if (!receipt) {
    return (
      <Screen>
        <Notice tone="warn" text="Nu există niciun vot trimis de pe acest telefon la acest scrutin." />
        <Button title="Înapoi la scrutin" onPress={() => router.dismissTo({ pathname: '/scrutin/[id]', params: { id } })} />
      </Screen>
    )
  }

  const copy = async () => {
    await Clipboard.setStringAsync(receipt.trackingCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.check}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <H1>Votul tău e pe board</H1>
        <P muted>
          Buletinul #{receipt.seq}, primit la {formatDateTime(receipt.receivedAt)}.
        </P>
      </View>

      <Card>
        <Text style={styles.label}>Cod de urmărire</Text>
        <Text style={styles.code} selectable>
          {groupHash(receipt.trackingCode)}
        </Text>
        <LinkButton title={copied ? 'Copiat' : 'Copiază codul'} onPress={copy} />
      </Card>
      <P muted>
        Cu acest cod îți găsești buletinul pe board-ul public, din aplicație sau de pe site. Codul nu dezvăluie pe cine ai votat, așa că îl poți
        păstra fără grijă.
      </P>

      <Button title="Verifică pe board" onPress={() => router.push({ pathname: '/scrutin/[id]/verifica', params: { id } })} />
      <Button title="Înapoi la scrutin" variant="secondary" onPress={() => router.dismissTo({ pathname: '/scrutin/[id]', params: { id } })} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.okSoft,
    borderWidth: 1,
    borderColor: colors.okLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 30, color: colors.ok, fontWeight: '700' },
  label: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  code: { ...mono, fontSize: 16, lineHeight: 26, color: colors.ink, letterSpacing: 0.5 },
})
