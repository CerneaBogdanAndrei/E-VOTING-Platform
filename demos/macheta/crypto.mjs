// crypto.mjs — criptografia machetei de vot electronic verificabil.
//
//   1. Grupul MODP 2048 (RFC 3526) și aritmetica modulară cu BigInt
//   2. Hash, Fiat–Shamir și HMAC (Web Crypto API)
//   3. Trustees: chei ElGamal + dovadă Schnorr că își cunosc cheia
//   4. ElGamal exponențial, buletinul de vot și dovezile zero-knowledge
//   5. Bulletin board (lanț de hash-uri)
//   6. Numărare homomorfică și decriptare parțială (toți trustees sunt necesari)
//   7. Verificare publică
//   8. Server simulat: înregistrare (doar HMAC pe CNP) și urna electronică
//   9. CNP: validare, generare de date fictive, atacul de dicționar
//
// Rulează identic în browser (context sigur: https sau localhost) și în Node ≥ 19.
// Machetă demonstrativă: matematica este reală, dar implementarea nu este auditată
// și nu rulează în timp constant. Nu folosiți acest cod în producție.

const webcrypto = globalThis.crypto;
if (!webcrypto?.subtle) {
  throw new Error(
    'Web Crypto API nu este disponibil. Deschideți macheta prin http://localhost (context sigur), nu prin adresa IP a calculatorului.'
  );
}
const subtle = webcrypto.subtle;
const utf8 = new TextEncoder();

// ───────────────────────── 1. Grupul și aritmetica ─────────────────────────

// Prima de 2048 de biți din RFC 3526 (grupul 14). p = 2q + 1, cu q prim.
// g = 2 este rest pătratic modulo p, deci generează subgrupul de ordin q.
const P_HEX = `
  FFFFFFFF FFFFFFFF C90FDAA2 2168C234 C4C6628B 80DC1CD1 29024E08 8A67CC74
  020BBEA6 3B139B22 514A0879 8E3404DD EF9519B3 CD3A431B 302B0A6D F25F1437
  4FE1356D 6D51C245 E485B576 625E7EC6 F44C42E9 A637ED6B 0BFF5CB6 F406B7ED
  EE386BFB 5A899FA5 AE9F2411 7C4B1FE6 49286651 ECE45B3D C2007CB8 A163BF05
  98DA4836 1C55D39A 69163FA8 FD24CF5F 83655D23 DCA3AD96 1C62F356 208552BB
  9ED52907 7096966D 670C354E 4ABC9804 F1746C08 CA18217C 32905E46 2E36CE3B
  E39E772C 180E8603 9B2783A2 EC07A28F B5C55DF0 6F4C52C9 DE2BCBF6 95581718
  3995497C EA956AE5 15D22618 98FA0510 15728E5A 8AACAA68 FFFFFFFF FFFFFFFF`;

export const P = BigInt('0x' + P_HEX.replace(/\s+/g, ''));
export const Q = (P - 1n) / 2n;
export const G = 2n;
export const GROUP_INFO = { name: 'MODP 2048 biți (RFC 3526, grupul 14)', bits: 2048, p: P, q: Q, g: G };

export function mod(a, m) {
  const r = a % m;
  return r < 0n ? r + m : r;
}

const HEX_DIGIT = new Uint8Array(128);
for (let i = 0; i < 16; i++) HEX_DIGIT['0123456789abcdef'.charCodeAt(i)] = i;

// Exponențiere modulară cu fereastră fixă de 4 biți.
export function modPow(base, exp, m = P) {
  if (exp < 0n) return modPow(modInv(base, m), -exp, m);
  base = mod(base, m);
  if (exp === 0n) return 1n % m;
  const table = new Array(16);
  table[0] = 1n;
  table[1] = base;
  for (let i = 2; i < 16; i++) table[i] = (table[i - 1] * base) % m;
  const hex = exp.toString(16);
  let r = table[HEX_DIGIT[hex.charCodeAt(0)]];
  for (let i = 1; i < hex.length; i++) {
    r = (r * r) % m;
    r = (r * r) % m;
    r = (r * r) % m;
    r = (r * r) % m;
    const d = HEX_DIGIT[hex.charCodeAt(i)];
    if (d) r = (r * table[d]) % m;
  }
  return r;
}

// Invers modular prin algoritmul lui Euclid extins.
export function modInv(a, m = P) {
  let r0 = m, r1 = mod(a, m), s0 = 0n, s1 = 1n;
  while (r1 !== 0n) {
    const t = r0 / r1;
    [r0, r1] = [r1, r0 - t * r1];
    [s0, s1] = [s1, s0 - t * s1];
  }
  if (r0 !== 1n) throw new Error('Elementul nu este inversabil');
  return mod(s0, m);
}

