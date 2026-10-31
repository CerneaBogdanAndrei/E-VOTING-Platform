# 3. Cum circulă cererile între telefon, site și server

## 3.1 Ce e o cerere HTTP

Telefonul, site-ul și serverul sunt programe separate, uneori pe calculatoare diferite. Vorbesc între ele prin **HTTP**, același protocol pe care îl folosește browserul ca să deschidă orice pagină.

Comunicarea e mereu **cerere → răspuns**:

1. **Clientul** (telefonul, site-ul sau un program din `tools/`) trimite o **cerere** (request).
2. **Serverul** (`apps/backend`) o procesează și trimite înapoi un **răspuns** (response).

### Ce conține o cerere

| Parte | Ce e | Exemplu |
| --- | --- | --- |
| **Metoda** | Ce vrei să faci. `GET` = citește ceva, nu schimbă nimic. `POST` = trimite date care schimbă ceva. | `POST` |
| **Adresa (URL)** | Unde trimiți: serverul + **ruta** (calea). | `http://localhost:3000/elections/abc/ballots` |
| **Antetele (headers)** | Informații despre cerere, de forma `Nume: valoare`. | `Content-Type: application/json`, `Authorization: Bearer 7f3a…` |
| **Corpul (body)** | Datele trimise, de obicei în JSON. Lipsește la `GET`. | `{"cnp": "…", "credentialPubkey": "…"}` |

### Ce conține un răspuns

| Parte | Ce e |
| --- | --- |
| **Codul de stare** | Un număr care spune cum a mers (tabelul de mai jos). |
| **Antetele** | De exemplu `Content-Type: application/json`. |
| **Corpul** | Datele cerute sau mesajul de eroare, în JSON. |

### Codurile de stare din proiect

| Cod | Nume | Când apare în proiect |
| --- | --- | --- |
| 200 | OK | Totul a mers și există un răspuns. |
| 201 | Created | S-a creat ceva nou (un scrutin, o înregistrare, un vot). |
| 204 | No Content | A mers, dar nu e nimic de trimis înapoi (`/admin/check` cu token corect). |
| 400 | Bad Request | Datele trimise sunt greșite: CNP invalid, dovadă falsă, buletin modificat. |
| 401 | Unauthorized | Lipsește autentificarea sau e greșită: token greșit, sesiune expirată. |
| 403 | Forbidden | Ești autentificat, dar n-ai voie: CNP-ul nu e pe lista de eligibili. |
| 404 | Not Found | Nu există: scrutin sau cod de urmărire necunoscut. |
| 409 | Conflict | Contrazice starea curentă: ai votat deja, scrutinul nu e deschis. |
| 429 | Too Many Requests | Prea multe cereri de la tine într-un minut (limitarea de rată). |
| 500 | Internal Server Error | O eroare neprevăzută în server. |

### JSON

**JSON** (JavaScript Object Notation) e formatul în care circulă datele. Arată așa:

```json
{
  "id": "alegeri-senat-2026",
  "title": "Alegeri Senat UDJG",
  "status": "open",
  "candidates": [
    { "id": "c1", "name": "Ana Popescu", "position": 0 },
    { "id": "c2", "name": "Ion Ionescu", "position": 1 }
  ]
}
```

- `{ }` = un obiect, cu perechi `"cheie": valoare`;
- `[ ]` = o listă;
- textele sunt între ghilimele, numerele nu.

## 3.2 Cine face cererile, în cod

Toate cererile trec prin aceeași interfață, `ApiClient` (`packages/api/src/types.ts`). Ea are două implementări:

| Implementare | Fișier | Ce face |
| --- | --- | --- |
| **Clientul HTTP** | `packages/api/src/http.ts` | Trimite cereri reale la server, cu `fetch`. |
| **Backend-ul simulat** | `packages/api/src/mock.ts` | Nu trimite nimic pe rețea; face aceleași verificări în memorie, cu criptografie reală. |

Telefonul și site-ul aleg una dintre ele în `src/api/index.ts`:

