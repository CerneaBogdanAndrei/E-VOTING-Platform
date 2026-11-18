// Afișarea în terminal: bife verzi, cruci roșii și oprirea cu eroare.

export const ok = (s: string) => console.log(`  \x1b[32m✓\x1b[0m ${s}`)
export const bad = (s: string) => console.log(`  \x1b[31m✗\x1b[0m ${s}`)

export const die = (s: string): never => {
  console.error(`\x1b[31mEroare:\x1b[0m ${s}`)
  process.exit(1)
}
