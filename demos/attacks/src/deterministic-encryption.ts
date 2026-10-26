// Demonstrația 2: ghicirea votului din criptotext.
//
// La o criptare deterministă (RSA „de manual”, fără padding aleator), același
// mesaj dă mereu același criptotext. Opțiunile de vot sunt puține, deci atacatorul
// criptează fiecare opțiune cu cheia publică și compară: află votul fără cheia privată.
// La ElGamal, fiecare criptare folosește un r aleator nou, deci comparația nu spune nimic.

import { generateKeyPairSync } from 'node:crypto'
import { encrypt, G, pointToHex, randomScalar } from '@evoting/crypto'

const candidates = ['Andrei Munteanu', 'Ioana Dumitrescu', 'Mihai Stoica']
const secretVote = 1

console.log('Demonstrația 2: ghicirea votului din criptotext\n')

// RSA textbook: c = m^e mod n
const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = publicKey.export({ format: 'jwk' })
const b64 = (s: string) => BigInt('0x' + Buffer.from(s, 'base64url').toString('hex'))
const n = b64(jwk.n!)
const e = b64(jwk.e!)
const modPow = (b: bigint, x: bigint, m: bigint) => {
  let r = 1n
  b %= m
  while (x > 0n) {
    if (x & 1n) r = (r * b) % m
    b = (b * b) % m
    x >>= 1n
  }
  return r
}
const rsa = (m: number) => modPow(BigInt(m + 2), e, n).toString(16)

const observed = rsa(secretVote)
console.log('RSA fără padding (determinist):')
console.log(`  criptotextul votului, văzut pe board: ${observed.slice(0, 24)}…`)
for (const [i, name] of candidates.entries()) {
  const guess = rsa(i)
  console.log(`  criptez „${name}” cu cheia publică: ${guess.slice(0, 24)}… ${guess === observed ? '\x1b[31m← potrivire: votul e aflat\x1b[0m' : ''}`)
}

const x = randomScalar()
const y = pointToHex(G.multiply(x))
const ballot = candidates.map((_, j) => encrypt(y, j === secretVote ? 1 : 0))
console.log('\nElGamal exponențial (randomizat):')
console.log(`  criptotextul pentru „${candidates[secretVote]}”: A = ${ballot[secretVote].a.slice(0, 24)}…`)
let matches = 0
for (const [i, name] of candidates.entries()) {
  const guess = encrypt(y, 1)
  const hit = guess.a === ballot[i].a && guess.b === ballot[i].b
  if (hit) matches++
  console.log(`  criptez „1” pentru „${name}”: A = ${guess.a.slice(0, 24)}… ${hit ? 'potrivire' : 'diferit'}`)
}
console.log(`  \x1b[32m${matches} potriviri\x1b[0m: același vot dă de fiecare dată alt criptotext, deci comparația nu dezvăluie nimic.`)
console.log('  (Securitatea semantică a ElGamal se bazează pe ipoteza DDH în grupul ristretto255.)')
