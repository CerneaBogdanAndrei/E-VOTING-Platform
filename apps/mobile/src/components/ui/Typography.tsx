import type { ReactNode } from 'react'
import { StyleSheet, Text } from 'react-native'
import { colors } from '../../lib/theme'

export const H1 = ({ children }: { children: ReactNode }) => <Text style={styles.h1}>{children}</Text>
export const H2 = ({ children }: { children: ReactNode }) => <Text style={styles.h2}>{children}</Text>
export const P = ({ children, muted }: { children: ReactNode; muted?: boolean }) => <Text style={[styles.p, muted && { color: colors.muted }]}>{children}</Text>

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '700', color: colors.ink, lineHeight: 30 },
  h2: { fontSize: 17, fontWeight: '600', color: colors.ink },
  p: { fontSize: 15, lineHeight: 22, color: colors.ink2 },
})
