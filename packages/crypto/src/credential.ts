// Credentialul alegătorului: o pereche de chei Ed25519 generată pe telefon la
// înregistrare. Serverul păstrează doar cheia publică, legată de HMAC(CNP);
// cu cea secretă aplicația semnează provocarea de autentificare și buletinul.

import { ed25519 } from '@noble/curves/ed25519.js'
import { bytesToHex, hexToBytes, isHex, utf8ToBytes } from './encoding.js'

export interface CredentialKeyPair {
  secretKey: string
  publicKey: string
}

export function generateCredential(): CredentialKeyPair {
  const { secretKey, publicKey } = ed25519.keygen()
  return { secretKey: bytesToHex(secretKey), publicKey: bytesToHex(publicKey) }
}

export function credentialPublicKey(secretKeyHex: string): string {
  return bytesToHex(ed25519.getPublicKey(hexToBytes(secretKeyHex)))
}

export function isCredentialPubkey(value: unknown): value is string {
  if (!isHex(value, 32)) return false
  try {
    ed25519.Point.fromHex(value).assertValidity()
    return true
  } catch {
    return false
  }
}

export function signMessage(secretKeyHex: string, message: string): string {
  return bytesToHex(ed25519.sign(utf8ToBytes(message), hexToBytes(secretKeyHex)))
}

export function verifySignature(publicKeyHex: string, message: string, signatureHex: unknown): boolean {
  if (!isHex(publicKeyHex, 32) || !isHex(signatureHex, 64)) return false
  try {
    return ed25519.verify(hexToBytes(signatureHex), utf8ToBytes(message), hexToBytes(publicKeyHex))
  } catch {
    return false
  }
}

/** Mesajul semnat la autentificare: leagă nonce-ul serverului de scrutin și de credential. */
export const authMessage = (electionId: string, credentialPubkey: string, nonce: string) =>
  `evoting/v1/auth|${electionId}|${credentialPubkey}|${nonce}`
