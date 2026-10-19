import type { ElectionStatus, RegistrationMethod } from '../api'

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

const dateTime = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const dateOnly = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
export const formatDate = (iso: string) => dateOnly.format(new Date(iso))
export const formatInterval = (from: string, to: string) => `${formatDateTime(from)} – ${formatDateTime(to)}`

export const shortHash = (hex: string, head = 8, tail = 6) =>
  hex.length <= head + tail + 1 ? hex : `${hex.slice(0, head)}…${hex.slice(-tail)}`

export const percent = (part: number, whole: number) => (whole === 0 ? '0%' : `${Math.round((part / whole) * 1000) / 10}%`)
