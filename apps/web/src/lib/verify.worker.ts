// Un fir de verificare în browser (Web Worker): primește o bucată din board și întoarce
// semnăturile sau dovezile verificate, cu aceeași funcție ca firele din Node.

import { handleWorkRequest, type WorkRequest } from '@evoting/crypto'

// tipurile DOM ale proiectului descriu fereastra, nu un worker; aici e nevoie doar de aceste două
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkRequest>) => void) | null
  postMessage(message: unknown): void
}

scope.onmessage = (event) => scope.postMessage(handleWorkRequest(event.data))
