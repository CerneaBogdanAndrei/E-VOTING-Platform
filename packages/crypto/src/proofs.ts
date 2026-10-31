// Dovezile zero-knowledge, toate neinteractive prin Fiat–Shamir.
//
// Toate dovezile sunt în formă compactă (c, z): angajamentele nu se trimit, ci
// se recalculează din ecuația de verificare, apoi se verifică faptul că
// provocarea c e chiar hash-ul enunțului împreună cu angajamentele recalculate.
// Dovada e la fel de sigură, dar de două ori mai scurtă.
//
// Contextul (ce intră în hash pe lângă enunț) leagă dovada de scrutin, de
// credentialul alegătorului și de poziția din buletin. O dovadă copiată în alt
// scrutin, de alt alegător sau pe altă poziție nu mai verifică.

import type { CiphertextPoints } from './elgamal.js'
import { G, gTimes, hashToScalar, mod, mul, mulPublic, pointToHex, randomScalar, scalarFromHex, scalarToHex, type Hex, type Point } from './group.js'

/** Dovadă Schnorr / Chaum–Pedersen compactă. */
export interface CompactProof {
  c: Hex
  z: Hex
}

/** Dovadă disjunctivă: câte o pereche (cⱼ, zⱼ) pentru fiecare valoare permisă. */
export interface DisjunctiveProof {
  c: Hex[]
  z: Hex[]
}

export type ProofContext = (string | number)[]

// ───────────── Schnorr: cunoașterea logaritmului discret ─────────────
// Enunț: știu x astfel încât Y = xG. Folosită de trustees pentru Yᵢ.

export function proveDlog(x: bigint, Y: Point, context: ProofContext): CompactProof {
  const w = randomScalar()
  const t = mul(G, w)
  const c = hashToScalar('evoting/v1/dlog', ...context, pointToHex(Y), pointToHex(t))
  return { c: scalarToHex(c), z: scalarToHex(w + c * x) }
}

export function verifyDlog(Y: Point, proof: CompactProof, context: ProofContext): boolean {
  const c = scalarFromHex(proof.c)
  const z = scalarFromHex(proof.z)
  // t = zG − cY ; dacă dovada e corectă, t = wG.
  const t = mulPublic(G, z).subtract(mulPublic(Y, c))
  return hashToScalar('evoting/v1/dlog', ...context, pointToHex(Y), pointToHex(t)) === c
}

// ───────────── Chaum–Pedersen: egalitatea logaritmilor (DLEQ) ─────────────
// Enunț: log_G(X) = log_H(Y), adică X = xG și Y = xH cu același x.
// Folosită la decriptarea parțială: Yᵢ = xᵢG și Dᵢ = xᵢA.

export function proveDleq(x: bigint, H: Point, X: Point, Y: Point, context: ProofContext): CompactProof {
  const w = randomScalar()
  const a = mul(G, w)
  const b = mul(H, w)
  const c = dleqChallenge(context, H, X, Y, a, b)
  return { c: scalarToHex(c), z: scalarToHex(w + c * x) }
}

export function verifyDleq(H: Point, X: Point, Y: Point, proof: CompactProof, context: ProofContext): boolean {
  const c = scalarFromHex(proof.c)
  const z = scalarFromHex(proof.z)
  const a = mulPublic(G, z).subtract(mulPublic(X, c))
  const b = mulPublic(H, z).subtract(mulPublic(Y, c))
  return dleqChallenge(context, H, X, Y, a, b) === c
}

function dleqChallenge(context: ProofContext, H: Point, X: Point, Y: Point, a: Point, b: Point): bigint {
  return hashToScalar('evoting/v1/dleq', ...context, pointToHex(H), pointToHex(X), pointToHex(Y), pointToHex(a), pointToHex(b))
}

// ───────────── Dovada disjunctivă (Cramer–Damgård–Schoenmakers) ─────────────
// Enunț: (A, B) criptează un m din mulțimea S = {s₀, s₁, …}, fără a spune care.
// Pentru fiecare sⱼ, „(A, B) criptează sⱼ” înseamnă că (A, B − sⱼG) e un tuplu
// Diffie–Hellman față de (G, Y): A = rG și B − sⱼG = rY.
//
// Ramura adevărată se demonstrează normal, celelalte se simulează alegând
// dinainte (cⱼ, zⱼ). Fiat–Shamir impune Σcⱼ = H(…), deci cel mult o ramură
// poate fi „adevărată”: prover-ul nu poate simula toate ramurile.
//
//   S = {0, 1}         dovada „0 sau 1” pentru fiecare candidat
//   S = {min, …, max}  dovada pentru numărul de opțiuni bifate (implicit exact 1)

export function proveOneOf(
  publicKey: Point,
  ct: CiphertextPoints,
  m: number,
  r: bigint,
  allowed: number[],
  context: ProofContext,
): DisjunctiveProof {
  // Un client malițios (m ∉ S) ajunge aici cu o ramură „adevărată” falsă; dovada va pica la verificare.
  const real = Math.max(0, allowed.indexOf(m))
  const n = allowed.length
  const c: bigint[] = new Array(n)
  const z: bigint[] = new Array(n)
  const commitments: Point[] = new Array(2 * n)

  for (let j = 0; j < n; j++) {
    if (j === real) continue
    c[j] = randomScalar()
    z[j] = randomScalar()
    const [a, b] = branchCommitments(publicKey, ct, allowed[j], c[j], z[j])
    commitments[2 * j] = a
    commitments[2 * j + 1] = b
  }
  const w = randomScalar()
  commitments[2 * real] = mul(G, w)
  commitments[2 * real + 1] = mul(publicKey, w)

  const total = disjunctiveChallenge(context, ct, allowed, commitments)
  let others = 0n
  for (let j = 0; j < n; j++) if (j !== real) others += c[j]
  c[real] = mod(total - others)
  z[real] = mod(w + c[real] * r)
  return { c: c.map(scalarToHex), z: z.map(scalarToHex) }
}

export function verifyOneOf(publicKey: Point, ct: CiphertextPoints, proof: DisjunctiveProof, allowed: number[], context: ProofContext): boolean {
  const n = allowed.length
  if (!Array.isArray(proof?.c) || !Array.isArray(proof?.z) || proof.c.length !== n || proof.z.length !== n) return false
  const c = proof.c.map(scalarFromHex)
  const z = proof.z.map(scalarFromHex)
  const commitments: Point[] = []
  for (let j = 0; j < n; j++) commitments.push(...branchCommitments(publicKey, ct, allowed[j], c[j], z[j]))
  const sum = mod(c.reduce((s, x) => s + x, 0n))
  return sum === disjunctiveChallenge(context, ct, allowed, commitments)
}

/** a = zG − cA, b = zY − c(B − sG): angajamentele care fac ecuațiile ramurii adevărate. */
// Toate valorile de aici sunt publice (c și z fac parte din dovadă), deci se poate folosi mulPublic.
function branchCommitments(publicKey: Point, ct: CiphertextPoints, s: number, c: bigint, z: bigint): [Point, Point] {
  const a = mulPublic(G, z).subtract(mulPublic(ct.A, c))
  const b = mulPublic(publicKey, z).subtract(mulPublic(ct.B.subtract(gTimes(s)), c))
  return [a, b]
}

function disjunctiveChallenge(context: ProofContext, ct: CiphertextPoints, allowed: number[], commitments: Point[]): bigint {
  return hashToScalar(
    'evoting/v1/oneof',
    ...context,
    pointToHex(ct.A),
    pointToHex(ct.B),
    allowed.join(','),
    ...commitments.map(pointToHex),
  )
}
