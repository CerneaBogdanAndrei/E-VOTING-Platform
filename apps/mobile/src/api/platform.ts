// Primitivele care diferă între browser și React Native (varianta pentru React Native).
import * as Crypto from 'expo-crypto'

export function randomHex(bytes: number): string {
  return Array.from(Crypto.getRandomBytes(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function sha256Hex(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text)
}
