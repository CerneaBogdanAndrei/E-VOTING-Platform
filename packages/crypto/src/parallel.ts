// Partea scumpă a verificării publice: semnătura și dovezile ZK ale fiecărui buletin
// (~25-30 ms per buletin, aproape tot timpul verificatorului). Buletinele sunt
// independente unul de altul, deci verificările lor se pot face pe mai multe fire.
//
// Aici e doar logica comună, fără nimic specific unei platforme: împărțirea board-ului
// în bucăți, trimiterea lor la „lucrători”, păstrarea ordinii și progresul. Lucrătorii
// propriu-ziși sunt worker_threads în Node (./node/parallel.ts, folosit de CLI-uri) și
// Web Workers în browser (apps/web/src/lib/verify-workers.ts). Fără lucrători (de exemplu
// în React Native), `sequentialWork` face totul în firul curent, ca înainte.

import { verifyBallotProofs, verifyBallotSignature, type BallotCheck } from './ballot.js'
import { entryToBallot } from './board.js'
import { computeAggregate, sumAggregates } from './tally.js'
import type { BoardEntry, Ciphertext, ElectionParams } from './types.js'

/** Progresul unei etape: câte intrări s-au terminat până acum. */
export type WorkProgress = (done: number) => void | Promise<void>

/** Cine face verificările scumpe ale buletinelor. Rezultatele vin în ordinea intrărilor. */
export interface BallotWork {
  /** Pe câte fire lucrează (1 = firul curent). */
  readonly threads: number
  /** Semnătura credentialului peste fiecare buletin. */
  signatures(electionId: string, entries: readonly BoardEntry[], progress?: WorkProgress): Promise<boolean[]>
  /** Dovezile „0 sau 1” și dovada sumei pentru fiecare buletin. */
  proofs(params: ElectionParams, entries: readonly BoardEntry[], progress?: WorkProgress): Promise<BallotCheck[]>
  /** Agregatul homomorf: suma criptotextelor fiecărui candidat. Aruncă la primul buletin malformat, ca computeAggregate. */
  aggregate(candidateCount: number, entries: readonly BoardEntry[], progress?: WorkProgress): Promise<Ciphertext[]>
}

/** Semnăturile unui grup de intrări. O intrare malformată dă `false`, nu o excepție. */
export function checkSignatures(electionId: string, entries: readonly BoardEntry[]): boolean[] {
  return entries.map((e) => {
    try {
      return verifyBallotSignature(entryToBallot(electionId, e))
    } catch {
      return false
    }
  })
}

/** Dovezile ZK ale unui grup de intrări (verifyBallotProofs nu aruncă: întoarce motivul). */
export function checkProofs(params: ElectionParams, entries: readonly BoardEntry[]): BallotCheck[] {
  return entries.map((e) => {
    try {
      return verifyBallotProofs(params, entryToBallot(params.electionId, e))
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) }
    }
  })
}

/** Totul în firul curent, intrare cu intrare: comportamentul implicit al verificatorului. */
export function sequentialWork(): BallotWork {
  return {
    threads: 1,
    async signatures(electionId, entries, progress) {
      const out: boolean[] = []
      for (const e of entries) {
        out.push(checkSignatures(electionId, [e])[0])
        await progress?.(out.length)
      }
      return out
    },
    async proofs(params, entries, progress) {
      const out: BallotCheck[] = []
      for (const e of entries) {
        out.push(checkProofs(params, [e])[0])
        await progress?.(out.length)
      }
      return out
    },
    async aggregate(candidateCount, entries, progress) {
      const result = computeAggregate(candidateCount, entries)
      await progress?.(entries.length)
      return result
    },
  }
}

// ───────────── protocolul dintre bazin și lucrători ─────────────

/** O bucată de lucru trimisă unui lucrător. */
export type WorkRequest =
  | { id: number; kind: 'signatures'; electionId: string; entries: BoardEntry[] }
  | { id: number; kind: 'proofs'; params: ElectionParams; entries: BoardEntry[] }
  /** `offset`: poziția pe board a primei intrări din bucată, pentru mesajele de eroare. */
  | { id: number; kind: 'aggregate'; candidateCount: number; offset: number; entries: BoardEntry[] }

/** Răspunsul lucrătorului: rezultatele bucății (sau agregatul ei parțial), ori eroarea. */
export type WorkResponse = { id: number; result: boolean[] | BallotCheck[] | Ciphertext[] } | { id: number; error: string }

