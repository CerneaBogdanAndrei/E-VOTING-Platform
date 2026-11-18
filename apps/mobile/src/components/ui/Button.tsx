import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { colors } from '../../lib/theme'

type Variant = 'primary' | 'secondary' | 'danger'

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  title: string
  onPress: () => void
  variant?: Variant
  disabled?: boolean
  loading?: boolean
}) {
  const inactive = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [styles.button, variants[variant], inactive && styles.disabled, pressed && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.accent : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && { color: colors.accent2 }]}>{title}</Text>
      )}
    </Pressable>
  )
}

/** Acțiune secundară, ca un link. */
export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
      {({ pressed }) => <Text style={[styles.link, pressed && { opacity: 0.6 }]}>{title}</Text>}
    </Pressable>
  )
}

const variants = StyleSheet.create({
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderColor: colors.accentLine },
  danger: { backgroundColor: colors.bad, borderColor: colors.bad },
})

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600', paddingVertical: 4 },
})
