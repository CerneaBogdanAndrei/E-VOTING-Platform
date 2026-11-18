import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { colors } from '../../lib/theme'

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
})
