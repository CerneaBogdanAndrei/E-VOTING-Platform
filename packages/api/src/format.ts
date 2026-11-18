// Etichete și formatări comune site-ului și aplicației mobile (fără React, doar text).

import type { AdminRole, Candidate, ElectionStatus, RegistrationMethod, TrustLevel } from './contract/index.js'

export const statusLabel: Record<ElectionStatus, string> = {
  draft: 'În configurare',
  open: 'Vot deschis',
  closed: 'Vot închis',
  tallied: 'Rezultat publicat',
}

export const methodLabel: Record<RegistrationMethod, string> = {
  ocr: 'Scanare buletin (OCR)',
  nfc: 'Citire CEI (NFC)',
}

export const trustLabel: Record<TrustLevel, string> = {
  optic: 'verificat optic',
  criptografic: 'verificat criptografic',
}

export const roleLabel: Record<AdminRole, string> = {
  comisie: 'membru al comisiei',
  observator: 'observator (doar citire)',
}

export const BLANK_LABEL = 'Vot alb'

/** Numele afișat al unei opțiuni: candidații au numele lor, votul alb o etichetă fixă. */
export const candidateLabel = (c: Pick<Candidate, 'name' | 'kind'>) => (c.kind === 'blank' ? BLANK_LABEL : c.name)

const dateTime = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const dateOnly = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
export const formatDate = (iso: string) => dateOnly.format(new Date(iso))
export const formatInterval = (from: string, to: string) => `${formatDateTime(from)} – ${formatDateTime(to)}`

export const shortHash = (hex: string, head = 8, tail = 6) => (hex.length <= head + tail + 1 ? hex : `${hex.slice(0, head)}…${hex.slice(-tail)}`)

/** Codul de urmărire în grupuri de câte 8 caractere, mai ușor de citit și comparat. */
export const groupHash = (hex: string) => hex.match(/.{1,8}/g)?.join(' ') ?? hex

export const percent = (part: number, whole: number) => (whole === 0 ? '0%' : `${Math.round((part / whole) * 1000) / 10}%`)

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** „2 zile și 3 ore”, „45 de minute”, „sub un minut”. */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'sub un minut'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  const parts: string[] = []
  if (days) parts.push(days === 1 ? 'o zi' : `${days} zile`)
  if (hours) parts.push(hours === 1 ? 'o oră' : `${hours} ore`)
  if (!days && mins) parts.push(mins === 1 ? 'un minut' : `${mins}${mins >= 20 ? ' de' : ''} minute`)
  return parts.slice(0, 2).join(' și ')
}

export type IntervalPhase = 'before' | 'during' | 'after'

/** Unde ne aflăm față de intervalul scrutinului și cât mai e până la următoarea margine. */
export function intervalPhase(opensAt: string, closesAt: string, now = Date.now()): { phase: IntervalPhase; remainingMs: number } {
  const opens = new Date(opensAt).getTime()
  const closes = new Date(closesAt).getTime()
  if (now < opens) return { phase: 'before', remainingMs: opens - now }
  if (now <= closes) return { phase: 'during', remainingMs: closes - now }
  return { phase: 'after', remainingMs: 0 }
}
