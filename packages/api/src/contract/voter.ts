// Alegătorul: înregistrarea cu actul de identitate, autentificarea cu credentialul și chitanța votului.

export type RegistrationMethod = 'ocr' | 'nfc'
export type TrustLevel = 'optic' | 'criptografic'

export interface RegisterOcrInput {
  cnp: string
  credentialPubkey: string
}

export interface RegisterNfcInput {
  /** DG1 și SOD citite de pe cip, base64. Serverul face Passive Authentication. */
  dg1: string
  sod: string
  credentialPubkey: string
}

export interface Registration {
  electionId: string
  credentialPubkey: string
  method: RegistrationMethod
  trustLevel: TrustLevel
  registeredAt: string
  /**
   * Persoana era deja înregistrată (de pe alt telefon) și nu votase: credentialul vechi a fost
   * înlocuit cu acesta. Posibil doar cu același nivel de încredere sau mai mare.
   */
  replacedPrevious?: boolean
}

/** Ce se publică despre înregistrări: doar credentialele, fără nicio legătură cu persoana. */
export type PublicRegistration = Omit<Registration, 'electionId' | 'replacedPrevious'>

export interface AuthChallenge {
  challengeId: string
  nonce: string
  expiresAt: string
}

export interface AuthSession {
  token: string
  expiresAt: string
}

export interface BallotReceipt {
  seq: number
  /** Codul de urmărire = hash-ul intrării de pe board. */
  trackingCode: string
  ballotHash: string
  receivedAt: string
}
