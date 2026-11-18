// Afișarea în terminal pentru verificator.

export const GREEN = (s: string) => `\x1b[32m${s}\x1b[0m`
export const RED = (s: string) => `\x1b[31m${s}\x1b[0m`
export const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`

export const statusIcon = (status: 'ok' | 'fail' | 'skipped') => (status === 'ok' ? GREEN('✓') : status === 'fail' ? RED('✗') : YELLOW('–'))

/**
 * Oprirea unei comenzi cu un cod de ieșire, prin excepție: cli.ts o prinde și pune process.exitCode.
 * Nu se cheamă process.exit(): pe Windows, Node se prăbușește („UV_HANDLE_CLOSING”, alt cod de ieșire)
 * dacă procesul e oprit forțat imediat după un fetch, cât timp conexiunea încă se închide.
 */
export class CliExit extends Error {
  constructor(readonly code: number) {
    super(`ieșire cu codul ${code}`)
  }
}

/** Oprire cu eroare de utilizare (codul 2; 1 e rezervat pentru „verificarea a picat”). */
export const die = (s: string): never => {
  console.error(`${RED('Eroare:')} ${s}`)
  throw new CliExit(2)
}
