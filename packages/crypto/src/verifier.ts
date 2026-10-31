// Verificarea publică a unui scrutin, din datele publice (registrul scrutinului).
// Același cod rulează în CLI-ul de verificare, în pagina web de verificare și în teste.
//
// Ordinea pașilor urmează planul:
//   0. Cheile trustees și cheia scrutinului
//   1. Lanțul de hash-uri și hash-urile publicate independent
//   2. Semnăturile; fiecare credential e înregistrat și votează o singură dată
//   3. Dovezile ZK ale fiecărui buletin
//   4. Agregatul, recalculat de la zero
//   5. Decriptările parțiale și rezultatul final
// Orice pas picat înseamnă că rezultatul nu e de încredere; problemele spun exact unde.

import { ballotHash, verifyBallot } from './ballot.js'
import { verifyChain, type BoardEntry } from './board.js'
import { ballotMessage, verifySignature } from './credential.js'
import { combinePublicKeys, verifyTrusteeKey, type ElectionParams } from './election.js'
import type { Ciphertext } from './elgamal.js'
import { combineDecryptions, computeAggregate, verifyPartialDecryption, type PartialDecryption } from './tally.js'

// Disponibil în Node, browser și React Native; declarat aici ca pachetul să nu depindă de tipurile DOM sau Node.
declare function setTimeout(callback: () => void, ms?: number): unknown

export interface TallyRecord {
  /** Câte buletine au intrat în agregat. */
  ballotCount: number
  aggregate: Ciphertext[]
  partials: PartialDecryption[]
  /** Totalurile publicate, în ordinea candidaților. */
  counts: number[]
}

/** Tot ce e public despre un scrutin: GET /elections/:id/record. */
export interface ElectionRecord {
  version: 1
  title: string
  status: string
  params: ElectionParams
  /** Cheile publice ale credentialelor înregistrate (fără nicio legătură cu identitatea). */
  registrations: string[]
  board: BoardEntry[]
  tally: TallyRecord | null
}

export type StepKey = 'keys' | 'chain' | 'credentials' | 'proofs' | 'aggregate' | 'decryption'

export interface StepReport {
  key: StepKey
  title: string
  ok: boolean
  /** Pas sărit (de exemplu, numărarea încă nu a avut loc). */
  skipped: boolean
  problems: string[]
  /** Rezumat pozitiv, afișat când pasul trece. */
  summary: string
}

export interface VerificationReport {
  ok: boolean
  electionId: string
  steps: StepReport[]
  /** Capul lanțului recalculat, de comparat cu cel publicat independent. */
  head: string
  counts: number[] | null
  ms: number
}

export interface VerifyOptions {
  /** Hash-uri publicate independent de server (de exemplu pe site-ul facultății): fiecare trebuie să apară în lanț. */
  anchors?: string[]
  /** Apelat după fiecare buletin verificat (pentru bara de progres). */
  onProgress?: (done: number, total: number) => void
  /** Cedează controlul la fiecare N buletine (în browser, ca interfața să rămână vie). */
  yieldEvery?: number
  /** Câte probleme se păstrează per pas (restul se numără). */
  maxProblems?: number
  /**
   * Verificator alternativ pentru pasul 3 (de exemplu, în paralel pe mai multe nuclee).
   * Trebuie să întoarcă aceleași probleme ca verificarea implicită.
   */
  proofChecker?: (params: ElectionParams, board: BoardEntry[]) => Promise<string[]>
}

/** Pasul 3 pentru o porțiune din board (folosit și de verificatorii paraleli). */
export function checkBallotProofs(params: ElectionParams, entries: BoardEntry[]): string[] {
  const problems: string[] = []
  for (const e of entries) for (const p of verifyBallot(params, e.ballot, { checkSignature: false }).problems) problems.push(`Buletinul #${e.seq}: ${p}`)
  return problems
}

