// Afișarea în terminal pentru simulator.

export const step = (s: string) => console.log(`\n\x1b[1m${s}\x1b[0m`)
export const ok = (s: string) => console.log(`  \x1b[32m✓\x1b[0m ${s}`)
export const good = (s: string) => console.log(`  \x1b[32m${s}\x1b[0m`)
export const badLine = (s: string) => console.log(`  \x1b[31m${s}\x1b[0m`)
