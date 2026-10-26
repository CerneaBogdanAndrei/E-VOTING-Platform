// Hermes nu are crypto.getRandomValues; @noble/* și backend-ul simulat au nevoie
// de el pentru chei, r-urile din criptare și nonce-urile dovezilor. Se importă
// primul, înaintea oricărui cod care generează numere aleatoare.
import * as ExpoCrypto from 'expo-crypto'

const g = globalThis as unknown as { crypto?: { getRandomValues?: unknown } }
if (typeof g.crypto?.getRandomValues !== 'function') {
  g.crypto = { ...(g.crypto ?? {}), getRandomValues: ExpoCrypto.getRandomValues }
}
