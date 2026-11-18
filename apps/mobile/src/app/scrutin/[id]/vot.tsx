// Votul: alegerea candidatului, criptarea pe telefon, (opțional) auditul Benaloh, trimiterea.

import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import type { EncryptedBallot } from '@evoting/crypto'
import { api, prepareBallot, submitBallot } from '../../../api'
import { Button, H1, Loading, Notice, P, Screen } from '../../../components/ui'
import { BallotReview } from '../../../components/vote/BallotReview'
import { BenalohAudit } from '../../../components/vote/BenalohAudit'
import { CandidateOption } from '../../../components/vote/CandidateOption'
import { errorMessage } from '../../../lib/format'
import { useSession } from '../../../lib/session'
import { useAsync } from '../../../lib/useAsync'

export default function VoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const election = useAsync(() => api.getElection(id), [id])
  const { session, update } = useSession(id)
  const [choice, setChoice] = useState<number>()
  const [prepared, setPrepared] = useState<{ ballot: EncryptedBallot; ms: number }>()
  const [audit, setAudit] = useState<EncryptedBallot>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  if (election.error)
    return (
      <Screen>
        <Notice tone="bad" text={election.error.message} />
      </Screen>
    )
  if (!election.data) return <Loading />
  const e = election.data
  const { registration, credential } = session

  if (!registration || !credential) {
    return (
      <Screen>
        <Notice
          tone="warn"
          text={
            registration
              ? 'Cheia de credential nu e pe acest telefon. Votul se poate trimite doar de pe telefonul cu care te-ai înregistrat.'
              : 'Trebuie să te înregistrezi cu buletinul înainte să votezi.'
          }
        />
        {!registration && <Button title="Înregistrează-te" onPress={() => router.replace({ pathname: '/scrutin/[id]/inregistrare', params: { id } })} />}
      </Screen>
    )
  }

  const selected = e.candidates.find((c) => c.position === choice)

  /** Criptează opțiunea pe telefon: câte un criptotext 0/1 per candidat, dovezile ZK și semnătura. */
  const encrypt = (position: number) => {
    const t = Date.now()
    const ballot = prepareBallot(e, credential, position)
    setPrepared({ ballot, ms: Date.now() - t })
  }

  const confirm = () => {
    if (choice === undefined) return
    setError(undefined)
    setBusy(true)
    // lasă interfața să afișeze starea de lucru înainte de calculul sincron
    setTimeout(() => {
      try {
        encrypt(choice)
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setBusy(false)
      }
    }, 30)
  }

  const submit = async () => {
    if (!prepared) return
    setBusy(true)
    setError(undefined)
    try {
      const receipt = await submitBallot(api, e, credential, prepared.ballot)
      update({ receipt })
      router.replace({ pathname: '/scrutin/[id]/confirmare', params: { id } })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  if (audit) {
    return (
      <BenalohAudit
        election={e}
        audited={audit}
        onDone={() => {
          // buletinul auditat și-a dezvăluit r-urile, deci se aruncă; votul se recriptează cu r noi
          setAudit(undefined)
          if (choice !== undefined) encrypt(choice)
        }}
      />
    )
  }

  if (prepared && selected) {
    return (
      <BallotReview
        election={e}
        selected={selected}
        prepared={prepared}
        busy={busy}
        error={error}
        onSubmit={submit}
        onAudit={() => setAudit(prepared.ballot)}
        onBack={() => setPrepared(undefined)}
      />
    )
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <H1>{e.title}</H1>
        <P muted>Alege un singur candidat.</P>
      </View>
      {e.status !== 'open' && <Notice tone="warn" text="Votul nu este deschis acum." />}
      {e.candidates.map((c) => (
        <CandidateOption key={c.id} candidate={c} selected={c.position === choice} onSelect={() => setChoice(c.position)} />
      ))}
      {error && <Notice tone="bad" text={error} />}
      <Button title={busy ? 'Se criptează…' : 'Criptează votul'} onPress={confirm} loading={busy} disabled={choice === undefined || e.status !== 'open'} />
    </Screen>
  )
}
