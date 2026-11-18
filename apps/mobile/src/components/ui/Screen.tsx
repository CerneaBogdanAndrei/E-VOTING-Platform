import type { ReactElement, ReactNode } from 'react'
import { ScrollView, StyleSheet, type RefreshControlProps } from 'react-native'
import { colors } from '../../lib/theme'

/** Conținutul unui ecran: derulabil, cu spațiere uniformă între blocuri. */
export function Screen({ children, refreshControl }: { children: ReactNode; refreshControl?: ReactElement<RefreshControlProps> }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} refreshControl={refreshControl} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: 16, gap: 14, paddingBottom: 40 },
})
