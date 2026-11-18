import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../../lib/theme'

/** Comutatorul dintre modurile de înregistrare (cameră, text MRZ, doar CNP). */
export function ModeTabs<T extends string>({ tabs, active, onChange }: { tabs: { key: T; label: string }[]; active: T; onChange: (key: T) => void }) {
  return (
    <View style={styles.tabs}>
      {tabs.map((t) => (
        <Text key={t.key} onPress={() => onChange(t.key)} style={[styles.tab, t.key === active && styles.tabActive]}>
          {t.label}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.surface2,
    color: colors.ink2,
    fontWeight: '600',
    overflow: 'hidden',
  },
  tabActive: { backgroundColor: colors.accent, color: '#fff' },
})
