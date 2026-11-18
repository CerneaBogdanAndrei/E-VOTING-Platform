import { colors } from '../../lib/theme'

/** Nuanțele semantice folosite de etichete și mesaje. */
export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'accent'

export const toneColors: Record<Tone, { bg: string; border: string; fg: string }> = {
  neutral: { bg: colors.surface2, border: colors.line2, fg: colors.ink2 },
  ok: { bg: colors.okSoft, border: colors.okLine, fg: colors.ok },
  warn: { bg: colors.warnSoft, border: colors.warnLine, fg: colors.warn },
  bad: { bg: colors.badSoft, border: colors.badLine, fg: colors.bad },
  accent: { bg: colors.accentSoft, border: colors.accentLine, fg: colors.accent2 },
}
