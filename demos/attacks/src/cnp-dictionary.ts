// Demonstrația 1: CNP stocat ca SHA-256 vs HMAC-SHA256 cu cheie secretă.
//
// Spațiul CNP-urilor e mic: pentru o persoană cu data nașterii cunoscută (de pe
// o rețea socială, de exemplu) rămân doar sexul, județul și numărul de ordine,
// adică ~100.000 de variante. Un atacator care fură baza de date cu SHA-256(CNP)
// le încearcă pe toate în sub o secundă. Cu HMAC, fără cheia k (care nu stă în
// baza de date), fiecare încercare cere cheia, deci atacul nu are de unde porni.
//
// Toate CNP-urile sunt fictive, generate aici.

import { randomBytes } from 'node:crypto'
import { cnpHmac, sha256Hex } from '@evoting/crypto'
import { generateCnp, isValidCnp } from '@evoting/api'

const K = '279146358279'
const control = (first12: string) => {
  let s = 0
  for (let i = 0; i < 12; i++) s += Number(first12[i]) * Number(K[i])
  const r = s % 11
  return r === 10 ? 1 : r
}

let seed = 2026
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

// „Baza de date furată”: 200 de alegători, o dată cu SHA-256 simplu, o dată cu HMAC.
const voters = Array.from({ length: 200 }, () => generateCnp(rand))
const victim = voters[137]
const hmacKey = randomBytes(32).toString('hex')
const leakedSha = new Set(voters.map((c) => sha256Hex(c)))
const leakedHmac = new Set(voters.map((c) => cnpHmac(hmacKey, c)))

console.log('Demonstrația 1: dicționar de CNP-uri pe o bază de date furată\n')
console.log(`Victima (fictivă) s-a născut pe ${victim.slice(5, 7)}.${victim.slice(3, 5)}.20${victim.slice(1, 3)}; atacatorul știe doar atât.\n`)

function* candidatesFor(birth: string) {
  for (const s of ['5', '6']) for (let county = 1; county <= 52; county++) for (let n = 1; n <= 999; n++) {
    const first12 = `${s}${birth}${String(county).padStart(2, '0')}${String(n).padStart(3, '0')}`
    yield first12 + control(first12)
  }
}

const birth = victim.slice(1, 7)
let tries = 0
let found: string | null = null
const t0 = performance.now()
for (const cnp of candidatesFor(birth)) {
  tries++
  if (leakedSha.has(sha256Hex(cnp))) {
    found = cnp
    break
  }
}
const ms = performance.now() - t0
console.log('Stocare SHA-256(CNP):')
console.log(`  ${found ? `\x1b[31mCNP găsit: ${found}\x1b[0m` : 'negăsit'} după ${tries.toLocaleString('ro-RO')} încercări, în ${ms.toFixed(0)} ms`)
const rate = tries / (ms / 1000)
// spațiul complet pentru o generație (8 ani de naștere): 2 × 8 × 366 × 52 × 999
const space = 2 * 8 * 366 * 52 * 999
console.log(`  Ritm: ${Math.round(rate).toLocaleString('ro-RO')} hash-uri/s pe un singur nucleu, în JavaScript.`)
console.log(`  Toți studenții născuți în 2000–2007 (${space.toLocaleString('ro-RO')} CNP-uri posibile): ~${(space / rate / 60).toFixed(0)} minute.`)

let hits = 0
const t1 = performance.now()
const wrongKey = randomBytes(32).toString('hex')
for (const cnp of candidatesFor(birth)) if (leakedHmac.has(cnpHmac(wrongKey, cnp))) hits++
console.log('\nStocare HMAC-SHA256(k, CNP), cu k ținut în afara bazei de date:')
console.log(`  \x1b[32m0 potriviri\x1b[0m din ${tries.toLocaleString('ro-RO')}+ încercări (${hits} găsite, ${(performance.now() - t1).toFixed(0)} ms): fără k, amprenta nu se poate reface.`)
console.log('  Ghicirea lui k: 2²⁵⁶ variante, imposibil.')
console.log(`\nValid: ${isValidCnp(victim)} · CNP-urile din demonstrație sunt generate aleator și nu aparțin nimănui.`)
