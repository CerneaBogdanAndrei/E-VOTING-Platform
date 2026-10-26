// Verificatorul public. Primește tot ce publică serverul (parametrii, lista de
// credentiale înregistrate, board-ul, agregatul, decriptările parțiale și
// rezultatul) și reface fiecare pas. Orice pas picat spune exact unde.

import { ballotHash, verifyBallotProofs, verifyBallotSignature } from './ballot.js'
import { computeEntryHash, entryToBallot, genesisHash } from './board.js'
import { combinePublicKeys, verifyPartialDecryption, verifyTrusteeKey } from './trustee.js'
import { combinePartialDecryptions, computeAggregate } from './tally.js'
import type { BoardEntry, Ciphertext, ChaumPedersenProof, ElectionParams, PartialDecryption } from './types.js'

export interface AuditBundle {
  election: {
    id: string
    publicKey: string | null
    candidates: { id: string; position: number; name?: string }[]
    trustees: { id: string; name?: string; publicKeyShare: string | null; keyProof?: ChaumPedersenProof | null }[]
  }
  /** Credentialele înregistrate (doar cheile publice, fără nicio legătură cu identitatea). */
  registrations: { credentialPubkey: string }[]
  board: BoardEntry[]
  tally?: { aggregate: Ciphertext[] | null; partials: PartialDecryption[] } | null
  result?: { counts: { candidateId: string; votes: number }[]; totalBallots: number } | null
}

export type StepId = 'keys' | 'chain' | 'credentials' | 'proofs' | 'aggregate' | 'decryption'
export type StepStatus = 'ok' | 'fail' | 'skipped'

export interface Failure {
  /** Locul exact: „buletinul #12”, „trustee-ul t2, candidatul 3” etc. */
  where: string
  message: string
}

export interface VerificationStep {
  id: StepId
  title: string
  status: StepStatus
  details: string[]
  failures: Failure[]
}

export interface VerificationReport {
  ok: boolean
  steps: VerificationStep[]
  /** Hash-ul ultimei intrări, de comparat cu cel publicat independent. */
  head: string
  ballots: number
}

export interface VerifyOptions {
  /** Hash-ul publicat independent (de exemplu pe site-ul facultății) pentru intrarea `seq`. */
  publishedHead?: { seq: number; hash: string }
  onProgress?: (step: StepId, done: number, total: number) => void
  /** Cedează controlul la fiecare N buletine, ca interfața să rămână receptivă în browser. */
  yieldEvery?: number
}

export const STEP_TITLES: Record<StepId, string> = {
  keys: 'Cheile trustees și cheia scrutinului',
  chain: 'Lanțul de hash-uri al board-ului',
  credentials: 'Semnăturile și credentialele înregistrate',
  proofs: 'Dovezile zero-knowledge ale buletinelor',
  aggregate: 'Agregatul homomorf, recalculat de la zero',
  decryption: 'Decriptările parțiale și rezultatul',
}

