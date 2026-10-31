// Demonstrația 1: CNP stocat ca SHA-256 simplu vs HMAC cu cheie secretă.
// Spațiul CNP-urilor pentru o dată de naștere are ~96.000 de valori: SHA-256 se
// inversează în câteva secunde prin încercarea tuturor. Cu HMAC, fără cheie
// (care nu e în baza de date), atacatorul nu are ce compara.
import { bytesToHex, cnpFingerprint, cnpPlainSha256, cnpSearchSpace, generateCnp, randomBytes } from '@evoting/crypto'

const victim = process.argv[2] ?? generateCnp()
const birthDate = `${({ 1: 19, 2: 19, 5: 20, 6: 20 })[victim[0]] ?? 19}${victim.slice(1, 3)}-${victim.slice(3, 5)}-${victim.slice(5, 7)}`
console.log(`Victima (fictivă): ${victim}, născută pe ${birthDate}\n`)

const leakedSha = cnpPlainSha256(victim)
console.log(`Baza furată conține SHA-256(CNP) = ${leakedSha.slice(0, 24)}…`)
const space = cnpSearchSpace(birthDate)
let t = Date.now()
const found = space.find((c) => cnpPlainSha256(c) === leakedSha)
console.log(`  Atacatorul încearcă toate cele ${space.length.toLocaleString('ro-RO')} CNP-uri posibile pentru data nașterii (aflată, de exemplu, de pe Facebook)…`)
console.log(`  \x1b[31mCNP recuperat: ${found} în ${Date.now() - t} ms\x1b[0m\n`)

const serverKey = bytesToHex(randomBytes(32))
const leakedHmac = cnpFingerprint(serverKey, victim)
console.log(`Baza furată conține HMAC(k, CNP) = ${leakedHmac.slice(0, 24)}…, iar cheia k e doar în variabila de mediu a serverului`)
t = Date.now()
const guessKey = bytesToHex(randomBytes(32))
const hit = space.find((c) => cnpFingerprint(guessKey, c) === leakedHmac)
console.log(`  Același atac, cu o cheie ghicită: ${hit ? 'găsit' : '\x1b[32mnimic găsit\x1b[0m'} (${Date.now() - t} ms)`)
console.log('  Ca să reușească, atacatorul ar trebui să ghicească și cheia: 2²⁵⁶ variante.')
