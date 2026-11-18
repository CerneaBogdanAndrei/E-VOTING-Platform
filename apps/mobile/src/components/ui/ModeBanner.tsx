import { StyleSheet, Text, View } from 'react-native'
import { apiMode } from '../../api'
import { colors } from '../../lib/theme'

/** Arată dacă aplicația vorbește cu serverul real sau cu backend-ul simulat. */
export function ModeBanner() {
  const label = apiMode.kind === 'mock' ? 'Backend simulat (date de test)' : `API: ${apiMode.url}`
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>
        {label}
        {' · ElGamal pe ristretto255'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'flex-start',
    backgroundColor: colors.warnSoft,
    borderColor: colors.warnLine,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  bannerText: { color: colors.warn, fontSize: 12 },
})
