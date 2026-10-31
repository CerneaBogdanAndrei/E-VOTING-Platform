// Fir de lucru pentru verificatorul paralel: verifică dovezile unei porțiuni din board.
import { parentPort, workerData } from 'node:worker_threads'
import { checkBallotProofs, type BoardEntry, type ElectionParams } from '@evoting/crypto'

const { params, entries } = workerData as { params: ElectionParams; entries: BoardEntry[] }
parentPort!.postMessage(checkBallotProofs(params, entries))
