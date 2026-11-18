// status: starea scrutinului și a fiecărui trustee (cheie trimisă, decriptare trimisă).

import type { ApiClient } from '@evoting/api'
import { die } from '../output.js'

export async function status(client: ApiClient, electionId: string | undefined) {
  const e = await client.getElection(electionId ?? die('lipsește --election'))
  console.log(`${e.title}\nStare: ${e.status}\nCheia scrutinului: ${e.publicKey ?? '—'}\nBuletine: ${e.stats.ballots}\n`)
  for (const t of e.trustees) {
    console.log(`  ${t.name} (${t.id}): cheie ${t.publicKeyShare ? '✓' : '—'}, decriptare ${t.partialDecryptionSubmitted ? '✓' : '—'}`)
  }
}
