// Modulele native Kotlin (modules/evoting-nfc și modules/evoting-ocr). Există doar
// într-un development build Android (npx expo run:android); în Expo Go și pe web
// lipsesc, iar ecranele trec pe varianta manuală sau simulată.
import { requireOptionalNativeModule } from 'expo'

interface EvotingNfcModule {
  isSupported(): boolean
  isEnabled(): boolean
  /** Deschide PACE cu CAN-ul, citește DG1 și SOD (fără DG2, poza). Întoarce base64. */
  readDocument(can: string): Promise<{ dg1: string; sod: string }>
  cancel(): void
}

interface EvotingOcrModule {
  /** Recunoaște textul dintr-o imagine (URI local de la cameră). */
  recognizeText(uri: string): Promise<string>
}

export const nfcModule = requireOptionalNativeModule<EvotingNfcModule>('EvotingNfc')
export const ocrModule = requireOptionalNativeModule<EvotingOcrModule>('EvotingOcr')