/** Ce face un lucrător cu o bucată. Aceeași funcție rulează în worker_threads și în Web Workers. */
export function handleWorkRequest(request: WorkRequest): WorkResponse {
  try {
    const result =
      request.kind === 'signatures'
        ? checkSignatures(request.electionId, request.entries)
        : request.kind === 'proofs'
          ? checkProofs(request.params, request.entries)
          : computeAggregate(request.candidateCount, request.entries, request.offset)
    return { id: request.id, result }
  } catch (err) {
    return { id: request.id, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Un lucrător, așa cum îl vede bazinul; adaptorul de platformă leagă metodele de Worker-ul real. */
export interface WorkerPort {
  post(request: WorkRequest): void
  onResponse(listener: (response: WorkResponse) => void): void
  onError(listener: (error: Error) => void): void
  terminate(): unknown
}

export interface ParallelWork extends BallotWork {
  /** Oprește lucrătorii. După close, o nouă cerere pornește alții. */
  close(): Promise<void>
}

export interface ParallelOptions {
  /** Câte intrări primește un lucrător deodată; implicit, cam patru bucăți per fir, între 4 și 64 de intrări. */
  chunkSize?: number
}

type Task = { request: Omit<WorkRequest, 'id'>; resolve: (result: unknown[]) => void; reject: (error: Error) => void }

/**
 * Bazinul de lucrători: pornește `threads` lucrători la prima cerere, împarte intrările în
 * bucăți și le dă, pe rând, primului lucrător liber. Rezultatele se pun la loc în ordinea
 * intrărilor, deci raportul verificatorului e identic cu cel făcut pe un singur fir.
 * Dacă un lucrător cade, toate cererile în curs eșuează: un verificator nu ghicește rezultate.
 */
export function createParallelWork(spawn: () => WorkerPort, threads: number, options: ParallelOptions = {}): ParallelWork {
  const size = Math.max(1, Math.floor(threads))
  let workers: WorkerPort[] = []
  let idle: WorkerPort[] = []
  const queue: Task[] = []
  const pending = new Map<number, { worker: WorkerPort; task: Task }>()
  let nextId = 1

  const failAll = (error: Error) => {
    for (const { task } of pending.values()) task.reject(error)
    pending.clear()
    for (const task of queue.splice(0)) task.reject(error)
    for (const w of workers) w.terminate()
    workers = []
    idle = []
  }

  const start = () => {
    while (workers.length < size) {
      const worker = spawn()
      worker.onResponse((response) => {
        const p = pending.get(response.id)
        if (!p) return
        pending.delete(response.id)
        if ('error' in response) p.task.reject(new Error(response.error))
        else p.task.resolve(response.result)
        if (workers.includes(worker)) {
          idle.push(worker)
          pump()
        }
      })
      worker.onError((error) => failAll(new Error(`Un fir de verificare s-a oprit: ${error.message}`)))
      workers.push(worker)
      idle.push(worker)
    }
  }

  const pump = () => {
    while (idle.length && queue.length) {
      const worker = idle.pop()!
      const task = queue.shift()!
      const id = nextId++
      pending.set(id, { worker, task })
      worker.post({ ...task.request, id } as WorkRequest)
    }
  }

  const run = (request: Omit<WorkRequest, 'id'>) =>
    new Promise<unknown[]>((resolve, reject) => {
      queue.push({ request, resolve, reject })
      start()
      pump()
    })

  /** Bucățile board-ului, cu poziția primei intrări din fiecare. */
  const split = (entries: readonly BoardEntry[]) => {
    const chunk = options.chunkSize ?? Math.min(64, Math.max(4, Math.ceil(entries.length / (size * 4))))
    const parts: { offset: number; entries: BoardEntry[] }[] = []
    for (let i = 0; i < entries.length; i += chunk) parts.push({ offset: i, entries: entries.slice(i, i + chunk) })
    return parts
  }

  /**
   * Trimite toate bucățile și întoarce rezultatele lor în ordinea bucăților. Dacă mai multe eșuează,
   * eroarea raportată e a primei bucăți din board, ca la verificarea pe un singur fir.
   */
  async function runParts<T>(
    parts: { offset: number; entries: BoardEntry[] }[],
    request: (part: { offset: number; entries: BoardEntry[] }) => Omit<WorkRequest, 'id'>,
    progress?: WorkProgress,
  ): Promise<T[][]> {
    let done = 0
    const settled = await Promise.allSettled(
      parts.map(async (part) => {
        const result = (await run(request(part))) as T[]
        done += part.entries.length
        await progress?.(done)
        return result
      }),
    )
    const failed = settled.find((x) => x.status === 'rejected')
    if (failed) throw (failed as PromiseRejectedResult).reason
    return settled.map((x) => (x as PromiseFulfilledResult<T[]>).value)
  }

  /** Un rezultat per intrare (semnături, dovezi), lipite la loc în ordinea board-ului. */
  async function perEntry<T>(entries: readonly BoardEntry[], request: (part: BoardEntry[]) => Omit<WorkRequest, 'id'>, progress?: WorkProgress): Promise<T[]> {
    if (entries.length === 0) return []
    const parts = split(entries)
    const results = await runParts<T>(parts, (part) => request(part.entries), progress)
    results.forEach((r, i) => {
      if (r.length !== parts[i].entries.length) throw new Error('Un fir de verificare a întors un număr greșit de rezultate')
    })
    return results.flat()
  }

  return {
    threads: size,
    signatures: (electionId, entries, progress) => perEntry<boolean>(entries, (part) => ({ kind: 'signatures', electionId, entries: part }), progress),
    proofs: (params, entries, progress) => perEntry<BallotCheck>(entries, (part) => ({ kind: 'proofs', params, entries: part }), progress),
    // fiecare fir adună bucata lui; sumele parțiale se adună aici (adunarea punctelor e asociativă, deci rezultatul e același)
    async aggregate(candidateCount, entries, progress) {
      if (entries.length === 0) return computeAggregate(candidateCount, [])
      const partials = await runParts<Ciphertext>(
        split(entries),
        (part) => ({ kind: 'aggregate', candidateCount, offset: part.offset, entries: part.entries }),
        progress,
      )
      return sumAggregates(candidateCount, partials)
    },
    async close() {
      const all = workers
      workers = []
      idle = []
      const stopped = new Error('Verificarea a fost oprită')
      for (const { task } of pending.values()) task.reject(stopped)
      pending.clear()
      for (const task of queue.splice(0)) task.reject(stopped)
      await Promise.all(all.map((w) => w.terminate()))
    },
  }
}
