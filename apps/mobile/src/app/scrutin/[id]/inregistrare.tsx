import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { api } from '../../../api'
import { Card, H1, Notice, P, Screen, Tag } from '../../../components/ui'
import { colors } from '../../../lib/theme'
import { useAsync } from '../../../lib/useAsync'

export default function RegistrationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  // un scrutin „doar NFC” nu acceptă scanarea optică (serverul ar refuza-o oricum)
  const election = useAsync(() => api.getElection(id), [id])
  const nfcOnly = election.data?.requireNfc === true

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <H1>Confirmă-ți identitatea</H1>
        <P muted>
          {nfcOnly
            ? 'O singură dată per scrutin. La acest scrutin, comisia acceptă doar cartea electronică de identitate (CEI), citită prin NFC.'
            : 'O singură dată per scrutin. Alege cum vrei să citim datele de pe buletin.'}
        </P>
      </View>

      {nfcOnly ? (
        <Notice
          tone="accent"
          text="Scanarea optică nu e permisă la acest scrutin: un MRZ citit cu camera poate fi și printat, pe când datele de pe cip sunt semnate de stat. Ai nevoie de o carte electronică și de un telefon cu NFC."
        />
      ) : (
        <Card onPress={() => router.push({ pathname: '/scrutin/[id]/ocr', params: { id } })}>
          <View style={styles.head}>
            <Text style={styles.icon}>▭</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.title}>Scanează buletinul</Text>
              <Text style={styles.text}>Merge cu orice carte de identitate. Camera citește zona MRZ, rândurile cu „&lt;&lt;&lt;” de jos.</Text>
            </View>
          </View>
          <Tag label="Verificat optic" />
        </Card>
      )}

      <Card onPress={() => router.push({ pathname: '/scrutin/[id]/nfc', params: { id } })}>
        <View style={styles.head}>
          <Text style={[styles.icon, { color: colors.accent }]}>◉</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title}>Citește cartea electronică (CEI)</Text>
            <Text style={styles.text}>
              Apropii telefonul de buletin și datele se citesc automat de pe cip. Semnătura digitală a statului confirmă că documentul e autentic.
            </Text>
          </View>
        </View>
        <View style={styles.tags}>
          <Tag label="Automat" tone="accent" />
          <Tag label="Verificat criptografic" tone="ok" />
        </View>
      </Card>

      <Text style={styles.privacy}>
        CNP-ul nu se păstrează nicăieri în clar: serverul reține doar o amprentă HMAC, din care nu se poate reconstitui. Poza și adresa nu părăsesc telefonul.
      </Text>
      <Text style={styles.privacy}>
        Ai schimbat telefonul? Dacă nu ai votat încă, te poți înregistra din nou de pe acesta: cheia veche devine invalidă. O înregistrare prin NFC se poate
        înlocui doar tot prin NFC. După vot, înregistrarea nu se mai poate schimba.
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  icon: { fontSize: 28, color: colors.ink2, width: 34, textAlign: 'center' },
  title: { fontSize: 17, fontWeight: '600', color: colors.ink },
  text: { fontSize: 14, lineHeight: 20, color: colors.ink2 },
  tags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  privacy: { fontSize: 13, lineHeight: 19, color: colors.muted },
})
