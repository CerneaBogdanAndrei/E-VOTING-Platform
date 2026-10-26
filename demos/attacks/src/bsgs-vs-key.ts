// Demonstrația 3: brute force „legitim” vs. imposibil.
//
// ElGamal exponențial dă la decriptare TG, nu T. Totalul T e cel mult numărul
// de alegători, deci se află în milisecunde prin baby-step giant-step (O(√T)).
// Cheia privată x e însă un număr de 252 de biți: căutarea ei e imposibilă.

import { babyStepGiantStep, encodeSmall, G, randomScalar } from '@evoting/crypto'

console.log('Demonstrația 3: baby-step giant-step pentru totaluri vs. căutarea cheii\n')
for (const total of [137, 4_210, 98_765, 1_000_000]) {
  const target = encodeSmall(total)
  const t = performance.now()
  const found = babyStepGiantStep(target, Math.max(total, 1000) * 2)
  console.log(`  total ${total.toLocaleString('ro-RO').padStart(9)}: găsit ${found?.toLocaleString('ro-RO')} în ${(performance.now() - t).toFixed(1)} ms`)
}

// ritmul unei căutări naive a cheii: câte înmulțiri scalare pe secundă
const y = G.multiply(randomScalar())
let n = 0
const t = performance.now()
let p = G
while (performance.now() - t < 1000) {
  p = p.add(G)
  n++
  if (p.equals(y)) break
}
const perSecond = n
const years = 2 ** 252 / perSecond / (365 * 24 * 3600)
console.log(`\nCăutarea cheii private x (ordinul grupului ≈ 2²⁵²):`)
console.log(`  ${perSecond.toLocaleString('ro-RO')} încercări/s → ~10^${Math.round(Math.log10(years))} ani.`)
console.log('  Chiar cu un miliard de calculatoare, durata rămâne de multe ori vârsta universului (≈ 1,4 × 10¹⁰ ani).')
console.log('  Cea mai bună metodă cunoscută (Pollard rho) are nevoie de ~2¹²⁶ operații, tot imposibil.')
