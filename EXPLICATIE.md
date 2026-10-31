# Explicația completă a proiectului

Documentul explică în detaliu tot ce s-a construit în acest repository, în ordinea în care s-a construit, și ce face fiecare fișier. Teoria (formulele, modelul de amenințare, rezultatele) e în [DOCUMENTATIE.md](DOCUMENTATIE.md). Aici e partea practică: ce s-a scris, unde, de ce așa și cum se leagă bucățile între ele.

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
- Cele **17 teste end-to-end** rulează pe un PostgreSQL real și trec toate.

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

---

# Partea II: fiecare fișier, pe rând

## Rădăcina

| Fișier | Ce face |
| --- | --- |
| `package.json` | Declară monorepo-ul (workspaces), scripturile `build`, `test`, `typecheck` și o versiune corectată a bibliotecii `multer`, adusă de NestJS, care avea o vulnerabilitate cunoscută. |
| `package-lock.json` | Versiunile exacte ale tuturor dependențelor, ca instalarea să fie identică peste tot. |
| `tsconfig.base.json` | Setările TypeScript comune tuturor pachetelor. |
| `.gitignore` | Ce nu intră în Git: `node_modules`, `dist`, `.env` (secrete), `.idea`, fișierele cu chei de trustee. |
| `.dockerignore` | Ce nu se copiază în imaginile Docker. |
| `.env.example` | Model pentru `.env` la Docker Compose: cheia HMAC, token-ul comisiei, parola bazei. |
| `docker-compose.yml` | Trei servicii: `db` (PostgreSQL), `backend` (port 3000), `web` (port 8080). |
| `README.md` | Prezentarea scurtă și pornirea rapidă. |
| `DOCUMENTATIE.md` | Documentația completă: teorie, pași, securitate, evaluare. |
| `EXPLICATIE.md` | Acest document. |
| `apk/vot-verificabil.apk` | Aplicația Android construită de GitHub Actions. |
| `docs/evaluare/*.json` | Metricile măsurate la 100, 1.000 și 10.000 de alegători. |

## `.github/workflows/`

| Fișier | Ce face |
| --- | --- |
| `ci.yml` | La fiecare push, pe serverele GitHub: instalează tot, rulează cele 63 de teste (cu un PostgreSQL pornit ca serviciu), construiește tot, apoi verifică tipurile aplicației mobile și o împachetează pentru Android. |
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
| 1. Lanțul | Poziții consecutive, hash-ul anterior, hash-ul recalculat al fiecărui buletin și al fiecărei intrări; opțional, hash-ul publicat independent |
| 2. Credentialele | Fiecare buletin vine de la un credential înregistrat, câte unul per credential, cu semnătură validă |
| 3. Dovezile | Dovezile ZK ale fiecărui buletin |
| 4. Agregatul | Recalculat de la zero și comparat cu cel publicat |
| 5. Decriptarea | Dovezile trustees, apoi totalurile recalculate și comparate cu rezultatul publicat |

Fiecare eroare e raportată cu locul exact, de exemplu „buletinul #42”. Opțiunea `yieldEvery` lasă browserul să respire între buletine, ca pagina să nu înghețe.

### `src/index.ts`

Exportă tot ce folosesc celelalte pachete.

### `test/crypto.test.ts` și `test/helpers.ts`

35 de teste, grupate pe teme:

- **Codificări:** JSON canonic, HMAC pe vectorul oficial RFC 4231, scalari, puncte invalide.
- **ElGamal:** decriptare corectă, randomizare (același vot dă criptotexte diferite), proprietatea homomorfă, BSGS.
- **Dovezi:** buletin corect acceptat; respinse: vot 2, vot −1, suma 2, suma 0, „viclean” +2/−1, dovezi refolosite în alt scrutin, buletin copiat de alt credential, criptotext înlocuit.
- **Benaloh:** auditul prinde o aplicație care criptează altceva.
- **Trustees:** dovada legată de scrutin, decriptarea cere toți trustees, trustee care trișează.
- **Verificator:** 11 tipuri de manipulare (buletin modificat, hash-uri refăcute, ordine schimbată, buletin șters, vot adăugat, decriptare modificată, rezultat falsificat, agregat greșit, istorie rescrisă, cheie fără dovadă), toate prinse.

