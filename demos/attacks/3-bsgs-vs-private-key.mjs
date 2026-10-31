// Demonstrația 3: brute force „legitim”. Totalurile se află din TⱼG în
// milisecunde prin baby-step giant-step, pentru că Tⱼ ≤ numărul de alegători.
// Aceeași metodă pe o cheie privată de 252 de biți ar cere ~2¹²⁶ pași.
import { discreteLog, gTimes, mul, G, randomScalar, Q } from '@evoting/crypto'

for (const total of [137, 4321, 10_000, 250_000]) {
  const t = performance.now()
  const found = discreteLog(gTimes(total), Math.max(total, 10_000))
  console.log(`Total ${String(total).padStart(7)}: găsit ${found} în ${(performance.now() - t).toFixed(1)} ms (√${total} ≈ ${Math.ceil(Math.sqrt(total))} pași)`)
}

const x = randomScalar()
const Y = mul(G, x)
const steps = 2n ** 126n
const perSecond = 1_000_000n // generos: un milion de operații pe grup pe secundă
const years = steps / perSecond / 31_557_600n
console.log(`\nCheia privată: x are ${Q.toString(2).length} de biți. Y = ${Y.toHex().slice(0, 24)}…`)
console.log(`Baby-step giant-step pe x: ~2¹²⁶ pași ≈ ${years.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ani la un milion de pași pe secundă.`)
console.log('(Universul are ~1,4 × 10¹⁰ ani.) Iar memoria pentru tabela de 2¹²⁶ intrări nu există.')
