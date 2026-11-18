#!/usr/bin/env node
// Verificatorul public. Descarcă tot ce publică serverul și verifică, în ordine:
// cheile, lanțul de hash-uri (și hash-ul publicat independent), semnăturile și
// credentialele, dovezile ZK, agregatul și decriptarea. Nu are nevoie de niciun drept.
//
//   evoting-verify --api URL --election ID [--head SEQ:HASH] [--save FIȘIER] [--json]
//   evoting-verify --bundle FIȘIER [--head SEQ:HASH]
//   evoting-verify audit-ballot --api URL --election ID --file AUDIT.json
//
// Comenzile sunt în commands/.

import { parseArgs } from 'node:util'
import { auditBallotCommand } from './commands/audit-ballot.js'
import { verify } from './commands/verify.js'
import { die } from './output.js'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    api: { type: 'string', default: process.env.EVOTING_API ?? 'http://localhost:3000' },
    election: { type: 'string' },
    bundle: { type: 'string' },
    head: { type: 'string' },
    save: { type: 'string' },
    file: { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
})

const HELP = `Verificator public – vot electronic verificabil

  evoting-verify --api URL --election ID     descarcă board-ul și verifică tot
     --head SEQ:HASH   hash-ul publicat independent (de ex. pe site-ul facultății)
     --save FIȘIER     salvează datele descărcate, pentru arhivă sau verificare offline
     --json            raport în format JSON
  evoting-verify --bundle FIȘIER              verifică offline un fișier salvat
  evoting-verify audit-ballot --election ID --file AUDIT.json
                                              verifică un buletin auditat (provocarea Benaloh)

Codul de ieșire e 0 doar dacă toate verificările trec.`

const options = { ...values, api: values.api! }

try {
  const [command] = positionals
  if (values.help) console.log(HELP)
  else if (command === 'audit-ballot') await auditBallotCommand(options)
  else if (!command || command === 'verify') await verify(options)
  else die(`comandă necunoscută: ${command}\n\n${HELP}`)
} catch (err) {
  die(err instanceof Error ? err.message : String(err))
}
