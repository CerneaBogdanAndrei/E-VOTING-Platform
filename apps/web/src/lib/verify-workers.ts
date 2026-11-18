// Verificarea publică în paralel, în browser: bazinul din @evoting/crypto cu Web Workers.
// Fiecare worker rulează ./verify.worker.ts; raportul iese identic cu cel de pe un singur fir.

import { createParallelWork, type ParallelWork, type WorkResponse } from '@evoting/crypto'

/** Web Workers există (în orice browser modern; nu în testele fără DOM). */
export const workersAvailable = typeof Worker !== 'undefined'

/** Câte fire: nucleele raportate de browser, cel mult 16. */
export const browserThreads = (): number => Math.max(1, Math.min(16, (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 1))

export function createBrowserWork(threads: number = browserThreads()): ParallelWork {
  return createParallelWork(() => {
    const worker = new Worker(new URL('./verify.worker.ts', import.meta.url), { type: 'module' })
    return {
      post: (request) => worker.postMessage(request),
      onResponse: (listener) => worker.addEventListener('message', (event: MessageEvent<WorkResponse>) => listener(event.data)),
      onError: (listener) => worker.addEventListener('error', (event) => listener(new Error(event.message || 'eroare într-un Web Worker'))),
      terminate: () => worker.terminate(),
    }
  }, threads)
}
