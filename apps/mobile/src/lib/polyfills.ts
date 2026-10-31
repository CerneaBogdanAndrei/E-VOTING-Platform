// Hermes (motorul JS din React Native) nu are crypto.getRandomValues, de care au
// nevoie @noble/curves și @noble/hashes pentru valorile aleatoare (r din ElGamal,
// cheia de credential). expo-crypto îl oferă din generatorul sigur al sistemului.
import * as ExpoCrypto from 'expo-crypto'

const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }
if (!g.crypto) g.crypto = {}
if (!g.crypto.getRandomValues) {
  g.crypto.getRandomValues = (array: Uint8Array) => ExpoCrypto.getRandomValues(array)
}
