// test.mjs — rulează un scrutin complet cu 20 de alegători și atacurile, folosind doar crypto.mjs.
// Utilizare: node test.mjs   (Node ≥ 19)

import assert from 'node:assert/strict';
import { checkPrimeSync, getDiffieHellman } from 'node:crypto';
import * as C from './crypto.mjs';

let passed = 0, failed = 0;

async function test(name, fn) {
  const t0 = performance.now();
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}  (${Math.round(performance.now() - t0)} ms)`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}\n      ${String(err?.stack ?? err).split('\n').join('\n      ')}`);
  }
}

const section = (title) => console.log(`\n${title}`);
const CANDIDATES = ['Elena Marinescu', 'Victor Constantinescu', 'Ioana Dragomir'];
const N_VOTERS = 20;

// ───────────── Parametri ─────────────
section('Parametrii grupului');

await test('p este prima MODP-2048 din RFC 3526 (identică cu „modp14” din Node/OpenSSL)', () => {
  assert.equal(C.P.toString(16), getDiffieHellman('modp14').getPrime('hex'));
  assert.equal(C.P.toString(2).length, 2048);
});

await test('p și q = (p−1)/2 sunt prime, iar g = 2 are ordinul q', () => {
  assert.ok(checkPrimeSync(C.P));
  assert.ok(checkPrimeSync(C.Q));
  assert.equal(C.modPow(C.G, C.Q), 1n);
  assert.ok(C.isGroupElement(C.G));
  assert.ok(!C.isGroupElement(C.P - 1n), '−1 nu este în subgrupul de ordin q');
});

await test('aritmetică: tabela pentru bază fixă = exponențiere generică; invers modular', () => {
  for (let i = 0; i < 3; i++) {
    const e = C.randomExponent();
    assert.equal(C.pow(C.G, e), C.modPow(C.G, e));
  }
  const x = C.randomBelow(C.P);
  assert.equal((x * C.modInv(x)) % C.P, 1n);
  assert.equal(C.gPow(-3), C.modInv(C.modPow(C.G, 3n)));
});

// ───────────── ElGamal ─────────────
section('ElGamal exponențial cu 3 trustees');

await test('criptare + adunare homomorfică + decriptare cu toți cei 3 trustees', async () => {
  const { election, trustees } = await C.createElection(['X']);
  const cts = [1, 0, 1, 1, 0].map((m) => C.encrypt(election.pk, m));
  const agg = [C.multiplyCiphertexts(cts)];
  const partials = [];
  for (const t of trustees) partials.push(await C.partialDecrypt(election, t, agg));
  assert.deepEqual(C.combineDecryption(agg, partials, 10), [3]);
});

// ───────────── Scrutin complet ─────────────
section(`Scrutin complet cu ${N_VOTERS} de alegători`);

const { election, trustees } = await C.createElection(CANDIDATES);
const server = await C.SimulatedServer.create();
server.startElection(election);
const cnps = [];
const voterIds = [];
const expected = CANDIDATES.map(() => 0);
const receipts = [];
let tally;

await test('configurare: dovezile Schnorr ale trustees trec, cheia scrutinului = h₁·h₂·h₃', async () => {
  assert.equal(election.trustees.length, 3);
  const r = await C.verifyElectionKeys(election);
  assert.ok(r.ok, JSON.stringify(r.problems));
  assert.equal(election.pk, (trustees[0].pk * trustees[1].pk * trustees[2].pk) % C.P);
  assert.ok(!('sk' in election.trustees[0]), 'datele publice nu conțin chei secrete');
});

await test(`înregistrare: ${N_VOTERS} de CNP-uri fictive valide; serverul păstrează doar HMAC-ul`, async () => {
  while (cnps.length < N_VOTERS) {
    const cnp = C.randomCnp();
    if (!cnps.includes(cnp)) cnps.push(cnp);
  }
  for (const [i, cnp] of cnps.entries()) {
    assert.ok(C.validateCnp(cnp).ok, `CNP invalid generat: ${cnp}`);
    const r = await server.register(cnp, i % 2 ? 'nfc' : 'ocr');
    assert.ok(r.ok, r.reason);
    assert.match(r.id, /^[0-9a-f]{64}$/);
    assert.equal(r.id, await server.fingerprint(cnp));
    voterIds.push(r.id);
  }
  const stored = JSON.stringify([...server.voters.entries()]);
  for (const cnp of cnps) assert.ok(!stored.includes(cnp), 'CNP-ul nu trebuie să apară în baza de date');
  assert.equal(server.voters.get(voterIds[0]).trust, 'optic');
  assert.equal(server.voters.get(voterIds[1]).trust, 'criptografic');
});