- dacă există o adresă de server (`VITE_API_URL` pe site, `EXPO_PUBLIC_API_URL` pe telefon), folosesc clientul HTTP;
- altfel, folosesc backend-ul simulat.

Ecranele nu știu și nu le pasă cu care vorbesc. Ele apelează doar `api.castBallot(...)`, `api.getElection(...)` și așa mai departe.

### Cum trimite clientul o cerere (`http.ts`, pe scurt)

```ts
res = await fetch(root + path, { method, headers, body: JSON.stringify(body) })
```

1. `fetch` e funcția încorporată în browser, în Node și în React Native care trimite o cerere HTTP.
2. Dacă e nevoie de autentificare, adaugă antetul `Authorization: Bearer <token>`.
3. Dacă serverul nu răspunde deloc, aruncă eroarea „Backend-ul nu răspunde”.
4. Dacă răspunsul are un cod de eroare (≥ 400), citește mesajul trimis de server (NestJS trimite `{ statusCode, message, error }`) și aruncă un `ApiError` cu codul și mesajul. Pentru 429, mesajul devine „Prea multe încercări. Așteaptă puțin…”.
5. Altfel, transformă corpul din JSON în obiect și îl întoarce.

### Cum primește serverul o cerere (pe scurt)

1. **Express** (sub NestJS) ascultă pe portul 3000 și primește cererea.
2. **Body parser-ul** transformă corpul din text JSON în obiect. Limita e 2 MB pentru JSON și 20 MB pentru CSV (`app.ts`).
3. **Limitarea de rată** (`ThrottlerGuard`) verifică dacă adresa IP n-a depășit limita. Dacă a depășit-o, răspunde 429.
4. **Ruta** decide care metodă a controller-ului se ocupă de cerere. De exemplu, `POST /elections/:id/ballots` → `ElectionsController.castBallot`.
5. Dacă ruta are `@UseGuards(AdminGuard)`, **guard-ul** verifică token-ul comisiei. Dacă e greșit, răspunde 401.
6. Controller-ul cheamă **serviciul**, care validează datele, verifică criptografia și lucrează cu baza de date.
7. Ce întoarce serviciul devine corpul răspunsului, în JSON. Dacă serviciul aruncă o excepție (`ForbiddenException`, `ConflictException`…), Nest o transformă în codul de eroare potrivit.

## 3.3 Toate rutele serverului

| Metodă | Rută | Cine o folosește | Ce face | Protecție |
| --- | --- | --- | --- | --- |
| GET | `/health` | monitorizare, Docker | Răspunde `{"ok":true}` dacă serverul trăiește. | – |
| GET | `/admin/check` | site (login comisie) | 204 dacă token-ul comisiei e corect. | token comisie, limită strictă |
| GET | `/elections` | toți | Lista scrutinelor. | – |
| GET | `/elections/:id` | toți | Un scrutin: candidați, trustees, cheia publică, statistici. | – |
| GET | `/elections/:id/board` | toți | Toate buletinele criptate de pe board. | – |
| GET | `/elections/:id/board/:hash` | alegătorul | Caută un buletin după codul de urmărire. | – |
| GET | `/elections/:id/board-head` | comisia, public | Ultima amprentă a board-ului, de publicat independent. | – |
| GET | `/elections/:id/registrations` | verificatorul | Credentialele înregistrate, fără identitate. | – |
| GET | `/elections/:id/tally` | trustees | Totalurile criptate (agregatul). | – |
| GET | `/elections/:id/result` | toți | Rezultatul final. | – |
| GET | `/elections/:id/audit-bundle` | verificatorul | Tot ce e public, într-un singur pachet. | – |
| POST | `/elections` | comisia | Creează un scrutin; întoarce token-urile trustees, o singură dată. | token comisie |
| POST | `/elections/:id/eligible` | comisia | Importă lista CSV de CNP-uri eligibile; se salvează doar HMAC-urile. | token comisie |
| POST | `/elections/:id/open` | comisia | Deschide votul. | token comisie |
| POST | `/elections/:id/close` | comisia | Închide votul și calculează agregatul. | token comisie |
| GET | `/elections/:id/audit-log` | comisia | Jurnalul acțiunilor. | token comisie |
| POST | `/elections/:id/trustees` | `tools/trustee keygen` | Trustee-ul trimite cheia publică și dovada. | token trustee, limită strictă |
| POST | `/elections/:id/tally/partial` | `tools/trustee decrypt` | Trustee-ul trimite decriptarea parțială. | token trustee, limită strictă |
| POST | `/elections/:id/register/ocr` | telefon | Înregistrare cu CNP-ul citit optic. | limită strictă |
| POST | `/elections/:id/register/nfc` | telefon | Înregistrare cu DG1 și SOD de pe cip. | limită strictă |
| POST | `/auth/challenge` | telefon | Cere o provocare (nonce) de semnat. | limită strictă |
| POST | `/auth/verify` | telefon | Trimite semnătura și primește o sesiune de 10 minute. | limită strictă |
| POST | `/elections/:id/ballots` | telefon | Trimite buletinul criptat. | sesiune semnată |

