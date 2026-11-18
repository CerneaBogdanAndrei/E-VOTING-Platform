// Parola fișierului de cheie: din --password, din TRUSTEE_KEY_PASSWORD sau cerută în terminal, fără ecou.

import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'

export interface PasswordSource {
  password?: string
  /** `keygen --encrypt`: cere parola (de două ori) chiar dacă nu a fost dată. */
  encrypt?: boolean
}

function ask(question: string): Promise<string> {
  const muted = new Writable({ write: (_chunk, _enc, cb) => cb() })
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true })
  process.stderr.write(question)
  return new Promise((resolve) => {
    rl.question('', (answer) => {
      process.stderr.write('\n')
      rl.close()
      resolve(answer)
    })
  })
}

/** Parola pentru un fișier nou: dată explicit, din mediu sau cerută de două ori. `undefined` = fără criptare. */
export async function passwordForNewKey(source: PasswordSource): Promise<string | undefined> {
  const given = source.password ?? process.env.TRUSTEE_KEY_PASSWORD
  if (given) return given
  if (!source.encrypt) return undefined
  if (!process.stdin.isTTY) throw new Error('nu pot cere parola fără terminal; dă-o prin --password sau TRUSTEE_KEY_PASSWORD')
  const first = await ask('Parola fișierului de cheie: ')
  if (first.length < 8) throw new Error('parola trebuie să aibă cel puțin 8 caractere')
  const second = await ask('Repetă parola: ')
  if (first !== second) throw new Error('parolele nu coincid')
  return first
}

/** Parola pentru un fișier existent, criptat. */
export async function passwordForExistingKey(source: PasswordSource): Promise<string> {
  const given = source.password ?? process.env.TRUSTEE_KEY_PASSWORD
  if (given) return given
  if (!process.stdin.isTTY) throw new Error('fișierul de cheie e criptat: dă parola prin --password sau TRUSTEE_KEY_PASSWORD')
  return ask('Parola fișierului de cheie: ')
}