`helpers.ts` conține `simulateElection`, care face un scrutin complet fără server.

### `package.json`, `tsconfig*.json`, `.gitignore`

Numele pachetului (`@evoting/crypto`), comenzile `build` și `test` și setările de compilare. `dist/` (codul compilat) nu intră în Git.

## `packages/api/`: stratul comun

| Fișier | Ce face |
| --- | --- |
| `src/types.ts` | Contractul HTTP: `Election`, `Trustee`, `Registration`, `BallotReceipt`, `AuditBundleResponse` etc., `ApiError` (eroare cu cod HTTP) și interfața `ApiClient` cu toate metodele. Clientul real și cel simulat o implementează la fel, deci ecranele nu știu cu care vorbesc. |
| `src/http.ts` | Clientul real. Fiecare metodă face un `fetch` la ruta corespunzătoare. Adaugă `Authorization: Bearer …` (token-ul comisiei, al trustee-ului sau sesiunea alegătorului), transformă erorile NestJS în mesaje în română și tratează 429 („Prea multe încercări”). |
| `src/mock.ts` | Backend-ul simulat, în memorie, cu **aceleași reguli** ca serverul și criptografie reală. Creează la prima cerere trei scrutine de demonstrație: unul deschis, unul în configurare, unul numărat. Are „unelte de test” care țin locul trustees și al alegătorilor. Nu verifică SOD-ul la NFC, pentru că n-are certificate. |
| `src/cnp.ts` | Validarea CNP-ului (13 cifre, sex/secol, dată existentă, județ, cifra de control cu cheia 279146358279) și un generator de CNP-uri fictive valide. |
| `src/mrz.ts` | Parserul MRZ: curăță textul OCR („«” → „<”, spații, confuziile O/0 și I/1), recunoaște formatele TD1 (CEI), TD2 (buletinul vechi) și TD3 (pașaport), verifică cifrele de control ICAO (ponderi 7-3-1) și reconstituie CNP-ul. Acceptă doar un CNP valid și cu aceeași dată de naștere ca MRZ-ul. Construiește și MRZ-uri de test (`buildTd1`, `buildTd2`). |
| `src/dg1.ts` | DG1 e structura `61 { 5F1F <MRZ> }`. Funcțiile scot MRZ-ul din DG1 (și invers, pentru teste) și convertesc base64 ↔ octeți. |
| `src/voter.ts` | Pașii alegătorului: `authenticate` (cere provocarea, o semnează, primește sesiunea), `prepareBallot` (criptează), `submitBallot` (autentifică și trimite), `verifyOwnBallot` (caută codul și verifică local). |
| `src/index.ts` | Exportă tot. |
| `test/api.test.ts` | 11 teste: CNP, exemplele oficiale ICAO TD1 și TD2, buletinul vechi, CEI, zgomot OCR, DG1 și un scrutin complet pe backend-ul simulat, verificat la final de verificatorul public. |

## `apps/backend/`: serverul

### Configurare și pornire

| Fișier | Ce face |
| --- | --- |
| `.env.example` | Modelul de configurare: `DATABASE_URL`, `CNP_HMAC_KEY` (32 de octeți hex), `ADMIN_TOKEN`, `CSCA_DIR` (certificatele de încredere), `PORT`, `CORS_ORIGINS`, `RATE_LIMIT`. |
| `src/config.ts` | Citește variabilele de mediu și refuză pornirea dacă lipsește ceva sau cheia HMAC e prea scurtă. |
| `src/main.ts` | Pornește serverul pe portul configurat. |
| `src/app.ts` | Aplică migrările, creează aplicația Nest, acceptă JSON și CSV (pentru importul eligibililor) și activează CORS. |
| `src/app.module.ts` | Leagă totul: controllerele, serviciile, baza de date și limitarea de rată (600 de cereri pe minut per IP în general). |

### Baza de date

