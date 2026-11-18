import { StyleSheet, Text, View } from 'react-native'
import { colors, mono } from '../../lib/theme'

/** Un rând „etichetă: valoare”, folosit la datele citite de pe act și la buletinul găsit pe board. */
export function KeyValueRow({ label, value, bad, mono: isMono }: { label: string; value: string; bad?: boolean; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, bad && { color: colors.bad }, isMono && mono]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 2 },
  label: { fontSize: 14, color: colors.ink2 },
  value: { fontSize: 14, fontWeight: '600', color: colors.ink, flexShrink: 1, textAlign: 'right' },
})
