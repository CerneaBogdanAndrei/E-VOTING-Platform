// DG1 de pe cipul CEI: structura TLV 61 { 5F1F <MRZ> }. Din el serverul extrage
// MRZ-ul, după ce Passive Authentication a confirmat că hash-ul lui e semnat de stat.

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function readLength(bytes: Uint8Array, at: number): { length: number; next: number } {
  const first = bytes[at]
  if (first === undefined) throw new Error('DG1 trunchiat')
  if (first < 0x80) return { length: first, next: at + 1 }
  const count = first & 0x7f
  if (count < 1 || count > 3) throw new Error('DG1: lungime invalidă')
  let length = 0
  for (let i = 1; i <= count; i++) length = (length << 8) | bytes[at + i]
  return { length, next: at + 1 + count }
}

function encodeLength(n: number): number[] {
  if (n < 0x80) return [n]
  if (n < 0x100) return [0x81, n]
  return [0x82, n >> 8, n & 0xff]
}

/** MRZ-ul din DG1, ca text pe rânduri (TD1: 3 × 30, TD2: 2 × 36). */
export function mrzFromDg1(dg1: Uint8Array): string {
  if (dg1[0] !== 0x61) throw new Error('DG1: lipsește eticheta 61')
  const outer = readLength(dg1, 1)
  let at = outer.next
  if (dg1[at] !== 0x5f || dg1[at + 1] !== 0x1f) throw new Error('DG1: lipsește eticheta 5F1F (MRZ)')
  const inner = readLength(dg1, at + 2)
  at = inner.next
  const raw = String.fromCharCode(...dg1.subarray(at, at + inner.length))
  const width = raw.length === 90 ? 30 : raw.length === 72 ? 36 : raw.length === 88 ? 44 : 0
  if (!width) throw new Error(`DG1: MRZ de lungime neașteptată (${raw.length})`)
  return raw.match(new RegExp(`.{${width}}`, 'g'))!.join('\n')
}

/** Construiește un DG1 dintr-un MRZ (pentru cipuri de test). */
export function dg1FromMrz(mrz: string): Uint8Array {
  const text = mrz.replace(/\s+/g, '')
  const body = [0x5f, 0x1f, ...encodeLength(text.length), ...Array.from(text, (c) => c.charCodeAt(0))]
  return new Uint8Array([0x61, ...encodeLength(body.length), ...body])
}