await test('același CNP a doua oară este respins; un CNP greșit este respins', async () => {
  const again = await server.register(cnps[0], 'nfc');
  assert.equal(again.ok, false);
  assert.equal(again.code, 'duplicate');
  const bad = cnps[1].slice(0, 12) + ((Number(cnps[1][12]) + 1) % 10);
  assert.equal((await server.register(bad, 'ocr')).code, 'invalid-cnp');
  assert.equal(server.voters.size, N_VOTERS);
});

await test(`${N_VOTERS} de voturi aleatoare: dovezi ZK verificate de server, lanț de hash-uri`, async () => {
  for (const id of voterIds) {
    const choice = C.randomInt(CANDIDATES.length);
    expected[choice]++;
    const { ballot, trackingCode } = await C.encryptBallot(election, choice);
    const r = await server.castBallot(id, ballot);
    assert.ok(r.ok, r.reason);
    assert.equal(r.entry.trackingCode, trackingCode);
    receipts.push(trackingCode);
  }
  const entries = server.board.entries;
  assert.equal(entries.length, N_VOTERS);
  assert.equal(entries[0].prevHash, C.GENESIS_HASH);
  for (let i = 1; i < entries.length; i++) assert.equal(entries[i].prevHash, entries[i - 1].entryHash);
  console.log(`      voturi așteptate: ${CANDIDATES.map((c, i) => `${c} = ${expected[i]}`).join(', ')}`);
});

await test('codul de urmărire (complet sau prefix de 16 caractere) găsește buletinul pe board', () => {
  for (const [i, code] of receipts.entries()) {
    const found = server.board.find(code.slice(0, 16).toUpperCase().replace(/(.{4})(?!$)/g, '$1-'));
    assert.equal(found.length, 1);
    assert.equal(found[0].index, i + 1);
  }
  assert.equal(server.board.find('ffff'.repeat(16)).length, 0);
});

await test('cu doar 2 din 3 trustees rezultatul nu poate fi aflat', async () => {
  const agg = C.computeAggregate(election, server.board.entries);
  const partials = [];
  for (const t of trustees.slice(0, 2)) partials.push(await C.partialDecrypt(election, t, agg));
  assert.deepEqual(C.combineDecryption(agg, partials, N_VOTERS * CANDIDATES.length), CANDIDATES.map(() => null));
});

await test('numărare homomorfică + 3 decriptări parțiale = numărătoarea reală', async () => {
  const entries = server.board.entries;
  const aggregate = C.computeAggregate(election, entries);
  const partials = [];
  for (const [i, t] of trustees.entries()) {
    const p = await C.partialDecrypt(election, t, aggregate);
    const v = await C.verifyPartialDecryption(election, election.trustees[i], aggregate, p);
    assert.ok(v.ok, JSON.stringify(v.problems));
    partials.push(p);
  }
  const counts = C.combineDecryption(aggregate, partials, entries.length * CANDIDATES.length);
  assert.deepEqual(counts, expected);
  tally = { ballots: entries.length, aggregate, partials, counts };
});

await test('verificarea publică trece integral (chei, lanț, dovezi, agregat, decriptare)', async () => {
  const r = await C.verifyEverything({ election, entries: server.board.entries, tally });
  assert.ok(r.ok, JSON.stringify([r.keys, r.chain, r.ballots, r.aggregate, r.decryption].flatMap((x) => x?.problems ?? [])));
  assert.equal(r.ballots.proofs, N_VOTERS * (CANDIDATES.length + 1));
});

// ───────────── Atacuri ─────────────
section('Atacuri');

await test('vot dublu → respins, board-ul rămâne neschimbat', async () => {
  const { ballot } = await C.encryptBallot(election, 0);
  const r = await server.castBallot(voterIds[0], ballot);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'double-vote');
  assert.equal(server.board.entries.length, N_VOTERS);
});

await test('două voturi trimise simultan de același alegător → doar unul e acceptat', async () => {
  const reg = await server.register(C.randomCnp(), 'nfc');
  const [a, b] = await Promise.all([C.encryptBallot(election, 0), C.encryptBallot(election, 1)]);
  const results = await Promise.all([server.castBallot(reg.id, a.ballot), server.castBallot(reg.id, b.ballot)]);
  assert.deepEqual(results.map((r) => r.ok).sort(), [false, true]);
  server.board.entries.pop(); // scoatem buletinul de test, ca numărătoarea să rămână cea de mai sus
});

await test('alegător neînregistrat → respins', async () => {
  const { ballot } = await C.encryptBallot(election, 1);
  assert.equal((await server.castBallot('00'.repeat(32), ballot)).code, 'not-registered');
});

await test('vot invalid (2 voturi pentru un candidat) → dovezile pică, votul e respins', async () => {
  const reg = await server.register(C.randomCnp(), 'ocr');
  const { ballot } = await C.encryptVector(election, [2, 0, 0]);
  const r = await server.castBallot(reg.id, ballot);
  assert.equal(r.code, 'invalid-proof');
  assert.deepEqual(r.verification.candidates.map((c) => c.ok), [false, true, true]);
  assert.equal(r.verification.sum.ok, false);
  assert.equal(server.voters.get(reg.id).voted, false);
  assert.equal(server.board.entries.length, N_VOTERS);
});

