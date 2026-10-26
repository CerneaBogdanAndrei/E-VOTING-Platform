// Formatele JSON publice. Punctele și scalarii circulă ca hex (32 de octeți),
// exact cum apar pe bulletin board și în API.

export type Hex = string

/** Criptotext ElGamal exponențial: (A, B) = (rG, mG + rY). */
export interface Ciphertext {
  a: Hex
  b: Hex
}

/** Dovadă Chaum-Pedersen (sau Schnorr) neinteractivă: provocarea c și răspunsul s. */
export interface ChaumPedersenProof {
  c: Hex
  s: Hex
}

/** Dovadă disjunctivă că un criptotext conține 0 sau 1: câte o ramură pentru fiecare valoare. */
export interface ZeroOneProof {
  c0: Hex
  c1: Hex
  s0: Hex
  s1: Hex
}

export interface BallotProofs {
  /** Câte o dovadă 0/1 per candidat, în ordinea pozițiilor. */
  choices: ZeroOneProof[]
  /** Suma voturilor este exact 1. */
  sum: ChaumPedersenProof
}

/** Buletinul semnat, așa cum îl trimite aplicația. */
export interface Ballot {
  electionId: string
  /** Cheia publică Ed25519 a credentialului, hex. */
  credentialPubkey: Hex
  ciphertexts: Ciphertext[]
  proofs: BallotProofs
  /** Semnătura Ed25519 peste rezumatul buletinului, hex. */
  signature: Hex
}

/** Parametrii publici de care depinde criptarea și verificarea unui buletin. */
export interface ElectionParams {
  electionId: string
  publicKey: Hex
  candidateCount: number
}

export interface TrusteePublicKey {
  trusteeId: string
  publicKeyShare: Hex
  /** Dovada Schnorr că trustee-ul cunoaște xᵢ pentru Yᵢ = xᵢG. */
  proof: ChaumPedersenProof
}

export interface PartialDecryption {
  trusteeId: string
  /** Dᵢⱼ = xᵢAⱼ, câte unul per candidat. */
  shares: Hex[]
  /** Dovezi Chaum-Pedersen că log_G(Yᵢ) = log_Aⱼ(Dᵢⱼ). */
  proofs: ChaumPedersenProof[]
}

/** Intrare de pe bulletin board. */
export interface BoardEntry {
  seq: number
  /** Codul de urmărire: hash-ul intrării, care include hash-ul celei anterioare. */
  hash: Hex
  prevHash: Hex
  /** Hash-ul buletinului semnat (fără poziția pe board). */
  ballotHash: Hex
  credentialPubkey: Hex
  ciphertexts: Ciphertext[]
  proofs: BallotProofs
  signature: Hex
  receivedAt: string
}
