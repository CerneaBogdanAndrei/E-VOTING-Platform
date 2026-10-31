// Credentialul alegătorului: o pereche de chei Ed25519 generată pe telefon.
// Cheia publică se înregistrează la server (legată de HMAC(CNP)), iar cea
// secretă semnează provocarea de autentificare și buletinul.

import { ed25519 } from '@noble/curves/ed25519.js'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js'

export interface CredentialKeyPair {
  /** Cheia secretă, hex (32 de octeți). Nu părăsește dispozitivul. */
  secretKey: string
  /** Cheia publică, hex (32 de octeți). */
  publicKey: string
}

export function generateCredential(): CredentialKeyPair {
  const sk = ed25519.utils.randomSecretKey()
  return { secretKey: bytesToHex(sk), publicKey: bytesToHex(ed25519.getPublicKey(sk)) }
}

export function credentialFromSecret(secretKey: string): CredentialKeyPair {
  return { secretKey, publicKey: bytesToHex(ed25519.getPublicKey(hexToBytes(secretKey))) }
}

export function isValidCredentialKey(publicKey: unknown): publicKey is string {
  if (typeof publicKey !== 'string' || !/^[0-9a-f]{64}$/.test(publicKey)) return false
  try {
    ed25519.Point.fromHex(publicKey)
    return true
  } catch {
    return false
  }
}

export function signMessage(secretKey: string, message: string): string {
  return bytesToHex(ed25519.sign(utf8ToBytes(message), hexToBytes(secretKey)))
}

export function verifySignature(publicKey: string, message: string, signature: string): boolean {
  try {
    if (!/^[0-9a-f]{128}$/.test(signature)) return false
    return ed25519.verify(hexToBytes(signature), utf8ToBytes(message), hexToBytes(publicKey))
  } catch {
    return false
  }
}

/** Mesajul semnat la autentificare: legat de scrutin și de nonce-ul serverului. */
export const authMessage = (electionId: string, nonce: string) => `evoting/v1/auth|${electionId}|${nonce}`

/** Mesajul semnat pentru buletin: codul de urmărire acoperă tot conținutul buletinului. */
export const ballotMessage = (electionId: string, trackingCode: string) => `evoting/v1/ballot|${electionId}|${trackingCode}`
