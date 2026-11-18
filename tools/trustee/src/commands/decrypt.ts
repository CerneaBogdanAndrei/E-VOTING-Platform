// decrypt: după închiderea votului, verifică board-ul și agregatul, apoi trimite decriptarea parțială.

import { createHttpClient } from '@evoting/api'
import { partialDecrypt, verifyElection } from '@evoting/crypto'
import { isEncrypted, readStoredKeyFile, unlockKeyFile } from '../key-file.js'
import { bad, die, ok } from '../output.js'
import { passwordForExistingKey, type PasswordSource } from '../password.js'

export interface DecryptOptions extends PasswordSource {
  key?: string
  token?: string
  /** Doar dacă a fost dat explicit; altfel se folosește URL-ul din fișierul de cheie. */
  api?: string
}

export async function decrypt(options: DecryptOptions) {
  const keyPath = options.key ?? die('lipsește --key')
  const stored = await readStoredKeyFile(keyPath)
  const key = unlockKeyFile(stored, isEncrypted(stored) ? await passwordForExistingKey(options) : undefined)
  const client = createHttpClient(options.api ?? key.api)
  const token = options.token ?? die('lipsește --token (sau TRUSTEE_TOKEN)')
  const bundle = await client.getAuditBundle(key.electionId)
  const e = bundle.election
  console.log(`Scrutin: ${e.title} (${e.status})\nBuletine pe board: ${bundle.board.length}\n`)
  if (e.status !== 'closed') die('decriptarea se face doar după închiderea votului, înainte de publicarea rezultatului')
  const me = e.trustees.find((t) => t.id === key.trusteeId) ?? die('cheia nu aparține unui trustee al acestui scrutin')
  if (me.publicKeyShare !== key.publicKeyShare) die('cheia publică din fișier diferă de cea înregistrată pe server')
  if (me.partialDecryptionSubmitted) die('decriptarea parțială a fost deja trimisă')

  // Trustee-ul nu decriptează orbește: verifică întâi board-ul și că agregatul e suma lui.
  // Altfel un server rău-intenționat i-ar putea cere să decripteze un buletin individual.
  console.log('Verific board-ul înainte de decriptare…')
  const report = await verifyElection({ ...bundle, result: null })
  for (const s of report.steps) {
    if (s.id === 'decryption') continue
    if (s.status === 'fail') {
      bad(s.title)
      for (const f of s.failures.slice(0, 5)) console.log(`      ${f.where}: ${f.message}`)
    } else ok(s.title)
  }
  if (!report.ok) die('verificarea a picat; nu trimit decriptarea parțială')

  const partial = partialDecrypt(key, bundle.tally.aggregate!)
  const updated = await client.submitPartialDecryption(key.electionId, token, partial)
  ok(`decriptarea parțială (${partial.shares.length} valori Dᵢⱼ cu dovezi Chaum-Pedersen) a fost trimisă`)
  if (updated.status === 'tallied') {
    const result = await client.getResult(key.electionId)
    ok('toți trustees au decriptat; rezultatul e publicat:')
    for (const c of updated.candidates) console.log(`      ${c.name}: ${result.counts.find((x) => x.candidateId === c.id)?.votes ?? 0}`)
  } else {
    console.log(`  Mai lipsesc ${updated.trustees.filter((t) => !t.partialDecryptionSubmitted).length} decriptări.`)
  }
}
