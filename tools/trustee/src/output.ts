// Afișarea în terminal: bife verzi, cruci roșii și oprirea cu eroare.

export const ok = (s: string) => console.log(`  \x1b[32m✓\x1b[0m ${s}`)
export const bad = (s: string) => console.log(`  \x1b[31m✗\x1b[0m ${s}`)

export const errorLine = (s: string) => console.error(`\x1b[31mEroare:\x1b[0m ${s}`)

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

export const die = (s: string): never => {
  errorLine(s)
  throw new CliExit(1)
}
