// SHA-256, HMAC-SHA256 și Fiat-Shamir. Totul sincron, prin @noble/hashes,
// ca să ruleze identic în Node, browser și Hermes (React Native).

import { hmac } from '@noble/hashes/hmac.js'
import { sha256, sha512 } from '@noble/hashes/sha2.js'
import { bytesToHex, canonicalJson, hexToBytes, utf8ToBytes } from './encoding.js'
import { scalarFromWideBytes } from './group.js'

export function sha256Hex(data: string | Uint8Array): string {
  return bytesToHex(sha256(typeof data === 'string' ? utf8ToBytes(data) : data))
}

/** Hash-ul JSON-ului canonic al unui obiect. */
export const hashObject = (value: unknown): string => sha256Hex(canonicalJson(value))

export function hmacSha256Hex(key: Uint8Array, message: string): string {
  return bytesToHex(hmac(sha256, key, utf8ToBytes(message)))
}

/**
 * Amprenta CNP-ului păstrată de server: HMAC-SHA256(k, CNP). Fără cheia k,
 * cele câteva milioane de CNP-uri posibile nu se pot încerca pe rând.
 */
export function cnpHmac(keyHex: string, cnp: string): string {
  return hmacSha256Hex(hexToBytes(keyHex), cnp)
}

/**
 * Provocarea Fiat-Shamir: un scalar derivat din eticheta dovezii și din toate
 * elementele publice. Fiecare parte e prefixată cu lungimea, ca împărțirea în
 * părți să nu fie ambiguă.
 */
export function hashToScalar(domain: string, parts: readonly string[]): bigint {
  const encoded = [domain, ...parts].map((p) => `${p.length}:${p}`).join('|')
  return scalarFromWideBytes(sha512(utf8ToBytes(encoded)))
}