**Limitarea de rată:** în general, 600 de cereri pe minut per adresă IP. Pe rutele marcate „limită strictă”, 30 pe minut. Asta face imposibilă ghicirea unui token prin încercări repetate (demonstrația `api-bruteforce.ts`).

**CORS** (Cross-Origin Resource Sharing): browserul refuză implicit ca o pagină de pe `localhost:5173` să trimită cereri la `localhost:3000`, pentru că sunt „origini” diferite. Serverul spune explicit ce origini accepta prin `app.enableCors(...)`. Implicit le acceptă pe toate, iar cu `CORS_ORIGINS` în `.env` le poți restrânge.

## 3.4 Un scrutin complet, cerere cu cerere

Exemplu: scrutinul „Senat 2026”, 3 candidați, 2 trustees, alegătoarea Ana.

### Pasul 1. Comisia creează scrutinul (site)

```http
POST /elections
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "title": "Senat 2026",
  "opensAt": "2026-11-10T08:00:00Z",
  "closesAt": "2026-11-10T20:00:00Z",
  "candidates": [{ "name": "A", "description": "" }, { "name": "B", "description": "" }, { "name": "C", "description": "" }],
  "trustees": [{ "name": "Prof. X" }, { "name": "Student Y" }]
}
```

Serverul:

1. `AdminGuard` compară token-ul cu `ADMIN_TOKEN` **în timp constant** (`safeEqual`), ca un atacator să nu poată deduce literele corecte după cât durează răspunsul.
2. `ElectionsService.create` validează datele, generează câte un token aleator pentru fiecare trustee și salvează în tabela `trustees` doar **SHA-256-ul** token-ului.
3. Răspunde 201 cu scrutinul și token-urile în clar. Site-ul le afișează o singură dată, iar comisia le dă trustees.

### Pasul 2. Fiecare trustee își trimite cheia (`tools/trustee`)

Trustee-ul rulează pe calculatorul lui:

```bash
npx evoting-trustee keygen --api http://localhost:3000 --election <id> --trustee <id-trustee> --token <token-trustee> --out cheie.json
```

Programul generează `x₁` și îl scrie în `cheie.json`, apoi trimite doar partea publică:

```http
POST /elections/<id>/trustees
Authorization: Bearer <token-trustee>

{ "trusteeId": "t1", "publicKeyShare": "8c2e…", "proof": { "c": "41fa…", "s": "09bd…" } }
```

Serverul verifică token-ul (comparând SHA-256-ul lui cu cel salvat) și dovada Schnorr. După ultimul trustee calculează `Y = Y₁ + Y₂` și o salvează în `elections.public_key`.

### Pasul 3. Comisia importă eligibilii și deschide votul

```http
POST /elections/<id>/eligible
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: text/csv

cnp
2960310123456
...
```

Pentru fiecare rând, serverul validează CNP-ul, calculează `HMAC(CNP_HMAC_KEY, CNP)`, **aruncă CNP-ul în clar** și inserează doar amprenta în `eligible_voters`. Apoi:

