// Afișarea în terminal pentru verificator.

export const GREEN = (s: string) => `\x1b[32m${s}\x1b[0m`
export const RED = (s: string) => `\x1b[31m${s}\x1b[0m`
export const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`

export const statusIcon = (status: 'ok' | 'fail' | 'skipped') => (status === 'ok' ? GREEN('✓') : status === 'fail' ? RED('✗') : YELLOW('–'))

/** Oprire cu eroare de utilizare (codul 2; 1 e rezervat pentru „verificarea a picat”). */
export const die = (s: string): never => {
  console.error(`${RED('Eroare:')} ${s}`)
  process.exit(2)
}
