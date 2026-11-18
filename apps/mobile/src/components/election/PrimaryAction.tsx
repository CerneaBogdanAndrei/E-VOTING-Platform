import { View } from 'react-native'
import type { Election } from '../../api'
import { formatDateTime } from '../../lib/format'
import type { VoterSession } from '../../lib/session'
import { Button, Notice } from '../ui'

export type VoterRoute = '/scrutin/[id]/inregistrare' | '/scrutin/[id]/vot' | '/scrutin/[id]/verifica'

/** Butonul principal al paginii scrutinului: ce poate face alegătorul acum. */
export function PrimaryAction({ election: e, session, go }: { election: Election; session: VoterSession; go: (route: VoterRoute) => void }) {
  const canRegister = e.status === 'draft' || e.status === 'open'
  if (session.receipt) return <Button title="Verifică votul pe board" onPress={() => go('/scrutin/[id]/verifica')} />
  if (!session.registration && canRegister) return <Button title="Înregistrează-te" onPress={() => go('/scrutin/[id]/inregistrare')} />
  if (session.registration && e.status === 'open') return <Button title="Votează" onPress={() => go('/scrutin/[id]/vot')} />
  if (session.registration && e.status === 'draft')
    return <Notice tone="accent" text={`Ești înregistrat. Votul se deschide pe ${formatDateTime(e.opensAt)}.`} />
  return (
    <View style={{ gap: 10 }}>
      <Notice
        text={
          e.status === 'tallied' ? 'Votul s-a încheiat, iar rezultatul e publicat.' : 'Votul s-a încheiat. Rezultatul apare după decriptarea de către trustees.'
        }
      />
      {e.stats.ballots > 0 && <Button title="Caută un cod de urmărire" variant="secondary" onPress={() => go('/scrutin/[id]/verifica')} />}
    </View>
  )
}
