import type { ElectionStatus, TrustLevel } from '../api'

export const statusLabel: Record<ElectionStatus, string> = {
  draft: 'În configurare',
  open: 'Vot deschis',
  closed: 'Vot închis',
  tallied: 'Rezultat publicat',
}

export const trustLabel: Record<TrustLevel, string> = {
  optic: 'verificat optic',
  criptografic: 'verificat criptografic',
}

const dateTime = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
export const formatInterval = (from: string, to: string) => `${formatDateTime(from)} – ${formatDateTime(to)}`

export const shortHash = (hex: string, head = 8, tail = 6) =>
  hex.length <= head + tail + 1 ? hex : `${hex.slice(0, head)}…${hex.slice(-tail)}`

/** Codul de urmărire în grupuri de câte 8 caractere, mai ușor de citit și comparat. */
export const groupHash = (hex: string) => hex.match(/.{1,8}/g)?.join(' ') ?? hex

export const percent = (part: number, whole: number) => (whole === 0 ? '0%' : `${Math.round((part / whole) * 1000) / 10}%`)

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))