| Fișier | Ce face |
| --- | --- |
| `migrations/001_init.sql` | Creează cele **nouă tabele** (DOCUMENTATIE §7.1) și **trigger-ul** care interzice `UPDATE` și `DELETE` pe `ballots`, adică board-ul append-only. Constrângerile `UNIQUE` garantează o înregistrare per persoană și un vot per credential chiar și la cereri simultane. |
| `src/db/database.service.ts` | Conexiunea la PostgreSQL (un pool de 20 de conexiuni), cu ajutorul `transaction(...)` (BEGIN … COMMIT, ROLLBACK la eroare) și `isUniqueViolation`, care recunoaște eroarea „există deja”. |
| `src/db/migrate.ts` | Aplică fișierele din `migrations/` o singură dată, în ordine. Ține evidența în `schema_migrations` și folosește un lacăt ca două instanțe să nu migreze simultan. |
| `src/db/migrate-cli.ts` | Același lucru, rulat din linia de comandă. |

### Securitate comună

| Fișier | Ce face |
| --- | --- |
| `src/common/security.ts` | Token-uri aleatoare, SHA-256, comparație **în timp constant** (`safeEqual`, ca un atacator să nu afle literele corecte din timpul de răspuns), citirea antetului `Bearer` și sesiunile alegătorilor: un text semnat cu HMAC, valabil 10 minute, fără să fie nevoie de stocare. |
| `src/common/admin.guard.ts` | Verifică token-ul comisiei pe rutele de administrare. |
| `src/common/throttle.ts` | Limita strictă pentru rutele sensibile: implicit 30 de cereri pe minut per IP. |
| `src/common/validate.ts` | Verifică datele primite (text, dată, obiect, listă) și întoarce erori clare, în română. |
| `src/common/audit.service.ts` | Scrie și citește jurnalul de audit. |

### Logica

**`src/elections/elections.service.ts`** conține logica scrutinelor:

- **Citiri publice:** `list`, `get` (scrutinul cu candidații, trustees și statisticile), `board`, `findBallot`, `head`, `registrations` (doar credentialele, fără identitate), `tally`, `result`, `auditBundle` (tot, dintr-un singur instantaneu consistent al bazei).
- **`create`:** validează datele, creează scrutinul, candidații și trustees și generează câte un token per trustee. Salvează doar hash-ul token-ului și îl întoarce în clar o singură dată.
- **`importEligible`:** citește CSV-ul, validează fiecare CNP, calculează HMAC-ul și **aruncă CNP-ul în clar**, apoi inserează în grupuri de câte 1.000. În răspuns, CNP-urile invalide apar mascate.
- **`open`:** permis doar cu toate cheile primite și lista nevidă.
- **`close`:** calculează și salvează agregatul.
- **`submitTrusteeKey`:** verifică token-ul și dovada Schnorr, salvează Yᵢ și, după ultimul trustee, publică Y.
- **`lock`:** `SELECT … FOR UPDATE` pe rândul scrutinului. Schimbările de stare și adăugările pe board se fac astfel una câte una, fără conflicte.

**`src/elections/elections.controller.ts`** leagă rutele HTTP (`GET /elections`, `POST /elections/:id/open` etc.) de metodele serviciilor și pune protecțiile: token de comisie sau limita strictă.

**`src/voting/voting.service.ts`** se ocupă de alegător:

- **`registerOcr`:** validează CNP-ul, apoi înregistrează.
- **`registerNfc`:** decodează DG1 și SOD, face Passive Authentication, extrage MRZ-ul din DG1, verifică cifrele de control și expirarea, extrage CNP-ul, apoi înregistrează cu nivelul „criptografic”.
- **`register`** (comun): calculează HMAC(CNP), verifică eligibilitatea, inserează și traduce erorile „există deja” în mesaje clare. În jurnal nu intră HMAC-ul, ca un credential să nu poată fi legat de o persoană.
- **`challenge` și `verify`:** provocarea (un nonce de 32 de octeți, valabil 2 minute, ținut în memorie) și verificarea semnăturii, după care se emite sesiunea. Provocarea se consumă la prima încercare.
- **`cast`:**
  1. verifică sesiunea;
  2. reconstruiește buletinul doar din câmpurile cunoscute;
  3. verifică semnătura și dovezile **în afara tranzacției**, pentru că durează ~25 ms și n-ar trebui să țină board-ul blocat;
  4. în tranzacție verifică din nou starea, înregistrarea și votul anterior, construiește intrarea legată de cea precedentă, o inserează și întoarce codul de urmărire.

