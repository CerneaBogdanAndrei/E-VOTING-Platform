// Demonstrația 4: brute force pe API, oprit de limitarea de rată.
//
// Atacatorul încearcă token-uri de comisie la rând. Serverul răspunde cu 401 până
// la limita de cereri pe minut (implicit 30), apoi cu 429 Too Many Requests.
// Rulează contra backend-ului propriu, pornit cu limitarea activă (RATE_LIMIT=on).
//
//   node dist/api-bruteforce.js [--api http://localhost:3000] [--attempts 60]

import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    api: { type: 'string', default: process.env.EVOTING_API ?? 'http://localhost:3000' },
    attempts: { type: 'string', default: '60' },
  },
})

const attempts = Number(values.attempts)
console.log(`Demonstrația 4: ${attempts} încercări de token pe ${values.api}/admin/check\n`)
const counts = new Map<number, number>()
let firstBlocked: number | null = null
const t = performance.now()
for (let i = 1; i <= attempts; i++) {
  const guess = `ghicit-${i.toString(36).padStart(6, '0')}`
  let status: number
  try {
    const res = await fetch(`${values.api}/admin/check`, { headers: { Authorization: `Bearer ${guess}` } })
    status = res.status
  } catch {
    console.error('Backend-ul nu răspunde. Pornește-l (npm run dev -w @evoting/backend) și reîncearcă.')
    process.exit(1)
  }
  counts.set(status, (counts.get(status) ?? 0) + 1)
  if (status === 429 && firstBlocked === null) firstBlocked = i
}
for (const [status, n] of [...counts].sort()) {
  const label = status === 401 ? 'token greșit' : status === 429 ? '\x1b[32mblocat (Too Many Requests)\x1b[0m' : status === 204 ? '\x1b[31mtoken ghicit!\x1b[0m' : ''
  console.log(`  ${status}: ${n} cereri  ${label}`)
}
console.log(`\n${firstBlocked ? `Blocat de la încercarea #${firstBlocked}` : 'Nu a fost blocat: backend-ul rulează cu RATE_LIMIT=off?'}, în ${((performance.now() - t) / 1000).toFixed(1)} s.`)
if (firstBlocked) {
  const perMinute = firstBlocked - 1
  console.log(`Cu ${perMinute} încercări pe minut, un token de 24 de octeți (2¹⁹² variante) ar cere ~10^${Math.round(192 * Math.log10(2) - Math.log10(perMinute * 525_600))} ani.`)
}
