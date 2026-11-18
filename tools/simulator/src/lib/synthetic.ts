// Alegătorii sintetici: CNP-uri fictive (reproductibile), o opțiune de vot cu
// distribuție neuniformă și, pentru NFC, un cip de test semnat de PKI-ul de laborator.

import { buildTd1, generateCnp } from '@evoting/api'

/** Generator cu sămânță fixă, ca aceeași comandă să producă aceiași alegători. */
export function seededRandom(seed = 7) {
  let s = seed
  return () => (s = (s * 48271) % 2147483647) / 2147483647
}

export function uniqueCnps(n: number, rand: () => number): string[] {
  const cnps = new Set<string>()
  while (cnps.size < n) cnps.add(generateCnp(rand))
  return [...cnps]
}

/** Opțiune aleasă cu probabilități inegale, ca rezultatul să nu fie trivial. */
export function pickChoice(candidates: number, rand: () => number) {
  const r = rand()
  return Math.min(candidates - 1, Math.floor(candidates * r * r))
}

/** MRZ-ul (TD1, ca pe CEI) al alegătorului sintetic i, pentru cipul de test. */
export function syntheticMrz(i: number, cnp: string) {
  return buildTd1({
    surname: 'Sintetic',
    givenNames: `Alegator ${i}`,
    documentNumber: `GL${String(i).padStart(7, '0')}`,
    cnp,
    sex: Number(cnp[0]) % 2 ? 'M' : 'F',
    expiry: '330101',
  })
}

export type TestPkiModule = typeof import('@evoting/backend/test-pki')

/** Încarcă PKI-ul de test (generat cu `npm run test-pki -w @evoting/backend`) pentru cipuri NFC simulate. */
export async function loadChipFactory(pkiDir: string) {
  const mod: TestPkiModule = await import('@evoting/backend/test-pki')
  const pki = await mod.loadTestPki(pkiDir)
  return (mrz: string) => mod.createTestChip(pki, mrz)
}