**`src/tally/tally.service.ts`** primește decriptarea unui trustee și verifică dovezile față de agregat. După ultimul trustee combină decriptările, află totalurile, publică rezultatul și trece scrutinul în `tallied`.

**`src/auth/auth.controller.ts`** conține rutele `/auth/challenge`, `/auth/verify`, `/health` și `/admin/check`.

### NFC

**`src/nfc/passive-auth.ts`** face verificarea propriu-zisă:

1. Scoate ambalajul `0x77` din EF.SOD și citește structura CMS SignedData.
2. Verifică dacă e un LDSSecurityObject și citește din el hash-urile grupurilor de date.
3. Compară hash-ul DG1 primit cu cel semnat. Un DG1 modificat pică aici.
4. Verifică atributele semnate: `messageDigest` = hash-ul conținutului, `contentType` = LDSSecurityObject.
5. Verifică semnătura Document Signer-ului, prin OpenSSL. Suportă ECDSA (inclusiv curbele brainpool), RSA și RSA-PSS.
6. Verifică faptul că DSC-ul e emis și semnat de un CSCA din lista de încredere și că ambele certificate sunt valabile.

**`src/nfc/passive-auth.service.ts`** încarcă certificatele CSCA din `CSCA_DIR` la pornire și apelează verificarea.

**`src/nfc/test-pki.ts`** și **`test-pki-cli.ts`** creează un CSCA și un DSC de test, cu chei ECDSA P-256, și „cipuri” de test: DG1 cu un MRZ dat și SOD semnat. Serverul are încredere în ele doar dacă certificatul de test e pus explicit în `CSCA_DIR`.

### Docker și teste

**`Dockerfile`** și **`docker-entrypoint.sh`** construiesc imaginea serverului. La pornire, dacă `GENERATE_TEST_PKI=true`, generează PKI-ul de test (doar pentru demo).

**`test/e2e.test.ts`** și **`helpers.ts`** conțin cele 17 teste end-to-end. Golesc baza de test, pornesc serverul real și parcurg:

- crearea scrutinului și token-urile;
- cheile trustees, inclusiv token greșit și dovadă falsă;
- importul eligibililor, cu verificarea că în bază sunt doar HMAC-uri;
- înregistrarea OCR;
- înregistrarea NFC: cip valid acceptat; respinse: DG1 modificat, CSCA străin, semnătură alterată;
- votul, autentificarea și buletinele invalide;
- votul dublu simultan;
- trigger-ul append-only;
- închiderea, trustee-ul care trișează și rezultatul;
- verificatorul;
- căutarea CNP-urilor în toată baza;
- un administrator care modifică board-ul direct în bază;
- jurnalul de audit;
- limitarea de rată.

## `apps/web/`: site-ul

