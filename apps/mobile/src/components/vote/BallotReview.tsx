import { StyleSheet, Text } from 'react-native'
import { ballotDigest, type EncryptedBallot } from '@evoting/crypto'
import type { Candidate, Election } from '../../api'
import { candidateLabel, groupHash } from '../../lib/format'
import { colors, mono } from '../../lib/theme'
import { Button, Card, H1, H2, LinkButton, Notice, P, Screen } from '../ui'

/** Ecranul de confirmare: opțiunea aleasă, buletinul criptat și butoanele trimite / auditează / înapoi. */
export function BallotReview({
  election,
  selected,
  prepared,
  busy,
  error,
  onSubmit,
  onAudit,
  onBack,
}: {
  election: Election
  selected: Candidate
  prepared: { ballot: EncryptedBallot; ms: number }
  busy: boolean
  error?: string
  onSubmit: () => void
  onAudit: () => void
  onBack: () => void
}) {
  return (
    <Screen>
      <H1>Confirmă votul</H1>
      <Card style={{ borderColor: colors.accent, borderWidth: 2, padding: 15 }}>
        <Text style={styles.label}>Ai ales</Text>
        <Text style={styles.chosen}>{candidateLabel(selected)}</Text>
        <Text style={styles.meta}>{selected.kind === 'blank' ? 'niciun candidat' : selected.description}</Text>
      </Card>
      <Card>
        <H2>Buletinul criptat</H2>
        <P muted>
          Criptat pe telefon în {prepared.ms} ms: {election.candidates.length} criptotexte ElGamal, câte o dovadă că fiecare e 0 sau 1 și o dovadă că suma e 1.
          Serverul va verifica dovezile fără să afle pe cine ai votat.
        </P>
        <Text style={styles.label}>Amprenta buletinului</Text>
        <Text style={styles.code}>{groupHash(ballotDigest(prepared.ballot.ballot)).slice(0, 35)}…</Text>
      </Card>
      {error && <Notice tone="bad" text={error} />}
      <Button title="Trimite votul" onPress={onSubmit} loading={busy} />
      <Button title="Verifică întâi criptarea (Benaloh)" variant="secondary" onPress={onAudit} disabled={busy} />
      <LinkButton title="Înapoi la listă" onPress={onBack} />
      <P muted>După trimitere votul nu mai poate fi schimbat: contează un singur vot per credential.</P>
    </Screen>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  chosen: { fontSize: 22, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  code: { ...mono, fontSize: 14, color: colors.ink2 },
})
