// Fișierul cu cheia secretă xᵢ a trustee-ului. Rămâne pe calculatorul lui, cu
// permisiuni 600, nu se suprascrie niciodată și, opțional, e criptat cu o parolă
// (scrypt pentru derivarea cheii, AES-256-GCM pentru criptare).

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { access, readFile, writeFile } from 'node:fs/promises'
import type { TrusteeKeyPair } from '@evoting/crypto'

export interface KeyFile extends TrusteeKeyPair {
  /** URL-ul serverului folosit la keygen, ca decrypt să nu-l mai ceară. */
  api: string
  createdAt: string
}

/** Pe disc, cheia secretă e fie în clar (`secretKey`), fie criptată (`encrypted`). */
export interface StoredKeyFile extends Omit<KeyFile, 'secretKey'> {
  version: 2
  secretKey?: string
  encrypted?: {
    kdf: 'scrypt'
    salt: string
    N: number
    r: number
    p: number
    cipher: 'aes-256-gcm'
    iv: string
    ciphertext: string
    tag: string
  }
}

const SCRYPT = { N: 2 ** 15, r: 8, p: 1 }

function deriveKey(password: string, salt: Buffer, params = SCRYPT) {
  return scryptSync(password.normalize('NFKC'), salt, 32, { N: params.N, r: params.r, p: params.p, maxmem: 64 * 1024 * 1024 })
}

export function encryptSecret(secretKey: string, password: string): NonNullable<StoredKeyFile['encrypted']> {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(password, salt), iv)
  const ciphertext = Buffer.concat([cipher.update(secretKey, 'utf8'), cipher.final()])
  return {
    kdf: 'scrypt',
    salt: salt.toString('base64'),
    ...SCRYPT,
    cipher: 'aes-256-gcm',
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  }
}

export function decryptSecret(encrypted: NonNullable<StoredKeyFile['encrypted']>, password: string): string {
  const key = deriveKey(password, Buffer.from(encrypted.salt, 'base64'), encrypted)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'))
  try {
    return Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('parola e greșită sau fișierul de cheie a fost modificat')
  }
}

export async function keyFileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Scrie fișierul doar dacă nu există (`wx`), cu permisiuni 600. Cu parolă, cheia secretă e criptată. */
export async function writeKeyFile(path: string, file: KeyFile, password?: string) {
  const { secretKey, ...rest } = file
  const stored: StoredKeyFile = password ? { version: 2, ...rest, encrypted: encryptSecret(secretKey, password) } : { version: 2, ...rest, secretKey }
  await writeFile(path, JSON.stringify(stored, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
}

export async function readStoredKeyFile(path: string): Promise<StoredKeyFile> {
  return JSON.parse(await readFile(path, 'utf8')) as StoredKeyFile
}

export const isEncrypted = (stored: StoredKeyFile) => !!stored.encrypted && !stored.secretKey

/** Fișierul cu cheia secretă în clar; pentru unul criptat cere parola. */
export function unlockKeyFile(stored: StoredKeyFile, password?: string): KeyFile {
  const { encrypted, secretKey, version: _v, ...rest } = stored
  if (secretKey) return { ...rest, secretKey }
  if (!encrypted) throw new Error('fișierul de cheie nu conține cheia secretă')
  if (!password) throw new Error('fișierul de cheie e criptat: dă parola cu --password sau prin TRUSTEE_KEY_PASSWORD')
  return { ...rest, secretKey: decryptSecret(encrypted, password) }
}
