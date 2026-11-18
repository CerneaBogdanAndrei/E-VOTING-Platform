# Explicația completă a proiectului

Documentul explică în detaliu tot ce s-a construit în acest repository, în ordinea în care s-a construit, și ce face fiecare fișier. Teoria (formulele, modelul de amenințare, rezultatele) e în [DOCUMENTATIE.md](DOCUMENTATIE.md). Analiza stării actuale și planul de dezvoltare sunt în [ANALIZA.md](ANALIZA.md). Aici e partea practică: ce s-a scris, unde, de ce așa și cum se leagă bucățile între ele.

## Cuprins

- [Partea I: ce s-a făcut, pas cu pas](#partea-i-ce-s-a-făcut-pas-cu-pas)
- [Partea II: fiecare fișier, pe rând](#partea-ii-fiecare-fișier-pe-rând)
- [Partea III: un vot urmărit prin tot sistemul](#partea-iii-un-vot-urmărit-prin-tot-sistemul)
- [Partea IV: ce a arătat testul cu buletinul real](#partea-iv-ce-a-arătat-testul-cu-buletinul-real)
- [Partea V: ce rămâne de făcut](#partea-v-ce-rămâne-de-făcut)

---

# Partea I: ce s-a făcut, pas cu pas

## Pasul 0. Punctul de plecare

Repository-ul avea un singur commit, „prima varianta”:

- `macheta-evoting/`: o machetă a criptografiei într-un fișier HTML și un modul JavaScript, cu ElGamal pe grupul MODP-2048 și 22 de teste;
- `frontend/web/`: un site React cu panoul comisiei și pagina publică, legat de un **backend simulat** (`mock.ts`) care nu cripta nimic;
- `frontend/mobile/`: aplicația Expo cu ecranele de înregistrare, vot și verificare, tot pe backend-ul simulat;
- `src/index.ts`: doar `console.log('Happy developing ✨')`, deci backend-ul nu exista;
- `ballot.ts`: un *placeholder* care trimitea votul **în clar**, cu un comentariu că urmează criptografia reală.

Planul aplicației (7 oct. 2026) cerea:

- un monorepo cu `packages/crypto`, `apps/mobile`, `apps/backend`, `apps/web`, `tools/trustee`, `tools/verifier`, `demos/attacks` și `docker-compose.yml`;
- ElGamal exponențial pe **ristretto255** (nu pe MODP-2048), dovezi Chaum-Pedersen, cheie n-din-n și Fiat-Shamir legat de scrutin și credential;
- nouă tabele PostgreSQL și o listă precisă de rute HTTP;
- OCR pe MRZ, NFC cu PACE și Passive Authentication pe server;
- evaluare cu 100, 1.000 și 10.000 de alegători și patru demonstrații de atac.

Totul s-a făcut după acest plan.

## Pasul 1. Restructurarea în monorepo

- `frontend/web` → `apps/web`, `frontend/mobile` → `apps/mobile`, `macheta-evoting` → `demos/macheta` (păstrată pentru istoric).
- Au fost șterse `src/index.ts` (gol) și `frontend/sync-api.mjs`, scriptul care copia fișierele API din web în mobil. Copierea a fost înlocuită de un pachet comun, `packages/api`.
- Folderul `.idea/` (setările IntelliJ) a fost scos din Git și adăugat în `.gitignore`.
- `package.json` de la rădăcină a devenit un **npm workspace**: `npm install` instalează odată toate pachetele, care se pot importa unul pe altul după nume (`@evoting/crypto`, `@evoting/api`).
- `tsconfig.base.json` conține setările TypeScript comune: ES2022, module ES, verificare strictă.

## Pasul 2. Biblioteca de criptografie (`packages/crypto`)

E inima sistemului. S-a scris o singură dată și o folosesc toate celelalte părți: serverul, telefonul, site-ul, CLI-ul de trustee și verificatorul. O dovadă generată pe telefon e verificată de **exact același cod** pe server și la audit.

Biblioteca externă e `@noble/curves`, pentru grupul ristretto255 și semnăturile Ed25519, plus `@noble/hashes` pentru SHA-256, SHA-512 și HMAC. Ambele sunt scrise în JavaScript pur, deci rulează la fel în Node, în browser și pe telefon.

Ce s-a implementat, fișier cu fișier, e descris în Partea II. Pe scurt: criptarea votului, cele trei tipuri de dovezi, semnătura buletinului, board-ul cu lanț de hash-uri, cheile trustees, decriptarea parțială, aflarea totalului și verificatorul public. Testele sunt 35, toate trec.

## Pasul 3. Stratul API comun (`packages/api`)

- `types.ts` descrie **contractul** dintre aplicații și server: ce date trimite fiecare rută și ce primește înapoi.
- `http.ts` e clientul care vorbește cu serverul real.
- `mock.ts`, backend-ul simulat, a fost **rescris cu criptografie reală**. Acum generează chei de trustee adevărate, verifică dovezile buletinelor și numără prin decriptare parțială, exact ca serverul. Datele se pierd la închiderea aplicației.
- `mrz.ts` (nou) citește zona MRZ a buletinului, verifică cifrele de control și extrage CNP-ul.
- `dg1.ts` (nou) despachetează MRZ-ul din fișierul DG1 citit de pe cip.
- `voter.ts` (nou) conține pașii alegătorului: autentificare, criptare, trimitere, verificare.

Testele sunt 11, toate trec.

## Pasul 4. Backend-ul (`apps/backend`)

- **NestJS 12** cu **PostgreSQL 16**, SQL scris de mână prin driverul `pg`. Nu s-a folosit ORM, ca fiecare interogare să fie vizibilă și explicabilă în lucrare.
- Cele **nouă tabele** sunt create de migrarea `migrations/001_init.sql`, aplicată automat la pornire.
- Toate rutele din plan sunt implementate, plus câteva ajutătoare (`/board-head`, `/registrations`, `/tally`, `/audit-bundle`, `/audit-log`, `/admin/check`, `/health`).
- **Passive Authentication** pentru NFC: SOD-ul se verifică până la certificatul CSCA, iar hash-ul DG1 se compară cu cel semnat.
- Un **PKI de test** (un CSCA și un Document Signer „de laborator”) permite testarea NFC fără un buletin real.
- Limitarea de rată și jurnalul de audit sunt active.
- Cele **18 teste end-to-end** rulează pe un PostgreSQL real și trec toate.

## Pasul 5. Uneltele și demonstrațiile

- `tools/trustee`: programul trustee-ului. Generează cheia și face decriptarea parțială.
- `tools/verifier`: verificatorul public în linia de comandă.
- `tools/simulator`: rulează alegeri complete cu alegători sintetici contra serverului real și măsoară timpii.
- `demos/attacks`: cele patru atacuri din plan, plus al cincilea, modificarea board-ului direct în baza de date.

Toate au fost rulate efectiv, iar rezultatele sunt în DOCUMENTATIE.md, §9 și §10.

## Pasul 6. Site-ul (`apps/web`)

- E legat acum de `@evoting/api`. Fără `VITE_API_URL` folosește backend-ul simulat, cu el folosește serverul real.
- Panoul comisiei cere token-ul de administrator.
- După crearea unui scrutin, afișează **o singură dată** comenzile pentru trustees.
- Arată hash-ul board-ului de publicat independent și jurnalul de audit.
- Pagina publică are trei tab-uri noi: **Verificare publică** (verificatorul complet rulează în browser), **Audit buletin** (provocarea Benaloh) și **Cum funcționează**.
- A fost testat cu Playwright, un browser automat, contra serverului real și în mod simulat.

## Pasul 7. Aplicația mobilă (`apps/mobile`)

- Criptarea e reală: votul se criptează pe telefon, cu dovezi și semnătură.
- Cheia de credential se generează la înregistrare și se păstrează în **SecureStore**, adică criptată cu o cheie din Android Keystore.
- Înainte de trimitere, alegătorul poate face **provocarea Benaloh**: dezvăluie numerele aleatoare, verifică și apoi recriptează votul.
- Ecranul **Verifică votul** recalculează pe telefon hash-urile buletinului.
- Ecranul **Scanare buletin** fotografiază MRZ-ul, îl citește prin OCR și verifică cifrele de control.
- Ecranul **Citire CEI prin NFC** cere CAN-ul, deschide PACE și citește DG1 și SOD.
- Pentru ultimele două există **module native Kotlin**: `modules/evoting-nfc` (JMRTD) și `modules/evoting-ocr` (ML Kit).

## Pasul 8. Docker, CI și documentația

- `docker-compose.yml` pornește PostgreSQL, backend-ul și site-ul.
- `.github/workflows/ci.yml` rulează la fiecare push: testele (cu PostgreSQL ca serviciu), build-ul complet și verificările aplicației mobile.
- `DOCUMENTATIE.md` explică teoria și pașii, `README.md` e intrarea scurtă în proiect.

## Pasul 9. Evaluarea

Simulatorul a rulat alegeri cu 100, 1.000 și 10.000 de alegători. De fiecare dată:

- rezultatul publicat a fost **identic** cu voturile simulate;
- verificatorul public a trecut toți pașii.

Rapoartele sunt în `docs/evaluare/`.

## Pasul 10. APK-ul

Mediul de lucru nu are Android SDK, deci APK-ul se construiește pe serverele GitHub, prin `.github/workflows/android-apk.yml`. Au fost trei încercări:

1. **#1 a picat la împachetare.** Două biblioteci BouncyCastle conțineau același fișier `META-INF/LICENSE.md`. Corectura e `plugins/with-packaging-excludes.js`. Important: la această încercare, modulele Kotlin NFC și OCR **s-au compilat fără erori** prima dată.
2. **#2 a construit APK-ul**, dar a picat la pasul care îl copia în `apk/`, pentru că `expo prebuild` modificase un fișier și `git pull` a refuzat să continue. S-a corectat workflow-ul.
3. **#3 a reușit.** APK-ul e în `apk/vot-verificabil.apk`.

## Pasul 11. Reorganizarea codului (16 nov. 2026)

Codul a fost împărțit în fișiere mai mici, grupate pe teme, ca orice lucru să se găsească ușor, fără să se schimbe comportamentul:

- **Documentația** s-a mutat în `docs/` (`DOCUMENTATIE.md`, `EXPLICATIE.md`, ghidul `explicatii/`, măsurătorile `evaluare/`), plus `ANALIZA.md` (ce e bun, ce lipsește, ce urmează). Fiecare pachet și aplicație are un `README.md` cu harta fișierelor lui.
- **`packages/api`**: contractul HTTP în `contract/` (un fișier per temă), clientul în `client/`, backend-ul simulat în `mock/` (stare, reguli, scrutine de demonstrație, client, unelte), identitatea în `identity/` (CNP, MRZ, constructorul de MRZ-uri de test, DG1). Testele, câte un fișier pe temă.
- **`packages/crypto`**: sursele erau deja mici; testele s-au împărțit pe teme (`encoding`, `elgamal`, `ballot`, `trustee`, `verifier`) și au crescut de la 35 la 44.
- **`apps/backend`**: un folder per modul. `ElectionsService` (388 de rânduri, cu citiri, comenzi și trustees la un loc) a devenit `ElectionsRepository` (citirile și blocarea), `ElectionsService` (acțiunile comisiei) și `TrusteesService`. `VotingService` a devenit `RegistrationService`, `AuthService` și `BallotsService`. `/health` și `/admin/check` au controller-ul lor (`system/`). Testele e2e sunt două fișiere.
- **`apps/web`**: pagina publică și pagina comisiei au tab-urile și bucățile în fișiere separate (`pages/election/tabs/`, `pages/commission/parts/`), componentele mici în `components/ui/`, iar CSS-ul în `styles/`, pe module.
- **`apps/mobile`**: `components/ui/` (un fișier per componentă), `components/election/`, `components/identity/` și `components/vote/` pentru bucățile scoase din ecrane. Ecranele din `app/` au rămas la locul lor (Expo Router).
- **`tools/`**: fiecare comandă a CLI-urilor are fișierul ei (`commands/`), iar simulatorul are ajutoarele în `lib/`.
- Curățenie: fișierele rămase din șablonul Expo (`LICENSE`, `.claude/`) au fost șterse, `docker-compose.yml` lasă `DATABASE_SSL` configurabil din `.env` (necesar pentru Supabase), iar workflow-ul APK nu mai pornește de pe un branch vechi.

## Pasul 12. Dezvoltarea după analiză (17–18 nov. 2026)

Din punctele slabe găsite de analiză (`ANALIZA.md`) s-au rezolvat cele mai importante. Explicația pe larg, cu problema, soluția și testul fiecăreia, e în [GHID-COMPLET.md, Partea 9](GHID-COMPLET.md#partea-9-ce-s-a-schimbat-în-ultima-etapă-1618-nov-2026). Pe scurt:

- **Intervalul aplicat:** votul se primește doar între `opensAt` și `closesAt`, iar la `closesAt` serverul închide singur scrutinul (`elections/auto-close.service.ts`). Site-ul și aplicația arată cât mai e.
- **Configurarea se poate corecta:** în `draft`, scrutinul se poate modifica (titlu, interval, candidați, vot alb) sau șterge; lista de eligibili se poate completa și cu votul deschis.
- **Votul alb:** un candidat special, ultimul (`candidates.kind = 'blank'`); criptografia nu se schimbă.
- **Re-înregistrarea înainte de vot:** un alegător care își schimbă telefonul se înregistrează din nou, iar credentialul vechi devine inutilizabil; nu după vot și nu cu un nivel de încredere mai mic.
- **Membrii comisiei:** folderul nou `apps/backend/src/admin/` (guard-urile cu roluri, rutele `/admin/*`, `MembersService`); rolul `observator` doar citește; jurnalul reține numele.
- **Robustețe:** provocările de autentificare în tabela `auth_challenges` (migrarea `003`); board-ul paginat (`/board/page`); `helmet`; avertismente pentru configurări riscante; `TRUST_PROXY`.
- **Trustees:** fișierul de cheie se poate cripta cu parolă (`tools/trustee/src/key-file.ts`, `password.ts`).
- **Verificatorul** verifică și orele primirii (crescătoare și în interval).
- **HTTPS în Docker Compose**, prin Caddy (`infra/Caddyfile`).
- **Calitate:** `prettier` și `oxlint` la rădăcină, pași noi în CI, formatările comune mutate în `packages/api/src/format.ts`, CLI-urile testate ca procese separate. Testele au crescut de la 78 la 93.
- **La verificarea finală (18 nov.)** s-au reparat două probleme: ora primirii se ia acum după blocarea board-ului (altfel două voturi simultane puteau intra în ordinea inversă orelor, iar verificatorul ar fi raportat fals o manipulare) și verificarea de sănătate a containerului backend folosește `127.0.0.1` (cu `localhost`, Docker îl marca „unhealthy”). Apoi tot sistemul a fost pornit cu Docker Compose și un scrutin complet a trecut prin HTTPS.

---

# Partea II: fiecare fișier, pe rând

## Rădăcina

| Fișier | Ce face |
| --- | --- |
| `package.json` | Declară monorepo-ul (workspaces), scripturile `build`, `test`, `lint`, `format`, `format:check`, `typecheck`, uneltele `oxlint` și `prettier` și o versiune corectată a bibliotecii `multer`, adusă de NestJS, care avea o vulnerabilitate cunoscută. |
| `package-lock.json` | Versiunile exacte ale tuturor dependențelor, ca instalarea să fie identică peste tot. |
| `tsconfig.base.json` | Setările TypeScript comune tuturor pachetelor. |
| `.prettierrc`, `.prettierignore` | Regulile de formatare (fără `;`, ghilimele simple, 160 de caractere) și ce nu se formatează (fișierele generate, Markdown-ul). |
| `.oxlintrc.json` | Regulile linterului pentru tot monorepo-ul. |
| `.gitignore` | Ce nu intră în Git: `node_modules`, `dist`, `.env` (secrete), `.idea`, fișierele cu chei de trustee. |
| `.gitattributes` | Scripturile `.sh` și Dockerfile-urile rămân cu LF și pe Windows. |
| `.dockerignore` | Ce nu se copiază în imaginile Docker. |
| `.env.example` | Model pentru `.env` la Docker Compose: cheia HMAC, token-ul comisiei, cheia sesiunilor, Supabase, adresa site-ului pentru Caddy, originile CORS. |
| `docker-compose.yml` | Patru servicii: `db` (PostgreSQL), `backend` (port 3000), `web` (port 8080) și `proxy` (Caddy, HTTPS pe 443, API-ul la `/api`). |
| `infra/Caddyfile` | Configurarea lui Caddy: certificat local pentru `localhost` (sau Let's Encrypt pentru un domeniu), `/api/*` spre server, restul spre site. |
| `README.md` | Prezentarea scurtă, structura și pornirea rapidă. |
| `docs/README.md` | Indexul documentației. |
| `docs/GHID-COMPLET.md` | Tot proiectul explicat de la zero, într-un singur fișier, pentru cineva care n-a mai văzut codul. |
| `docs/DOCUMENTATIE.md` | Documentația completă: teorie, pași, securitate, evaluare. |
| `docs/EXPLICATIE.md` | Acest document. |
| `docs/ANALIZA.md` | Ce e bun, ce lipsește, ce s-a rezolvat și planul de dezvoltare. |
| `docs/explicatii/` | Ghidul de la zero, în șapte capitole. |
| `docs/evaluare/*.json` | Metricile măsurate la 100, 1.000 și 10.000 de alegători, plus remăsurarea cu 1.000 pe codul final (`simulare-1000-18-nov.json`). |
| `apk/vot-verificabil.apk` | Aplicația Android construită de GitHub Actions. |

## `.github/workflows/`

| Fișier | Ce face |
| --- | --- |
| `ci.yml` | La fiecare push, pe serverele GitHub: instalează tot, rulează linterul și verificarea formatării, cele 93 de teste (cu un PostgreSQL pornit ca serviciu), construiește tot și rulează `npm audit`; separat, verifică tipurile aplicației mobile și o împachetează pentru Android. |
| `android-apk.yml` | Construiește APK-ul. Pornește când se modifică aplicația mobilă sau pachetele comune, sau manual (Actions → Android APK → Run workflow). Pașii: Node 22 și Java 17, construirea pachetelor comune, `expo prebuild` (generează proiectul Android), `gradlew assembleRelease` (compilează; doar arm64, ca fișierul să fie mai mic), apoi copierea APK-ului în `apk/`, încărcarea lui ca artifact și commit-ul pe branch. Câmpul opțional `api_url` leagă APK-ul de un server real. |

## `packages/crypto/`: criptografia

### `src/encoding.ts`

- `isHex(valoare, octeți)`: verifică dacă un text e hex valid, de lungimea cerută. Datele venite din rețea sunt verificate înainte de orice calcul.
- `canonicalJson(obiect)`: transformă un obiect în JSON cu cheile **sortate alfabetic** și fără spații. Același obiect dă astfel mereu același text, deci același hash, indiferent de ordinea în care au fost scrise câmpurile sau de limbajul care îl generează. Pe asta se bazează semnăturile și lanțul de hash-uri.

### `src/group.ts`

Lucrul cu grupul ristretto255.

- `Q`: ordinul grupului (un număr prim de ~252 de biți). Toate calculele cu scalari se fac modulo Q.
- `G`: generatorul (punctul de bază). `ZERO`: elementul neutru.
- `randomScalar()`: număr aleator. Ia 64 de octeți aleatori și îi reduce modulo Q, ca distribuția să fie practic uniformă.
- `scalarToHex` / `scalarFromHex`: scalar ↔ 64 de caractere hex. Decodarea respinge valorile ≥ Q, deci nu acceptă reprezentări alternative ale aceluiași număr.
- `pointToHex` / `pointFromHex`: punct ↔ hex. Decodarea respinge orice șir care nu e un element ristretto255 valid.
- `encodeSmall(m)`: calculează m·G, folosit pentru voturi (0 sau 1) și totaluri.
- `mulSecret(p, s)`: înmulțire **în timp constant**, pentru valori secrete (r, x, k), ca durata calculului să nu dezvăluie nimic.
- `mulPublic(p, s)`: înmulțire mai rapidă, doar pentru date publice, la verificare.
- `Point` e o interfață TypeScript scrisă de mână, pentru că clasa din `@noble/curves` nu se poate exporta direct în declarațiile de tipuri.

### `src/hash.ts`

- `sha256Hex(text)`: SHA-256, ca hex.
- `hashObject(obiect)`: SHA-256 peste JSON-ul canonic.
- `hmacSha256Hex(cheie, mesaj)` și `cnpHmac(cheieHex, cnp)`: amprenta CNP-ului păstrată de server.
- `hashToScalar(domeniu, părți)`: provocarea **Fiat-Shamir**. Pune eticheta dovezii și toate valorile publice într-un șir, fiecare parte prefixată cu lungimea ei (`12:scrutin-2026|64:ab12…`), ca împărțirea să nu fie ambiguă. Calculează apoi SHA-512 și reduce rezultatul modulo Q.

### `src/types.ts`

Formatele JSON ale datelor criptografice:

- `Ciphertext {a, b}`: un criptotext;
- `ChaumPedersenProof {c, s}`: o dovadă de egalitate de logaritmi;
- `ZeroOneProof {c0, c1, s0, s1}`: dovada 0/1, cu două ramuri;
- `BallotProofs`: dovezile unui buletin;
- `Ballot`: buletinul complet, semnat;
- `ElectionParams`: ID-ul scrutinului, cheia publică și numărul de candidați;
- `TrusteePublicKey`, `PartialDecryption`, `BoardEntry`: cheia unui trustee, o decriptare parțială, o intrare de pe board.

### `src/elgamal.ts`

- `encrypt(cheiePublică, m, r)`: calculează **(A, B) = (r·G, m·G + r·Y)**. Dacă nu se dă r, se alege unul aleator nou.
- `preparePublicKey(hex)`: decodează cheia scrutinului și precalculează tabele pentru ea, ca înmulțirile repetate să fie mai rapide. Rezultatul se păstrează într-un cache mic.
- `addCiphertexts(listă)`: adună criptotextele componentă cu componentă. Pe asta se bazează numărarea homomorfă.
- `decodeCiphertext` / `encodeCiphertext`: hex ↔ puncte.
- `decryptToPoint(x, ct)`: B − x·A = m·G. Se folosește doar în teste, pentru că în sistem nimeni nu are cheia completă x.

### `src/proofs.ts`

Dovezile zero-knowledge.

- `DOMAIN`: etichetele dovezilor (`evoting/v1/ballot-01` etc.). O dovadă de un tip nu poate fi folosită ca dovadă de alt tip.
- `proveSchnorr` / `verifySchnorr`: dovada că știi x pentru Y = x·G. O folosesc trustees pentru cheia lor.
  - Prover: alege k, calculează T = k·G, c = hash(…, T) și s = k + c·x.
  - Verificator: recalculează T = s·G − c·Y și verifică dacă hash-ul dă același c.
- `proveEqualLogs` / `verifyEqualLogs` (**Chaum-Pedersen**): dovada că U = w·G și V = w·H folosesc același w. Se folosește pentru suma voturilor = 1 și pentru decriptarea parțială.
- `proveZeroOne` / `verifyZeroOne` (dovada **disjunctivă**): arată că (A, B) criptează 0 SAU 1, fără să spună care.
  - Ramura adevărată se dovedește normal; cealaltă se **simulează**, alegând dinainte provocarea și răspunsul ei.
  - Suma celor două provocări trebuie să dea hash-ul. Hash-ul e fixat, deci se poate simula cel mult o ramură, iar criptotextul trebuie să fie cu adevărat 0 sau 1.

### `src/credential.ts`

Cheia alegătorului, de tip Ed25519.

- `generateCredential()`: o pereche nouă de chei.
- `signMessage` / `verifySignature`: semnare și verificare.
- `isCredentialPubkey`: verifică dacă un text e o cheie publică Ed25519 validă.
- `authMessage(scrutin, credential, nonce)`: textul exact semnat la autentificare.

### `src/ballot.ts`

- `encryptBallot(parametri, opțiune, cheieSecretă, cheiePublică)`:
  1. pentru fiecare candidat j, alege rⱼ și criptează 1 (dacă e cel ales) sau 0;
  2. face dovada 0/1 pentru fiecare criptotext, cu contextul (scrutin, cheie, număr de candidați, credential, poziție);
  3. face dovada că suma e 1, cu martorul R = Σrⱼ;
  4. semnează rezumatul buletinului cu cheia de credential;
  5. întoarce buletinul **și** secretele (opțiunea și r-urile), necesare doar pentru auditul Benaloh.
- `ballotDigest(buletin)`: hash-ul a ce se semnează, adică tot în afară de semnătură.
- `ballotHash(buletin)`: hash-ul buletinului semnat, care intră pe board.
- `verifyBallotSignature`, `verifyBallotProofs`, `verifyBallot`: verificarea semnăturii, a dovezilor sau a tuturor. Întorc `{ok: true}` sau `{ok: false, reason}`, cu motivul exact.
- `auditBallot(parametri, criptotexte, secrete)`: provocarea Benaloh. Recriptează opțiunea declarată cu r-urile dezvăluite și compară cu criptotextele.

### `src/board.ts`

- `genesisHash(scrutin)`: „hash-ul anterior” al primei intrări, derivat din ID-ul scrutinului, ca board-urile a două scrutine să nu se poată amesteca.
- `computeEntryHash(...)`: hash-ul unei intrări = SHA-256 peste {scrutin, poziție, hash anterior, hash-ul buletinului, ora primirii}.
- `appendEntry(...)`: construiește intrarea următoare.
- `entryToBallot(...)`: reface buletinul dintr-o intrare.
- `checkOwnEntry(...)`: verificarea făcută de alegător pe propriul buletin. Recalculează hash-urile și le compară cu codul de urmărire și cu amprenta păstrată pe telefon.
- `normalizeTrackingCode`: curăță codul introdus (spații, majuscule).

### `src/trustee.ts`

- `generateTrusteeKey(scrutin, trustee)`: alege xᵢ, calculează Yᵢ și dovada Schnorr.
- `verifyTrusteeKey`: verifică dovada cheii.
- `combinePublicKeys`: calculează Y = ΣYᵢ.
- `partialDecrypt(cheie, agregat)`: Dᵢⱼ = xᵢ·Aⱼ pentru fiecare candidat, cu dovadă Chaum-Pedersen. Înainte verifică dacă cheia secretă chiar corespunde cheii publice.
- `verifyPartialDecryption`: verifică dovezile, cu motivul exact când pică.

### `src/tally.ts`

- `computeAggregate(n, buletine)`: pentru fiecare candidat, suma criptotextelor de pe board.
- `babyStepGiantStep(punct, maxim)`: găsește t cu t·G = punct, pentru t între 0 și maxim, în aproximativ √maxim pași.
  1. Își face o listă cu 0·G, 1·G, …, (m−1)·G („pașii mici”).
  2. Scade din punct câte m·G („pașii mari”) până dă de un element din listă.
- `combinePartialDecryptions(agregat, decriptări, maxim)`: TⱼG = Bⱼ − ΣDᵢⱼ, apoi Tⱼ prin funcția de mai sus.

### `src/verify.ts`

Verificatorul public. `verifyElection(pachet, opțiuni)` primește tot ce publică serverul și reface șase pași:

| Pas | Ce verifică |
| --- | --- |
| 0. Cheile | Dovada fiecărui trustee și Y = ΣYᵢ |
| 1. Lanțul | Poziții consecutive, hash-ul anterior, hash-ul recalculat al fiecărui buletin și al fiecărei intrări, orele primirii (crescătoare și în intervalul scrutinului); opțional, hash-ul publicat independent |
| 2. Credentialele | Fiecare buletin vine de la un credential înregistrat, câte unul per credential, cu semnătură validă |
| 3. Dovezile | Dovezile ZK ale fiecărui buletin |
| 4. Agregatul | Recalculat de la zero și comparat cu cel publicat |
| 5. Decriptarea | Dovezile trustees, apoi totalurile recalculate și comparate cu rezultatul publicat |

Fiecare eroare e raportată cu locul exact, de exemplu „buletinul #42”. Opțiunea `yieldEvery` lasă browserul să respire între buletine, ca pagina să nu înghețe.

### `src/index.ts`

Exportă tot ce folosesc celelalte pachete.

### `test/`

45 de teste, câte un fișier pe temă:

| Fișier | Ce verifică |
| --- | --- |
| `encoding.test.ts` | JSON canonic (ordinea cheilor, `undefined`, valori instabile), HMAC pe vectorul oficial RFC 4231, scalari și puncte invalide. |
| `elgamal.test.ts` | Decriptare corectă, randomizare (același vot dă criptotexte diferite), proprietatea homomorfă, BSGS. |
| `ballot.test.ts` | Buletin corect acceptat; respinse: vot 2, vot −1, suma 2, suma 0, „viclean” +2/−1, dovezi refolosite în alt scrutin, buletin copiat de alt credential, criptotext înlocuit, formă greșită; Benaloh. |
| `trustee.test.ts` | Dovada cheii legată de scrutin și trustee, chei invalide, cheie secretă nepotrivită, decriptarea cere toți trustees, trustee care trișează. |
| `verifier.test.ts` | 13 tipuri de manipulare (buletin modificat, hash-uri refăcute, ordine schimbată, buletin șters, vot adăugat, vot dublu, decriptare modificată, rezultat falsificat, agregat greșit, istorie rescrisă, cheie fără dovadă, ore în afara ordinii sau a intervalului), scrutin încă deschis, progresul raportat. |
| `helpers.ts` | `simulateElection` (un scrutin complet fără server), `testKey` și `forgeBallot` (buletin „trișat”). |

### `package.json`, `tsconfig*.json`, `.gitignore`

Numele pachetului (`@evoting/crypto`), comenzile `build` și `test` și setările de compilare. `dist/` (codul compilat) nu intră în Git.

## `packages/api/`: stratul comun

| Fișier | Ce face |
| --- | --- |
| `src/index.ts` | Exportă tot; comentariul de sus e harta folderelor. |
| `src/contract/election.ts` | Scrutinul: `Election`, `Candidate` (cu `kind`: candidat sau vot alb), `Trustee`, `CreateElectionInput` (cu `allowBlank`), `UpdateElectionInput`, `TrusteeToken`, `EligibleImportResult`. |
| `src/contract/voter.ts` | Alegătorul: `Registration` (cu `replacedPrevious` la re-înregistrare), `RegisterOcrInput`, `RegisterNfcInput`, `AuthChallenge`, `AuthSession`, `BallotReceipt`. |
| `src/contract/board.ts` | Ce se publică: `BoardHead`, `BoardPage` (o pagină din board), `TallyInfo`, `ElectionResult`, `AuditLogEntry`, `AuditBundleResponse`. |
| `src/contract/admin.ts` | Comisia: rolurile `comisie` / `observator`, `AdminIdentity`, `CommissionMember`, `CreatedMember` (cu token-ul afișat o dată). |
| `src/contract/errors.ts` | `ApiError` (eroare cu cod HTTP). |
| `src/contract/client.ts` | Interfața `ApiClient` cu toate metodele. Clientul real și cel simulat o implementează la fel, deci ecranele nu știu cu care vorbesc. |
| `src/client/http.ts` | Clientul real. Fiecare metodă face un `fetch` la ruta corespunzătoare, adaugă `Authorization: Bearer …` și transformă erorile NestJS în mesaje în română (429 → „Prea multe încercări”). |
| `src/mock/index.ts` | `createMockBackend`: leagă contextul, scrutinele de demonstrație, clientul și uneltele de test. |
| `src/mock/state.ts` | Starea în memorie (ce ar fi în tabelele serverului) și `MockContext`: HMAC-ul, jurnalul, instantaneele. |
| `src/mock/rules.ts` | Regulile serverului, cu aceleași mesaje ca `apps/backend`: modificare și ștergere în configurare, chei, import CSV (și cu votul deschis), înregistrare și re-înregistrare, vot în interval, închidere (și automată), decriptare. |
| `src/mock/seed.ts` | Cele trei scrutine de demonstrație (deschis, cu vot alb; în configurare; numărat). |
| `src/mock/client.ts` | Implementarea `ApiClient`, rută cu rută, inclusiv paginarea board-ului și membrii comisiei. |
| `src/mock/tools.ts` | Uneltele de test: cheile trustees, alegători simulați, decriptarea, CNP-ul propriu adăugat în lista de eligibili. |
| `src/mock/random.ts`, `contract-helpers.ts` | Aleator reproductibil (`mulberry32`), latență simulată, copiere; constantele simulatorului. |
| `src/identity/cnp.ts` | Validarea CNP-ului (13 cifre, sex/secol, dată existentă, județ, cifra de control cu cheia 279146358279) și generatorul de CNP-uri fictive. |
| `src/identity/mrz.ts` | Parserul MRZ: curăță textul OCR, recunoaște TD1 (CEI), TD2 (buletinul vechi) și TD3 (pașaport), verifică cifrele de control ICAO și reconstituie CNP-ul. |
| `src/identity/mrz-build.ts` | `buildTd1`, `buildTd2`: MRZ-uri de test pentru demonstrații, teste și cipuri simulate. |
| `src/identity/dg1.ts` | DG1 e structura `61 { 5F1F <MRZ> }`: scoate MRZ-ul din DG1 (și invers, pentru teste), base64 ↔ octeți. |
| `src/voter.ts` | Pașii alegătorului: `authenticate`, `prepareBallot`, `submitBallot`, `verifyOwnBallot`. |
| `src/format.ts` | Etichetele și formatările comune site-ului și aplicației: stări, metode, niveluri, roluri, „Vot alb”, date, hash-uri, procente, durate, poziția față de interval (`intervalPhase`). |
| `test/cnp.test.ts`, `mrz.test.ts`, `dg1.test.ts`, `mock.test.ts` | 20 de teste: CNP, exemplele oficiale ICAO, buletinul vechi, CEI, zgomot OCR, DG1 și, pe backend-ul simulat, un scrutin complet verificat de verificatorul public, re-înregistrarea, votul alb, modificarea și ștergerea, intervalul, uneltele de test și membrii. |

## `apps/backend/`: serverul

Un folder per modul; `src/app.module.ts` le enumeră.

### Configurare și pornire

| Fișier | Ce face |
| --- | --- |
| `.env.example` | Modelul de configurare: `DATABASE_URL`, `CNP_HMAC_KEY` (32 de octeți hex), `ADMIN_TOKEN`, `SESSION_SECRET`, `CSCA_DIR` (certificatele de încredere), `PORT`, `CORS_ORIGINS`, `RATE_LIMIT`, `SENSITIVE_RATE_LIMIT`, `AUTO_CLOSE_INTERVAL_MS`, `TRUST_PROXY`, `DATABASE_SSL`, `DATABASE_CA`. |
| `src/config.ts` | Citește variabilele de mediu și refuză pornirea dacă lipsește ceva, cheia HMAC e prea scurtă sau token-ul comisiei are sub 16 caractere; în producție avertizează dacă lipsește `SESSION_SECRET`. |
| `src/main.ts` | Pornește serverul pe portul configurat. |
| `src/app.ts` | Aplică migrările, creează aplicația Nest, adaugă antetele de securitate (`helmet`) și `trust proxy`, acceptă JSON și CSV (pentru importul eligibililor), activează CORS și avertizează pentru CORS deschis în producție sau SSL fără verificarea certificatului. |
| `src/app.module.ts` | Leagă totul: controllerele, serviciile fiecărui modul, baza de date și limitarea de rată (600 de cereri pe minut per IP în general). |

### Baza de date

| Fișier | Ce face |
| --- | --- |
| `migrations/001_init.sql` | Creează cele **nouă tabele** (DOCUMENTATIE §7.1) și **trigger-ul** care interzice `UPDATE` și `DELETE` pe `ballots`, adică board-ul append-only. Constrângerile `UNIQUE` garantează o înregistrare per persoană și un vot per credential chiar și la cereri simultane. |
| `migrations/002_rls.sql` | Row Level Security pe toate tabelele, ca API-ul REST public al Supabase să nu vadă nimic. |
| `migrations/003_settings_members_challenges.sql` | Coloana `candidates.kind` (votul alb) și tabelele `commission_members` (membrii comisiei, cu hash-ul token-ului și rolul) și `auth_challenges` (provocările de autentificare), cu Row Level Security. |
| `src/db/database.service.ts` | Conexiunea la PostgreSQL (un pool de 20 de conexiuni), cu ajutorul `transaction(...)` (BEGIN … COMMIT, ROLLBACK la eroare) și `isUniqueViolation`. |
| `src/db/pg-options.ts` | Opțiunile de conexiune: SSL automat pentru bazele care nu sunt locale, verificarea certificatului cu `DATABASE_CA` și avertismentul când lipsește. |
| `src/db/migrate.ts` | Aplică fișierele din `migrations/` o singură dată, în ordine, cu un lacăt ca două instanțe să nu migreze simultan. |
| `src/db/migrate-cli.ts` | Același lucru, rulat din linia de comandă. |

### Securitate comună

| Fișier | Ce face |
| --- | --- |
| `src/common/security.ts` | Token-uri aleatoare, SHA-256, comparație **în timp constant** (`safeEqual`), citirea antetului `Bearer` și sesiunile alegătorilor: un text semnat cu HMAC, valabil 10 minute, fără stocare. |
| `src/common/throttle.ts` | Limita strictă pentru rutele sensibile: implicit 30 de cereri pe minut per IP. |
| `src/common/validate.ts` | Verifică datele primite (text, dată, obiect, listă) și întoarce erori clare, în română. |
| `src/admin/admin.guard.ts` | Autentificarea comisiei: `AdminGuard` acceptă `ADMIN_TOKEN` (rădăcina) sau token-ul unui membru nerevocat (căutat după SHA-256) și pune identitatea pe cerere; `CommissionGuard` cere în plus rolul `comisie`; `@Admin()` dă identitatea controllerului; `adminActor` o scrie în jurnal (`comisie:<nume>`). |
| `src/admin/admin.controller.ts` | Rutele `/admin/check`, `/admin/members` (listă, creare) și `/admin/members/:id` (revocare). |
| `src/admin/members.service.ts` | Membrii comisiei: creare (token întors o singură dată, păstrat ca SHA-256), listă, revocare (rândul rămâne). |
| `src/audit/audit.service.ts` | Scrie și citește jurnalul de audit. |

### Modulele

| Fișier | Ce face |
| --- | --- |
| `src/elections/elections.controller.ts` | Toate rutele `/elections/...`: le leagă de servicii și pune protecțiile (rolul din comisie, token de trustee sau limita strictă). Ruta `board/page` e declarată înaintea lui `board/:hash`. |
| `src/elections/elections.repository.ts` | **Citirile publice**: `list`, `get`, `board`, `boardPage` (cele mai noi primele), `findBallot`, `head`, `registrations`, `tally`, `result`, `auditBundle` (dintr-un singur instantaneu consistent al bazei). Tot aici: `lock` (`SELECT … FOR UPDATE` pe rândul scrutinului, care serializează schimbările de stare și adăugările pe board) și `params` (cheia, numărul de candidați, starea și intervalul). |
| `src/elections/elections.service.ts` | **Acțiunile comisiei**: `create` (validare, scrutin, candidați și vot alb, trustees cu token-uri hash-uite), `update` și `remove` (doar în `draft`), `importEligible` (CSV → doar HMAC-uri, în grupuri de 1.000, în `draft` sau `open`), `open` (cere toate cheile, lista nevidă și `closesAt` în viitor), `close` (calculează și publică agregatul), `closeExpired` (scrutinele ajunse la `closesAt`). |
| `src/elections/auto-close.service.ts` | Închiderea automată: la fiecare `AUTO_CLOSE_INTERVAL_MS` (implicit un minut) cheamă `closeExpired`; în jurnal, actorul e `server`. |
| `src/elections/election.rows.ts` | Rândurile din PostgreSQL și transformarea lor în obiectele din contract; `candidateRows` (votul alb ultimul); `slug` pentru ID-ul scrutinului. |
| `src/trustees/trustees.service.ts` | `byToken` (serverul păstrează doar SHA-256 al token-ului) și `submitKey`: verifică dovada Schnorr, salvează Yᵢ și, după ultimul trustee, publică Y. |
| `src/registration/registration.service.ts` | `registerOcr` (CNP validat) și `registerNfc` (DG1 + SOD → Passive Authentication → MRZ → CNP), apoi `register`: HMAC(CNP), eligibilitate, **re-înregistrarea** (dacă persoana n-a votat și noul nivel de încredere nu e mai mic, credentialul vechi și provocările lui se șterg), inserare, erori „există deja” traduse. În jurnal nu intră HMAC-ul. |
| `src/auth/auth.service.ts` | `challenge` (nonce de 32 de octeți, valabil 2 minute, în tabela `auth_challenges`) și `verify` (`DELETE … RETURNING`, semnătura, apoi sesiunea). Provocarea se consumă la prima încercare. |
| `src/auth/auth.controller.ts` | Rutele `/auth/challenge` și `/auth/verify`. |
| `src/ballots/ballots.service.ts` | `cast`: sesiunea, buletinul reconstruit din câmpurile cunoscute, intervalul scrutinului, semnătura și dovezile verificate **în afara tranzacției**, apoi, cu scrutinul blocat, starea, înregistrarea, votul anterior, **ora primirii luată acum** (`boardTime`: niciodată mai devreme decât intrarea anterioară) și verificată din nou față de interval, intrarea legată de cea precedentă și codul de urmărire. |
| `src/tally/tally.service.ts` | Decriptarea parțială a unui trustee, verificată față de agregat; după ultimul, `publishResult`: totalurile, rândul din `results`, starea `tallied`. |
| `src/system/system.controller.ts` | `/health`. |

### NFC

| Fișier | Ce face |
| --- | --- |
| `src/nfc/passive-auth.ts` | Verificarea propriu-zisă: SOD → CMS SignedData → LDSSecurityObject; hash-ul DG1; atributele semnate; semnătura Document Signer-ului (OpenSSL: ECDSA, inclusiv brainpool, RSA, RSA-PSS); DSC-ul emis de un CSCA de încredere și valabilitatea certificatelor. |
| `src/nfc/passive-auth.service.ts` | Încarcă certificatele CSCA din `CSCA_DIR` la pornire și apelează verificarea. |
| `src/nfc/test-pki.ts`, `test-pki-cli.ts` | Un CSCA și un DSC de test (ECDSA P-256) și „cipuri” de test: DG1 cu un MRZ dat și SOD semnat. Serverul are încredere în ele doar dacă certificatul de test e pus explicit în `CSCA_DIR`. |

### Docker și teste

| Fișier | Ce face |
| --- | --- |
| `Dockerfile`, `docker-entrypoint.sh` | Imaginea serverului. La pornire, dacă `GENERATE_TEST_PKI=true`, generează PKI-ul de test (doar pentru demo). |
| `test/helpers.ts` | Golește baza de test, pornește serverul real pe un port liber, clienți cu și fără token de comisie, `rejects` (verifică un `ApiError` cu codul așteptat). |
| `test/election-flow.e2e.test.ts` | 16 teste, tot fluxul: crearea scrutinului și token-urile; cheile trustees (token greșit, dovadă falsă); importul eligibililor (doar HMAC-uri în bază, și după deschidere); înregistrarea OCR și re-înregistrarea; înregistrarea NFC (cip valid acceptat; respinse: DG1 modificat, CSCA străin, semnătură alterată; NFC neînlocuibil prin OCR); votul, autentificarea și buletinele invalide; votul dublu simultan; trigger-ul append-only; paginarea; închiderea, trustee-ul care trișează și rezultatul; verificatorul; căutarea CNP-urilor în toată baza; un administrator care modifică board-ul direct în bază; jurnalul de audit. |
| `test/interval.e2e.test.ts` | 5 teste: vot înainte de deschidere, deschidere cu închiderea în trecut, 16 voturi simultane cu ore crescătoare care trec de verificator, ceasuri diferite pe instanțe (`boardTime`), închiderea automată. |
| `test/commission.e2e.test.ts` | 3 teste: membrii comisiei și rolurile (observatorul doar citește, revocarea, numele în jurnal), modificarea și ștergerea doar în configurare, votul alb. |
| `test/rate-limit.e2e.test.ts` | 3 teste: ghicirea token-ului comisiei e oprită cu 429, rutele publice nu sunt afectate, `/health`. |
| `test/cli.e2e.test.ts` | 1 test: CLI-urile reale rulate ca procese separate (keygen cu și fără parolă, status, decrypt refuzat înainte de închidere și fără parolă, decrypt reușit, verificarea online și offline, codul de ieșire la un hash publicat greșit). |

## `apps/web/`: site-ul

| Fișier | Ce face |
| --- | --- |
| `src/main.tsx` | Punctul de intrare: pornește React și încarcă `styles/index.css`. |
| `src/App.tsx` | Lista paginilor și adresele lor. |
| `src/api/index.ts` | Alege clientul: real dacă există `VITE_API_URL`, simulat altfel. |
| `src/api/admin.ts` | Ține token-ul comisiei în `sessionStorage` (se pierde la închiderea tab-ului), oferă ieșirea din cont, identitatea autentificată (`useAdmin`) și `canEdit` (doar rolul `comisie` vede butoanele care schimbă ceva). |
| `src/api/config.ts` | Citește `VITE_API_URL`. |
| `src/components/layout/Layout.tsx` | Bara de sus: logo, meniu (Scrutine, Comisie, Cum funcționează) și modul (simulat sau URL-ul serverului). |
| `src/components/layout/AdminGate.tsx` | Ecranul de login al comisiei. Verifică token-ul (rădăcină sau de membru) prin `/admin/check`, pune numele și rolul în context și abia apoi arată paginile comisiei. |
| `src/components/ui/` | Componente mici, una per fișier: `StatusBadge`, `Hash` (hash scurtat, la click se copiază întreg), `Stat`, `Countdown` („se închide peste…”), `Feedback` (`Loading`, `ErrorBox`, `Message`). |
| `src/pages/Home.tsx` | Lista scrutinelor, cu numărul de opțiuni (și „+ vot alb”) și cât mai e până la deschidere sau închidere. |
| `src/pages/About.tsx` | Explicația pentru public, cu formule. |
| `src/pages/commission/CommissionList.tsx` | Tabelul scrutinelor pentru comisie; cine e autentificat și cu ce rol. |
| `src/pages/commission/CommissionNew.tsx`, `CommissionEdit.tsx` | Crearea unui scrutin și modificarea lui în configurare. |
| `src/pages/commission/ElectionForm.tsx` | Formularul comun: titlu, interval, candidați (cu reordonare), votul alb, trustees (doar la creare). |
| `src/pages/commission/CommissionElection.tsx` | Pagina unui scrutin pentru comisie: starea, ceasul, modifică/șterge (în configurare), deschide/închide, trustees, opțiunile; restul în `parts/`. Observatorii văd tot, fără butoane. |
| `src/pages/commission/CommissionMembers.tsx` | Membrii comisiei: creare (token afișat o dată), listă, revocare. |
| `src/pages/commission/parts/` | `Steps` (etapele), `TrusteeTokens` (comenzile afișate o dată), `EligibleImport` (CSV-ul, și cu votul deschis), `BoardHead` (hash-ul de publicat independent), `AuditLog` (jurnalul, cu închiderea automată marcată), `MockToolsPanel` (uneltele de test, doar în mod simulat). |
| `src/pages/election/ElectionPublic.tsx` | Pagina publică: statisticile, ceasul și cele cinci tab-uri. |
| `src/pages/election/tabs/` | `BoardTab` (căutarea codului verifică local hash-urile; board-ul pe pagini de câte 50), `ResultTab` (votul alb separat), `VerificationTab` (verificatorul cu bară de progres și raport), `BenalohTab` (auditul unui buletin), `ParametersTab`. |
| `src/lib/format.ts`, `src/lib/useAsync.ts` | Formatările (re-exportate din `@evoting/api`) și încărcarea asincronă a datelor în pagini. |
| `src/styles/` | CSS-ul pe module, importate în ordine de `index.css`: `tokens` (culorile), `base`, `layout`, `cards`, `forms`, `feedback`, `tables`, `results`, `verification`, `responsive`. |
| `Dockerfile`, `nginx.conf` | Imaginea Docker: build-ul cu Vite, servit apoi de nginx. |

## `apps/mobile/`: aplicația

| Fișier | Ce face |
| --- | --- |
| `package.json` | Dependențele: Expo 57, React Native 0.86, expo-camera, expo-secure-store și pachetele comune, legate prin `file:../../packages/...`. Instalarea e separată de restul monorepo-ului, pentru că Expo cere React 19.2.3, iar site-ul cere ≥ 19.2.7. |
| `metro.config.js` | Îi spune lui Metro (împachetatorul React Native) să urmărească și folderul `packages/` și să caute dependențele în ambele `node_modules`. |
| `app.json` | Numele aplicației, pachetul Android `ro.udjg.evoting`, permisiunile CAMERA și NFC și pluginurile (router, secure store, cameră și pluginul nostru de împachetare). |
| `plugins/with-packaging-excludes.js` | Adaugă automat în proiectul Android generat excluderea fișierelor META-INF duplicate. Fără el, build-ul APK pica. |
| `src/lib/polyfills.ts` | Pe telefon (motorul Hermes) lipsește `crypto.getRandomValues`, pe care criptografia îl folosește pentru numerele aleatoare. Îl ia din `expo-crypto`. Se încarcă primul. |
| `src/lib/session.tsx` | Starea alegătorului per scrutin: credentialul (cheile), înregistrarea și chitanța, niciodată opțiunea votată. Se salvează în SecureStore (pe web, în localStorage). |
| `src/lib/native.ts` | Încarcă modulele native `EvotingNfc` și `EvotingOcr`, dacă există. În Expo Go sau pe web lipsesc și aplicația folosește variantele manuale. |
| `src/lib/theme.ts`, `format.ts`, `useAsync.ts` | Culorile, formatările (din `@evoting/api`), încărcarea datelor. |
| `src/api/index.ts`, `config.ts` | Alege clientul, real sau simulat. Pe telefon, scrutinele de demonstrație au mai puțini votanți. |
| `src/components/ui/` | O componentă per fișier: `Screen`, `Card`, `Button` (și `LinkButton`), `Tag` (și `StatusTag`), `Notice`, `Field`, `Typography` (`H1`, `H2`, `P`), `ModeBanner`, `Loading`; `tones.ts` are nuanțele semantice. |
| `src/components/election/` | Bucățile paginii scrutinului: `VoterSteps` (cei trei pași), `PrimaryAction` (butonul principal), `CandidateList` (cu nota despre votul alb), `ResultCard` (votul alb la final), `IntervalNote` („votul se închide peste…”). |
| `src/components/identity/` | `MrzSummary` (datele citite și cifrele de control), `ModeTabs` (cameră / text MRZ / CNP), `KeyValueRow`. |
| `src/components/vote/` | `CandidateOption` (opțiunea cu buton radio), `BallotReview` (confirmarea cu amprenta buletinului), `BenalohAudit` (auditul buletinului). |
| `src/app/_layout.tsx` | Navigarea: lista ecranelor și titlurile lor. |
| `src/app/index.tsx` | Lista scrutinelor, cu etichetele „Înregistrat” și „Ai votat”. |
| `src/app/scrutin/[id]/index.tsx` | Pagina unui scrutin: pașii alegătorului, acțiunea principală, candidații sau rezultatul. |
| `src/app/scrutin/[id]/inregistrare.tsx` | Alegerea între scanare și NFC, plus explicația re-înregistrării (alt telefon, înainte de vot). |
| `src/app/scrutin/[id]/ocr.tsx` | Trei moduri: Cameră (fotografie, OCR nativ, parsare MRZ), Text MRZ (introdus de mână sau „buletin de test”) și Doar CNP; apoi generează credentialul și se înregistrează. |
| `src/app/scrutin/[id]/nfc.tsx` | CAN-ul (6 cifre), apoi „Citește cipul” (modulul nativ) sau „Simulează citirea cipului” (fără modul nativ, în mod simulat). Trimite DG1 și SOD la server. |
| `src/app/scrutin/[id]/vot.tsx` | Alegerea candidatului, criptarea pe telefon, confirmarea, auditul Benaloh (recriptare după audit), trimiterea. |
| `src/app/scrutin/[id]/confirmare.tsx` | Codul de urmărire, cu buton de copiere. |
| `src/app/scrutin/[id]/verifica.tsx` | Caută codul pe board și recalculează local hash-urile; pentru buletinul propriu compară și cu amprenta păstrată. |
| `modules/evoting-nfc/` | Modulul nativ NFC, în Kotlin (detaliat mai jos). |
| `modules/evoting-ocr/` | Modulul nativ OCR, în Kotlin (detaliat mai jos). |
| `AGENTS.md` | Îndrumări generice pentru unelte AI, venite cu șablonul Expo. |

**`modules/evoting-nfc/.../EvotingNfcModule.kt`**, pe rând:

1. La creare înlocuiește BouncyCastle-ul redus din Android cu versiunea completă, pentru că PACE pe curbe eliptice are nevoie de ea.
2. `isSupported` / `isEnabled`: telefonul are NFC și e pornit?
3. `readDocument(can)`:
   - verifică dacă CAN-ul are 6 cifre;
   - pornește modul cititor NFC (`enableReaderMode`) și așteaptă cardul;
   - la apropierea cardului: IsoDep → `CardService` → `PassportService`;
   - citește EF.CardAccess, unde găsește parametrii PACE, apoi face `doPACE` cu cheia derivată din CAN;
   - selectează aplicația ICAO, citește **DG1** și **SOD** și le întoarce în base64.
   - Nu citește DG2 (poza) și nu folosește niciodată PIN-ul cardului.
4. `cancel` și oprirea la ieșirea din aplicație.

`build.gradle` aduce JMRTD 0.8.9, SCUBA (accesul la card pe Android) și BouncyCastle.

**`modules/evoting-ocr/.../EvotingOcrModule.kt`**: `recognizeText(uri)` deschide fotografia făcută de cameră, rulează ML Kit (modelul e inclus în aplicație, deci nu trimite imaginea nicăieri) și întoarce textul. Parsarea MRZ se face apoi în JavaScript, cu `packages/api/src/identity/mrz.ts`.

## `tools/`: programele în linia de comandă

**`tools/trustee/`** (`evoting-trustee`): `src/cli.ts` citește argumentele și alege comanda; `src/key-file.ts` scrie și citește fișierul de cheie (permisiuni 600, fără suprascriere, opțional cu cheia secretă criptată: scrypt + AES-256-GCM); `src/password.ts` ia parola din `--password`, din `TRUSTEE_KEY_PASSWORD` sau din terminal, fără ecou; `src/output.ts` afișează.

- **`commands/keygen.ts`:** verifică dacă trustee-ul există și n-a trimis deja cheia; cere parola dacă s-a dat `--encrypt`; generează xᵢ și scrie fișierul de cheie; abia apoi trimite Yᵢ cu dovada.
- **`commands/decrypt.ts`:** citește fișierul de cheie (cu parola, dacă e criptat) și descarcă tot scrutinul; verifică singur board-ul și agregatul, apoi refuză dacă ceva pică; altfel trimite decriptarea parțială.
- **`commands/status.ts`:** starea trustees.

**`tools/verifier/`** (`evoting-verify`): `src/cli.ts` și `src/output.ts`, plus:

- **`commands/verify.ts`:** descarcă de pe server sau citește dintr-un fișier salvat, poate primi hash-ul publicat independent prin `--head`, afișează pașii cu ✓/✗ și timpii, iar codul de ieșire e 0 doar dacă trece tot;
- **`commands/audit-ballot.ts`:** auditul Benaloh dintr-un fișier.

**`tools/simulator/`** (`evoting-simulate`): `src/cli.ts` rulează cele opt etape (scrutin, chei, import, alegători în paralel, închidere, decriptări, comparația rezultatului, verificarea publică) și afișează metricile. Ajutoarele sunt în `src/lib/`: `metrics.ts` (medie, mediană, p95, `timed`), `pool.ts` (paralelism limitat), `synthetic.ts` (CNP-uri reproductibile, opțiuni cu distribuție neuniformă, cipuri NFC de test), `output.ts`.

## `demos/`

| Fișier | Ce arată |
| --- | --- |
| `attacks/src/cnp-dictionary.ts` | Cu SHA-256, CNP-ul unei persoane se găsește în milisecunde dacă se știe data nașterii; cu HMAC fără cheie, niciodată. |
| `attacks/src/deterministic-encryption.ts` | La RSA fără padding, votul se ghicește comparând criptotextele; la ElGamal, nu. |
| `attacks/src/bsgs-vs-key.ts` | Totalurile se află în milisecunde; cheia privată, în ~10⁶³ ani. |
| `attacks/src/api-bruteforce.ts` | Încercările de token sunt blocate cu 429 după limită. |
| `attacks/src/tamper-board.ts` | Modifică un buletin direct în PostgreSQL, arată că verificatorul îl prinde exact, apoi restaurează. |
| `macheta/` | Macheta inițială, păstrată, cu un README care explică de ce a fost înlocuită. |

---

# Partea III: un vot urmărit prin tot sistemul

Exemplu concret: Ana votează candidatul B, din 3, într-un scrutin cu 2 trustees.

1. **Configurarea.**
   - Comisia creează scrutinul și primește token-urile (`POST /elections`). În baza de date intră doar hash-urile lor.
   - Trustee 1 rulează `evoting-trustee keygen`: x₁ rămâne în fișierul lui, iar serverul primește Y₁ și dovada. La fel trustee 2.
   - Serverul calculează Y = Y₁ + Y₂.
   - Comisia importă CSV-ul; în `eligible_voters` intră doar HMAC-ul CNP-ului Anei. Apoi deschide votul.
2. **Înregistrarea.**
   - Ana scanează buletinul. `mrz.ts` verifică cifrele de control și reconstituie CNP-ul.
   - Telefonul generează perechea Ed25519 și o pune în SecureStore.
   - `POST /register/ocr` trimite CNP-ul și cheia publică. Serverul calculează HMAC-ul, îl găsește în listă și inserează în `registrations` (HMAC, cheie publică, „ocr”, „optic”). CNP-ul nu se salvează.
3. **Votul.**
   - Ana alege B. `encryptBallot` produce trei criptotexte: Enc(0), Enc(1), Enc(0), cu r-uri diferite. Adaugă trei dovezi 0/1, o dovadă că suma e 1 și semnătura. Durează ~10–20 ms.
   - *(Opțional)* Ana apasă „Verifică întâi criptarea”, vede ✓ și buletinul se recriptează cu r noi.
   - `POST /auth/challenge` întoarce un nonce. Telefonul îl semnează, iar `POST /auth/verify` întoarce o sesiune de 10 minute.
   - `POST /elections/:id/ballots`: serverul verifică semnătura și dovezile, blochează scrutinul, verifică faptul că Ana n-a mai votat și ia ultima intrare (#41). Calculează intrarea #42 cu `prevHash` = hash-ul lui #41, o inserează și întoarce codul de urmărire = hash-ul lui #42.
4. **Verificarea proprie.** Ana caută codul. Telefonul recalculează `ballotHash` și hash-ul intrării și le compară cu codul și cu amprenta salvată: ✓.
5. **Închiderea.**
   - Comisia închide votul. Serverul adună toate cele 100 de buletine: (A_B, B_B) = suma criptotextelor candidatului B, adică Enc(37), dacă B a primit 37 de voturi. La fel pentru A și C.
   - Agregatul se publică.
6. **Decriptarea.**
   - Trustee 1 rulează `decrypt`. CLI-ul verifică tot board-ul, apoi trimite D₁ = x₁·A pentru fiecare candidat, cu dovezi. La fel trustee 2.
   - Serverul calculează B − D₁ − D₂ = 37·G și găsește 37 prin baby-step giant-step.
   - Rezultatul se publică, iar votul Anei nu a fost decriptat niciodată singur.
7. **Verificarea publică.** Oricine apasă „Verifică tot”. Verificatorul reface pașii 0–5 și confirmă, de exemplu, că suma celor 100 de buletine dă exact agregatul și că 37 e totalul corect pentru B.

---

# Partea IV: ce a arătat testul cu buletinul real

Când ai citit CEI-ul prin NFC cu APK-ul, a apărut „CNP-ul nu figurează în lista alegătorilor eligibili”.

Lanțul complet care a mers până acolo:

1. Modulul Kotlin a detectat cardul și a deschis **PACE cu CAN-ul tău**. Dacă CAN-ul era greșit, eroarea ar fi fost „PACE a eșuat”.
2. A citit **DG1 și SOD** de pe cip.
3. Backend-ul simulat de pe telefon a scos MRZ-ul din DG1, a verificat cifrele de control și **a extras un CNP valid**, cu data nașterii identică celei din MRZ. Dacă vreunul din pași ar fi eșuat, eroarea ar fi fost „DG1 nu conține un MRZ valid cu CNP”.
4. A căutat HMAC-ul CNP-ului în lista de eligibili a scrutinului de test. Lista conține doar CNP-uri fictive, deci a refuzat, corect.

Concluzii:

- Modulul nativ NFC funcționează pe un card real.
- Întrebarea deschisă din plan, *unde e CNP-ul pe cipul CEI*, e lămurită: în MRZ-ul din DG1, iar parserul îl găsește.
- Backend-ul simulat **nu verifică SOD-ul**: n-are certificatul CSCA al României. Verificarea completă se face doar pe serverul real, cu certificatul pus în `CSCA_DIR`.

---

# Partea V: ce rămâne de făcut

1. **Votul cu buletinul propriu în APK:** rezolvat pentru backend-ul simulat. Când înregistrarea (NFC sau OCR) e refuzată cu „CNP-ul nu figurează în lista alegătorilor eligibili”, apare butonul „Test: adaugă CNP-ul meu în lista de eligibili și reîncearcă”. Pe serverul real, CNP-ul trebuie importat de comisie în lista de eligibili.
2. **Server online:** backend-ul și baza nu sunt găzduite nicăieri. Trebuie un serviciu de găzduire (Render, Railway, un VPS) cu contul tău. Apoi APK-ul se reconstruiește cu `api_url`.
3. **Certificatul CSCA al României**, pentru Passive Authentication pe documente reale.
4. **Chip Authentication** (anti-clonare), opțională în plan.
5. **Măsurători pe telefon:** timpul de criptare pe un Android real și rata de citire corectă a OCR-ului, metrici cerute de plan.
6. ~~**Docker Compose cap-coadă**~~: rezolvat pe 18 noiembrie. Tot sistemul a pornit cu `docker compose up --build`, iar un scrutin complet a trecut prin HTTPS (Caddy).
7. **Varianta t-din-n** pentru trustees și o **autoritate de înregistrare separată**, extensii menționate în plan.

Lista completă a punctelor din analiză, cu ce s-a rezolvat și ce rămâne, e în [ANALIZA.md, secțiunea 5](ANALIZA.md#5-ce-s-a-rezolvat-după-analiză-1718-noiembrie).
