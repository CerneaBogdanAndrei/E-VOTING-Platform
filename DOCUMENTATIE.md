# Sistem de vot electronic verificabil: documentație pas cu pas

Documentul explică ce face sistemul, cum îl pornești și cum se desfășoară un scrutin de la configurare la verificarea publică. Explică apoi ce se întâmplă în interior la fiecare pas, cu formulele și fișierele din cod. Ultimele secțiuni arată cum s-a testat totul și ce limitări rămân.

> Scenariul principal: alegerile studențești de la UDJG (reprezentanți în Consiliul facultății și în Senat). Totul e scris în TypeScript, într-un monorepo. Criptografia există o singură dată, în `packages/crypto`, și e folosită de server, aplicația mobilă, site, CLI-ul de trustee și verificator.

## Cuprins

1. [Ideea pe scurt](#1-ideea-pe-scurt)
2. [Arhitectura și structura repository-ului](#2-arhitectura-și-structura-repository-ului)
3. [Pornire](#3-pornire)
4. [Un scrutin complet, pas cu pas](#4-un-scrutin-complet-pas-cu-pas)
5. [Ce se întâmplă în interior: criptografia](#5-ce-se-întâmplă-în-interior-criptografia)
6. [Identitatea: CNP, MRZ și NFC](#6-identitatea-cnp-mrz-și-nfc)
7. [Backend-ul: tabele, rute, reguli](#7-backend-ul-tabele-rute-reguli)
8. [Modelul de amenințare și cum e acoperit](#8-modelul-de-amenințare-și-cum-e-acoperit)
9. [Demonstrațiile de atac](#9-demonstrațiile-de-atac)
10. [Teste și evaluare](#10-teste-și-evaluare)
11. [Limitări și ce rămâne de făcut](#11-limitări-și-ce-rămâne-de-făcut)
12. [Comparație cu Helios și Belenios](#12-comparație-cu-helios-și-belenios)
13. [Glosar](#13-glosar)

---

## 1. Ideea pe scurt

Alegătorul își criptează votul pe telefon, iar totul se publică criptat pe un *bulletin board*. Voturile se adună fără să fie decriptate individual (proprietatea homomorfă), iar trustees decriptează doar totalul. Oricine poate verifica matematic, cu un program public, că:

- **votul e criptat cum a vrut alegătorul**: provocarea Benaloh;
- **e înregistrat cum a fost trimis**: codul de urmărire și lanțul de hash-uri;
- **e numărat cum a fost înregistrat**: agregatul recalculabil și dovezile de decriptare.

Aceasta e **verificabilitatea end-to-end**. Celelalte obiective din plan sunt:

| Obiectiv | Cum e atins |
| --- | --- |
| Secretul votului | Se decriptează doar totalurile. Cheia e împărțită între toți trustees (n-din-n). |
| Eligibilitate, un vot per persoană | Listă de eligibili, o înregistrare per HMAC(CNP), un vot per credential. |
| Protecția CNP-ului | Serverul stochează doar `HMAC-SHA256(k, CNP)`, cu cheia k ținută în afara bazei de date. |
| Voturi valide | Dovezi zero-knowledge: fiecare criptotext e 0 sau 1, iar suma e exact 1. |

Limitări asumate (din plan): rezistența la constrângere și la cumpărarea voturilor, încrederea în telefonul alegătorului și alegerile naționale nu sunt acoperite.

---

## 2. Arhitectura și structura repository-ului

```
                    ┌────────────────────────┐
  Alegător ───────▶ │ apps/mobile (Expo/RN)  │──┐
  (telefon)         │ + module Kotlin NFC/OCR│  │
                    └────────────────────────┘  │   HTTP/JSON
  Comisie,          ┌────────────────────────┐  │  ┌──────────────────────┐   ┌────────────┐
  observatori ────▶ │ apps/web (React/Vite)  │──┼─▶│ apps/backend (NestJS)│──▶│ PostgreSQL │
                    └────────────────────────┘  │  └──────────────────────┘   └────────────┘
  Trustee ────────▶   tools/trustee (CLI)  ─────┤
  Auditor ────────▶   tools/verifier (CLI) ─────┘
                         ▲
        toate folosesc packages/crypto (+ packages/api pentru contractul HTTP)
```

Toate componentele vorbesc doar cu backend-ul. O dovadă generată pe telefon e verificată de **exact același cod** pe server, în browser și în verificatorul CLI.

```
packages/crypto/     ElGamal pe ristretto255, dovezi ZK, board, numărare, verificatorul public (+ 35 de teste)
packages/api/        contractul HTTP (tipuri), clientul, backend-ul simulat, CNP, MRZ, DG1 (+ 11 teste)
apps/backend/        NestJS + PostgreSQL: înregistrare, autentificare, board, numărare, Passive Authentication (+ 17 teste e2e)
apps/web/            panoul comisiei și pagina publică: board, rezultat, verificare publică, audit Benaloh
apps/mobile/         aplicația alegătorului (Expo + Expo Router) și modulele native modules/evoting-nfc, modules/evoting-ocr
tools/trustee/       CLI: generarea cheii xᵢ, decriptarea parțială
tools/verifier/      CLI: verificarea publică completă, auditul Benaloh
tools/simulator/     alegeri simulate cap-coadă cu alegători sintetici și metrici de performanță
demos/attacks/       cele cinci demonstrații de atac
demos/macheta/       macheta inițială (MODP-2048, într-un singur fișier HTML), păstrată pentru istoric
docs/evaluare/       rezultatele măsurate ale simulărilor
docker-compose.yml   PostgreSQL + backend + web, pentru demo
```

Tehnologiile, conform planului:

| Componentă | Tehnologie |
| --- | --- |
| Criptografie | TypeScript, `@noble/curves` (ristretto255, Ed25519), `@noble/hashes` (SHA-256/512, HMAC) |
| Backend | NestJS 12, PostgreSQL 16 (driverul `pg`, SQL scris de mână), `pkijs`/`asn1js` pentru SOD |
| Web | React 19, Vite, React Router |
| Mobil | React Native 0.86, Expo SDK 57, Expo Router, `expo-secure-store`, `expo-camera`; Kotlin cu JMRTD 0.8.9 și ML Kit |
| CLI | Node.js ≥ 22 |
| Infrastructură | Docker Compose |

---

## 3. Pornire

### 3.1 Cerințe

- Node.js 22.12 sau mai nou și npm 10.
- PostgreSQL 16, local sau prin Docker. Nu e nevoie de el pentru modul simulat.
- Pentru telefon: Expo Go, sau Android Studio pentru un development build cu NFC și OCR.

### 3.2 Instalare și teste

```bash
npm install                 # instalează toate pachetele monorepo-ului (fără aplicația mobilă)
npm run build               # construiește pachetele, backend-ul, CLI-urile și site-ul
npm test                    # 35 + 11 teste unitare și 17 teste end-to-end pe PostgreSQL
```

Testele end-to-end folosesc baza `postgres://evoting:evoting@localhost:5432/evoting_test`, sau variabila `TEST_DATABASE_URL`. Dacă baza nu e disponibilă, sunt sărite cu un mesaj. Pentru a o crea:

```bash
sudo -u postgres psql -c "CREATE ROLE evoting LOGIN PASSWORD 'evoting' CREATEDB"
sudo -u postgres psql -c "CREATE DATABASE evoting OWNER evoting"
sudo -u postgres psql -c "CREATE DATABASE evoting_test OWNER evoting"
```

### 3.3 Fără server: backend-ul simulat

Fără nicio configurare, site-ul și aplicația mobilă folosesc un backend simulat în memorie (`packages/api/src/mock.ts`). Are aceleași reguli ca serverul și **criptografie reală**: chei de trustee cu dovezi, buletine verificate, agregat și decriptări parțiale. Are trei scrutine de test și „Unelte de test” care țin locul trustees și al alegătorilor.

```bash
npm run dev -w @evoting/web            # http://localhost:5173
cd apps/mobile && npm install && npx expo start   # scanezi QR-ul cu Expo Go sau apeși „w”
```

### 3.4 Cu backend-ul real

```bash
cd apps/backend
cp .env.example .env
# completează CNP_HMAC_KEY (openssl rand -hex 32) și ADMIN_TOKEN (openssl rand -hex 24)
npm run build -w @evoting/backend
npm run test-pki -w @evoting/backend -- pki   # opțional: PKI de test pentru cipuri NFC simulate
npm run dev                                    # aplică migrările și pornește pe :3000
```

Apoi îndrepți clienții spre server:

- web: `VITE_API_URL=http://localhost:3000` în `apps/web/.env.local`, apoi `npm run dev -w @evoting/web`;
- mobil: `EXPO_PUBLIC_API_URL=http://<IP-ul calculatorului>:3000` în `apps/mobile/.env.local`. Pe telefon, `localhost` e telefonul însuși.

### 3.5 Docker Compose

```bash
cp .env.example .env     # completează CNP_HMAC_KEY și ADMIN_TOKEN
docker compose up --build
# web: http://localhost:8080   API: http://localhost:3000
```

Compose pornește PostgreSQL, backend-ul (care aplică singur migrările și, pentru demo, generează un PKI de test în volumul `pki`) și site-ul servit de nginx.

### 3.6 Aplicația mobilă cu NFC și OCR

Modulele native nu există în Expo Go, deci e nevoie de un *development build* Android:

```bash
cd apps/mobile
npx expo run:android          # cere Android SDK; generează android/ (nu se versionează)
```

În Expo Go și pe web, aplicația trece automat pe variante de rezervă:

- **OCR:** introducerea manuală a rândurilor MRZ, cu aceleași verificări.
- **NFC:** cu backend-ul simulat, citirea cipului se simulează; cu serverul real, NFC-ul cere development build-ul.

---

## 4. Un scrutin complet, pas cu pas

Exemplul de mai jos rulează pe backend-ul real. Același flux merge și în modul simulat, cu butoanele „Simulează…” în locul CLI-urilor.

### Pasul 1: comisia creează scrutinul

1. Pe site, **Comisie**: introduci token-ul comisiei (`ADMIN_TOKEN`). Rămâne doar în tab-ul curent, iar încercările greșite repetate primesc `429`.
2. **Scrutin nou**: titlu, interval, candidați (ordinea definește poziția în vectorul de vot) și trustees.
3. După creare, pagina afișează **o singură dată** comanda fiecărui trustee, cu token-ul lui. Serverul păstrează doar `SHA-256(token)` (tabela `trustees.token_hash`).

În cod: `ElectionsService.create` (`apps/backend/src/elections/elections.service.ts`), ruta `POST /elections`.

### Pasul 2: fiecare trustee își generează cheia

Pe calculatorul trustee-ului:

```bash
npx evoting-trustee keygen --api http://localhost:3000 --election <ID> --trustee <ID>-t1 --token <TOKEN>
```

- CLI-ul alege local un scalar aleator xᵢ și îl salvează în `<trustee>.trustee-key.json`, cu permisiuni 600. Fișierul se scrie înainte de trimitere, ca cheia să nu se poată pierde.
- Pe server pleacă doar **Yᵢ = xᵢG** și o **dovadă Schnorr** că trustee-ul cunoaște xᵢ, legată de scrutin și de trustee.
- Serverul verifică dovada. Când au trimis toți, publică cheia scrutinului **Y = Y₁ + … + Yₙ**.

În cod: `tools/trustee/src/cli.ts`, `generateTrusteeKey` și `verifyTrusteeKey` (`packages/crypto/src/trustee.ts`), `ElectionsService.submitTrusteeKey`.

### Pasul 3: lista eligibililor și deschiderea votului

1. Comisia importă un CSV cu un CNP pe linie (de exemplu din evidența universității).
2. Serverul validează fiecare CNP (format, dată, județ, cifra de control), calculează `HMAC-SHA256(k, CNP)` și **aruncă imediat valoarea în clar**. În răspuns apar doar numerele liniilor invalide, mascate.
3. **Deschide votul** e permis doar dacă toate cheile trustees au sosit și lista nu e goală.

În cod: `ElectionsService.importEligible`, `cnpHmac` (`packages/crypto/src/hash.ts`), `checkCnp` (`packages/api/src/cnp.ts`).

### Pasul 4: alegătorul se înregistrează

Din aplicație: **Înregistrează-te**, apoi una din două variante.

**A. Scanarea buletinului (OCR), nivel de încredere „optic”:**

1. Camera fotografiază zona MRZ, iar modulul nativ recunoaște textul pe telefon. Imaginea nu pleacă de pe dispozitiv.
2. Parserul MRZ alege rândurile, corectează confuziile tipice (O/0, I/1) și **verifică cifrele de control ICAO** (număr document, data nașterii, expirare, cifra compusă).
3. Din MRZ se reconstituie CNP-ul (§6.2). Alegătorul vede datele extrase și confirmă.
4. Telefonul generează o pereche de chei **Ed25519 de credential** și o păstrează în SecureStore (criptată cu o cheie din Android Keystore).
5. Aplicația trimite CNP-ul și cheia publică. Serverul calculează HMAC(CNP), verifică eligibilitatea și unicitatea, apoi salvează credentialul.

**B. Cartea electronică de identitate (NFC), nivel „criptografic”:**

1. Alegătorul introduce CAN-ul (6 cifre de pe fața CEI).
2. Modulul nativ (JMRTD) deschide canalul **PACE** cu CAN-ul și citește **DG1** (MRZ-ul) și **SOD** (hash-urile semnate de stat). Poza (DG2) nu se citește.
3. Serverul face **Passive Authentication**: semnătura SOD-ului până la certificatul CSCA de încredere și hash-ul DG1 (§6.3).
4. Serverul extrage CNP-ul din DG1 și continuă ca la varianta A.

În cod: `apps/mobile/src/app/scrutin/[id]/ocr.tsx` și `nfc.tsx`, `VotingService.registerOcr` și `registerNfc`, `verifyPassiveAuth` (`apps/backend/src/nfc/passive-auth.ts`).

### Pasul 5: votul

1. Alegătorul alege candidatul și apasă **Criptează votul**.
2. Telefonul criptează vectorul de voturi: câte un criptotext ElGamal pentru fiecare candidat (1 pentru cel ales, 0 pentru ceilalți). Generează câte o **dovadă 0/1** per criptotext și o **dovadă că suma e 1**, apoi **semnează** buletinul cu cheia de credential. Durează ~20 ms (§10).
3. *(Opțional)* **Verifică întâi criptarea (Benaloh):** aplicația dezvăluie r-urile, verifică local și oferă datele de audit pentru o verificare independentă pe site (tab-ul „Audit buletin”) sau cu CLI-ul. Buletinul auditat **se aruncă** și votul se recriptează cu r noi.
4. **Trimite votul:**
   - aplicația cere o provocare (`POST /auth/challenge`), o semnează cu credentialul și primește o sesiune de 10 minute (`POST /auth/verify`);
   - trimite buletinul (`POST /elections/:id/ballots`);
   - serverul verifică: scrutin deschis, credential înregistrat și care n-a mai votat, semnătură validă, dovezi valide;
   - adaugă buletinul pe board și întoarce **codul de urmărire**.

În cod: `apps/mobile/src/app/scrutin/[id]/vot.tsx`, `encryptBallot` și `verifyBallot` (`packages/crypto/src/ballot.ts`), `VotingService.cast`.

### Pasul 6: alegătorul își verifică votul

Pe ecranul **Verifică votul** (sau pe site, în tab-ul Bulletin board) se caută codul de urmărire. Telefonul recalculează local hash-ul buletinului și hash-ul intrării. Le compară cu codul și cu amprenta păstrată la trimitere. Așa confirmă că buletinul de pe board e **exact** cel trimis de pe acel telefon.

În cod: `checkOwnEntry` (`packages/crypto/src/board.ts`), `verifyOwnBallot` (`packages/api/src/voter.ts`).

### Pasul 7: închiderea și hash-ul publicat independent

1. În timpul votului, comisia publică periodic hash-ul ultimei intrări (`SEQ:HASH`, afișat în panou) pe un canal independent, de exemplu site-ul facultății. Dacă serverul ar rescrie ulterior istoria, verificatorul ar observa nepotrivirea.
2. **Închide votul:** serverul calculează criptotextele **agregate** per candidat și le publică (`elections.aggregate`, `GET /elections/:id/tally`).

### Pasul 8: trustees decriptează

```bash
npx evoting-trustee decrypt --key <trustee>.trustee-key.json --token <TOKEN>
```

1. CLI-ul descarcă board-ul și **verifică singur** totul: lanțul, semnăturile, dovezile și dacă agregatul e chiar suma board-ului. Altfel, un server rău-intenționat i-ar putea cere să decripteze un buletin individual.
2. CLI-ul calculează Dᵢⱼ = xᵢAⱼ pentru fiecare candidat, cu o dovadă Chaum-Pedersen.
3. Serverul verifică dovada. După ultimul trustee, combină decriptările, află totalurile prin baby-step giant-step și publică rezultatul.

### Pasul 9: verificarea publică

Oricine, fără niciun drept, poate verifica în două moduri:

- pe site, în tab-ul **Verificare publică** → **Verifică tot**: rulează în browser;
- din linia de comandă:

```bash
npx evoting-verify --api http://localhost:3000 --election <ID> --head <SEQ:HASH publicat>
npx evoting-verify --api http://localhost:3000 --election <ID> --save arhiva.json   # arhivă pentru verificare offline
npx evoting-verify --bundle arhiva.json
```

Verificatorul reface șase pași (§5.8) și spune exact unde pică. Codul de ieșire e 0 doar dacă trec toți.

---

## 5. Ce se întâmplă în interior: criptografia

Tot codul e în `packages/crypto/src/`. Notație aditivă: punctele grupului se adună, iar „xG” înseamnă G adunat cu el însuși de x ori.

### 5.1 Grupul: ristretto255

- **Ristretto255** (RFC 9496) e un grup de **ordin prim** q ≈ 2²⁵², construit peste Curve25519. Nu are cofactor, deci orice element valid decodat aparține grupului de lucru și dispar capcanele de cofactor ale Ed25519 brut.
- Punctele și scalarii circulă ca hex de 32 de octeți. Decodarea e strictă: `pointFromHex` respinge codificările invalide, iar `scalarFromHex` respinge valorile ≥ q (`group.ts`).
- Numerele aleatoare au 64 de octeți, reduși modulo q, deci abaterea de la uniform e neglijabilă. Scalarii secreți se înmulțesc în timp constant (`mulSecret`), iar datele publice, la verificare, mai rapid (`mulPublic`).

### 5.2 Cheia scrutinului (n-din-n)

Fiecare trustee i are xᵢ secret și Yᵢ = xᵢG public. Cheia scrutinului e

```
Y = Y₁ + … + Yₙ = (x₁ + … + xₙ)·G
```

Nimeni nu cunoaște x = Σxᵢ: decriptarea cere toți trustees. Dovada **Schnorr** a cheii arată că trustee-ul cunoaște xᵢ:

```
k aleator, T = kG, c = H(context, G, Yᵢ, T), s = k + c·xᵢ
verificare: T' = sG − cYᵢ și c == H(context, G, Yᵢ, T')
```

Contextul e (ID-ul scrutinului, ID-ul trustee-ului), deci dovada nu se poate refolosi. Fișiere: `trustee.ts`, `proofs.ts`.

### 5.3 Criptarea votului (ElGamal exponențial)

Pentru fiecare candidat j, cu mⱼ ∈ {0, 1} și un rⱼ aleator nou:

```
Enc(mⱼ) = (Aⱼ, Bⱼ) = (rⱼ·G,  mⱼ·G + rⱼ·Y)
```

Fiind randomizat, același vot dă de fiecare dată alt criptotext (demonstrația 2). Mesajul stă „în exponent”, deci suma a două criptotexte criptează suma mesajelor. Pe asta se bazează numărarea. Fișier: `elgamal.ts`.

### 5.4 Dovezile zero-knowledge ale buletinului

Toate sunt Σ-protocoale făcute neinteractive prin **Fiat-Shamir**, cu SHA-512 redus modulo q (`hashToScalar`, `hash.ts`). Fiecare parte din hash e prefixată cu lungimea ei, ca împărțirea să nu fie ambiguă.

**a) Fiecare criptotext conține 0 sau 1: dovada disjunctivă Cramer-Damgård-Schoenmakers.**

Pentru (A, B), ramura j ∈ {0, 1} afirmă că (A, B − jG) = (rG, rY), adică B − jG e criptarea lui 0:

- ramura adevărată (m) se dovedește normal: k aleator, T₁ = kG, T₂ = kY;
- ramura falsă se **simulează**: se aleg întâi cⱼ și sⱼ, apoi T₁ = sⱼG − cⱼA și T₂ = sⱼY − cⱼ(B − jG);
- provocarea totală c = H(context, Y, A, B, toate T-urile) e fixată de hash. Se pune cₘ = c − c_falsă și sₘ = k + cₘ·r.

Verificatorul recalculează T-urile din (c₀, c₁, s₀, s₁) și cere c₀ + c₁ = H(…). Cum c e fixat de hash, prover-ul poate simula **cel mult o** ramură, deci criptotextul e cu adevărat 0 sau 1. Dovada nu spune care.

**b) Suma voturilor e exact 1: Chaum-Pedersen.**

Perechea (ΣAⱼ, ΣBⱼ − G) trebuie să cripteze 0, adică ΣAⱼ = R·G și ΣBⱼ − G = R·Y, cu același R = Σrⱼ:

```
k aleator, T₁ = kG, T₂ = kY, c = H(context, G, Y, U, V, T₁, T₂), s = k + c·R
```

**c) Contextul Fiat-Shamir** al unui buletin e (ID-ul scrutinului, cheia Y, numărul de candidați, credentialul alegătorului, poziția candidatului). O dovadă copiată în alt scrutin sau pentru alt credential nu mai verifică. Testele confirmă asta în `packages/crypto/test/crypto.test.ts` și în e2e.

Ce prind dovezile, testat explicit:

| Buletin | Ce pică |
| --- | --- |
| Vot 2 pentru un candidat | dovada 0/1 |
| Vot −1 | dovada 0/1 |
| Două voturi (suma 2) | dovada sumei; dovezile 0/1 trec |
| Buletin gol (suma 0) | dovada sumei |
| „Viclean” +2 / −1 (suma 1) | dovezile 0/1; dovada sumei trece |
| Dovezi refolosite în alt scrutin | dovezile, chiar cu semnătura refăcută |
| Buletin copiat și semnat de alt credential | dovezile, pentru că contextul conține credentialul |

### 5.5 Credentialul și autentificarea

- Credentialul e o pereche **Ed25519**, generată pe telefon (`credential.ts`).
- Buletinul se semnează peste `SHA-256(JSON canonic al {electionId, credentialPubkey, ciphertexts, proofs})`. JSON-ul canonic are cheile sortate, deci dă același hash în orice limbaj (`encoding.ts`).
- Autentificarea: serverul trimite un nonce de 32 de octeți. Telefonul semnează `evoting/v1/auth|scrutin|credential|nonce`, iar serverul emite o sesiune HMAC fără stare, valabilă 10 minute. Provocarea expiră în 2 minute și se consumă la prima încercare (`voting.service.ts`, `common/security.ts`).

### 5.6 Bulletin board-ul

Fiecare intrare k conține:

```
ballotHash = SHA-256(JSON canonic al buletinului semnat)
hashₖ      = SHA-256(JSON canonic al {electionId, seq, prevHash, ballotHash, receivedAt})
prevHashₖ  = hashₖ₋₁   (prima intrare: un hash „genesis” derivat din ID-ul scrutinului)
```

- **Codul de urmărire** e hashₖ. Depinde de tot istoricul, deci o modificare a unui buletin anterior l-ar schimba.
- În PostgreSQL, tabela `ballots` are un **trigger** care respinge `UPDATE` și `DELETE`.
- Adăugarea pe board e serializată prin `SELECT … FOR UPDATE` pe rândul scrutinului, iar un vot dublu e oprit și de constrângerea `UNIQUE (election_id, credential_pubkey)`. Testul trimite două voturi simultane cu același credential și doar unul intră.

Fișiere: `board.ts`, `migrations/001_init.sql`.

### 5.7 Numărarea homomorfă și decriptarea

La închidere, pentru fiecare candidat j:

```
(Aⱼ, Bⱼ) = (Σₖ Aₖⱼ,  Σₖ Bₖⱼ) = Enc(Tⱼ)
```

Fiecare trustee publică Dᵢⱼ = xᵢAⱼ, cu o dovadă Chaum-Pedersen că log_G(Yᵢ) = log_Aⱼ(Dᵢⱼ), adică a folosit aceeași cheie. Apoi:

```
Tⱼ·G = Bⱼ − Σᵢ Dᵢⱼ
```

Tⱼ ≤ numărul de buletine, deci se află prin **baby-step giant-step** în O(√T): ~250 ms pentru 1.000.000 (demonstrația 3). Fișier: `tally.ts`.

### 5.8 Verificatorul public

`verifyElection` (`verify.ts`) primește tot ce publică serverul (`GET /elections/:id/audit-bundle`) și reface, în ordine:

| Pas | Ce verifică |
| --- | --- |
| 0. Cheile | Dovada Schnorr a fiecărui Yᵢ și Y = ΣYᵢ |
| 1. Lanțul | Pozițiile 1..n, prevHash, ballotHash recalculat, hash-ul intrării; opțional hash-ul publicat independent |
| 2. Credentialele | Fiecare credential e înregistrat (lista publică, fără identitate), votează o singură dată, semnătura e validă |
| 3. Dovezile ZK | Dovezile 0/1 și ale sumei, pentru fiecare buletin |
| 4. Agregatul | Recalculat de la zero și comparat cu cel publicat |
| 5. Decriptarea | Dovezile fiecărui trustee, combinarea, totalurile publicate și suma lor față de numărul de buletine |

Fiecare eroare are un loc exact: „buletinul #42”, „trustee-ul t2, candidatul B” etc. Verificatorul cedează periodic controlul (`yieldEvery`), ca browserul să rămână receptiv.

### 5.9 Provocarea Benaloh

`auditBallot` (`ballot.ts`) primește criptotextele, opțiunea declarată și r-urile, recalculează `Enc(mⱼ, rⱼ)` și compară. O aplicație compromisă care criptează alt candidat e prinsă de oricine verifică. Cum aplicația nu știe dinainte dacă buletinul va fi auditat sau trimis, trișatul are șanse mari să fie observat. Buletinul auditat nu se trimite niciodată.

---

## 6. Identitatea: CNP, MRZ și NFC

### 6.1 CNP-ul

- Validare completă (`packages/api/src/cnp.ts`): 13 cifre, prima cifră (sex și secol), dată existentă, județ 01–52 sau 70, cifra de control cu cheia 279146358279.
- Serverul păstrează doar `HMAC-SHA256(k, CNP)`. Cheia k (`CNP_HMAC_KEY`) stă în mediul serverului, niciodată în baza de date. Testul e2e caută fiecare CNP în toate tabelele și nu-l găsește.
- De ce HMAC și nu SHA-256: spațiul CNP-urilor e mic, deci SHA-256 se sparge prin căutare (demonstrația 1). Exemplul măsurat: un CNP găsit în 68 ms dacă se știe data nașterii; toți cei născuți în 2000–2007 în ~18 minute pe un singur nucleu.
- Jurnalul de audit nu conține HMAC-uri, ca un credential să nu poată fi legat de o persoană prin jurnal.

### 6.2 MRZ-ul (OCR)

`packages/api/src/mrz.ts` acceptă trei formate:

| Format | Document | Structură |
| --- | --- | --- |
| TD2 | cartea de identitate „veche” | 2 × 36 de caractere |
| TD1 | CEI | 3 × 30 de caractere |
| TD3 | pașaport | 2 × 44 de caractere |

- Cifrele de control ICAO (ponderi 7-3-1, modulo 10) se verifică pe fiecare câmp și pe cifra compusă. Testate pe exemplele din documentul ICAO 9303.
- **Extragerea CNP-ului** (întrebare deschisă în plan, de confirmat pe documente reale):
  - **TD2:** câmpul opțional de 7 caractere conține prima cifră a CNP-ului și ultimele șase, deci CNP = S + AALLZZ (data nașterii din MRZ) + JJNNNC;
  - **TD1:** CNP-ul se caută ca 13 cifre în câmpurile opționale; dacă apare ca la TD2, se reconstituie la fel.
  - Parserul acceptă doar un CNP valid **și** cu aceeași dată de naștere ca MRZ-ul.
- Pe telefon, modulul `evoting-ocr` (Kotlin, ML Kit, model inclus, fără rețea) întoarce textul brut, iar JavaScript-ul face restul. ML Kit e alternativa din plan la Tesseract; motorul se poate schimba fără să atingă parserul.

### 6.3 NFC și Passive Authentication

- **Pe telefon** (`apps/mobile/modules/evoting-nfc`, Kotlin + JMRTD 0.8.9): `enableReaderMode`, apoi IsoDep → PACE cu `PACEKeySpec.createCANKey(can)`, cu parametrii din EF.CardAccess. Urmează citirea EF.DG1 și EF.SOD; DG2 nu se citește. Se folosește doar CAN-ul, niciodată PIN-ul, care ar putea bloca cardul.
- **Pe server** (`verifyPassiveAuth`):
  1. Despachetează EF.SOD (eticheta 0x77) până la CMS SignedData și LDSSecurityObject.
  2. Compară hash-ul DG1 primit cu cel semnat. Un DG1 modificat pică aici.
  3. Verifică atributele semnate (`messageDigest`, `contentType`) și semnătura Document Signer-ului.
  4. Verifică faptul că DSC-ul e emis și semnat de un **CSCA de încredere** (directorul `CSCA_DIR`) și că ambele certificate sunt în perioada de valabilitate.
  
  Semnăturile se verifică prin OpenSSL (`node:crypto`), care suportă ECDSA pe P-256 și pe curbele brainpool, plus RSA PKCS#1 și RSA-PSS.
- **PKI-ul de test** (`apps/backend/src/nfc/test-pki.ts`) creează un CSCA „de laborator”, un DSC și cipuri simulate (DG1 + SOD semnat), folosite de teste și de simulator. Serverul îl acceptă doar dacă certificatul lui e pus explicit în `CSCA_DIR`. Pentru documente reale, în `CSCA_DIR` se pune certificatul CSCA al României (disponibilitatea lui e o întrebare deschisă din plan).

---

## 7. Backend-ul: tabele, rute, reguli

### 7.1 Cele nouă tabele (`apps/backend/migrations/001_init.sql`)

| Tabelă | Conținut | Observații |
| --- | --- | --- |
| `elections` | titlu, stare, interval, cheia publică Y, agregatul | stări: draft → open → closed → tallied |
| `candidates` | nume, descriere, poziție | poziția = indicele în vectorul de vot |
| `trustees` | nume, hash-ul token-ului, Yᵢ, dovada Schnorr | niciodată xᵢ |
| `eligible_voters` | `cnp_hmac` | populată la import |
| `registrations` | `cnp_hmac` (unic), credential (unic), metodă, nivel de încredere | singura legătură cu identitatea e HMAC-ul |
| `ballots` | criptotexte, dovezi, semnătură, ballot_hash, prev_hash, hash, received_at | append-only (trigger), un vot per credential |
| `partial_decryptions` | Dᵢⱼ și dovezile | un rând per trustee |
| `results` | totaluri, număr de buletine | public |
| `audit_log` | actor, acțiune, payload, oră | acțiunile comisiei, ale trustees și ale serverului |

### 7.2 Rutele

| Metodă | Rută | Cine | Protecție |
| --- | --- | --- | --- |
| GET | `/elections`, `/elections/:id` | oricine | – |
| GET | `/elections/:id/board`, `/board/:hash`, `/board-head` | oricine | – |
| GET | `/elections/:id/registrations`, `/tally`, `/result`, `/audit-bundle` | oricine | – |
| POST | `/elections` | comisia | token comisie, limită de rată |
| POST | `/elections/:id/eligible` (text/csv), `/open`, `/close` | comisia | token comisie |
| GET | `/elections/:id/audit-log`, `/admin/check` | comisia | token comisie, limită strictă |
| POST | `/elections/:id/trustees` | CLI trustee | token trustee, limită strictă |
| POST | `/elections/:id/tally/partial` | CLI trustee | token trustee, limită strictă |
| POST | `/elections/:id/register/ocr`, `/register/nfc` | aplicația | limită strictă |
| POST | `/auth/challenge`, `/auth/verify` | aplicația | limită strictă |
| POST | `/elections/:id/ballots` | aplicația | sesiune semnată |
| GET | `/health` | monitorizare | – |

Limitarea de rată:

- limita generală e de 600 de cereri pe minut per IP;
- limita strictă e `SENSITIVE_RATE_LIMIT`, implicit 30 pe minut;
- `RATE_LIMIT=off` doar pentru simulări de încărcare, când toți alegătorii vin de pe aceeași adresă.

### 7.3 Regulile de stare

| Acțiune | Permisă când |
| --- | --- |
| Trimiterea cheilor de trustee, importul eligibililor | `draft` |
| Deschiderea | `draft`, cu toate cheile primite și lista nevidă |
| Înregistrarea | `draft` sau `open` |
| Votul | `open` |
| Decriptarea parțială | `closed`, după publicarea agregatului |
| Rezultatul | publicat automat după ultima decriptare; starea devine `tallied` |

Politica de revot (întrebare deschisă în plan) e implementată ca **un singur vot per credential**.

---

## 8. Modelul de amenințare și cum e acoperit

| Amenințare | Măsură implementată | Unde se vede |
| --- | --- | --- |
| Serverul modifică sau șterge buletine | lanț de hash-uri, trigger append-only, hash publicat independent, cod de urmărire | e2e „administrator rău-intenționat”, demonstrația 5 |
| Vot invalid (2 voturi, vot negativ) | dovezi ZK verificate de server și de verificator | `crypto.test.ts`, e2e |
| Rezultat falsificat | agregat recalculabil, dovezi de decriptare | `crypto.test.ts` („rezultat falsificat”) |
| Un trustee decriptează un vot individual | cheie n-din-n; CLI-ul verifică agregatul înainte să decripteze | `trustee.ts`, `tools/trustee` |
| Un trustee trimite o decriptare falsă | dovadă Chaum-Pedersen per Dᵢⱼ | e2e, `crypto.test.ts` |
| Furtul bazei expune CNP-uri | HMAC cu cheie în afara bazei | e2e „CNP-urile nu apar”, demonstrația 1 |
| Buletin fals (MRZ printat) | nivel „optic” marcat separat; NFC cu Passive Authentication | e2e NFC (DG1 modificat, CSCA străin, semnătură alterată) |
| Cip clonat | Chip Authentication | **neimplementat** (§11) |
| Reutilizarea unei dovezi sau a unui buletin | Fiat-Shamir legat de scrutin și credential, semnătura credentialului | `crypto.test.ts`, e2e |
| Brute force pe autentificare | limitare de rată, comparații în timp constant | e2e „limitarea de rată”, demonstrația 4 |
| Aplicație compromisă criptează alt vot | provocarea Benaloh | `crypto.test.ts`, ecranul de audit |
| Ballot stuffing de către server | buletine semnate de credentiale din lista publică, număr public de înregistrări | `crypto.test.ts` („ballot stuffing”); acoperire **parțială** |
| Constrângere, cumpărarea voturilor | nicio măsură | limitare asumată |

---

## 9. Demonstrațiile de atac

Toate rulează pe sistemul propriu, cu CNP-uri fictive valide ca format.

```bash
npm run build -w @evoting/attacks
npm run cnp -w @evoting/attacks            # 1. SHA-256 vs HMAC pe CNP
npm run deterministic -w @evoting/attacks  # 2. ghicirea votului: RSA „de manual” vs ElGamal
npm run bsgs -w @evoting/attacks           # 3. baby-step giant-step vs căutarea cheii
node demos/attacks/dist/api-bruteforce.js --api http://localhost:3000   # 4. cu RATE_LIMIT=on
DATABASE_URL=... node demos/attacks/dist/tamper-board.js --election <ID> --seq 42   # 5.
```

Rezultate obținute la rulare:

| Demonstrație | Rezultat |
| --- | --- |
| 1. CNP | SHA-256: CNP găsit după 18.909 încercări în 68 ms (≈ 278.000 hash-uri/s). HMAC fără cheie: 0 potriviri. |
| 2. Vot ghicit | RSA fără padding: votul aflat prin comparație. ElGamal: 0 potriviri, fiecare criptare e diferită. |
| 3. BSGS vs cheie | Totaluri până la 1.000.000 aflate în ≤ 260 ms. Căutarea naivă a cheii: ~10⁶³ ani. |
| 4. API | Primele 30 de cereri primesc 401, următoarele 429. |
| 5. Board modificat | Verificatorul arată buletinul #42 la lanț, semnătură, dovezi și agregat; după restaurare, trece din nou. |

---

## 10. Teste și evaluare

### 10.1 Teste automate (`npm test`)

| Suită | Teste | Ce acoperă |
| --- | --- | --- |
| `packages/crypto` | 35 | JSON canonic, HMAC (vector RFC 4231), ElGamal, homomorfism, BSGS, buletine valide și toate tipurile de buletine invalide, refolosirea dovezilor, Benaloh, trustees, verificatorul pe 11 tipuri de manipulare |
| `packages/api` | 11 | CNP, MRZ (exemplele ICAO TD1 și TD2, buletin vechi, CEI, zgomot OCR), DG1, scrutin complet pe backend-ul simulat |
| `apps/backend` | 17 | Pe PostgreSQL real: tot fluxul, token-uri, NFC cu PKI de test, autentificare, buletine invalide, vot dublu simultan, trigger append-only, agregat, trustee care trișează, verificatorul, CNP absent din bază, manipulare directă în bază, jurnal de audit, limitare de rată |

Pe lângă acestea, verificări manuale:

- **Site:** testat cu Playwright, contra backend-ului real și în mod simulat.
- **Aplicația mobilă:**
  - verificarea de tipuri;
  - bundle-ul Android compilat în bytecode Hermes;
  - fluxul complet al alegătorului, testat cu Playwright pe build-ul web (scanare MRZ de test, înregistrare, criptare, Benaloh, trimitere, verificare, persistența sesiunii).

### 10.2 Performanță (simulatorul)

Comanda pentru reproducere:

```bash
RATE_LIMIT=off npm run dev -w @evoting/backend
npx evoting-simulate --admin-token <TOKEN> --voters 1000 --nfc 0.2 --pki apps/backend/pki --report raport.json
```

Toate măsurătorile sunt pe un singur calculator, unde clientul, serverul și PostgreSQL împart același CPU. 3 candidați, 3 trustees, 8 alegători în paralel. Rapoartele complete sunt în `docs/evaluare/`.

| Metrică | 100 de alegători | 1.000 de alegători | 10.000 de alegători |
| --- | --- | --- | --- |
| Criptare + dovezi per buletin (client, Node) | 20,8 ms | 19,2 ms | __C10K__ |
| Trimitere + validare (dus-întors, sub încărcare) | 218 ms | 209 ms | __S10K__ |
| Buletine pe secundă | 17,4 | 19,5 | __B10K__ |
| Închidere (calculul agregatului) | 115 ms | 718 ms | __A10K__ |
| Decriptare parțială per trustee | 16 ms | 13 ms | __D10K__ |
| Verificare publică completă | 2,5 s | 25,8 s | __V10K__ |
| Verificare per buletin | 24,9 ms | 25,8 ms | __P10K__ |
| Rezultat = voturile simulate | da | da | __R10K__ |

**Interpretare:**

- Validarea unui buletin pe server (semnătură + dovezi) durează ~25 ms de CPU. Un singur proces Node validează deci ~40 de buletine pe secundă. Pentru alegerile unei facultăți e suficient: 10.000 de voturi într-o zi înseamnă sub 0,2 voturi pe secundă în medie.
- Timpul de criptare de pe un telefon Android real e o metrică din plan care rămâne de măsurat pe dispozitiv. În browser, pe build-ul web al aplicației, criptarea a durat ~9 ms.

---

## 11. Limitări și ce rămâne de făcut

Spus deschis, ce **nu** a putut fi verificat sau implementat aici:

1. **Modulele native Kotlin (NFC și OCR) nu au fost compilate** în acest mediu, pentru că nu există Android SDK.
   - Verificat: semnăturile API-ului JMRTD 0.8.9 (cu `javap` pe jar-ul oficial) și detectarea modulelor de autolinking-ul Expo.
   - Rămâne de făcut: `npx expo run:android` pe un calculator cu Android Studio și un test cu o CEI reală.
2. **Chip Authentication** (anti-clonare) nu e implementată. E marcată opțională în plan.
3. **Certificatul CSCA al României** nu e inclus. Fără el, NFC-ul acceptă doar cipurile de test. Se adaugă punând certificatul în `CSCA_DIR`.
4. **Pozițiile CNP-ului în MRZ** urmează structura cunoscută a buletinului vechi; pentru CEI sunt o presupunere. Parserul acceptă doar CNP-uri valide și consistente cu data nașterii, dar trebuie confirmat pe documente reale.
5. **Motorul OCR** e ML Kit (alternativa din plan), nu Tesseract.
6. **Cheia de credential** stă în SecureStore, criptată cu o cheie din Android Keystore. Nu e o cheie Ed25519 nativă a Keystore-ului: Ed25519 e suportat în Keystore abia din Android 13, iar semnarea se face în JavaScript.
7. **Docker Compose** a fost validat sintactic (`docker compose config`), dar build-ul complet nu a rulat aici: Docker Hub a răspuns cu 429 la descărcarea imaginilor. Backend-ul și site-ul au fost testate direct, fără containere.
8. **Schema n-din-n:** dacă un trustee își pierde cheia, rezultatul nu se mai poate decripta. Varianta t-din-n (Pedersen DKG) rămâne extensie.
9. **Ballot stuffing:** serverul controlează și înregistrarea. Soluția completă e o autoritate de înregistrare separată, ca în Belenios.
10. **Constrângerea și cumpărarea voturilor** nu sunt tratate, la fel ca în Helios.
11. **Securitate de producție:** codul criptografic nu e auditat independent, iar implementarea folosește BigInt în JavaScript, nu cod în timp constant la nivel de procesor. E potrivit pentru o lucrare de licență și un demo, nu pentru alegeri cu miză mare.

---

## 12. Comparație cu Helios și Belenios

| Criteriu | Helios | Belenios | Acest proiect |
| --- | --- | --- | --- |
| Numărare homomorfă | Da | Da | Da |
| Dovezi ZK de validitate | Da | Da | Da |
| Protecție împotriva ballot stuffing de către server | Nu | Da (credentiale separate) | Parțial |
| Verificarea identității cu act național | Nu | Nu | Da (OCR + NFC) |
| Protecția CNP-ului | Nu se aplică | Nu se aplică | HMAC |

Detaliile despre Helios și Belenios trebuie verificate în documentația lor oficială înainte de a fi trecute în lucrare.

---

## 13. Glosar

| Termen | Explicație |
| --- | --- |
| **Bulletin board** | Registrul public, append-only, cu toate buletinele criptate. |
| **CAN** | Card Access Number: 6 cifre tipărite pe CEI, folosite pentru PACE. |
| **CEI** | Cartea electronică de identitate. |
| **Chaum-Pedersen** | Dovadă că două valori au același logaritm discret în baze diferite. |
| **Cod de urmărire** | Hash-ul intrării alegătorului de pe board. |
| **CSCA / DSC** | Certificatul rădăcină al statului emitent / certificatul care semnează SOD-ul. |
| **DG1 / SOD** | Grupul de date cu MRZ-ul / documentul cu hash-urile semnate. |
| **Fiat-Shamir** | Transformă o dovadă interactivă în una neinteractivă, cu provocarea calculată ca hash. |
| **HMAC** | Hash cu cheie secretă: fără cheie, amprenta nu se poate recalcula. |
| **MRZ** | Machine Readable Zone, rândurile cu „<<<” de pe act. |
| **PACE** | Protocolul care deschide canalul securizat cu cipul. |
| **Passive Authentication** | Verificarea semnăturii statului pe datele cipului. |
| **Provocarea Benaloh** | Auditul unui buletin prin dezvăluirea numerelor aleatoare. |
| **Trustee** | Deținătorul unei părți din cheia de decriptare. |
