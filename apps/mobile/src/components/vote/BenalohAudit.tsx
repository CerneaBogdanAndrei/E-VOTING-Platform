import * as Clipboard from 'expo-clipboard'
import { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { auditBallot, type EncryptedBallot } from '@evoting/crypto'
import { electionParams, type Election } from '../../api'
import { candidateLabel } from '../../lib/format'
import { colors } from '../../lib/theme'
import { Button, Card, H1, H2, Notice, P, Screen } from '../ui'

/**
 * Provocarea Benaloh: aplicația dezvăluie r-urile buletinului, iar oricine poate
 * recripta opțiunea declarată și compara. Buletinul auditat nu se mai trimite.
 */
export function BenalohAudit({ election, audited, onDone }: { election: Election; audited: EncryptedBallot; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const params = electionParams(election)
  const local = auditBallot(params, audited.ballot.ciphertexts, audited.secrets)
  const declared = election.candidates.find((c) => c.position === audited.secrets.choice)
  const data = JSON.stringify({ electionId: election.id, ciphertexts: audited.ballot.ciphertexts, secrets: audited.secrets })

  const copy = async () => {
    await Clipboard.setStringAsync(data)
    setCopied(true)
  }

  return (
    <Screen>
      <H1>Auditul buletinului</H1>
      <P>
        Aplicația a dezvăluit numerele aleatoare r folosite la criptare. Cu ele, oricine poate verifica independent că buletinul criptează exact opțiunea ta:
        lipește datele în tab-ul „Audit buletin” de pe site sau rulează verificatorul CLI pe alt dispozitiv.
      </P>
      <Card style={{ borderColor: local.ok ? colors.okLine : colors.badLine }}>
        <H2>Verificare locală</H2>
        <Text style={styles.meta}>Opțiune declarată: {declared ? candidateLabel(declared) : '?'}</Text>
        <Text style={[styles.name, { color: local.ok ? colors.ok : colors.bad }]}>{local.ok ? '✓ Criptotextele corespund opțiunii' : `✗ ${local.reason}`}</Text>
      </Card>
      <Button title={copied ? 'Copiat' : 'Copiază datele de audit'} variant="secondary" onPress={copy} />
      <Notice
        tone="warn"
        text="Datele de audit dezvăluie opțiunea aleasă: nu le trimite nimănui altcuiva. Acest buletin nu se mai trimite; votul se recriptează cu numere noi."
      />
      <Button title="Am verificat: recriptează votul" onPress={onDone} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  name: { fontSize: 17, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 18 },
})
