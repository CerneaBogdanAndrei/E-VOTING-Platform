// Demonstrația 2: ghicirea votului din criptotext.
// Cu o criptare deterministă (RSA „de manual”, fără padding), același vot dă
// mereu același criptotext: atacatorul criptează fiecare opțiune cu cheia
// publică și compară. ElGamal folosește un r aleator nou, deci comparația nu spune nimic.
import { generateKeyPairSync } from 'node:crypto'
import { ciphertextToJson, encrypt, G, mul, randomScalar } from '@evoting/crypto'

const options = ['Andrei Munteanu', 'Ioana Dumitrescu', 'Mihai Stoica']
const secretChoice = 1

// RSA de manual: c = m^e mod n
const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = publicKey.export({ format: 'jwk' })
const b64 = (s) => BigInt('0x' + Buffer.from(s, 'base64url').toString('hex'))
const n = b64(jwk.n), e = b64(jwk.e)
const modPow = (b, x, m) => { let r = 1n; b %= m; while (x > 0n) { if (x & 1n) r = (r * b) % m; b = (b * b) % m; x >>= 1n } return r }
const rsa = (m) => modPow(BigInt(m + 1), e, n).toString(16)

console.log('RSA fără padding (determinist):')
const observed = rsa(secretChoice)
console.log(`  pe board: ${observed.slice(0, 32)}…`)
options.forEach((name, i) => {
  const guess = rsa(i)
  console.log(`  Enc(${name.padEnd(17)}) = ${guess.slice(0, 32)}…  ${guess === observed ? '\x1b[31m← potrivire: votul e aflat\x1b[0m' : ''}`)
})

console.log('\nElGamal exponențial pe ristretto255 (randomizat):')
const Y = mul(G, randomScalar())
const onBoard = ciphertextToJson(encrypt(Y, 1)) // votul pentru candidatul curent: 1
console.log(`  pe board: (${onBoard.a.slice(0, 16)}…, ${onBoard.b.slice(0, 16)}…)`)
for (const m of [0, 1]) {
  const guess = ciphertextToJson(encrypt(Y, m))
  console.log(`  Enc(${m}) încercat de atacator = (${guess.a.slice(0, 16)}…, ${guess.b.slice(0, 16)}…)  ${guess.a === onBoard.a ? 'potrivire' : '\x1b[32mnicio potrivire\x1b[0m'}`)
}
console.log('  Fiecare criptare folosește alt r, deci și Enc(1) încercat de atacator diferă de cel de pe board.')