```http
POST /elections/<id>/open
```

Deschiderea e refuzată dacă lipsește vreo cheie de trustee sau lista e goală.

### Pasul 4. Ana se înregistrează (telefon)

Telefonul citește buletinul (OCR sau NFC), generează **local** perechea Ed25519 și o salvează în SecureStore. Apoi trimite doar cheia publică:

```http
POST /elections/<id>/register/ocr

{ "cnp": "2960310123456", "credentialPubkey": "d75a9801…" }
```

sau, cu NFC:

```http
POST /elections/<id>/register/nfc

{ "dg1": "YV8fWklEUk9V…", "sod": "d4IGqjCCBqYG…", "credentialPubkey": "d75a9801…" }
```

(DG1 și SOD sunt date binare, trimise în **base64**, o codificare care transformă octeții în litere și cifre ca să poată sta în JSON.)

Serverul, într-o **tranzacție**:

1. pentru NFC, face întâi Passive Authentication și extrage CNP-ul din DG1;
2. calculează HMAC(CNP) și verifică dacă e în `eligible_voters` (dacă nu, răspunde 403);
3. inserează în `registrations`: HMAC-ul, cheia publică, metoda și nivelul de încredere;
4. dacă HMAC-ul există deja, constrângerea `UNIQUE` pică și răspunde 409, „Persoana este deja înregistrată”.

Răspunsul (201):

```json
{ "electionId": "…", "credentialPubkey": "d75a9801…", "method": "ocr", "trustLevel": "optic", "registeredAt": "2026-11-10T08:15:02.000Z" }
```

CNP-ul nu se salvează nicăieri pe server.

### Pasul 5. Ana votează (telefon)

**5a. Criptarea, pe telefon, fără rețea.** Ana alege B. `encryptBallot` produce:

```json
{
  "electionId": "…",
  "credentialPubkey": "d75a9801…",
  "ciphertexts": [ { "a": "…", "b": "…" }, { "a": "…", "b": "…" }, { "a": "…", "b": "…" } ],
  "proofs": {
    "choices": [ { "c0": "…", "c1": "…", "s0": "…", "s1": "…" }, { … }, { … } ],
    "sum": { "c": "…", "s": "…" }
  },
  "signature": "…"
}
```

Trei criptotexte (A=0, B=1, C=0, dar nu se vede care e care), trei dovezi 0/1, o dovadă a sumei și semnătura Ed25519 a Anei.

**5b. Autentificarea:**

```http
POST /auth/challenge
{ "electionId": "…", "credentialPubkey": "d75a9801…" }
```
→ `{ "challengeId": "9f1c…", "nonce": "e03b…", "expiresAt": "…" }` (valabil 2 minute)

Telefonul semnează textul `authMessage(electionId, credentialPubkey, nonce)` cu cheia secretă:

```http
POST /auth/verify
{ "challengeId": "9f1c…", "signature": "…" }
```
→ `{ "token": "eyJlbGVjdGlvbklk….Xk3p…", "expiresAt": "…" }` (valabil 10 minute)

Token-ul de sesiune are forma `<date>.<HMAC>`: datele (scrutinul, credentialul, expirarea) în base64, urmate de un HMAC cu `SESSION_SECRET`. Serverul nu trebuie să țină sesiunile minte: le verifică recalculând HMAC-ul.

**5c. Trimiterea:**

```http
POST /elections/<id>/ballots
Authorization: Bearer eyJlbGVjdGlvbklk….Xk3p…

{ …buletinul de la 5a… }
```

Serverul (`VotingService.cast`):