// Simbolul Jacobi (a/n); pentru n prim este simbolul Legendre.
export function jacobi(a, n) {
  a = mod(a, n);
  let t = 1;
  while (a !== 0n) {
    while ((a & 1n) === 0n) {
      a >>= 1n;
      const r = n & 7n;
      if (r === 3n || r === 5n) t = -t;
    }
    [a, n] = [n, a];
    if ((a & 3n) === 3n && (n & 3n) === 3n) t = -t;
    a %= n;
  }
  return n === 1n ? t : 0;
}

// Fiindcă p este „safe prime”, subgrupul de ordin q este exact mulțimea resturilor pătratice.
export function isGroupElement(x) {
  return typeof x === 'bigint' && x > 0n && x < P && jacobi(x, P) === 1;
}

// Pentru bazele folosite foarte des (g și cheia scrutinului) precalculăm
// baza^(d·16^i): o exponențiere devine ~512 înmulțiri, fără ridicări la pătrat.
class FixedBase {
  constructor(base) {
    this.rows = new Array(512);
    let cur = mod(base, P);
    for (let w = 0; w < 512; w++) {
      const row = new Array(16);
      row[0] = 1n;
      row[1] = cur;
      for (let d = 2; d < 16; d++) row[d] = (row[d - 1] * cur) % P;
      this.rows[w] = row;
      cur = (row[15] * cur) % P; // cur^16
    }
  }
  pow(exp) {
    const hex = exp.toString(16), n = hex.length;
    let r = 1n;
    for (let i = 0; i < n; i++) {
      const d = HEX_DIGIT[hex.charCodeAt(n - 1 - i)];
      if (d) r = (r * this.rows[i][d]) % P;
    }
    return r;
  }
}

const fixedBaseTables = new Map();
const MAX_FIXED_EXP = 1n << 2048n;

export function precompute(base) {
  if (fixedBaseTables.has(base)) return;
  if (fixedBaseTables.size >= 6) {
    for (const k of fixedBaseTables.keys()) {
      if (k !== G) { fixedBaseTables.delete(k); break; }
    }
  }
  fixedBaseTables.set(base, new FixedBase(base));
}

// base^exp mod p, folosind tabela precalculată dacă există.
export function pow(base, exp) {
  if (exp >= 0n && exp < MAX_FIXED_EXP) {
    const table = fixedBaseTables.get(base);
    if (table) return table.pow(exp);
  }
  return modPow(base, exp, P);
}

precompute(G);

// g^m pentru un întreg mic m (poate fi și negativ).
export function gPow(m) {
  const e = BigInt(m);
  return e >= 0n ? pow(G, e) : modInv(pow(G, -e));
}

export function randomBytes(n) {
  const bytes = new Uint8Array(n);
  webcrypto.getRandomValues(bytes);
  return bytes;
}

