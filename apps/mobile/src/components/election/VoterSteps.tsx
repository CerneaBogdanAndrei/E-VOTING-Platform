import { StyleSheet, Text, View } from 'react-native'
import { formatDateTime, shortHash, trustLabel } from '../../lib/format'
import type { VoterSession } from '../../lib/session'
import { colors } from '../../lib/theme'
import { Card, H2 } from '../ui'

/** Cei trei pași ai alegătorului la un scrutin, cu ce a făcut deja pe acest telefon. */
export function VoterSteps({ session }: { session: VoterSession }) {
  return (
    <Card>
      <H2>Pașii tăi</H2>
      <Step n={1} done={!!session.registration} title="Înregistrare cu buletinul" detail={registrationDetail(session)} />
      <Step
        n={2}
        done={!!session.receipt}
        title="Vot criptat"
        detail={session.receipt ? `Buletinul #${session.receipt.seq}, trimis la ${formatDateTime(session.receipt.receivedAt)}` : undefined}
      />
      <Step n={3} done={false} title="Verificare pe board" detail={session.receipt ? `Cod: ${shortHash(session.receipt.trackingCode)}` : undefined} last />
    </Card>
  )
}

function registrationDetail(session: VoterSession) {
  const r = session.registration
  if (!r) return undefined
  return `${r.method === 'nfc' ? 'Prin NFC' : 'Prin scanare'} · ${trustLabel[r.trustLevel]}`
}

function Step({ n, done, title, detail, last }: { n: number; done: boolean; title: string; detail?: string; last?: boolean }) {
  return (
    <View style={[styles.step, !last && styles.stepBorder]}>
      <View style={[styles.dot, done && styles.dotDone]}>
        <Text style={[styles.dotText, done && { color: colors.ok }]}>{done ? '✓' : n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stepTitle, done && { color: colors.ink }]}>{title}</Text>
        {detail && <Text style={styles.meta}>{detail}</Text>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  meta: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  step: { flexDirection: 'row', gap: 12, paddingVertical: 10, alignItems: 'flex-start' },
  stepBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.okSoft, borderColor: colors.okLine },
  dotText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  stepTitle: { fontSize: 15, fontWeight: '600', color: colors.ink2 },
})
