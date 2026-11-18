import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors, radius } from '../../lib/theme'

/** Card simplu sau apăsabil (cu stare „selectat”, pentru opțiunile de vot). */
export function Card({ children, style, onPress, selected }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; selected?: boolean }) {
  const cardStyle = [styles.card, selected && styles.cardSelected, style]
  if (!onPress) return <View style={cardStyle}>{children}</View>
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, pressed && styles.pressed]} accessibilityRole="button" accessibilityState={{ selected }}>
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 8,
  },
  cardSelected: { borderColor: colors.accent, borderWidth: 2, padding: 15, backgroundColor: '#fbfcff' },
  pressed: { opacity: 0.75 },
})
