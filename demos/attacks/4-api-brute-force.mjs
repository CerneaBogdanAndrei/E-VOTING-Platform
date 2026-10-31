// Demonstrația 4: brute force pe autentificarea comisiei, oprit de rate limiting.
// Rulează cu backend-ul pornit normal (RATE_LIMIT activ): după 5 încercări pe minut, serverul răspunde 429.
//   node demos/attacks/4-api-brute-force.mjs [--server URL]
import { parseArgs } from 'node:util'
import { ApiError, createApiClient } from '@evoting/api'

const { values } = parseArgs({ options: { server: { type: 'string', default: process.env.EVOTING_SERVER ?? 'http://localhost:3000' } } })
const api = createApiClient(values.server)
const dictionary = ['123456', 'parola', 'admin', 'udjg2026', 'comisie2026', 'aciee', 'qwerty', 'senat', 'student', 'vot2026', 'galati', 'comisie']
let blocked = 0
for (const [i, guess] of dictionary.entries()) {
  try {
    await api.adminLogin(guess)
    console.log(`${String(i + 1).padStart(2)}. „${guess}” → \x1b[31mACCEPTATĂ\x1b[0m`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) {
      blocked++
      console.log(`${String(i + 1).padStart(2)}. „${guess}” → \x1b[32m429 Too Many Requests (blocat)\x1b[0m`)
    } else {
      console.log(`${String(i + 1).padStart(2)}. „${guess}” → ${err.status ?? ''} ${err.message}`)
    }
  }
}
console.log(blocked ? `\n${blocked} încercări blocate: la 5 pe minut, un dicționar de 10 milioane de parole ar dura ~${Math.round(10_000_000 / 5 / 60 / 24 / 365)} ani.` : '\nNicio blocare: serverul rulează cu RATE_LIMIT=off?')
