// Un fir de verificare (worker_threads): primește o bucată din board, întoarce rezultatele.

import { parentPort } from 'node:worker_threads'
import { handleWorkRequest, type WorkRequest } from '../parallel.js'

parentPort?.on('message', (request: WorkRequest) => parentPort!.postMessage(handleWorkRequest(request)))