| Fișier | Ce face |
| --- | --- |
| `src/api/index.ts` | Alege clientul: real dacă există `VITE_API_URL`, simulat altfel. |
| `src/api/admin.ts` | Ține token-ul comisiei în `sessionStorage` (se pierde la închiderea tab-ului) și oferă ieșirea din cont. |
| `src/api/config.ts` | Citește `VITE_API_URL`. |
| `src/components/AdminGate.tsx` | Ecranul de login al comisiei. Verifică token-ul prin `/admin/check` și abia apoi arată paginile comisiei. |
| `src/components/Layout.tsx` | Bara de sus: logo, meniu (Scrutine, Comisie, Cum funcționează) și modul (simulat sau URL-ul serverului). |
| `src/components/ui.tsx` | Componente mici: insigna de stare, hash-ul scurtat (la click se copiază întreg), cifrele statistice, mesajele de eroare. |
| `src/pages/Home.tsx` | Lista scrutinelor. |
| `src/pages/Commission.tsx` | Tabelul scrutinelor pentru comisie. |
| `src/pages/CommissionNew.tsx` | Formularul de creare: titlu, interval, candidați (cu reordonare), trustees. |
| `src/pages/CommissionElection.tsx` | Pagina unui scrutin pentru comisie: pașii, deschidere/închidere, comenzile trustees afișate o dată, trustees și candidații, importul CSV, hash-ul de publicat independent, jurnalul de audit și uneltele de test (doar în mod simulat). |
| `src/pages/ElectionPublic.tsx` | Pagina publică, cu tab-urile Bulletin board (căutarea codului verifică local hash-urile), Rezultat, Verificare publică (verificatorul cu bară de progres și raport), Audit buletin (Benaloh) și Parametri publici. |
| `src/pages/About.tsx` | Explicația pentru public, cu formule. |
| `src/lib/format.ts`, `src/lib/useAsync.ts` | Formatarea datelor și încărcarea asincronă a datelor în pagini. |
| `src/index.css` | Stilurile. |
| `Dockerfile`, `nginx.conf` | Imaginea Docker: build-ul cu Vite, servit apoi de nginx. |

## `apps/mobile/`: aplicația

| Fișier | Ce face |
| --- | --- |
| `package.json` | Dependențele: Expo 57, React Native 0.86, expo-camera, expo-secure-store și pachetele comune, legate prin `file:../../packages/...`. Instalarea e separată de restul monorepo-ului, pentru că Expo cere React 19.2.3, iar site-ul cere ≥ 19.2.7. |
| `metro.config.js` | Îi spune lui Metro (împachetatorul React Native) să urmărească și folderul `packages/` și să caute dependențele în ambele `node_modules`. |
| `app.json` | Numele aplicației, pachetul Android `ro.udjg.evoting`, permisiunile CAMERA și NFC și pluginurile (router, secure store, cameră și pluginul nostru de împachetare). |
| `plugins/with-packaging-excludes.js` | Adaugă automat în proiectul Android generat excluderea fișierelor META-INF duplicate. Fără el, build-ul APK pica. |
| `src/lib/polyfills.ts` | Pe telefon (motorul Hermes) lipsește `crypto.getRandomValues`, pe care criptografia îl folosește pentru numerele aleatoare. Îl ia din `expo-crypto`. Se încarcă primul, înaintea oricărui alt cod. |
| `src/lib/session.tsx` | Starea alegătorului per scrutin: credentialul (cheile), înregistrarea și chitanța, niciodată opțiunea votată. Se salvează în SecureStore (pe web, în localStorage) și se reîncarcă la pornire. |
| `src/lib/native.ts` | Încarcă modulele native `EvotingNfc` și `EvotingOcr`, dacă există. În Expo Go sau pe web lipsesc și aplicația folosește variantele manuale. |
| `src/api/index.ts` | Alege clientul, real sau simulat. Pe telefon, scrutinele de demonstrație au mai puțini votanți, pentru că acolo criptarea e mai lentă. |
| `src/app/_layout.tsx` | Navigarea: lista ecranelor și titlurile lor. |
| `src/app/index.tsx` | Lista scrutinelor, cu etichetele „Înregistrat” și „Ai votat”. |
| `src/app/scrutin/[id]/index.tsx` | Pagina unui scrutin: pașii alegătorului, acțiunea principală, candidații sau rezultatul. |
| `src/app/scrutin/[id]/inregistrare.tsx` | Alegerea între scanare și NFC. |
| `src/app/scrutin/[id]/ocr.tsx` | Trei moduri: Cameră (fotografie, OCR nativ, parsare MRZ), Text MRZ (introdus de mână sau „buletin de test”) și Doar CNP. Arată datele citite și rezultatul fiecărei cifre de control, apoi generează credentialul și se înregistrează. |
| `src/app/scrutin/[id]/nfc.tsx` | CAN-ul (6 cifre), apoi „Citește cipul” (modulul nativ) sau „Simulează citirea cipului” (fără modul nativ, în mod simulat). Trimite DG1 și SOD la server. |
| `src/app/scrutin/[id]/vot.tsx` | Alegerea candidatului, criptarea pe telefon (cu timpul afișat), confirmarea cu amprenta buletinului, auditul Benaloh (verificare locală, copierea datelor de audit, recriptare), trimiterea și chitanța. |
| `src/app/scrutin/[id]/confirmare.tsx` | Codul de urmărire, cu buton de copiere. |
| `src/app/scrutin/[id]/verifica.tsx` | Caută codul pe board și recalculează local hash-urile; pentru buletinul propriu compară și cu amprenta păstrată. |
| `src/components/ui.tsx`, `src/lib/theme.ts`, `src/lib/format.ts`, `src/lib/useAsync.ts` | Componentele vizuale, culorile, formatarea, încărcarea datelor. |
| `modules/evoting-nfc/` | Modulul nativ NFC, în Kotlin (detaliat mai jos). |
| `modules/evoting-ocr/` | Modulul nativ OCR, în Kotlin (detaliat mai jos). |
| `.claude/settings.json`, `AGENTS.md` | Existau deja în proiect din primul commit, generate de șablonul Expo. Nu fac parte din aplicație. |

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

