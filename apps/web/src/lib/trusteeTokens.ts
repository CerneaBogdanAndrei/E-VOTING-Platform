// Token-urile trustees, afișate o singură dată după crearea scrutinului. Serverul păstrează doar
// hash-ul lor, deci dacă pagina se reîncarcă sau comisia navighează în altă parte înainte să le copieze,
// sunt pierdute și scrutinul nu mai poate primi chei. Ca să nu se întâmple asta, rămân în sessionStorage
// (doar în acest tab, ca token-ul comisiei) până când comisia confirmă că le-a transmis.

import type { TrusteeToken } from '@evoting/api'

const key = (electionId: string) => `evoting.trusteeTokens.${electionId}`

export function saveTrusteeTokens(electionId: string, tokens: TrusteeToken[]) {
  try {
    sessionStorage.setItem(key(electionId), JSON.stringify(tokens))
  } catch {
    // stocare indisponibilă: token-urile rămân doar pe ecran
  }
}

export function loadTrusteeTokens(electionId: string): TrusteeToken[] | undefined {
  try {
    const raw = sessionStorage.getItem(key(electionId))
    return raw ? (JSON.parse(raw) as TrusteeToken[]) : undefined
  } catch {
    return undefined
  }
}

export function forgetTrusteeTokens(electionId: string) {
  try {
    sessionStorage.removeItem(key(electionId))
  } catch {
    // nimic de șters
  }
}

/** Comanda pe care o rulează un trustee ca să-și genereze cheia (cu parolă pentru fișierul de cheie). */
export const keygenCommand = (apiUrl: string, electionId: string, t: TrusteeToken) =>
  `npx evoting-trustee keygen --api ${apiUrl} --election ${electionId} --trustee ${t.trusteeId} --token ${t.token} --encrypt`

/** Un fișier text cu comenzile tuturor trustees, de împărțit apoi fiecăruia pe un canal separat. */
export function tokensFile(apiUrl: string, electionId: string, title: string, tokens: TrusteeToken[]) {
  const lines = [
    `Scrutin: ${title} (${electionId})`,
    'Token-urile trustees. Serverul păstrează doar hash-ul lor: fișierul acesta e singura copie.',
    'Dă fiecărui trustee doar rândul lui, pe un canal separat; același token îi trebuie și la decriptare.',
    '',
  ]
  for (const t of tokens) lines.push(`${t.name}:`, `  ${keygenCommand(apiUrl, electionId, t)}`, '')
  return lines.join('\n')
}
