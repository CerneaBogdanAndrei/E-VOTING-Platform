import * as Clipboard from 'expo-clipboard'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { auditBallot, ballotDigest, type EncryptedBallot } from '@evoting/crypto'
import { api, electionParams, prepareBallot, submitBallot, type Election } from '../../../api'
import { Button, Card, H1, H2, LinkButton, Loading, Notice, P, Screen } from '../../../components/ui'
import { errorMessage, groupHash } from '../../../lib/format'
import { useSession } from '../../../lib/session'
import { colors, mono } from '../../../lib/theme'
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

  if (election.error) return <Screen><Notice tone="bad" text={election.error.message} /></Screen>
  if (!election.data) return <Loading />
  const e = election.data
  const { registration, credential } = session

  if (!registration || !credential) {
    return (
      <Screen>
        <Notice tone="warn" text={registration ? 'Cheia de credential nu e pe acest telefon. Votul se poate trimite doar de pe telefonul cu care te-ai înregistrat.' : 'Trebuie să te înregistrezi cu buletinul înainte să votezi.'} />
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

  if (audit) return <BenalohAudit election={e} audited={audit} onDone={() => {
    // buletinul auditat și-a dezvăluit r-urile, deci se aruncă; votul se recriptează cu r noi
    setAudit(undefined)
    if (choice !== undefined) encrypt(choice)
  }} />

  if (prepared && selected) {
    return (
      <Screen>
        <H1>Confirmă votul</H1>
        <Card style={{ borderColor: colors.accent, borderWidth: 2, padding: 15 }}>
          <Text style={styles.label}>Ai ales</Text>
          <Text style={styles.chosen}>{selected.name}</Text>
          <Text style={styles.meta}>{selected.description}</Text>
        </Card>
        <Card>
          <H2>Buletinul criptat</H2>
          <P muted>
            Criptat pe telefon în {prepared.ms} ms: {e.candidates.length} criptotexte ElGamal, câte o dovadă că fiecare e 0 sau 1 și o dovadă că
            suma e 1. Serverul va verifica dovezile fără să afle pe cine ai votat.
          </P>
          <Text style={styles.label}>Amprenta buletinului</Text>
          <Text style={styles.code}>{groupHash(ballotDigest(prepared.ballot.ballot)).slice(0, 35)}…</Text>
        </Card>
        {error && <Notice tone="bad" text={error} />}
        <Button title="Trimite votul" onPress={submit} loading={busy} />
        <Button title="Verifică întâi criptarea (Benaloh)" variant="secondary" onPress={() => setAudit(prepared.ballot)} disabled={busy} />
        <LinkButton title="Înapoi la listă" onPress={() => setPrepared(undefined)} />
        <P muted>După trimitere votul nu mai poate fi schimbat: contează un singur vot per credential.</P>
      </Screen>
    )
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <H1>{e.title}</H1>
        <P muted>Alege un singur candidat.</P>
      </View>
      {e.status !== 'open' && <Notice tone="warn" text="Votul nu este deschis acum." />}
      {e.candidates.map((c) => {
        const isSelected = c.position === choice
        return (
          <Card key={c.id} onPress={() => setChoice(c.position)} selected={isSelected}>
            <View style={styles.option}>
              <View style={[styles.radio, isSelected && styles.radioOn]}>{isSelected && <View style={styles.radioDot} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.meta}>{c.description}</Text>
              </View>
            </View>
          </Card>
        )
      })}
      {error && <Notice tone="bad" text={error} />}
      <Button title={busy ? 'Se criptează…' : 'Criptează votul'} onPress={confirm} loading={busy} disabled={choice === undefined || e.status !== 'open'} />
    </Screen>
  )
}

/**
 * Provocarea Benaloh: aplicația dezvăluie r-urile buletinului, iar oricine poate
 * recripta opțiunea declarată și compara. Buletinul auditat nu se mai trimite.
 */
function BenalohAudit({ election, audited, onDone }: { election: Election; audited: EncryptedBallot; onDone: () => void }) {
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
        Aplicația a dezvăluit numerele aleatoare r folosite la criptare. Cu ele, oricine poate verifica independent că buletinul criptează exact
        opțiunea ta: lipește datele în tab-ul „Audit buletin” de pe site sau rulează verificatorul CLI pe alt dispozitiv.
      </P>
      <Card style={{ borderColor: local.ok ? colors.okLine : colors.badLine }}>
        <H2>Verificare locală</H2>
        <Text style={styles.meta}>Opțiune declarată: {declared?.name}</Text>
        <Text style={[styles.name, { color: local.ok ? colors.ok : colors.bad }]}>{local.ok ? '✓ Criptotextele corespund opțiunii' : `✗ ${local.reason}`}</Text>
      </Card>
      <Button title={copied ? 'Copiat' : 'Copiază datele de audit'} variant="secondary" onPress={copy} />
      <Notice tone="warn" text="Datele de audit dezvăluie opțiunea aleasă: nu le trimite nimănui altcuiva. Acest buletin nu se mai trimite; votul se recriptează cu numere noi." />
      <Button title="Am verificat: recriptează votul" onPress={onDone} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  name: { fontSize: 17, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  label: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  chosen: { fontSize: 22, fontWeight: '700', color: colors.ink },
  code: { ...mono, fontSize: 14, color: colors.ink2 },
})