const MAX_LISTED_FAILURES = 50
// Disponibil în Node, browser și React Native; declarat aici ca biblioteca să nu depindă de tipurile DOM.
declare function setTimeout(callback: () => void, ms: number): unknown
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export async function verifyElection(bundle: AuditBundle, options: VerifyOptions = {}): Promise<VerificationReport> {
  const { election, board } = bundle
  const yieldEvery = options.yieldEvery ?? 0
  const steps: VerificationStep[] = []
  const step = (id: StepId): VerificationStep => {
    const s: VerificationStep = { id, title: STEP_TITLES[id], status: 'ok', details: [], failures: [] }
    steps.push(s)
    return s
  }
  const fail = (s: VerificationStep, where: string, message: string) => {
    s.status = 'fail'
    if (s.failures.length < MAX_LISTED_FAILURES) s.failures.push({ where, message })
  }
  const progress = async (id: StepId, done: number, total: number) => {
    options.onProgress?.(id, done, total)
    if (yieldEvery > 0 && done % yieldEvery === 0) await tick()
  }

  const candidates = [...election.candidates].sort((a, b) => a.position - b.position)
  const n = candidates.length

  // 0. Cheile
  const keys = step('keys')
  for (const t of election.trustees) {
    if (!t.publicKeyShare || !t.keyProof) {
      fail(keys, `trustee-ul ${t.name ?? t.id}`, 'Lipsește cheia publică sau dovada Schnorr')
    } else if (!verifyTrusteeKey(election.id, { trusteeId: t.id, publicKeyShare: t.publicKeyShare, proof: t.keyProof })) {
      fail(keys, `trustee-ul ${t.name ?? t.id}`, 'Dovada Schnorr a cheii nu e validă')
    }
  }
  if (keys.status === 'ok') {
    const expected = combinePublicKeys(election.trustees.map((t) => t.publicKeyShare!))
    if (expected !== election.publicKey) fail(keys, 'cheia scrutinului', 'Y publicat ≠ Y₁ + … + Yₙ')
    else keys.details.push(`${election.trustees.length} chei Yᵢ cu dovezi valide; Y = ΣYᵢ`)
  }
  const params: ElectionParams | null = election.publicKey ? { electionId: election.id, publicKey: election.publicKey, candidateCount: n } : null

  // 1. Lanțul
  const chain = step('chain')
  let prev = genesisHash(election.id)
  for (let k = 0; k < board.length; k++) {
    const e = board[k]
    const where = `buletinul #${e.seq}`
    if (e.seq !== k + 1) fail(chain, where, `Poziție așteptată ${k + 1}, găsită ${e.seq} (ordinea a fost schimbată sau lipsesc intrări)`)
    if (e.prevHash !== prev) fail(chain, where, 'Hash-ul anterior nu corespunde intrării dinainte')
    const bh = ballotHash(entryToBallot(election.id, e))
    if (bh !== e.ballotHash) {
      fail(chain, where, `Conținutul a fost modificat: hash-ul recalculat al buletinului (${bh.slice(0, 8)}…) ≠ cel publicat (${String(e.ballotHash).slice(0, 8)}…)`)
    }
    const h = computeEntryHash({ electionId: election.id, seq: e.seq, prevHash: e.prevHash, ballotHash: bh, receivedAt: e.receivedAt })
    if (h !== e.hash) fail(chain, where, `Hash-ul intrării recalculat (${h.slice(0, 8)}…) ≠ codul de urmărire publicat (${e.hash.slice(0, 8)}…)`)
    prev = e.hash
    await progress('chain', k + 1, board.length)
  }
  const head = board.length ? board[board.length - 1].hash : genesisHash(election.id)
  if (options.publishedHead) {
    const { seq, hash } = options.publishedHead
    const entry = seq === 0 ? { hash: genesisHash(election.id) } : board[seq - 1]
    if (!entry) fail(chain, `intrarea #${seq}`, 'Hash-ul publicat independent se referă la o intrare care nu mai există pe board')
    else if (entry.hash !== hash.toLowerCase()) fail(chain, `intrarea #${seq}`, 'Board-ul diferă de hash-ul publicat independent: istoria a fost rescrisă')
    else chain.details.push(`Intrarea #${seq} corespunde hash-ului publicat independent`)
  }
  if (chain.status === 'ok') chain.details.push(`${board.length} intrări legate corect; ultimul hash ${head.slice(0, 16)}…`)

  // 2. Semnături și credentiale
  const creds = step('credentials')
  const registered = new Set(bundle.registrations.map((r) => r.credentialPubkey))
  if (registered.size !== bundle.registrations.length) fail(creds, 'lista de înregistrări', 'Același credential apare de mai multe ori')
  const seen = new Map<string, number>()
  for (let k = 0; k < board.length; k++) {
    const e = board[k]
    const where = `buletinul #${e.seq}`
    if (!registered.has(e.credentialPubkey)) fail(creds, where, 'Credentialul nu figurează în lista publică de înregistrări')
    const first = seen.get(e.credentialPubkey)
    if (first !== undefined) fail(creds, where, `Credentialul a mai votat la buletinul #${first}`)
    else seen.set(e.credentialPubkey, e.seq)
    if (!verifyBallotSignature(entryToBallot(election.id, e))) fail(creds, where, 'Semnătura credentialului nu e validă')
    await progress('credentials', k + 1, board.length)
  }
  if (creds.status === 'ok') {
    creds.details.push(`${board.length} semnături valide, fiecare credential votează o singură dată`)
    creds.details.push(`${bundle.registrations.length} credentiale înregistrate, ${board.length} au votat`)
  }

  // 3. Dovezile ZK
  const proofs = step('proofs')
  if (!params) {
    proofs.status = 'skipped'
    proofs.details.push('Cheia scrutinului lipsește')
  } else {
    for (let k = 0; k < board.length; k++) {
      const e = board[k]
      const check = verifyBallotProofs(params, entryToBallot(election.id, e))
      if (!check.ok) fail(proofs, `buletinul #${e.seq}${check.candidate !== undefined ? `, ${candidates[check.candidate]?.name ?? `poziția ${check.candidate + 1}`}` : ''}`, check.reason)
      await progress('proofs', k + 1, board.length)
    }
    if (proofs.status === 'ok') proofs.details.push(`${board.length} buletine × ${n} dovezi 0/1 + dovada sumei: toate valide`)
  }

  // 4. Agregatul
  const aggregateStep = step('aggregate')
  const published = bundle.tally?.aggregate ?? null
  let recomputed: Ciphertext[] | null = null
  try {
    recomputed = computeAggregate(n, board)
  } catch (err) {
    fail(aggregateStep, 'board', err instanceof Error ? err.message : String(err))
  }
  if (!published) {
    aggregateStep.status = aggregateStep.status === 'fail' ? 'fail' : 'skipped'
    aggregateStep.details.push('Agregatul nu a fost publicat încă (votul nu e închis)')
  } else if (recomputed) {
    if (published.length !== n) fail(aggregateStep, 'agregat', `Se așteaptă ${n} criptotexte agregate`)
    else
      recomputed.forEach((ct, j) => {
        if (ct.a !== published[j].a || ct.b !== published[j].b) {
          fail(aggregateStep, `candidatul ${candidates[j]?.name ?? j + 1}`, 'Agregatul publicat nu e suma criptotextelor de pe board')
        }
      })
    if (aggregateStep.status === 'ok') aggregateStep.details.push(`Suma celor ${board.length} buletine coincide cu agregatul publicat`)
  }

  // 5. Decriptarea și rezultatul
  const dec = step('decryption')
  const result = bundle.result
  if (!published || !bundle.tally || !result) {
    dec.status = 'skipped'
    dec.details.push('Rezultatul nu a fost publicat încă')
  } else if (aggregateStep.status === 'fail') {
    fail(dec, 'agregat', 'Rezultatul nu poate fi verificat pe un agregat greșit')
  } else {
    const partials = bundle.tally.partials
    for (const t of election.trustees) {
      const p = partials.find((x) => x.trusteeId === t.id)
      if (!p) {
        fail(dec, `trustee-ul ${t.name ?? t.id}`, 'Lipsește decriptarea parțială')
        continue
      }
      const check = verifyPartialDecryption(election.id, t.publicKeyShare ?? '', published, p)
      if (!check.ok) fail(dec, `trustee-ul ${t.name ?? t.id}${check.candidate !== undefined ? `, ${candidates[check.candidate]?.name ?? check.candidate + 1}` : ''}`, check.reason)
    }
    if (partials.length !== election.trustees.length) fail(dec, 'decriptări parțiale', 'Numărul decriptărilor nu corespunde numărului de trustees')
    if (dec.status === 'ok') {
      try {
        const ordered = election.trustees.map((t) => partials.find((x) => x.trusteeId === t.id)!)
        const counts = combinePartialDecryptions(published, ordered, board.length)
        counts.forEach((votes, j) => {
          const c = candidates[j]
          const claimed = result.counts.find((x) => x.candidateId === c.id)?.votes
          if (claimed !== votes) fail(dec, `candidatul ${c.name ?? c.id}`, `Rezultatul publicat spune ${claimed ?? '—'}, decriptarea dă ${votes}`)
        })
        if (result.totalBallots !== board.length) fail(dec, 'total buletine', `Publicat ${result.totalBallots}, pe board ${board.length}`)
        const sum = counts.reduce((a, b) => a + b, 0)
        if (sum !== board.length) fail(dec, 'totaluri', `Suma voturilor (${sum}) ≠ numărul de buletine (${board.length})`)
        if (dec.status === 'ok') dec.details.push(`${partials.length} decriptări cu dovezi valide; totaluri: ${counts.join(', ')}`)
      } catch (err) {
        fail(dec, 'combinare', err instanceof Error ? err.message : String(err))
      }
    }
  }

  return { ok: steps.every((s) => s.status !== 'fail'), steps, head, ballots: board.length }
}
