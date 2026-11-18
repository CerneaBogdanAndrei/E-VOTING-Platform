// Verificarea în paralel în Node: lucrătorii sunt worker_threads care rulează ./worker.js.
// Separat de restul bibliotecii (importul e `@evoting/crypto/node`), ca browserul și
// React Native să nu vadă niciodată module Node. Folosit de evoting-verify, de CLI-ul
// trustee-ului (înainte de decriptare) și de simulator.

import { availableParallelism } from 'node:os'
import { Worker } from 'node:worker_threads'
import { createParallelWork, type ParallelOptions, type ParallelWork, type WorkResponse } from '../parallel.js'

/** Câte fire are mașina (nucleele logice). */
export const defaultThreads = (): number => availableParallelism()

/** Bazin de worker_threads; `close()` îi oprește la final (altfel procesul nu se termină). */
export function createNodeWork(threads: number = defaultThreads(), options: ParallelOptions = {}): ParallelWork {
  const script = new URL('./worker.js', import.meta.url)
  return createParallelWork(
    () => {
      const worker = new Worker(script)
      return {
        post: (request) => worker.postMessage(request),
        onResponse: (listener) => worker.on('message', (response: WorkResponse) => listener(response)),
        onError: (listener) => worker.on('error', listener),
        terminate: () => worker.terminate(),
      }
    },
    threads,
    options,
  )
}