export async function verifyElectionRecord(record: ElectionRecord, options: VerifyOptions = {}): Promise<VerificationReport> {
  const t0 = Date.now()
  const { params, board } = record
  const names = params.candidates
  const max = options.maxProblems ?? 50
  const steps: StepReport[] = []
  const step = (key: StepKey, title: string, problems: string[], summary: string, skipped = false): StepReport => {
    const shown = problems.length > max ? [...problems.slice(0, max), `… și încă ${problems.length - max} probleme`] : problems
    const r = { key, title, ok: skipped || problems.length === 0, skipped, problems: shown, summary }
    steps.push(r)
    return r
  }

  // 0. Cheile
  {
    const problems: string[] = []
    for (const t of params.trustees) {
      if (!verifyTrusteeKey(params.electionId, t.id, t.publicKeyShare, t.proof)) problems.push(`${t.name}: dovada că își cunoaște cheia nu se verifică`)
    }
    if (params.trustees.length === 0) problems.push('scrutinul nu are trustees')
    else if (combinePublicKeys(params.trustees.map((t) => t.publicKeyShare)) !== params.publicKey) {
      problems.push('cheia scrutinului nu este suma cheilor publice ale trustees')
    }
    step('keys', 'Cheile trustees și cheia scrutinului', problems, `${params.trustees.length} trustees, Y = ΣYᵢ`)
  }

  // 1. Lanțul
  const chain = verifyChain(params.electionId, board)
  {
    const problems = [...chain.problems]
    const hashes = new Set(board.map((e) => e.hash))
    for (const a of options.anchors ?? []) {
      if (!hashes.has(a)) problems.push(`hash-ul publicat independent ${a.slice(0, 12)}… nu apare în lanț: istoria board-ului a fost rescrisă`)
    }
    const anchors = options.anchors?.length ? `, ${options.anchors.length} hash-uri publicate independent găsite` : ''
    step('chain', 'Lanțul de hash-uri al board-ului', problems, `${board.length} intrări, cap ${chain.head.slice(0, 12)}…${anchors}`)
  }

  // 2. Semnături și credentiale
  {
    const problems: string[] = []
    const registered = new Set(record.registrations)
    const seen = new Map<string, number>()
    for (const e of board) {
      const where = `Buletinul #${e.seq}`
      const cred = e.ballot?.credentialPubkey
      if (!registered.has(cred)) problems.push(`${where}: credentialul nu e în lista celor înregistrați (posibil buletin adăugat de server)`)
      const first = seen.get(cred)
      if (first !== undefined) problems.push(`${where}: credentialul a mai votat, în buletinul #${first}`)
      else seen.set(cred, e.seq)
      let signed = false
      try {
        signed = verifySignature(cred, ballotMessage(params.electionId, ballotHash(e.ballot)), e.ballot.signature)
      } catch {
        signed = false
      }
      if (!signed) problems.push(`${where}: semnătura credentialului nu se verifică`)
    }
    step('credentials', 'Semnături și credentiale unice', problems, `${seen.size} credentiale distincte, toate înregistrate (din ${registered.size} înregistrări)`)
  }

  // 3. Dovezile ZK
  {
    let problems: string[] = []
    if (options.proofChecker) {
      problems = await options.proofChecker(params, board)
    } else {
      for (const [i, e] of board.entries()) {
        problems.push(...checkBallotProofs(params, [e]))
        options.onProgress?.(i + 1, board.length)
        if (options.yieldEvery && (i + 1) % options.yieldEvery === 0) await new Promise<void>((res) => setTimeout(() => res(), 0))
      }
    }
    step('proofs', 'Dovezile zero-knowledge ale buletinelor', problems, `${board.length * (names.length + 1)} dovezi verificate`)
  }

  const tally = record.tally
  if (!tally) {
    step('aggregate', 'Agregatul homomorf', [], 'numărarea nu a avut loc încă', true)
    step('decryption', 'Decriptarea și rezultatul', [], 'numărarea nu a avut loc încă', true)
    return finish()
  }

  // 4. Agregatul
  {
    const problems: string[] = []
    if (tally.ballotCount !== board.length) problems.push(`numărarea a inclus ${tally.ballotCount} buletine, dar board-ul are ${board.length}`)
    let recomputed: Ciphertext[] = []
    try {
      recomputed = computeAggregate(names.length, board.map((e) => e.ballot))
    } catch {
      problems.push('agregatul nu poate fi recalculat: board-ul conține criptotexte invalide')
    }
    recomputed.forEach((ct, j) => {
      const pub = tally.aggregate[j]
      if (!pub || ct.a !== pub.a || ct.b !== pub.b) problems.push(`${names[j]}: agregatul recalculat din board ≠ agregatul folosit la numărare`)
    })
    step('aggregate', 'Agregatul homomorf, recalculat de la zero', problems, `${names.length} criptotexte agregate din ${board.length} buletine`)
  }

  // 5. Decriptarea
  {
    const problems: string[] = []
    for (const t of params.trustees) {
      const partial = tally.partials.find((p) => p.trusteeId === t.id)
      problems.push(...verifyPartialDecryption(params.electionId, t, tally.aggregate, partial, names))
    }
    if (problems.length === 0) {
      const ordered = params.trustees.map((t) => tally.partials.find((p) => p.trusteeId === t.id)!)
      const counts = combineDecryptions(tally.aggregate, ordered, Math.max(tally.ballotCount, board.length) * params.maxSelections)
      counts.forEach((n, j) => {
        if (n !== tally.counts[j]) problems.push(`${names[j]}: rezultatul publicat (${tally.counts[j]}) ≠ rezultatul decriptat (${n ?? 'negăsit'})`)
      })
    }
    const total = tally.counts.reduce((s, n) => s + n, 0)
    const min = board.length * params.minSelections
    const maxVotes = board.length * params.maxSelections
    if (total < min || total > maxVotes) problems.push(`suma voturilor (${total}) nu e compatibilă cu ${board.length} buletine`)
    step('decryption', 'Decriptările parțiale și rezultatul', problems, `${params.trustees.length} decriptări parțiale corecte; rezultat: ${tally.counts.map((n, j) => `${names[j]} ${n}`).join(', ')}`)
  }

  return finish()

  function finish(): VerificationReport {
    return {
      ok: steps.every((s) => s.ok),
      electionId: params.electionId,
      steps,
      head: chain.head,
      counts: record.tally?.counts ?? null,
      ms: Date.now() - t0,
    }
  }
}
