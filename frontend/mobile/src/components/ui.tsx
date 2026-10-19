import type { ReactElement, ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { apiMode, type ElectionStatus } from '../api'
import { CRYPTO_READY } from '../api/ballot'
import { statusLabel } from '../lib/format'
import { colors, radius } from '../lib/theme'

export function Screen({ children, refreshControl }: { children: ReactNode; refreshControl?: ReactElement<RefreshControlProps> }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} refreshControl={refreshControl} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  )
}

export function Card({ children, style, onPress, selected }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; selected?: boolean }) {
  const cardStyle = [styles.card, selected && styles.cardSelected, style]
  if (!onPress) return <View style={cardStyle}>{children}</View>
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, pressed && styles.pressed]} accessibilityRole="button" accessibilityState={{ selected }}>
      {children}
    </Pressable>
  )
}

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
      style={({ pressed }) => [styles.button, buttonStyles[variant], inactive && styles.disabled, pressed && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.accent : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && { color: colors.accent2 }]}>{title}</Text>
      )}
    </Pressable>
  )
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
      {({ pressed }) => <Text style={[styles.link, pressed && { opacity: 0.6 }]}>{title}</Text>}
    </Pressable>
  )
}

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'accent'

const toneColors: Record<Tone, { bg: string; border: string; fg: string }> = {
  neutral: { bg: colors.surface2, border: colors.line2, fg: colors.ink2 },
  ok: { bg: colors.okSoft, border: colors.okLine, fg: colors.ok },
  warn: { bg: colors.warnSoft, border: colors.warnLine, fg: colors.warn },
  bad: { bg: colors.badSoft, border: colors.badLine, fg: colors.bad },
  accent: { bg: colors.accentSoft, border: colors.accentLine, fg: colors.accent2 },
}

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const c = toneColors[tone]
  return (
    <View style={[styles.tag, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.tagText, { color: c.fg }]}>{label}</Text>
    </View>
  )
}

const statusTone: Record<ElectionStatus, Tone> = { draft: 'neutral', open: 'ok', closed: 'warn', tallied: 'accent' }

export function StatusTag({ status }: { status: ElectionStatus }) {
  return <Tag label={statusLabel[status]} tone={statusTone[status]} />
}

export function Notice({ text, tone = 'neutral' }: { text: string; tone?: Tone }) {
  const c = toneColors[tone]
  return (
    <View style={[styles.notice, { backgroundColor: c.bg, borderColor: c.border }]} accessibilityRole={tone === 'bad' ? 'alert' : undefined}>
      <Text style={{ color: tone === 'neutral' ? colors.ink2 : c.fg, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  )
}

export function Field({ label, hint, error, ...input }: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...input} style={[styles.input, error ? { borderColor: colors.bad } : null, input.style]} />
      {error ? <Text style={styles.fieldError}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

export function ModeBanner() {
  const label = apiMode.kind === 'mock' ? 'Backend simulat (date de test)' : `API: ${apiMode.url}`
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>
        {label}
        {CRYPTO_READY ? '' : ' · criptare: placeholder'}
      </Text>
    </View>
  )
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
    </View>
  )
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={styles.h1}>{children}</Text>
export const H2 = ({ children }: { children: ReactNode }) => <Text style={styles.h2}>{children}</Text>
export const P = ({ children, muted }: { children: ReactNode; muted?: boolean }) => <Text style={[styles.p, muted && { color: colors.muted }]}>{children}</Text>

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderColor: colors.accentLine },
  danger: { backgroundColor: colors.bad, borderColor: colors.bad },
})

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: 16, gap: 14, paddingBottom: 40 },
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
  link: { color: colors.accent, fontSize: 15, fontWeight: '600', paddingVertical: 4 },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  tagText: { fontSize: 12, fontWeight: '600' },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12 },
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  h1: { fontSize: 24, fontWeight: '700', color: colors.ink, lineHeight: 30 },
  h2: { fontSize: 17, fontWeight: '600', color: colors.ink },
  p: { fontSize: 15, lineHeight: 22, color: colors.ink2 },
})