await test('vot invalid „viclean” (+2 / −1, suma rămâne 1) → dovada sumei trece, dar dovezile 0/1 pică', async () => {
  const reg = await server.register(C.randomCnp(), 'ocr');
  const { ballot } = await C.encryptVector(election, [2, -1, 0]);
  const r = await server.castBallot(reg.id, ballot);
  assert.equal(r.code, 'invalid-proof');
  assert.deepEqual(r.verification.candidates.map((c) => c.ok), [false, false, true]);
  assert.equal(r.verification.sum.ok, true);
});

await test('buletin copiat de pe board și retrimis de alt alegător → respins', async () => {
  const reg = await server.register(C.randomCnp(), 'nfc');
  assert.equal((await server.castBallot(reg.id, server.board.entries[3].ballot)).code, 'replay');
});

await test('buletin modificat pe board după numărare → verificarea pică exact la #7; după restaurare trece', async () => {
  const entries = server.board.entries;
  const restore = C.tamperAddVote(entries[6], 2);
  const r = await C.verifyEverything({ election, entries, tally });
  assert.equal(r.ok, false);
  assert.ok(r.keys.ok);
  assert.ok(r.chain.problems.length > 0 && r.chain.problems.every((p) => p.index === 7), JSON.stringify(r.chain.problems));
  assert.ok(r.ballots.problems.length > 0 && r.ballots.problems.every((p) => p.index === 7), JSON.stringify(r.ballots.problems));
  assert.deepEqual(r.aggregate.problems.map((p) => p.candidate), [2]);
  assert.ok(r.decryption.ok, 'decriptarea publicată rămâne corectă față de agregatul publicat');
  console.log(`      ${r.chain.problems[0].text}`);
  console.log(`      ${r.ballots.problems[0].text}`);
  restore();
  assert.ok((await C.verifyEverything({ election, entries, tally })).ok);
});

await test('buletin modificat înainte de numărare → rezultatul se schimbă (+1), dar verificarea arată #12', async () => {
  const entries = server.board.entries;
  const restore = C.tamperAddVote(entries[11], 0);
  const aggregate = C.computeAggregate(election, entries);
  const partials = [];
  for (const t of trustees) partials.push(await C.partialDecrypt(election, t, aggregate));
  const counts = C.combineDecryption(aggregate, partials, entries.length * CANDIDATES.length);
  assert.equal(counts[0], expected[0] + 1);
  const r = await C.verifyEverything({ election, entries, tally: { ballots: entries.length, aggregate, partials, counts } });
  assert.equal(r.ok, false);
  assert.ok(r.chain.problems.every((p) => p.index === 12));
  assert.ok(r.ballots.problems.every((p) => p.index === 12));
  assert.ok(r.aggregate.ok && !r.decryption.ok, 'totalul nu mai este egal cu numărul de buletine');
  restore();
});

await test('trustee care trișează la decriptarea parțială → detectat', async () => {
  const forged = structuredClone(tally.partials[1]);
  forged.shares[0].d = (forged.shares[0].d * C.G) % C.P;
  const r = await C.verifyDecryption(election, { ...tally, partials: [tally.partials[0], forged, tally.partials[2]] });
  assert.equal(r.ok, false);
  assert.match(r.problems[0].text, /^Trustee 2, Elena Marinescu/);
});

await test('SHA-256 simplu: CNP-ul e recuperat prin căutare; HMAC fără cheie: nu', async () => {
  const target = cnps[5];
  const { birthDate } = C.validateCnp(target);
  const space = C.cnpSearchSpace(birthDate);
  assert.equal(space.length, 2 * 48 * 999);
  assert.ok(space.every((c) => C.validateCnp(c).ok));

  const plain = await C.dictionaryAttack(await C.sha256Hex(target), space, C.sha256Hex);
  assert.equal(plain.found, target);
  console.log(`      SHA-256: găsit după ${plain.tried} încercări în ${Math.round(plain.ms)} ms`);

  const stored = await server.fingerprint(target);
  const guessedKey = await C.importHmacKey(C.randomBytes(32));
  const hmac = await C.dictionaryAttack(stored, space, (c) => C.hmacHex(guessedKey, c));
  assert.equal(hmac.found, null);
  assert.equal(hmac.tried, space.length);

  const leaked = await C.dictionaryAttack(stored, space, (c) => server.fingerprint(c));
  assert.equal(leaked.found, target, 'cu cheia serverului atacul ar reuși — de aceea cheia stă separat (HSM)');
});

console.log(`\n${passed} teste trecute, ${failed} picate`);
process.exit(failed ? 1 : 0);
