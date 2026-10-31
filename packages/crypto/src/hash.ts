// SHA-256 și HMAC-SHA256, sincron și fără Web Crypto, ca să ruleze la fel în
// Node, în browser și în React Native (Hermes nu are crypto.subtle).

import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js'

export function sha256Hex(data: string | Uint8Array): string {
  return bytesToHex(sha256(typeof data === 'string' ? utf8ToBytes(data) : data))
}

/** Hash peste o listă de valori, serializată neambiguu ca JSON. */
export function hashParts(...parts: unknown[]): string {
  return sha256Hex(JSON.stringify(parts))
}

/** HMAC-SHA256(key, message), hex. Cheia e hex (recomandat 32 de octeți) sau octeți. */
export function hmacSha256Hex(key: string | Uint8Array, message: string): string {
  const k = typeof key === 'string' ? hexToBytes(key) : key
  return bytesToHex(hmac(sha256, k, utf8ToBytes(message)))
}

/** Compară două șiruri în timp care nu depinde de poziția primei diferențe. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