**`modules/evoting-ocr/.../EvotingOcrModule.kt`**: `recognizeText(uri)` deschide fotografia făcută de cameră, rulează ML Kit (modelul e inclus în aplicație, deci nu trimite imaginea nicăieri) și întoarce textul. Parsarea MRZ se face apoi în JavaScript, cu `packages/api/src/mrz.ts`.

## `tools/`: programele în linia de comandă

**`tools/trustee/src/cli.ts`:**

- **`keygen`:**
  1. verifică dacă trustee-ul există și n-a trimis deja cheia;
  2. generează xᵢ și scrie fișierul de cheie, cu permisiuni 600 și fără să suprascrie unul existent;
  3. abia apoi trimite Yᵢ cu dovada.
- **`decrypt`:**
  1. citește fișierul de cheie și descarcă tot scrutinul;
  2. verifică singur board-ul și agregatul, apoi refuză dacă ceva pică;
  3. altfel trimite decriptarea parțială.
- **`status`:** starea trustees.

**`tools/verifier/src/cli.ts`:**

- **verificarea completă:** descarcă de pe server sau citește dintr-un fișier salvat, poate primi hash-ul publicat independent prin `--head`, afișează pașii cu ✓/✗ și timpii, iar codul de ieșire e 0 doar dacă trece tot;
- **`audit-ballot`:** auditul Benaloh dintr-un fișier.

**`tools/simulator/src/cli.ts`:**

1. creează un scrutin cu trustees și importă N CNP-uri fictive;
2. pentru fiecare alegător, în paralel: înregistrare (OCR sau NFC, cu cipuri de test), autentificare, criptare, trimitere;
3. închide votul și rulează decriptarea fiecărui trustee;
4. compară rezultatul publicat cu voturile simulate și rulează verificatorul;
5. afișează și salvează metricile.

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

1. **Votul cu buletinul propriu în APK:** e nevoie de un buton de test care adaugă CNP-ul citit în lista de eligibili a backend-ului simulat, sau de un server real în a cărui listă e importat CNP-ul.
2. **Server online:** backend-ul și baza nu sunt găzduite nicăieri. Trebuie un serviciu de găzduire (Render, Railway, un VPS) cu contul tău. Apoi APK-ul se reconstruiește cu `api_url`.
3. **Certificatul CSCA al României**, pentru Passive Authentication pe documente reale.
4. **Chip Authentication** (anti-clonare), opțională în plan.
5. **Măsurători pe telefon:** timpul de criptare pe un Android real și rata de citire corectă a OCR-ului, metrici cerute de plan.
6. **Docker Compose cap-coadă:** fișierul e valid, dar build-ul n-a rulat în mediul de lucru (Docker Hub a limitat descărcările). Pe calculatorul tău ar trebui să meargă cu `docker compose up --build`.
7. **Varianta t-din-n** pentru trustees și o **autoritate de înregistrare separată**, extensii menționate în plan.
