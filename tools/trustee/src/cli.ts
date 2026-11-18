#!/usr/bin/env node
// CLI-ul trustee-ului. Cheia secretă xᵢ se generează și rămâne pe calculatorul
// trustee-ului, într-un fișier local (opțional criptat cu parolă); serverul primește doar Yᵢ și dovezile.
//
//   evoting-trustee keygen  --api URL --election ID --trustee ID --token TOKEN [--out FIȘIER] [--encrypt | --password P]
//   evoting-trustee decrypt --key FIȘIER --token TOKEN [--api URL] [--password P]
//   evoting-trustee status  --api URL --election ID
//
// Comenzile sunt în commands/, fișierul de cheie în key-file.ts, parola în password.ts.

import { parseArgs } from 'node:util'
import { createHttpClient } from '@evoting/api'
import { decrypt } from './commands/decrypt.js'
import { keygen } from './commands/keygen.js'
import { status } from './commands/status.js'
import { CliExit, die, errorLine } from './output.js'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    api: { type: 'string', default: process.env.EVOTING_API ?? 'http://localhost:3000' },
    election: { type: 'string' },
    trustee: { type: 'string' },
    token: { type: 'string', default: process.env.TRUSTEE_TOKEN },
    key: { type: 'string' },
    out: { type: 'string' },
    encrypt: { type: 'boolean' },
    password: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
})

const HELP = `CLI trustee – vot electronic verificabil

  keygen   Generează local cheia xᵢ, o salvează într-un fișier și trimite doar Yᵢ cu dovada Schnorr.
           --api URL --election ID --trustee ID --token TOKEN [--out FIȘIER]
           --encrypt            cere o parolă și criptează cheia în fișier (scrypt + AES-256-GCM)
           --password PAROLA    aceeași, fără întrebare (sau variabila TRUSTEE_KEY_PASSWORD)
  decrypt  După închiderea votului: verifică board-ul și agregatul, apoi trimite decriptarea parțială.
           --key FIȘIER --token TOKEN [--api URL] [--password PAROLA]
  status   Arată starea scrutinului și a trustees.
           --api URL --election ID

Token-ul se poate da și prin variabila de mediu TRUSTEE_TOKEN.`

const api = values.api!

try {
  const [command] = positionals
  if (values.help || !command) console.log(HELP)
  else if (command === 'keygen') await keygen(createHttpClient(api), { ...values, api })
  else if (command === 'decrypt') await decrypt({ ...values, api: process.argv.includes('--api') ? api : undefined })
  else if (command === 'status') await status(createHttpClient(api), values.election)
  else die(`comandă necunoscută: ${command}\n\n${HELP}`)
} catch (err) {
  if (!(err instanceof CliExit)) errorLine(err instanceof Error ? err.message : String(err))
  process.exitCode = err instanceof CliExit ? err.code : 1
}
