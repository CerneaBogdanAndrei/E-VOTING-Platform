# Analiza proiectului (16 noiembrie 2026, actualizată pe 18 noiembrie)

Starea aplicației după reorganizarea codului: ce e bun și merită păstrat, ce nu e bun sau lipsește, și un plan de dezvoltare pe etape. Scrisă pentru cine continuă dezvoltarea.

> **Actualizare 18 noiembrie:** după analiză a urmat o etapă de dezvoltare care a rezolvat o parte din puncte. Secțiunile 1–3 descriu starea de pe 16 noiembrie, ca punct de plecare; **ce s-a rezolvat și ce rămâne, punct cu punct, e în [secțiunea 5](#5-ce-s-a-rezolvat-după-analiză-1718-noiembrie)**. Explicația pe larg a fiecărei schimbări: [GHID-COMPLET.md, Partea 9](GHID-COMPLET.md#partea-9-ce-s-a-schimbat-în-ultima-etapă-1618-nov-2026).

## 1. Ce e bun

**Criptografia e corectă, într-un singur loc și bine testată.** `packages/crypto` implementează schema din plan (ElGamal exponențial pe ristretto255, dovezi Schnorr, Chaum-Pedersen și disjunctive 0/1, Fiat-Shamir cu contextul scrutinului și al credentialului, numărare homomorfă, decriptare n-din-n, board cu lanț de hash-uri). Aceeași bibliotecă rulează pe telefon, server, site și CLI, deci nu există două implementări care pot diferi. Cele 44 de teste acoperă fiecare fel de buletin trișat și 13 feluri de manipulare a board-ului.

**Verificatorul public e serios.** `verifyElection` reface fiecare pas și spune exact unde pică („buletinul #42”, „trustee-ul t2, candidatul B”). Trustee-ul îl rulează înainte să decripteze, deci un server rău-intenționat nu-l poate păcăli să decripteze un buletin individual. Testul e2e modifică board-ul direct în bază și verificatorul îl prinde.

**Protecțiile din server sunt gândite, nu cosmetice:** HMAC(CNP) cu cheia în afara bazei (testul caută CNP-urile în toate tabelele), token-urile trustees doar hash-uite, comparații în timp constant, sesiuni HMAC fără stare, provocare consumată la prima încercare, `SELECT … FOR UPDATE` pe scrutin plus constrângeri `UNIQUE` (testul trimite două voturi simultane), trigger append-only pe `ballots`, `audit-bundle` dintr-un singur instantaneu `REPEATABLE READ`, verificarea dovezilor în afara tranzacției, limitare de rată strictă pe rutele sensibile.

**Passive Authentication e reală**, nu simulată: SOD → CMS → LDSSecurityObject, hash-ul DG1, atributele semnate, semnătura DSC prin OpenSSL (inclusiv brainpool), lanțul până la CSCA și perioadele de valabilitate. PKI-ul de test permite testarea fără buletin real, iar modulul Kotlin a citit un CEI real (EXPLICATIE.md, Partea IV).

**Backend-ul simulat are aceleași reguli și aceeași criptografie** ca serverul, deci site-ul și aplicația se pot demonstra oriunde, iar testele lui trec prin verificatorul public.

**Testele sunt end-to-end adevărate:** 18 teste pornesc serverul real pe PostgreSQL și parcurg tot fluxul, inclusiv NFC cu cipuri de test, vot dublu simultan și un administrator care umblă în bază. CI-ul le rulează la fiecare push.

**Documentația e neobișnuit de completă** pentru un proiect de licență: teorie, pași, modelul de amenințare, demonstrații de atac cu rezultate, măsurători la 100/1.000/10.000 de alegători, plus ghidul de la zero.

**Structura e acum ușor de parcurs:** un folder per modul în backend, un fișier per componentă în web și mobil, comenzile CLI separate, CSS pe module, README în fiecare pachet, harta completă în `docs/explicatii/05-harta-fisierelor.md`.

## 2. Ce nu e bun sau lipsește

### 2.1 Funcțional (ce ar observa comisia sau alegătorul)

1. **Intervalul scrutinului e decorativ.** `opensAt` și `closesAt` se salvează și se afișează, dar nimic nu le aplică: votul se deschide și se închide doar manual, de comisie. Un alegător poate vota după `closesAt` dacă comisia nu a apăsat „Închide”. Fie se aplică automat (un job sau o verificare la fiecare cerere), fie se spune clar că sunt orientative.
2. **Lista de eligibili se poate importa doar în `draft`.** După deschidere nu se mai poate adăuga nimeni (un student înmatriculat târziu, un CSV greșit). Nu există nici ștergere din listă.
3. **Un scrutin nu se poate edita, anula sau șterge.** O greșeală la creare (un candidat scris greșit) înseamnă un scrutin nou și token-uri noi pentru trustees. Pentru `draft` ar trebui permise editarea și ștergerea.
4. **Comisia e un singur token static, fără utilizatori.** Nu se știe *cine* din comisie a apăsat „Închide votul”: jurnalul spune doar „comisie”. Nu există roluri (comisie vs. observator cu drept de citire a jurnalului).
5. **Politica de revot e „primul vot contează”**, implementată ca un vot per credential. E o decizie validă, dar nu e explicată alegătorului nicăieri înainte de trimitere, decât într-o propoziție pe ecranul de confirmare.
6. **Alegătorul nu are nicio cale de recuperare.** Dacă schimbă telefonul sau șterge aplicația după înregistrare, credentialul (cheia Ed25519) e pierdut și CNP-ul lui e deja „înregistrat”: nu mai poate vota. Lipsesc re-înregistrarea (cu invalidarea credentialului vechi, înainte de vot) și o explicație în aplicație.
7. **Nu există notificări sau mementouri**, nici în aplicație, nici pe email: alegătorul trebuie să știe singur când e deschis votul.
8. **Rezultatul nu arată nimic despre voturile „albe”**: schema cere exact un candidat ales (suma = 1), deci nu există vot alb sau abținere explicită. Pentru alegeri reale, de obicei trebuie o opțiune „niciunul”.
9. **Un singur scrutin per pagină, fără listă de alegeri multiple pe buletin** (de exemplu Consiliu și Senat în același tur). Fiecare e un scrutin separat, cu înregistrare separată.

### 2.2 Securitate și robustețe (ce ar observa un auditor)

10. **Ballot stuffing de către server rămâne posibil** (documentat în plan): serverul controlează și înregistrarea, deci poate inventa credentiale „înregistrate” și vota cu ele. Lista publică de înregistrări limitează, dar nu elimină riscul. Soluția din Belenios: o autoritate de înregistrare separată, care semnează lista de credentiale.
11. **Schema n-din-n:** dacă un trustee își pierde fișierul de cheie, rezultatul nu se mai poate decripta niciodată. Varianta t-din-n (Pedersen DKG sau Shamir) e extensia firească.
12. **Fișierul de cheie al trustee-ului e JSON în clar**, protejat doar de permisiunile sistemului de fișiere. Ar trebui criptat cu o parolă (de exemplu scrypt + AES-GCM).
13. **Starea în memorie a serverului** (provocările de autentificare, contoarele de limitare de rată, `sessionSecret` generat la pornire dacă lipsește) înseamnă că serverul **nu se poate rula în mai multe instanțe** și că o repornire invalidează sesiunile și provocările în curs. Pentru o facultate, o instanță e suficientă, dar trebuie spus explicit; altfel, Redis sau tabele în PostgreSQL.
14. **Conexiunea la bază cu `rejectUnauthorized: false`** când nu e dat `DATABASE_CA`: SSL-ul criptează, dar nu verifică identitatea serverului (posibil atac man-in-the-middle pe conexiunea la Supabase). Ar trebui ca CA-ul Supabase să fie inclus și verificarea să fie implicită.
15. **CORS implicit deschis** (`corsOrigins: true` dacă lipsește `CORS_ORIGINS`) și **fără antete de securitate** (`helmet`: CSP, HSTS etc.). Pentru producție trebuie închise.
16. **Nu există HTTPS în Docker Compose** și nici un reverse proxy; API-ul și site-ul merg pe HTTP simplu. Token-ul comisiei și sesiunile ar circula în clar.
17. **Nivelul „optic” (OCR) acceptă orice MRZ cu cifre de control corecte**, inclusiv unul printat. E documentat și marcat separat, dar comisia ar trebui să poată decide dacă îl acceptă (o setare per scrutin) sau să ceară NFC.
18. **Certificatul CSCA al României nu e inclus**, deci NFC-ul pe serverul real acceptă doar cipurile de test. Fără el, nivelul „criptografic” nu există în practică. Chip Authentication (anti-clonare) nu e implementată.
19. **Verificatorul nu verifică timpii:** `receivedAt` nu e comparat cu intervalul scrutinului și nici nu se cere să fie crescător. Un server ar putea antedata intrări.
20. **Codul criptografic nu e auditat independent** și BigInt-ul din JavaScript nu e în timp constant la nivel de procesor. Suficient pentru licență și demo, spus deschis în documentație.

### 2.3 Scalare

21. **`GET /elections/:id/board` și `audit-bundle` întorc tot board-ul într-un singur răspuns**, fără paginare. La 10.000 de buletine, pachetul de audit are ~22 MB; la 100.000 ar fi greu de încărcat în browser. Trebuie paginare pentru board și un format streaming (NDJSON) pentru verificator.
22. **Verificarea publică e liniară și pe un singur fir:** ~24 ms per buletin, deci 4 minute la 10.000. În browser e deja la limită. Soluții: Web Workers (câteva fire în paralel), verificarea agregată a semnăturilor Ed25519 (batch) sau un verificator nativ.
23. **Validarea unui buletin pe server ia ~25 ms de CPU** pe un singur proces Node: ~40 de buletine pe secundă. Suficient pentru o facultate, nu pentru un vârf de câteva mii de voturi pe minut. Worker threads sau mai multe procese ar rezolva.

### 2.4 Cod și proces

24. **`useAsync` și `format.ts` sunt duplicate** între web și mobil (identice). Un pachet `packages/ui-shared` (sau mutarea formatărilor pure în `@evoting/api`) le-ar unifica.
25. **Fără teste pentru interfețe:** site-ul și aplicația au fost testate manual cu Playwright, dar nimic nu rulează automat. Un smoke test Playwright pe site (creare scrutin → simulare → verificare) ar prinde regresii la refactorizări ca aceasta.
26. **Fără teste pentru CLI-uri** (`trustee`, `verifier`, `simulator`); testele e2e acoperă logica lor doar indirect.
27. **Fără linter și formatter unitar:** doar web-ul are `oxlint`; restul n-are nici prettier. Ar trebui `oxlint` + `prettier` la rădăcină și un pas în CI.
28. **Versiunile sunt fixate pe cea mai nouă ediție a bibliotecilor** (NestJS 12, React 19.2, Vite 8, TypeScript 6.0, Expo 57). Bine pentru noutate, dar merită `npm audit` în CI și un plan de actualizare.
29. **Instalarea aplicației mobile e separată** (`file:` deps, propriul `package-lock.json`) din cauza versiunii de React cerute de Expo. E documentat, dar e o capcană: o schimbare în `packages/api` cere `npm run build:packages` înainte ca aplicația să o vadă.
30. **Cvorumul (1/3 + 1)** e un număr fix în pagina comisiei, nu o setare a scrutinului.

## 3. Plan de dezvoltare propus

Ordinea ține cont de ce aduce cel mai mult pentru lucrare și pentru o demonstrație convingătoare, cu efort rezonabil.

### Etapa A: ce lipsește funcțional (1–2 săptămâni)

- Aplicarea intervalului: votul se poate trimite doar între `opensAt` și `closesAt`; comisia poate deschide mai devreme sau închide mai devreme, dar nu vota în afara lui. Afișarea unui ceas „se închide în …” în aplicație.
- Editarea și ștergerea scrutinelor în `draft`; adăugarea de eligibili și după deschidere (cu jurnal).
- Opțiunea „vot alb” ca un candidat special (nu schimbă criptografia: rămâne „exact una din n+1 opțiuni”).
- Re-înregistrarea înainte de vot (invalidează credentialul vechi; după vot, nu se mai poate).
- Cvorumul și politica de revot ca setări ale scrutinului, afișate alegătorului.
- Conturi pentru comisie (nume + parolă sau link magic), cu rol `comisie` și `observator`, și actorul real în jurnal.

### Etapa B: producție minimă (1 săptămână)

- HTTPS: Caddy sau nginx cu certificat în `docker-compose.yml`, `CORS_ORIGINS` obligatoriu, `helmet`.
- `DATABASE_CA` pentru Supabase și `rejectUnauthorized: true` implicit.
- `SESSION_SECRET` obligatoriu; provocările și limitarea de rată în PostgreSQL (sau Redis), ca serverul să poată rula în mai multe instanțe și să supraviețuiască repornirii.
- Paginarea board-ului și `audit-bundle` ca NDJSON streaming.
- Linter și prettier la rădăcină, `npm audit` și un smoke test Playwright în CI.

### Etapa C: criptografie și identitate (2–3 săptămâni, cel mai valoros pentru lucrare)

- **t-din-n** pentru trustees (Shamir peste chei ElGamal sau Pedersen DKG), ca pierderea unui trustee să nu blocheze rezultatul.
- **Fișierul de cheie criptat cu parolă** (scrypt + AES-GCM) și export/import.
- **Verificarea în paralel** în browser (Web Workers) și semnături Ed25519 verificate în lot.
- **Verificatorul verifică și timpii** (`receivedAt` crescător și în interval).
- **CSCA-ul României** în `CSCA_DIR` (de obținut de la MAI sau din ICAO PKD) și, opțional, Chip Authentication.
- O autoritate de înregistrare separată (ca în Belenios): un al doilea serviciu care semnează lista credentialelor, ca serverul să nu poată inventa alegători.

### Etapa D: calitate (continuu)

- Un pachet comun pentru `useAsync` și formatări.
- Teste pentru CLI-uri (cu backend-ul simulat) și pentru paginile principale.
- Măsurători pe un telefon Android real (criptarea, OCR-ul), cerute de plan.

## 4. Ce s-a schimbat la reorganizare (pe scurt)

Comportamentul nu s-a schimbat; toate exporturile publice ale pachetelor sunt aceleași. Detaliile sunt în [EXPLICATIE.md, Pasul 11](EXPLICATIE.md#pasul-11-reorganizarea-codului-16-nov-2026). Pe lângă mutări:

- testele crypto au crescut de la 35 la 44 (JSON canonic cu `undefined`, hex invalid, opțiune în afara listei, forma buletinului, chei de trustee invalide, cheie secretă nepotrivită, vot dublu pe board, scrutin încă deschis, progresul verificatorului);
- testele api de la 11 la 16 (CNP cu format greșit, text fără MRZ, DG1 invalid, base64, uneltele de test);
- testele e2e de la 17 la 18 (`/health`);
- `docker-compose.yml` lasă `DATABASE_SSL` din `.env` (înainte era forțat `off`, deci Supabase nu putea fi folosit criptat din Compose);
- workflow-ul APK nu mai pornește de pe un branch vechi; `apps/web/.gitignore` nu mai are șablonul Vite; fișierele rămase din șablonul Expo (`LICENSE`, `.claude/`) au fost șterse;
- în `BallotsService.cast` a dispărut un `catch` redundant, iar `slug()` folosește intervalul Unicode scris explicit.

## 5. Ce s-a rezolvat după analiză (17–18 noiembrie)

Din cele 30 de puncte din secțiunea 2: **13 rezolvate, 5 parțial, 12 rămase**. Testele au crescut de la 78 la 93 (crypto 45, api 20, backend 28), apoi, la a doua verificare din 18 nov., la 111 (crypto 54, api 25, backend 32).

| # | Punctul | Starea | Ce s-a făcut / ce lipsește |
| --- | --- | --- | --- |
| 1 | Intervalul decorativ | rezolvat | Votul e refuzat înainte de `opensAt` și după `closesAt`; serverul închide singur la `closesAt` (`AutoCloseService`, la fiecare minut); deschiderea e refuzată dacă data închiderii a trecut; site-ul și aplicația arată cât mai e. |
| 2 | Eligibili doar în `draft`, fără ștergere | rezolvat | Importul merge și cu votul deschis. Scoaterea din listă (18 nov.): `POST /elections/:id/eligible/remove`, în configurare sau cu votul deschis; înregistrarea celor care n-au votat se șterge și ea, cine a votat rămâne; în jurnal doar numerele. |
| 3 | Scrutinul nu se poate edita sau șterge | rezolvat | `PATCH` și `DELETE /elections/:id`, în `draft` (titlu, interval, candidați, vot alb); trustees rămân. Anularea unui scrutin deschis nu există. |
| 4 | Comisia e un singur token | rezolvat | Membri cu nume, rol (`comisie` / `observator`) și token propriu (doar SHA-256 pe server), revocare; actorul din jurnal e `comisie:<nume>`. `ADMIN_TOKEN` rămâne rădăcina. |
| 5 | Politica de revot neexplicată | rămâne | „Primul vot contează”, explicat într-o propoziție pe ecranul de confirmare. |
| 6 | Fără recuperare după schimbarea telefonului | rezolvat | Re-înregistrare înainte de vot: credentialul vechi și provocările lui se șterg; nu după vot și nu cu un nivel de încredere mai mic (OCR peste NFC). |
| 7 | Fără notificări | rămâne | |
| 8 | Fără vot alb | rezolvat | Un candidat special (`kind = 'blank'`), ultimul; criptografia neschimbată; afișat separat în rezultat. |
| 9 | Un singur scrutin per buletin | rămâne | |
| 10 | Ballot stuffing de către server | rămâne | Autoritatea de înregistrare separată e în etapa C. |
| 11 | Schema n-din-n | rămâne | t-din-n e în etapa C. |
| 12 | Fișierul de cheie în clar | rezolvat | `keygen --encrypt` / `--password`: scrypt + AES-256-GCM; `decrypt` cere parola. |
| 13 | Starea în memorie | parțial | Provocările sunt în tabela `auth_challenges`; avertisment dacă lipsește `SESSION_SECRET` în producție. Contoarele limitării de rată sunt încă în memoria fiecărei instanțe. |
| 14 | `rejectUnauthorized: false` fără `DATABASE_CA` | parțial | Avertisment la pornire; verificarea rămâne opțională. |
| 15 | CORS deschis, fără antete de securitate | rezolvat | `helmet` (HSTS, nosniff, X-Frame-Options etc.); avertisment pentru CORS deschis în producție; Compose restrânge CORS la originile site-ului. |
| 16 | Fără HTTPS în Compose | rezolvat | Caddy (`infra/Caddyfile`): `https://localhost`, API la `/api`, certificat local sau Let's Encrypt; `TRUST_PROXY`. Verificat cap-coadă pe 18 nov. |
| 17 | Nivelul optic fără setare per scrutin | rămâne | |
| 18 | CSCA România, Chip Authentication | rămâne | |
| 19 | Verificatorul nu verifică timpii | rezolvat | Ore valide, crescătoare și în `[opensAt, closesAt]`. Serverul ia ora după blocarea board-ului (reparat pe 18 nov.). |
| 20 | Cod criptografic neauditat | rămâne | |
| 21 | Board și audit-bundle fără paginare | parțial | `GET /elections/:id/board/page`, folosit de site. Pachetul de audit se descarcă tot întreg (fără NDJSON). |
| 22 | Verificare liniară, pe un fir | rezolvat | Semnăturile, dovezile și agregatul se verifică pe bucăți, pe toate nucleele: `worker_threads` (`evoting-verify --workers N`, CLI-ul trustee, simulatorul) și Web Workers (site). Raport identic cu cel pe un fir. 1.000 de buletine: ~30 s → ~6 s pe 16 nuclee logice (×4,9; i7-10700F, 8 nuclee fizice) (`docs/evaluare/verificare-paralela-18-nov.json`). Semnăturile în lot rămân. |
| 23 | ~25 ms de validare per buletin pe server | rămâne | |
| 24 | `useAsync` și `format.ts` duplicate | parțial | Formatările sunt acum în `packages/api/src/format.ts`, comune; `useAsync` e încă duplicat. |
| 25 | Fără teste pentru interfețe | rămâne | Interfața testată cap-coadă în Chrome pe 18 nov. Testele automate cer Vitest, jsdom și Testing Library (instalarea, neaprobată încă). |
| 26 | Fără teste pentru CLI-uri | rezolvat | `cli.e2e.test.ts` rulează `evoting-trustee` și `evoting-verify` ca procese separate (simulatorul nu are test propriu). |
| 27 | Fără linter și formatter unitar | rezolvat | `oxlint` și `prettier` la rădăcină; CI rulează `lint` și `format:check`. |
| 28 | Versiuni foarte noi, fără `npm audit` | parțial | `npm audit` în CI (fără să blocheze); planul de actualizare rămâne. |
| 29 | Instalarea separată a aplicației mobile | rămâne | Documentată. |
| 30 | Cvorumul fix | rămâne | |

Pe lângă acestea, la verificarea finală (18 nov.) s-au reparat două probleme: ora primirii putea ieși în ordine inversă la voturi simultane (acum se ia după blocarea board-ului; două teste noi) și verificarea de sănătate a containerului backend chema `localhost` (IPv6 în container) și marca serverul „unhealthy”; acum cheamă `127.0.0.1`.

**A doua verificare (18 nov., seara).** Codul a fost recitit integral, testele rulate pe PostgreSQL și site-ul folosit cap-coadă în Chrome (comisie, membri, trustees cu CLI-ul, vot, închidere, decriptare, verificare). Reparate: o alarmă falsă „conținut modificat” în căutarea de pe board după editarea câmpului; o acuzație falsă la auditul Benaloh cu date incomplete (acum avertisment, codul 2 în CLI); confirmare la „Închide votul”; CLI-urile care se prăbușeau pe Windows la `process.exit()` după `fetch` (cod de ieșire greșit); `format:check` picat local pe Windows din cauza CRLF (`.gitattributes` cere LF); `sslmode=disable` ignorat; erorile ascunse de închiderea automată; cheile Ed25519 de ordin mic acceptate ca credential; o intrare malformată care oprea verificatorul; acordul numeralelor în română. Apoi: scoaterea din lista de eligibili (punctul 2) și token-urile trustees păstrate în tab până la confirmare (nu se mai pierd la navigare). Detalii în `GHID-COMPLET.md`, 9.15–9.19.

**Ce urmează**, din planul de mai sus: etapa C (t-din-n, CSCA România, autoritatea de înregistrare, semnăturile în lot) și etapa D (teste pentru interfețe, `useAsync` comun, măsurători pe telefon).