1. verifică sesiunea și că aparține aceluiași scrutin și credential;
2. verifică semnătura și toate dovezile, **în afara tranzacției**, pentru că durează ~25 ms și n-ar trebui să țină board-ul blocat;
3. deschide o tranzacție și **blochează rândul scrutinului** (`SELECT … FOR UPDATE`), ca două voturi să nu fie adăugate în același timp pe aceeași poziție;
4. verifică din nou că scrutinul e deschis, că credentialul e înregistrat și că n-a mai votat;
5. citește ultima intrare de pe board (de exemplu, #41);
6. construiește intrarea #42, cu `prevHash` = hash-ul lui #41, și calculează hash-ul ei;
7. o inserează și face `COMMIT`.

Răspunsul (201):

```json
{ "seq": 42, "trackingCode": "5be1…", "ballotHash": "a07c…", "receivedAt": "2026-11-10T09:02:11.481Z" }
```

`trackingCode` e codul de urmărire al Anei.

### Pasul 6. Ana își verifică votul

```http
GET /elections/<id>/board/5be1…
```

Telefonul primește intrarea și **recalculează local** hash-ul buletinului și al intrării. Dacă se potrivesc cu ce a păstrat după trimitere, votul e acolo, neschimbat.

### Pasul 7. Închiderea

```http
POST /elections/<id>/close
```

Serverul adună criptotextele fiecărui candidat de pe toate buletinele și salvează **agregatul** (3 criptotexte: totalul criptat pentru A, B și C).

### Pasul 8. Trustees decriptează

```bash
npx evoting-trustee decrypt --key cheie.json --token <token-trustee> --api http://localhost:3000
```

Fișierul de cheie știe deja scrutinul și trustee-ul. Programul descarcă tot (`GET /audit-bundle`), **verifică singur** board-ul și agregatul și refuză să continue dacă ceva nu se potrivește. Altfel calculează `Dᵢⱼ = xᵢ·Aⱼ` pentru fiecare candidat și trimite:

```http
POST /elections/<id>/tally/partial
Authorization: Bearer <token-trustee>

{ "trusteeId": "t1", "shares": ["…", "…", "…"], "proofs": [ { "c": "…", "s": "…" }, … ] }
```

După ultimul trustee, serverul calculează `Bⱼ − ΣDᵢⱼ = Tⱼ·G` pentru fiecare candidat, află `Tⱼ` prin baby-step giant-step, salvează rezultatul și trece scrutinul în `tallied`.

### Pasul 9. Oricine verifică

```bash
npx evoting-verify --api http://localhost:3000 --election <id>
```

sau butonul „Verifică tot” de pe site. Verificatorul descarcă `audit-bundle` și reface cei șase pași din capitolul 1.9.

## 3.5 Ce circulă și ce nu circulă niciodată

| Informație | Unde stă | Circulă pe rețea? |
| --- | --- | --- |
| CNP-ul în clar | pe buletin, în telefon cât timp te înregistrezi | Doar o dată, la `register/ocr` (sau în DG1, la NFC). Serverul nu-l salvează. |
| HMAC(CNP) | baza de date | Nu. |
| `CNP_HMAC_KEY` | `.env` pe server | Nu. |
| Cheia secretă a credentialului | SecureStore pe telefon | Niciodată. |
| Opțiunea votată (B) | doar pe telefon, cât timp votezi | Niciodată în clar. Pleacă doar criptată. |
| Numerele aleatoare `r` | telefon | Doar dacă alegi auditul Benaloh, iar atunci buletinul e aruncat. |
| Cheile secrete ale trustees (`xᵢ`) | fișierul fiecărui trustee | Niciodată. |
| Token-ul comisiei | `.env` pe server, `sessionStorage` în site | La fiecare cerere a comisiei, în antet. |

## 3.6 Ce se întâmplă cu backend-ul simulat

Când telefonul sau site-ul n-au o adresă de server, `mock.ts` ține locul serverului **în memoria aplicației**:

- face aceleași verificări (eligibilitate, un vot per credential, dovezi, semnături);
- folosește aceeași criptografie;
- creează la prima pornire trei scrutine de demonstrație;
- nu trimite nimic pe rețea, deci telefonul și site-ul nu se văd între ele;
- totul se pierde la închiderea aplicației;
- nu verifică semnătura statului pe cip, pentru că n-are certificate.

De aceea APK-ul de acum, fără `api_url`, merge complet, dar doar local pe telefon.