export function bytesToHex(bytes) {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

// Întreg uniform în [1, n).
export function randomBelow(n) {
  const bits = n.toString(2).length;
  const bytes = Math.ceil(bits / 8);
  const excess = BigInt(bytes * 8 - bits);
  for (;;) {
    const x = BigInt('0x' + bytesToHex(randomBytes(bytes))) >> excess;
    if (x > 0n && x < n) return x;
  }
}

export const randomExponent = () => randomBelow(Q);

// Întreg uniform în [0, n), pentru n mic.
export function randomInt(n) {
  const limit = Math.floor(0x100000000 / n) * n;
  const u = new Uint32Array(1);
  do webcrypto.getRandomValues(u); while (u[0] >= limit);
  return u[0] % n;
}

// ───────────────────────── 2. Hash, Fiat–Shamir, HMAC ─────────────────────────

export async function sha256Hex(text) {
  return bytesToHex(new Uint8Array(await subtle.digest('SHA-256', utf8.encode(text))));
}

function encodePart(x) {
  if (typeof x === 'bigint') return x.toString(16);
  if (typeof x === 'number' || typeof x === 'string') return String(x);
  if (Array.isArray(x)) return '[' + x.map(encodePart).join(',') + ']';
  throw new TypeError('Valoare care nu poate fi serializată: ' + typeof x);
}

export const serialize = (...parts) => parts.map(encodePart).join('|');

// Fiat–Shamir: provocarea verificatorului este înlocuită cu SHA-256 al întregului enunț.
export async function challenge(...parts) {
  return mod(BigInt('0x' + (await sha256Hex(serialize(...parts)))), Q);
}

export function generateHmacKey() {
  return subtle.generateKey({ name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
}

export function importHmacKey(raw) {
  return subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function hmacHex(key, text) {
  return bytesToHex(new Uint8Array(await subtle.sign('HMAC', key, utf8.encode(text))));
}

const pass = (extra = {}) => ({ ok: true, ...extra });
const fail = (why) => ({ ok: false, why });

async function guard(fn) {
  try {
    return await fn();
  } catch {
    return fail('date lipsă sau în format greșit');
  }
}

// ───────────────────────── 3. Trustees ─────────────────────────

// Fiecare trustee: cheie secretă x, cheie publică h = g^x și o dovadă Schnorr
// (neinteractivă) că știe x — fără să-l dezvăluie.
export async function createTrustee(name) {
  const sk = randomExponent();
  const pk = pow(G, sk);
  const w = randomExponent();
  const t = pow(G, w);
  const c = await challenge('pok', name, pk, t);
  return { name, sk, pk, pok: { t, c, s: mod(w + c * sk, Q) } };
}

export async function verifyTrusteeKey({ name, pk, pok }) {
  return guard(async () => {
    if (!isGroupElement(pk)) return fail('cheia publică nu aparține grupului');
    const c = await challenge('pok', name, pk, pok.t);
    if (c !== pok.c) return fail('provocarea Fiat–Shamir nu corespunde');
    if (pow(G, pok.s) !== (pok.t * modPow(pk, c)) % P) return fail('ecuația gˢ = t·hᶜ nu se verifică');
    return pass();
  });
}

export const combinePublicKeys = (pks) => pks.reduce((acc, pk) => (acc * pk) % P, 1n);

// Creează scrutinul: datele publice (`election`) și trustees cu cheile lor secrete.
export async function createElection(candidates, trusteeNames = ['Trustee 1', 'Trustee 2', 'Trustee 3']) {
  const trustees = [];
  for (const name of trusteeNames) trustees.push(await createTrustee(name));
  const pk = combinePublicKeys(trustees.map((t) => t.pk));
  precompute(pk);
  const id = await sha256Hex(
    JSON.stringify({ group: 'RFC3526-MODP-2048', candidates, trustees: trustees.map((t) => t.pk.toString(16)) })
  );
  const election = {
    id,
    candidates: [...candidates],
    pk,
    trustees: trustees.map(({ name, pk, pok }) => ({ name, pk, pok })),
  };
  return { election, trustees };
}

// ───────────────────────── 4. ElGamal exponențial și buletinul ─────────────────────────

// Enc(m; r) = (α, β) = (gʳ, gᵐ·hʳ). Înmulțind criptotexte, mesajele se adună în exponent.
export function encrypt(pk, m, r = randomExponent()) {
  return { alpha: pow(G, r), beta: (gPow(m) * pow(pk, r)) % P };
}

export function multiplyCiphertexts(cts) {
  let alpha = 1n, beta = 1n;
  for (const ct of cts) {
    alpha = (alpha * ct.alpha) % P;
    beta = (beta * ct.beta) % P;
  }
  return { alpha, beta };
}

// Dovadă disjunctivă Chaum–Pedersen (Cramer–Damgård–Schoenmakers):
// „(α, β) criptează 0 SAU criptează 1”, fără a spune care.
// Ramura adevărată se demonstrează normal, cealaltă se simulează; Fiat–Shamir
// impune c₀ + c₁ = H(…), deci doar o ramură poate fi simulată.
async function proveBit(election, index, ct, m, r) {
  const { pk, id } = election;
  const { alpha, beta } = ct;
  const real = Number(m) >= 1 ? 1 : 0; // la un client malițios (m ∉ {0,1}) dovada va pica
  const fake = 1 - real;
  const branches = [{}, {}];

  const cF = randomExponent(), zF = randomExponent();
  const betaF = (beta * gPow(-fake)) % P;
  branches[fake] = {
    a: (pow(G, zF) * modInv(modPow(alpha, cF))) % P,
    b: (pow(pk, zF) * modInv(modPow(betaF, cF))) % P,
    c: cF,
    z: zF,
  };

  const w = randomExponent();
  branches[real] = { a: pow(G, w), b: pow(pk, w) };

  const c = await challenge('bit', id, index, alpha, beta, branches[0].a, branches[0].b, branches[1].a, branches[1].b);
  const cR = mod(c - cF, Q);
  branches[real].c = cR;
  branches[real].z = mod(w + cR * r, Q);
  return branches.map(({ a, b, c, z }) => ({ a, b, c, z }));
}

async function verifyBit(election, index, ct, proof) {
  const { alpha, beta } = ct;
  if (!isGroupElement(alpha) || !isGroupElement(beta)) return fail('criptotextul nu aparține grupului');
  if (!Array.isArray(proof) || proof.length !== 2) return fail('dovada lipsește');
  const c = await challenge('bit', election.id, index, alpha, beta, proof[0].a, proof[0].b, proof[1].a, proof[1].b);
  if (mod(proof[0].c + proof[1].c, Q) !== c) return fail('c₀ + c₁ ≠ H(…): provocările nu mai corespund criptotextului');
  for (const j of [0, 1]) {
    const { a, b, c: cj, z } = proof[j];
    if (pow(G, z) !== (a * modPow(alpha, cj)) % P) return fail(`ramura „${j}”: gᶻ ≠ a·αᶜ`);
    const betaJ = (beta * gPow(-j)) % P;
    if (pow(election.pk, z) !== (b * modPow(betaJ, cj)) % P) return fail(`ramura „${j}”: hᶻ ≠ b·(β/g^${j})ᶜ`);
  }
  return pass();
}

// Dovadă Chaum–Pedersen că produsul criptotextelor criptează exact 1:
// (A, B/g) = (g^R, h^R) cu R = Σ rᵢ.
async function proveSum(election, cts, rs) {
  const { alpha: A, beta: B } = multiplyCiphertexts(cts);
  const R = mod(rs.reduce((s, r) => s + r, 0n), Q);
  const w = randomExponent();
  const a = pow(G, w), b = pow(election.pk, w);
  const c = await challenge('sum', election.id, A, B, a, b);
  return { a, b, c, z: mod(w + c * R, Q) };
}

async function verifySum(election, cts, proof) {
  const { alpha: A, beta: B } = multiplyCiphertexts(cts);
  if (!isGroupElement(A) || !isGroupElement(B)) return fail('produsul criptotextelor nu aparține grupului');
  const c = await challenge('sum', election.id, A, B, proof.a, proof.b);
  if (c !== proof.c) return fail('H(…) ≠ c: provocarea nu mai corespunde criptotextelor');
  if (pow(G, proof.z) !== (proof.a * modPow(A, c)) % P) return fail('gᶻ ≠ a·Aᶜ');
  if (pow(election.pk, proof.z) !== (proof.b * modPow((B * gPow(-1)) % P, c)) % P) {
    return fail('hᶻ ≠ b·(B/g)ᶜ: suma voturilor nu este 1');
  }
  return pass();
}

// Codul de urmărire = SHA-256 al întregului buletin (criptotexte + dovezi).
export async function ballotHash(ballot) {
  const parts = ['ballot', ballot.electionId];
  ballot.ciphertexts.forEach((ct, i) => {
    parts.push(ct.alpha, ct.beta);
    for (const br of ballot.proofs[i]) parts.push(br.a, br.b, br.c, br.z);
  });
  const s = ballot.sumProof;
  parts.push(s.a, s.b, s.c, s.z);
  return sha256Hex(serialize(...parts));
}

// Criptează un vector de valori (câte una per candidat) și construiește dovezile.
// Un client corect trimite doar 0/1 cu exact un 1; pentru alte valori (atac)
// dovezile se construiesc „cum se poate” și vor pica la verificare.
export async function encryptVector(election, plaintexts) {
  const randomness = plaintexts.map(() => randomExponent());
  const ciphertexts = plaintexts.map((m, i) => encrypt(election.pk, m, randomness[i]));
  const proofs = [];
  for (let i = 0; i < ciphertexts.length; i++) {
    proofs.push(await proveBit(election, i, ciphertexts[i], plaintexts[i], randomness[i]));
  }
  const sumProof = await proveSum(election, ciphertexts, randomness);
  const ballot = { electionId: election.id, ciphertexts, proofs, sumProof };
  return { ballot, trackingCode: await ballotHash(ballot), plaintexts: [...plaintexts], randomness };
}

export function encryptBallot(election, choice) {
  return encryptVector(election, election.candidates.map((_, i) => (i === choice ? 1 : 0)));
}

export async function verifyBallot(election, ballot) {
  const k = election.candidates.length;
  const result = { ok: false, structure: null, candidates: [], sum: null };
  if (ballot?.electionId !== election.id) {
    result.structure = 'buletinul aparține altui scrutin';
    return result;
  }
  if (ballot.ciphertexts?.length !== k || ballot.proofs?.length !== k || !ballot.sumProof) {
    result.structure = `buletinul trebuie să conțină ${k} criptotexte, ${k} dovezi și dovada sumei`;
    return result;
  }
  for (let i = 0; i < k; i++) {
    result.candidates.push(await guard(() => verifyBit(election, i, ballot.ciphertexts[i], ballot.proofs[i])));
  }
  result.sum = await guard(() => verifySum(election, ballot.ciphertexts, ballot.sumProof));
  result.ok = result.candidates.every((r) => r.ok) && result.sum.ok;
  return result;
}

// ───────────────────────── 5. Bulletin board ─────────────────────────

export const GENESIS_HASH = '0'.repeat(64);

function entryHashOf(electionId, { index, prevHash, trackingCode, time }) {
  return sha256Hex(serialize('entry', electionId, index, prevHash, trackingCode, time));
}

export const normalizeCode = (text) => String(text).toLowerCase().replace(/[^0-9a-f]/g, '');

export class BulletinBoard {
  constructor(electionId) {
    this.electionId = electionId;
    this.entries = [];
  }

  get head() {
    return this.entries.length ? this.entries[this.entries.length - 1].entryHash : GENESIS_HASH;
  }

  async append(ballot, trackingCode) {
    const entry = {
      index: this.entries.length + 1,
      time: new Date().toISOString(),
      prevHash: this.head,
      trackingCode: trackingCode ?? (await ballotHash(ballot)),
      ballot,
    };
    entry.entryHash = await entryHashOf(this.electionId, entry);
    this.entries.push(entry);
    return entry;
  }

  // Căutare după codul de urmărire (sau un prefix de cel puțin 4 caractere hex).
  find(code) {
    const prefix = normalizeCode(code);
    if (prefix.length < 4) return [];
    return this.entries.filter((e) => e.trackingCode.startsWith(prefix));
  }
}

// ───────────────────────── 6. Numărare ─────────────────────────

// Agregatul homomorfic: pentru fiecare candidat, produsul tuturor criptotextelor
// = Enc(numărul total de voturi), fără a decripta vreun buletin.
export function computeAggregate(election, entries) {
  return election.candidates.map((_, i) => multiplyCiphertexts(entries.map((e) => e.ballot.ciphertexts[i])));
}

// Decriptare parțială: dᵢ = α^xᵢ, plus o dovadă Chaum–Pedersen că log_g(hᵢ) = log_α(dᵢ),
// adică trustee-ul a folosit exact cheia sa (nu a trișat).
export async function partialDecrypt(election, trustee, aggregate) {
  const shares = [];
  for (const [i, ct] of aggregate.entries()) {
    const d = modPow(ct.alpha, trustee.sk);
    const w = randomExponent();
    const a = pow(G, w), b = modPow(ct.alpha, w);
    const c = await challenge('dec', election.id, i, trustee.pk, ct.alpha, d, a, b);
    shares.push({ d, proof: { a, b, c, z: mod(w + c * trustee.sk, Q) } });
  }
  return { trustee: trustee.name, pk: trustee.pk, shares };
}

export async function verifyPartialDecryption(election, trusteePublic, aggregate, partial) {
  const problems = [];
  if (!partial || partial.pk !== trusteePublic.pk || partial.shares?.length !== aggregate.length) {
    return { ok: false, problems: [{ text: `${trusteePublic.name}: decriptarea parțială lipsește sau e incompletă` }] };
  }
  for (const [i, ct] of aggregate.entries()) {
    const r = await guard(async () => {
      const { d, proof } = partial.shares[i];
      if (!isGroupElement(d)) return fail('valoarea parțială nu aparține grupului');
      const c = await challenge('dec', election.id, i, trusteePublic.pk, ct.alpha, d, proof.a, proof.b);
      if (c !== proof.c) return fail('provocarea Fiat–Shamir nu corespunde');
      if (pow(G, proof.z) !== (proof.a * modPow(trusteePublic.pk, c)) % P) return fail('gᶻ ≠ a·hᵢᶜ');
      if (modPow(ct.alpha, proof.z) !== (proof.b * modPow(d, c)) % P) return fail('αᶻ ≠ b·dᶜ');
      return pass();
    });
    if (!r.ok) problems.push({ candidate: i, text: `${trusteePublic.name}, ${election.candidates[i]}: ${r.why}` });
  }
  return { ok: problems.length === 0, problems };
}

// Logaritm discret mic: căutăm m cu gᵐ = țintă, încercând m = 0, 1, 2, …
export function discreteLogSmall(target, max) {
  let cur = 1n;
  for (let m = 0; m <= max; m++) {
    if (cur === target) return m;
    cur = (cur * G) % P;
  }
  return null;
}

// Până unde căutăm m: buletine × candidați acoperă și un agregat manipulat.
export const searchLimit = ({ ballots, aggregate }) => ballots * aggregate.length;

// Combinarea: gᵐ = β / (d₁·d₂·…). Cu o parte lipsă rezultatul rămâne ascuns (null).
export function combineDecryption(aggregate, partials, maxCount) {
  return aggregate.map((ct, i) => {
    const D = partials.reduce((acc, p) => (acc * p.shares[i].d) % P, 1n);
    return discreteLogSmall((ct.beta * modInv(D)) % P, maxCount);
  });
}

// ───────────────────────── 7. Verificare publică ─────────────────────────
// Fiecare funcție folosește doar date publice și întoarce { ok, problems: [{ index?, candidate?, text }] }.

export async function verifyElectionKeys(election) {
  const problems = [];
  for (const t of election.trustees) {
    const r = await verifyTrusteeKey(t);
    if (!r.ok) problems.push({ text: `${t.name}: ${r.why}` });
  }
  if (combinePublicKeys(election.trustees.map((t) => t.pk)) !== election.pk) {
    problems.push({ text: 'cheia scrutinului nu este produsul cheilor publice ale trustees' });
  }
  return { ok: problems.length === 0, problems };
}

export async function verifyChain(electionId, entries, { onProgress } = {}) {
  const problems = [];
  let prev = GENESIS_HASH;
  for (const [i, e] of entries.entries()) {
    const where = `Buletinul #${e.index}`;
    if (e.index !== i + 1) problems.push({ index: e.index, text: `${where}: poziția nu corespunde ordinii din lanț` });
    if (e.prevHash !== prev) {
      problems.push({ index: e.index, text: `${where}: legătura cu intrarea anterioară este ruptă (hash anterior greșit)` });
    }
    const code = await ballotHash(e.ballot).catch(() => null);
    if (code !== e.trackingCode) {
      problems.push({
        index: e.index,
        text: `${where}: conținutul a fost modificat — hash-ul recalculat (${code ? code.slice(0, 8) + '…' : 'imposibil'}) ≠ codul de urmărire publicat (${e.trackingCode.slice(0, 8)}…)`,
      });
    }
    if ((await entryHashOf(electionId, e)) !== e.entryHash) {
      problems.push({ index: e.index, text: `${where}: hash-ul intrării nu corespunde datelor ei` });
    }
    prev = e.entryHash;
    await onProgress?.(i + 1, entries.length);
  }
  return { ok: problems.length === 0, problems, head: prev };
}

export async function verifyBallots(election, entries, { onProgress } = {}) {
  const problems = [];
  let proofs = 0;
  for (const [i, e] of entries.entries()) {
    const r = await verifyBallot(election, e.ballot);
    const where = `Buletinul #${e.index}`;
    if (r.structure) problems.push({ index: e.index, text: `${where}: ${r.structure}` });
    r.candidates.forEach((c, k) => {
      proofs++;
      if (!c.ok) problems.push({ index: e.index, candidate: k, text: `${where}, ${election.candidates[k]}: dovada „0 sau 1” pică (${c.why})` });
    });
    if (r.sum) {
      proofs++;
      if (!r.sum.ok) problems.push({ index: e.index, text: `${where}: dovada „exact un vot” pică (${r.sum.why})` });
    }
    await onProgress?.(i + 1, entries.length);
  }
  return { ok: problems.length === 0, problems, proofs };
}

export function verifyAggregate(election, entries, tally) {
  const problems = [];
  if (tally.ballots !== entries.length) {
    problems.push({ text: `numărarea a inclus ${tally.ballots} buletine, dar board-ul are ${entries.length}` });
  }
  const recomputed = computeAggregate(election, entries);
  recomputed.forEach((ct, i) => {
    const pub = tally.aggregate[i];
    if (ct.alpha !== pub.alpha || ct.beta !== pub.beta) {
      problems.push({ candidate: i, text: `${election.candidates[i]}: agregatul recalculat din board ≠ agregatul folosit la numărare` });
    }
  });
  return { ok: problems.length === 0, problems, recomputed };
}

export async function verifyDecryption(election, tally) {
  const problems = [];
  for (const [t, trustee] of election.trustees.entries()) {
    const r = await verifyPartialDecryption(election, trustee, tally.aggregate, tally.partials[t]);
    problems.push(...r.problems);
  }
  if (problems.length === 0) {
    const counts = combineDecryption(tally.aggregate, tally.partials, searchLimit(tally));
    counts.forEach((n, i) => {
      if (n !== tally.counts?.[i]) {
        problems.push({ candidate: i, text: `${election.candidates[i]}: rezultatul publicat (${tally.counts?.[i]}) ≠ rezultatul decriptat (${n ?? 'negăsit'})` });
      }
    });
    const total = counts.reduce((s, n) => s + (n ?? 0), 0);
    if (total !== tally.ballots) problems.push({ text: `suma voturilor (${total}) ≠ numărul de buletine (${tally.ballots})` });
  }
  return { ok: problems.length === 0, problems };
}

export async function verifyEverything({ election, entries, tally }) {
  const keys = await verifyElectionKeys(election);
  const chain = await verifyChain(election.id, entries);
  const ballots = await verifyBallots(election, entries);
  const aggregate = tally ? verifyAggregate(election, entries, tally) : null;
  const decryption = tally ? await verifyDecryption(election, tally) : null;
  const ok = [keys, chain, ballots, aggregate, decryption].every((r) => r === null || r.ok);
  return { ok, keys, chain, ballots, aggregate, decryption };
}

// ───────────────────────── 8. Server simulat ─────────────────────────

export const ID_METHODS = {
  ocr: { label: 'Scanare buletin (OCR)', trust: 'optic' },
  nfc: { label: 'Citire NFC (CEI)', trust: 'criptografic' },
};

export class SimulatedServer {
  #key; // cheia HMAC: generată ne-exportabilă, ca într-un modul hardware (HSM)
  #pending = new Set();

  static async create() {
    const server = new SimulatedServer();
    server.#key = await generateHmacKey();
    return server;
  }

  constructor() {
    this.voters = new Map(); // HMAC(CNP) → { id, method, trust, registeredAt, voted }
    this.election = null;
    this.board = null;
  }

  startElection(election) {
    this.election = election;
    this.board = new BulletinBoard(election.id);
    for (const v of this.voters.values()) v.voted = false;
  }

  // Singura „amprentă” a CNP-ului care ajunge în baza de date.
  fingerprint(cnp) {
    return hmacHex(this.#key, cnp);
  }

  async register(cnp, method) {
    const check = validateCnp(cnp);
    if (!check.ok) return { ok: false, code: 'invalid-cnp', reason: `CNP invalid: ${check.why}` };
    if (!ID_METHODS[method]) return { ok: false, code: 'invalid-method', reason: 'metodă de identificare necunoscută' };
    const id = await this.fingerprint(cnp);
    if (this.voters.has(id)) {
      return { ok: false, code: 'duplicate', id, reason: 'acest CNP este deja înregistrat (HMAC-ul există deja în baza de date)' };
    }
    const record = { id, method, trust: ID_METHODS[method].trust, registeredAt: new Date().toISOString(), voted: false };
    this.voters.set(id, record);
    return { ok: true, id, record };
  }

  async castBallot(voterId, ballot) {
    if (!this.election) return { ok: false, code: 'no-election', reason: 'scrutinul nu a fost configurat' };
    const voter = this.voters.get(voterId);
    if (!voter) return { ok: false, code: 'not-registered', reason: 'alegătorul nu este înregistrat' };
    if (voter.voted || this.#pending.has(voterId)) {
      return { ok: false, code: 'double-vote', reason: 'acest alegător a votat deja' };
    }
    this.#pending.add(voterId);
    try {
      const verification = await verifyBallot(this.election, ballot);
      if (!verification.ok) {
        return { ok: false, code: 'invalid-proof', reason: 'dovezile zero-knowledge nu se verifică', verification };
      }
      const trackingCode = await ballotHash(ballot);
      if (this.board.entries.some((e) => e.trackingCode === trackingCode)) {
        return { ok: false, code: 'replay', reason: 'buletinul este o copie a unuia deja publicat' };
      }
      const entry = await this.board.append(ballot, trackingCode);
      voter.voted = true;
      return { ok: true, entry, verification };
    } finally {
      this.#pending.delete(voterId);
    }
  }
}

// Atacul de pe board: înmulțește β cu g pentru un candidat (= +1 vot pentru el),
// fără a recalcula hash-urile sau dovezile. Întoarce funcția de restaurare.
export function tamperAddVote(entry, candidateIndex) {
  const ct = entry.ballot.ciphertexts[candidateIndex];
  const original = ct.beta;
  ct.beta = (ct.beta * G) % P;
  return () => {
    ct.beta = original;
  };
}

// ───────────────────────── 9. CNP ─────────────────────────

export const COUNTIES = {
  '01': 'Alba', '02': 'Arad', '03': 'Argeș', '04': 'Bacău', '05': 'Bihor', '06': 'Bistrița-Năsăud',
  '07': 'Botoșani', '08': 'Brașov', '09': 'Brăila', '10': 'Buzău', '11': 'Caraș-Severin', '12': 'Cluj',
  '13': 'Constanța', '14': 'Covasna', '15': 'Dâmbovița', '16': 'Dolj', '17': 'Galați', '18': 'Gorj',
  '19': 'Harghita', '20': 'Hunedoara', '21': 'Ialomița', '22': 'Iași', '23': 'Ilfov', '24': 'Maramureș',
  '25': 'Mehedinți', '26': 'Mureș', '27': 'Neamț', '28': 'Olt', '29': 'Prahova', '30': 'Satu Mare',
  '31': 'Sălaj', '32': 'Sibiu', '33': 'Suceava', '34': 'Teleorman', '35': 'Timiș', '36': 'Tulcea',
  '37': 'Vaslui', '38': 'Vâlcea', '39': 'Vrancea', '40': 'București', '41': 'București S1',
  '42': 'București S2', '43': 'București S3', '44': 'București S4', '45': 'București S5',
  '46': 'București S6', '51': 'Călărași', '52': 'Giurgiu',
};
const COUNTY_CODES = Object.keys(COUNTIES);
const CNP_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
const CENTURY = { 1: 1900, 2: 1900, 3: 1800, 4: 1800, 5: 2000, 6: 2000, 7: 1900, 8: 1900 };

export function cnpControlDigit(first12) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(first12[i]) * CNP_WEIGHTS[i];
  const r = s % 11;
  return r === 10 ? 1 : r;
}

export function validateCnp(cnp) {
  cnp = String(cnp ?? '');
  if (!/^\d{13}$/.test(cnp)) return fail('trebuie să aibă exact 13 cifre');
  const s = Number(cnp[0]);
  if (!CENTURY[s]) return fail('prima cifră (sex și secol) trebuie să fie între 1 și 8');
  const year = CENTURY[s] + Number(cnp.slice(1, 3));
  const month = Number(cnp.slice(3, 5)), day = Number(cnp.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return fail('data nașterii nu există');
  }
  const county = COUNTIES[cnp.slice(7, 9)];
  if (!county) return fail('codul de județ nu există');
  if (cnp.slice(9, 12) === '000') return fail('numărul de ordine nu poate fi 000');
  if (cnpControlDigit(cnp) !== Number(cnp[12])) return fail('cifra de control nu corespunde');
  return pass({
    sex: s % 2 === 1 ? 'M' : 'F',
    birthDate: `${year}-${cnp.slice(3, 5)}-${cnp.slice(5, 7)}`,
    county,
  });
}

function sexDigitsForYear(year) {
  if (year >= 2000) return ['5', '6'];
  if (year >= 1900) return ['1', '2'];
  return ['3', '4'];
}

function cnpFromParts(sexDigit, birthDate, county, serial) {
  const [y, m, d] = birthDate.split('-');
  const first12 = sexDigit + y.slice(2) + m + d + county + String(serial).padStart(3, '0');
  return first12 + cnpControlDigit(first12);
}

export function randomBirthDate(fromYear = 1950, toYear = 2006) {
  const start = Date.UTC(fromYear, 0, 1), end = Date.UTC(toYear, 11, 31);
  const days = Math.floor((end - start) / 86400000);
  return new Date(start + randomInt(days + 1) * 86400000).toISOString().slice(0, 10);
}

// CNP fictiv, valid ca format (inclusiv cifra de control).
export function randomCnp({ birthDate = randomBirthDate(), sex } = {}) {
  const [male, female] = sexDigitsForYear(Number(birthDate.slice(0, 4)));
  const sexDigit = sex === 'M' ? male : sex === 'F' ? female : randomInt(2) ? male : female;
  return cnpFromParts(sexDigit, birthDate, COUNTY_CODES[randomInt(COUNTY_CODES.length)], 1 + randomInt(999));
}

// Toate CNP-urile posibile pentru o dată de naștere: 2 (sex) × 48 (județ) × 999 (nr. ordine).
// Cifra de control nu adaugă nimic: se calculează din celelalte 12.
export function cnpSearchSpace(birthDate) {
  const list = [];
  for (const sexDigit of sexDigitsForYear(Number(birthDate.slice(0, 4)))) {
    for (const county of COUNTY_CODES) {
      for (let serial = 1; serial <= 999; serial++) list.push(cnpFromParts(sexDigit, birthDate, county, serial));
    }
  }
  return list;
}

// Atac de dicționar: calculează hashFn pentru fiecare candidat și caută ținta.
export async function dictionaryAttack(targetHex, candidates, hashFn, { batchSize = 2000, onProgress } = {}) {
  const t0 = performance.now();
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const hashes = await Promise.all(batch.map(hashFn));
    const j = hashes.indexOf(targetHex);
    if (j >= 0) return { found: batch[j], tried: i + j + 1, total: candidates.length, ms: performance.now() - t0 };
    await onProgress?.(Math.min(i + batchSize, candidates.length), candidates.length);
  }
  return { found: null, tried: candidates.length, total: candidates.length, ms: performance.now() - t0 };
}
