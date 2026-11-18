import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { colors } from '../../lib/theme'

/** Câmp de text cu etichetă și, dedesubt, o explicație sau o eroare. */
export function Field({ label, hint, error, ...input }: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...input} style={[styles.input, error ? { borderColor: colors.bad } : null, input.style]} />
      {error ? <Text style={styles.fieldError}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: colors.ink2 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 18,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  hint: { fontSize: 13, color: colors.muted },
  fieldError: { fontSize: 13, color: colors.bad },
})
