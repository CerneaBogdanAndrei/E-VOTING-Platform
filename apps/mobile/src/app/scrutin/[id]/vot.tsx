import * as Clipboard from 'expo-clipboard'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { createAudit, encryptBallot, verifyAudit, type AuditResult, type BenalohAudit } from '@evoting/crypto'
import { api, electionParams, submitBallot } from '../../../api'
import { Button, Card, H1, H2, LinkButton, Loading, Notice, P, Screen } from '../../../components/ui'
import { errorMessage } from '../../../lib/format'
import { useSession } from '../../../lib/session'
import { colors, mono } from '../../../lib/theme'
import { useAsync } from '../../../lib/useAsync'

/** Lasă interfața să afișeze „Se criptează…” înainte de calculul (sincron) al dovezilor. */
const nextFrame = () => new Promise((r) => setTimeout(r, 30))

export default function VoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const election = useAsync(() => api.getElection(id), [id])
  const { session, update } = useSession(id)
  const [choices, setChoices] = useState<number[]>([])
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState<'send' | 'audit'>()
  const [error, setError] = useState<string>()
  const [audit, setAudit] = useState<{ data: BenalohAudit; result: AuditResult; ms: number }>()

  if (election.error) return <Screen><Notice tone="bad" text={election.error.message} /></Screen>
  if (!election.data) return <Loading />
  const e = election.data
  const credential = session.credential

  if (!session.registration || !credential) {
    return (
      <Screen>
        <Notice tone="warn" text="Trebuie să te înregistrezi cu buletinul de pe acest telefon înainte să votezi." />
        <Button title="Înregistrează-te" onPress={() => router.replace({ pathname: '/scrutin/[id]/inregistrare', params: { id } })} />
      </Screen>
    )
  }

  const multi = e.maxSelections > 1
  const selected = e.candidates.filter((c) => choices.includes(c.position))
  const validCount = choices.length >= e.minSelections && choices.length <= e.maxSelections

  const toggle = (position: number) => {
    if (!multi) return setChoices([position])
    setChoices((prev) => (prev.includes(position) ? prev.filter((p) => p !== position) : prev.length < e.maxSelections ? [...prev, position] : prev))
  }

  const submit = async () => {
    setBusy('send')
    setError(undefined)
    try {
      await nextFrame()
      // Mereu o criptare nouă: un buletin auditat (Benaloh) nu se trimite niciodată.
      const encrypted = encryptBallot(electionParams(e), credential.publicKey, choices)
      const receipt = await submitBallot(api, id, credential, encrypted)
      if (receipt.trackingCode !== encrypted.trackingCode) throw new Error('Serverul a întors alt cod de urmărire decât cel calculat pe telefon!')
      update({ receipt })
      router.replace({ pathname: '/scrutin/[id]/confirmare', params: { id } })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(undefined)
    }
  }

  const runAudit = async () => {
    setBusy('audit')
    setError(undefined)
    try {
      await nextFrame()
      const t0 = Date.now()
      const params = electionParams(e)
      const encrypted = encryptBallot(params, credential.publicKey, choices)
      const ms = Date.now() - t0
      const data = createAudit(params, encrypted)
      setAudit({ data, result: verifyAudit(data), ms })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(undefined)
    }
  }

  if (confirming && validCount) {
    return (
      <Screen>
        <H1>Confirmă votul</H1>
        <Card style={{ borderColor: colors.accent, borderWidth: 2, padding: 15 }}>
          <Text style={styles.label}>{selected.length === 1 ? 'Ai ales' : selected.length === 0 ? 'Vot alb' : `Ai ales ${selected.length} candidați`}</Text>
          {selected.map((c) => (
            <View key={c.id}>
              <Text style={styles.chosen}>{c.name}</Text>
              {c.description ? <Text style={styles.meta}>{c.description}</Text> : null}
            </View>
          ))}
        </Card>
        <P>
          Votul se criptează pe telefon cu cheia publică a scrutinului (ElGamal pe ristretto255), împreună cu dovezi zero-knowledge că buletinul e
          valid. Serverul verifică dovezile fără să afle pe cine ai votat. După trimitere votul nu mai poate fi schimbat.
        </P>
        {error && <Notice tone="bad" text={error} />}
        <Button title={busy === 'send' ? 'Se criptează și se trimite…' : 'Criptează și trimite'} onPress={submit} loading={busy === 'send'} disabled={!!busy} />

        <Card>
          <H2>Nu ai încredere în aplicație?</H2>
          <P muted>
            Cere-i să-ți arate cum criptează (provocarea Benaloh). Buletinul verificat se aruncă, iar la trimitere se criptează din nou, cu alte valori
            aleatoare. O aplicație care ar cripta altceva decât ai ales ar fi prinsă.
          </P>
          <Button title="Verifică criptarea" variant="secondary" onPress={runAudit} loading={busy === 'audit'} disabled={!!busy} />
          {audit && (
            <View style={{ gap: 8 }}>
              <Notice
                tone={audit.result.ok ? 'ok' : 'bad'}
                text={
                  audit.result.ok
                    ? `Criptarea conține: ${audit.result.selected.join(', ') || 'nicio opțiune'}. (${audit.ms} ms pentru criptare și dovezi)`
                    : `Aplicația NU a criptat ce ai ales: ${audit.result.problems.join('; ')}`
                }
              />
              <P muted>Pentru o verificare cu adevărat independentă, copiază auditul și lipește-l pe alt dispozitiv, pe pagina „Verifică un buletin” a site-ului.</P>
              <Text style={styles.code} numberOfLines={4} selectable>
                {JSON.stringify(audit.data)}
              </Text>
              <LinkButton title="Copiază auditul" onPress={() => Clipboard.setStringAsync(JSON.stringify(audit.data))} />
            </View>
          )}
        </Card>
        <Button title="Înapoi la listă" variant="secondary" onPress={() => { setConfirming(false); setAudit(undefined) }} disabled={!!busy} />
      </Screen>
    )
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <H1>{e.title}</H1>
        <P muted>
          {multi
            ? `Alege ${e.minSelections === 0 ? 'cel mult' : `între ${e.minSelections} și`} ${e.maxSelections} candidați (${choices.length} bifați).`
            : 'Alege un singur candidat.'}
        </P>
      </View>
      {e.status !== 'open' && <Notice tone="warn" text="Votul nu este deschis acum." />}
      {e.candidates.map((c) => {
        const isSelected = choices.includes(c.position)
        return (
          <Card key={c.id} onPress={() => toggle(c.position)} selected={isSelected}>
            <View style={styles.option}>
              <View style={[multi ? styles.box : styles.radio, isSelected && styles.radioOn]}>{isSelected && <View style={multi ? styles.boxDot : styles.radioDot} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                {c.description ? <Text style={styles.meta}>{c.description}</Text> : null}
              </View>
            </View>
          </Card>
        )
      })}
      <Button title="Continuă" onPress={() => setConfirming(true)} disabled={!validCount || e.status !== 'open'} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  boxDot: { width: 12, height: 12, borderRadius: 3, backgroundColor: colors.accent },
  name: { fontSize: 17, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  label: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  chosen: { fontSize: 22, fontWeight: '700', color: colors.ink },
  code: { ...mono, fontSize: 11, color: colors.ink2, backgroundColor: colors.surface2, padding: 8, borderRadius: 8 },
})
