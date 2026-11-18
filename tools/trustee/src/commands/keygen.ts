// keygen: generează local xᵢ, salvează fișierul de cheie (opțional criptat cu parolă),
// apoi trimite doar Yᵢ cu dovada Schnorr.

import { plural, type ApiClient } from '@evoting/api'
import { generateTrusteeKey } from '@evoting/crypto'
import { keyFileExists, writeKeyFile } from '../key-file.js'
import { die, ok } from '../output.js'
import { passwordForNewKey, type PasswordSource } from '../password.js'

export interface KeygenOptions extends PasswordSource {
  api: string
  election?: string
  trustee?: string
  token?: string
  out?: string
}

export async function keygen(client: ApiClient, options: KeygenOptions) {
  const electionId = options.election ?? die('lipsește --election')
  const trusteeId = options.trustee ?? die('lipsește --trustee')
  const token = options.token ?? die('lipsește --token (sau TRUSTEE_TOKEN)')
  const out = options.out ?? `${trusteeId}.trustee-key.json`
  if (await keyFileExists(out)) die(`fișierul ${out} există deja; nu suprascriu o cheie existentă`)

  const election = await client.getElection(electionId)
  const trustee = election.trustees.find((t) => t.id === trusteeId) ?? die(`trustee-ul ${trusteeId} nu există în scrutin`)
  if (trustee.publicKeyShare) die('acest trustee și-a trimis deja cheia')
  console.log(`Scrutin: ${election.title}\nTrustee: ${trustee.name}\n`)

  const password = await passwordForNewKey(options)
  const { keyPair, publicKey } = generateTrusteeKey(electionId, trusteeId)
  // fișierul se scrie înainte de trimitere: dacă trimiterea reușește, cheia nu se poate pierde
  await writeKeyFile(out, { ...keyPair, api: options.api, createdAt: new Date().toISOString() }, password)
  ok(
    password
      ? `cheia secretă xᵢ salvată criptată (scrypt + AES-256-GCM) în ${out}. Fără parolă nu poate fi folosită.`
      : `cheia secretă xᵢ salvată în ${out} (permisiuni 600). Păstreaz-o offline până la numărare; cu --encrypt ar fi protejată și de o parolă.`,
  )

  const updated = await client.submitTrusteeKey(electionId, token, publicKey)
  ok(`Yᵢ = ${publicKey.publicKeyShare.slice(0, 16)}… trimisă, cu dovada Schnorr`)
  if (updated.publicKey) ok(`toți trustees au trimis cheile; cheia scrutinului Y = ${updated.publicKey.slice(0, 16)}…`)
  else {
    const left = updated.trustees.filter((t) => !t.publicKeyShare).length
    console.log(left === 1 ? '  Mai lipsește o cheie.' : `  Mai lipsesc ${plural(left, 'cheie', 'chei')}.`)
  }
}
