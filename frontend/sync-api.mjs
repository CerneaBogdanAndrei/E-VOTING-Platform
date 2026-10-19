// Copiază stratul API comun din web în mobile. Sursa de adevăr e web/src/api;
// platform.ts și config.ts rămân separate în fiecare aplicație.
// Rulare: node sync-api.mjs
import { copyFileSync } from 'node:fs'

const shared = ['types', 'cnp', 'ballot', 'http', 'mock', 'index']
for (const name of shared) {
  copyFileSync(new URL(`./web/src/api/${name}.ts`, import.meta.url), new URL(`./mobile/src/api/${name}.ts`, import.meta.url))
}
console.log(`Copiat în mobile/src/api: ${shared.map((n) => `${n}.ts`).join(', ')}`)
