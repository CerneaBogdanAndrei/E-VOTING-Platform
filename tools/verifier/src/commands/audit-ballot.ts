// audit-ballot: provocarea Benaloh dintr-un fișier exportat de aplicație
// (criptotextele, opțiunea declarată și r-urile).

import { readFile } from 'node:fs/promises'
import { createHttpClient } from '@evoting/api'
import { auditBallot, type BallotSecrets, type Ciphertext } from '@evoting/crypto'
import { CliExit, die, GREEN, RED, YELLOW } from '../output.js'

export interface AuditBallotOptions {
  api: string
  election?: string
  file?: string
}

interface AuditFile {
  electionId: string
  ciphertexts: Ciphertext[]
  secrets: BallotSecrets
}

export async function auditBallotCommand(options: AuditBallotOptions) {
  let data: AuditFile
  try {
    data = JSON.parse(await readFile(options.file ?? die('lipsește --file'), 'utf8')) as AuditFile
  } catch (err) {
    return die(`fișierul de audit nu e JSON valid (${err instanceof Error ? err.message : String(err)})`)
  }
  const e = await createHttpClient(options.api).getElection(options.election ?? data.electionId)
  if (!e.publicKey) die('scrutinul nu are încă o cheie publică')
  const r = auditBallot({ electionId: e.id, publicKey: e.publicKey!, candidateCount: e.candidates.length }, data.ciphertexts, data.secrets)
  if (r.ok) {
    const c = e.candidates.find((x) => x.position === r.choice)
    console.log(`${GREEN('✓')} Buletinul criptează exact opțiunea declarată: ${c?.name ?? r.choice}`)
    console.log('  Aplicația a criptat corect. Acest buletin a fost dezvăluit, deci nu se mai trimite; votul se recriptează.')
    return
  }
  if (r.malformed) {
    // fișier greșit sau incomplet: nu se poate verifica, dar nici nu dovedește că aplicația a trișat
    console.log(`${YELLOW('?')} ${r.reason}`)
    console.log('  Fișierul nu are forma exportată de aplicație (sau e de la alt scrutin). Exportă din nou datele de audit.')
    throw new CliExit(2)
  }
  console.log(`${RED('✗')} ${r.reason}`)
  console.log('  Aplicația NU a criptat opțiunea aleasă. Raportează comisiei și nu vota de pe acest dispozitiv.')
  throw new CliExit(1)
}
