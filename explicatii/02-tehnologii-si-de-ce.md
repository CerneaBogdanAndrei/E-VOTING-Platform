# 2. Tehnologiile și de ce au fost alese

Fiecare secțiune răspunde la trei întrebări: **ce este**, **ce face în proiect** și **de ce ea și nu alta**.

## 2.1 Limbajul: TypeScript

### Ce este

**JavaScript** e limbajul care rulează în orice browser. A apărut pentru pagini web, dar azi rulează și pe servere (prin Node.js) și pe telefoane (prin React Native).

**TypeScript** e JavaScript cu **tipuri**. Tipul spune ce fel de valoare e într-o variabilă: număr, text, listă, un obiect cu anumite câmpuri. Exemplu:

```ts
function encrypt(publicKey: string, m: number): Ciphertext
```

Aici TypeScript știe că `publicKey` trebuie să fie text, `m` un număr, iar rezultatul un `Ciphertext`. Dacă undeva în cod scrii `encrypt(5, "abc")`, TypeScript îți arată eroarea **înainte** să rulezi programul.

Browserul și Node nu înțeleg direct TypeScript. Comanda `tsc` (TypeScript Compiler) **compilează** fișierele `.ts` în fișiere `.js`, puse în folderele `dist/`. Tipurile dispar la compilare; ele există doar ca să te ajute cât scrii.

### Ce face în proiect

Tot codul proiectului e TypeScript, cu excepția celor două module Android (Kotlin) și a migrărilor bazei de date (SQL). Versiunea e TypeScript 6.0.

### De ce TypeScript

1. **Un singur limbaj peste tot.** Criptografia e scrisă o dată, în `packages/crypto`, și o folosesc la fel telefonul, site-ul, serverul și verificatorul. O dovadă făcută pe telefon e verificată de **exact același cod** pe server. Dacă serverul ar fi fost în Java și telefonul în Kotlin, criptografia ar fi trebuit scrisă de două ori, cu riscul ca cele două variante să difere.
2. **Erorile se prind devreme.** Într-un sistem de vot, un câmp greșit (de exemplu `ciphertext` în loc de `ciphertexts`) poate face un vot invalid. TypeScript prinde asta înainte de rulare. Setarea `"strict": true` din `tsconfig.base.json` activează toate verificările.
3. **Contractul dintre aplicații și server e un singur fișier.** `packages/api/src/types.ts` descrie ce trimite și ce primește fiecare rută. Dacă se schimbă ceva acolo, TypeScript arată imediat toate locurile din telefon, site și server care trebuie actualizate.

Alternative respinse: Java/Kotlin pe server (două limbaje), Python (nu rulează pe telefon și în browser), JavaScript simplu (fără verificarea tipurilor).

## 2.2 Node.js și npm

### Node.js

**Node.js** e programul care rulează JavaScript în afara browserului, pe un calculator sau server. Serverul, uneltele din linia de comandă (`tools/`), testele și demonstrațiile rulează toate în Node. Pe PC-ul tău e Node 24, iar în Docker și pe GitHub e Node 22. Proiectul cere minimum 22.12 (`"engines"` din `package.json`).

Node are module încorporate, importate cu prefixul `node:`. De exemplu, `node:crypto` (numere aleatoare, SHA-256, HMAC, verificarea certificatelor) și `node:fs` (citirea fișierelor).

### npm

**npm** (Node Package Manager) descarcă bibliotecile scrise de alții. Fiecare proiect are un `package.json` care spune:

- `name`: numele pachetului, de exemplu `@evoting/crypto`;
- `dependencies`: bibliotecile necesare la rulare;
- `devDependencies`: bibliotecile necesare doar la dezvoltare (TypeScript, tipuri);
- `scripts`: comenzi scurte, de exemplu `npm test`, `npm run build`, `npm run dev`.

Bibliotecile se descarcă în folderul `node_modules/`, care nu intră în Git pentru că e mare și se poate recrea oricând.

`package-lock.json` reține versiunea **exactă** a fiecărei biblioteci instalate. Comanda `npm ci` instalează exact acele versiuni, deci pe PC-ul tău, în Docker și pe GitHub rulează același cod.

### npm workspaces (monorepo)

Un **monorepo** e un singur repository cu mai multe proiecte. `package.json` de la rădăcină declară:

```json
"workspaces": ["packages/crypto", "packages/api", "apps/backend", "apps/web", "tools/trustee", ...]
```

Asta înseamnă:

- `npm install` o dată, la rădăcină, instalează tot;
- un pachet îl poate importa pe altul după nume: în server scrii `import { encrypt } from '@evoting/crypto'`, iar npm face legătura cu folderul `packages/crypto`;
- `npm test` și `npm run build` la rădăcină rulează pe toate pachetele.

**De ce:** fără monorepo ar fi fost nevoie de copiat fișiere între proiecte (exact ce făcea vechiul script `sync-api.mjs`, șters între timp) sau de publicat pachetele pe internet.

**Excepția:** aplicația mobilă (`apps/mobile`) **nu** e în workspaces și are propriul `node_modules`. Motivul: Expo cere fix React 19.2.3, iar site-ul folosește React ≥ 19.2.7. Două versiuni de React în același `node_modules` se ciocnesc. Aplicația mobilă leagă pachetele comune prin `"file:../../packages/crypto"`.

## 2.3 Criptografia: `@noble/curves` și `@noble/hashes`

### Ce sunt

Două biblioteci scrise de Paul Miller, folosite pe scară largă (de exemplu, în portofele de criptomonede):

- **`@noble/curves`**: curbe eliptice. Proiectul folosește `ristretto255` (pentru ElGamal și dovezi) și `ed25519` (pentru semnăturile credentialului).
- **`@noble/hashes`**: funcții hash: `sha256`, `sha512`, `hmac`.

### De ce ele

1. **JavaScript pur, fără cod nativ.** Rulează identic în Node, în browser și pe telefon (în motorul Hermes). Bibliotecile cu cod C (de exemplu `libsodium`) cer compilare separată pentru fiecare platformă.
2. **Auditate.** Au fost verificate de firme de securitate independente. Scrierea criptografiei de bază de la zero ar fi fost riscantă.
3. **Fără dependențe.** Mai puțin cod străin înseamnă mai puține locuri unde se poate ascunde o problemă.
4. **Versiune fixă** (`"2.4.0"`, fără `^`), ca o actualizare automată să nu schimbe nimic în criptografie fără să știi.

**Ce e scris în proiect peste ele:** ElGamal, toate dovezile zero-knowledge, buletinul, board-ul, trustees, numărarea și verificatorul. Bibliotecile dau doar operațiile de bază (adunarea punctelor, hash-ul, semnătura).

**De ce ristretto255 și nu MODP-2048** (folosit în macheta inițială): chei de 32 de octeți în loc de 256, calcule de câteva ori mai rapide pe telefon și un grup fără capcanele clasice ale curbelor eliptice (punctele „de ordin mic”).

## 2.4 Serverul: NestJS

### Ce este

**NestJS** e un framework pentru servere web în TypeScript. Un **framework** e un schelet gata făcut: tu scrii doar logica, iar el se ocupă de primirea cererilor, de rutare, de erori și de legarea componentelor între ele. Proiectul folosește NestJS 12.

Conceptele NestJS din proiect:

| Concept | Ce este | Exemplu în proiect |
| --- | --- | --- |
| **Controller** | Clasa care primește cererile HTTP și le trimite mai departe. Fiecare metodă e legată de o rută. | `ElectionsController`: `@Get(':id/board')` → `board(id)` |
| **Service** (provider) | Clasa care face treaba propriu-zisă: logica și accesul la baza de date. | `VotingService.cast(...)` |
| **Module** | Lista care spune Nest-ului ce controllere și servicii există. | `AppModule` |
| **Guard** | O verificare înainte ca cererea să ajungă la controller. Dacă pică, cererea e refuzată. | `AdminGuard` verifică token-ul comisiei |
| **Decorator** | Adnotarea care începe cu `@`, pusă deasupra unei clase sau metode, care îi spune Nest-ului ce să facă cu ea. | `@Controller('elections')`, `@Post()`, `@UseGuards(AdminGuard)` |
| **Dependency injection** | Nest creează singur serviciile și le dă automat cui are nevoie de ele, prin constructor. | `constructor(private readonly db: Database)` |

### De ce NestJS

- E organizat pe componente clare (controller, service, guard), ușor de explicat în lucrare.
- Are module gata făcute pentru limitarea de rată (`@nestjs/throttler`).
- E TypeScript din prima zi.

Alternativa mai simplă ar fi fost Express direct, dar ar fi trebuit construite manual structura, protecțiile și tratarea erorilor.

### Bibliotecile care vin cu NestJS

| Bibliotecă | Ce face |
| --- | --- |
| `@nestjs/core`, `@nestjs/common` | Nucleul Nest: decoratorii, excepțiile (`ForbiddenException`, `ConflictException` etc.), injectarea dependențelor. |
| `@nestjs/platform-express` | Nest rulează peste **Express**, cel mai folosit server HTTP pentru Node. Express ascultă pe port și citește cererile. |
| `@nestjs/throttler` | Limitarea de rată: câte cereri pe minut acceptă de la aceeași adresă IP. |
| `reflect-metadata` | Permite decoratorilor să rețină informații despre clase (de exemplu, ce tip are fiecare parametru din constructor). Nest are nevoie de ea; se importă o dată, în `app.ts`. |
| `rxjs` | Bibliotecă pentru fluxuri de evenimente, folosită intern de Nest. Proiectul nu o folosește direct. |
| `multer` | Bibliotecă pentru încărcarea fișierelor, adusă de `platform-express`. Versiunea e forțată la 2.5.0 în `package.json` de la rădăcină (`"overrides"`), pentru că versiunile vechi aveau o vulnerabilitate cunoscută. |

## 2.5 Baza de date: PostgreSQL, `pg` și Supabase

### PostgreSQL

O **bază de date relațională**: datele stau în **tabele** (ca foi Excel) cu coloane fixe, iar legăturile dintre tabele sunt garantate de bază. Limbajul folosit e **SQL**. Proiectul are nouă tabele (`elections`, `candidates`, `trustees`, `eligible_voters`, `registrations`, `ballots`, `partial_decryptions`, `results`, `audit_log`), create de fișierul `apps/backend/migrations/001_init.sql`.

**De ce PostgreSQL:**

- **Tranzacții:** mai multe operații se fac „toate sau niciuna”. La vot: verifici că n-ai votat, citești ultima intrare de pe board, adaugi intrarea nouă. Dacă ceva pică la mijloc, nu rămâne nimic pe jumătate.
- **Constrângeri:** `UNIQUE (election_id, credential_pubkey)` pe `ballots` garantează un vot per credential **chiar și** dacă două cereri sosesc în aceeași milisecundă. Testul „două voturi simultane” verifică exact asta.
- **Triggere:** codul din bază care refuză `UPDATE` și `DELETE` pe `ballots`. Nici serverul, nici cineva care intră direct în bază nu poate modifica board-ul fără să dezactiveze explicit trigger-ul.
- **`jsonb`:** coloane care țin JSON (criptotextele și dovezile), fără să fie nevoie de zeci de coloane.
- **Gratuit și standard.**

### `pg` (node-postgres)

Driverul care permite Node-ului să vorbească cu PostgreSQL. Serverul scrie SQL **de mână**, de exemplu:

```ts
await client.query('SELECT 1 FROM ballots WHERE election_id = $1 AND credential_pubkey = $2', [electionId, pubkey])
```

`$1` și `$2` sunt **parametri**. Valorile se trimit separat de text, deci un atacator nu poate „injecta” SQL scriind cod într-un câmp (atacul se numește SQL injection).

**De ce fără ORM** (un ORM e o bibliotecă precum Prisma sau Drizzle care scrie SQL-ul în locul tău): ca fiecare interogare să fie vizibilă și ușor de explicat în lucrare, mai ales tranzacția de la vot și blocarea rândului (`SELECT … FOR UPDATE`).

**Pool de conexiuni:** `pg.Pool({ max: 20 })` ține deschise până la 20 de conexiuni și le refolosește. Deschiderea unei conexiuni noi la fiecare cerere ar fi lentă, mai ales spre Supabase, care e pe alt continent de server.

### Supabase

Un serviciu online care îți dă o bază PostgreSQL găzduită, gratuit pentru proiecte mici. Datele tale stau acum acolo (`DATABASE_URL` din `.env`).

Particularități tratate în cod:

- **SSL obligatoriu:** conexiunea spre Supabase trebuie criptată. `apps/backend/src/db/pg-options.ts` pornește SSL automat pentru orice server care nu e `localhost`.
- **Session pooler:** Supabase dă o adresă (`…pooler.supabase.com:5432`) prin care trec conexiunile. E cea pusă în `.env`.
- **RLS** (Row Level Security): Supabase expune automat tabelele și printr-un API web propriu. Migrarea `002_rls.sql` activează RLS pe toate tabelele fără nicio regulă de acces, deci acel API nu vede nimic. Doar serverul tău, conectat direct cu parola, are acces.

**De ce Supabase:** bază online gratuită, fără să administrezi un server. Același cod merge și pe un PostgreSQL local (în Docker), fără nicio modificare.

## 2.6 Verificarea certificatelor de pe cip: `pkijs` și `asn1js`

- **ASN.1** e formatul binar în care sunt scrise certificatele digitale și SOD-ul de pe cipul buletinului. **`asn1js`** îl citește.
- **`pkijs`** înțelege structurile de deasupra: certificate X.509 și CMS SignedData (un document semnat). Cu el, `apps/backend/src/nfc/passive-auth.ts` despachetează SOD-ul.
- Semnătura propriu-zisă și certificatele se verifică apoi cu `node:crypto`, care folosește **OpenSSL** în spate. OpenSSL suportă curbele **brainpool**, folosite pe multe documente europene.
- Aceleași biblioteci generează în `test-pki.ts` un CSCA și un DSC „de laborator”, pentru teste fără un buletin real.

## 2.7 Site-ul: React, React Router și Vite

### React

O bibliotecă pentru interfețe. Pagina se construiește din **componente**: funcții care primesc date și întorc ce trebuie afișat, într-o sintaxă care arată ca HTML, numită **JSX**:

```tsx
function Badge({ status }: { status: string }) {
  return <span className="badge">{status}</span>
}
```

Când datele se schimbă, React actualizează singur doar partea de pagină afectată. Fișierele cu JSX au extensia `.tsx`. Versiunea folosită e React 19.

Concepte care apar în cod:

- **`useState`**: o variabilă care, când se schimbă, face componenta să se redeseneze. Exemplu: `const [choice, setChoice] = useState<number>()`.
- **`useEffect`**: cod care rulează după afișare, de exemplu încărcarea datelor de la server.
- **Hook**: orice funcție care începe cu `use`. Proiectul are propriul hook, `useAsync`, care încarcă date și ține starea de încărcare și eroare.
- **Props**: parametrii unei componente, de exemplu `status` mai sus.

**De ce React:** cel mai folosit, iar aplicația mobilă (React Native) folosește aceleași concepte. Știi React, știi și jumătate din aplicația mobilă.

### React Router

Leagă adresele din bara browserului de pagini: `/scrutin/:id` → `ElectionPublic`, `/comisie` → `Commission`. `:id` e o parte variabilă a adresei.

### Vite

Unealta care:

- în dezvoltare (`npm run dev`), pornește un server local pe portul 5173 și reîncarcă pagina instant la fiecare modificare;
- la `npm run build`, transformă tot codul TypeScript și CSS în câteva fișiere mici, optimizate, în `apps/web/dist/`.

Variabilele care încep cu `VITE_` (de exemplu `VITE_API_URL`) sunt puse în cod **la build**. De aceea, în Docker, adresa API-ului se dă ca argument de build.

**De ce Vite:** foarte rapid, configurare minimă (7 rânduri în `vite.config.ts`).

### oxlint

Un **linter**: un program care citește codul și semnalează greșeli probabile sau stil inconsistent, fără să-l ruleze. E foarte rapid, fiind scris în Rust.

### `sessionStorage`

Memoria browserului pentru un singur tab. Token-ul comisiei stă aici (`apps/web/src/api/admin.ts`) și dispare la închiderea tab-ului, ca să nu rămână pe un calculator comun.

## 2.8 Aplicația mobilă: Expo și React Native

### React Native

Permite scrierea aplicațiilor de telefon în React. În loc de `<div>` și `<span>` (HTML), folosești `<View>` și `<Text>`, care devin componente native Android sau iOS. Codul JavaScript rulează pe telefon în **Hermes**, motorul JavaScript făcut de Meta pentru telefoane. Versiunea folosită e React Native 0.86.

### Expo

O platformă construită peste React Native, care îți dă:

- module gata făcute pentru cameră, stocare securizată, clipboard etc.;
- **Expo Router**: navigarea între ecrane după structura folderelor. Fișierul `src/app/scrutin/[id]/vot.tsx` devine automat ecranul `/scrutin/<id>/vot`;
- **`expo prebuild`**: generează proiectul Android complet din `app.json`, deci nu trebuie scris de mână;
- **Metro**: împachetatorul care adună tot JavaScript-ul aplicației (`metro.config.js` îi spune să urmărească și `packages/`).

Versiunea folosită e Expo SDK 57.

**De ce Expo:** cel mai rapid drum de la React la un APK, iar modulele native proprii (NFC, OCR) se pot adăuga ca **Expo Modules** în Kotlin.

### Modulele Expo folosite

| Modul | La ce folosește |
| --- | --- |
| `expo-router` | Navigarea între ecrane. |
| `expo-camera` | Fotografierea MRZ-ului. |
| `expo-secure-store` | Păstrarea cheii de credential, criptată cu o cheie din **Android Keystore** (zona protejată a telefonului). |
| `expo-crypto` | Numere aleatoare sigure. Hermes nu are `crypto.getRandomValues`, de care are nevoie criptografia, deci `src/lib/polyfills.ts` îl adaugă din `expo-crypto`. Un **polyfill** e cod care adaugă o funcție lipsă dintr-un mediu. |
| `expo-clipboard` | Copierea codului de urmărire. |
| `expo-constants`, `expo-linking`, `expo-status-bar` | Configurația aplicației, legăturile `evote://` și bara de sus a telefonului. |
| `react-native-screens`, `react-native-safe-area-context` | Ecrane native rapide și respectarea zonelor ocupate de notch sau de bara de jos. |
| `react-native-web` | Permite rularea aplicației și în browser, pentru teste. |

### Kotlin și modulele native

Unele lucruri nu se pot face din JavaScript, de exemplu vorbitul direct cu cipul NFC. Pentru ele există două module scrise în **Kotlin**, limbajul oficial pentru Android:

| Modul | Biblioteci | Ce face |
| --- | --- | --- |
| `modules/evoting-nfc` | **JMRTD 0.8.9** (citirea documentelor de călătorie electronice), **SCUBA** (accesul la carduri inteligente pe Android), **BouncyCastle 1.86** (criptografia necesară pentru PACE pe curbe eliptice) | Deschide PACE cu CAN-ul și citește DG1 și SOD. |
| `modules/evoting-ocr` | **ML Kit Text Recognition 16** (Google) | Recunoaște textul din fotografie, direct pe telefon, fără internet. |

**De ce JMRTD:** e biblioteca open-source de referință pentru pașapoarte și cărți de identitate electronice ICAO. Implementarea PACE de la zero ar fi luat luni.

**De ce ML Kit și nu Tesseract:** rulează pe telefon, e rapid și nu trimite imaginea pe internet. Planul permitea ambele variante.

**Gradle** e programul care compilează proiectul Android. `build.gradle` spune ce biblioteci Java/Kotlin să descarce. `plugins/with-packaging-excludes.js` modifică automat configurația Gradle generată, ca să ignore fișierele `META-INF` duplicate din BouncyCastle, din cauza cărora build-ul pica.

### APK

**APK** (Android Package) e fișierul de instalare al aplicației Android. Al tău e în `apk/vot-verificabil.apk` și e construit pe serverele GitHub (vezi 2.10).

## 2.9 Docker, Docker Compose și nginx

### Problema pe care o rezolvă Docker

Ca serverul să ruleze, ai nevoie de Node 22, de toate bibliotecile, de PostgreSQL și de variabilele de mediu corecte. Pe alt calculator, ceva lipsește mereu sau e altă versiune („la mine merge”).

### Ce este Docker

Docker împachetează un program **împreună cu tot ce-i trebuie** (sistem de operare minim, Node, biblioteci, cod) într-o **imagine**. O imagine pornită devine un **container**: un mic calculator izolat care rulează pe al tău. Merge identic pe PC-ul tău, pe laptop sau pe un server din cloud.

- **Dockerfile**: rețeta imaginii, pas cu pas (explicat rând cu rând în capitolul 4).
- **Imagine de bază**: punctul de plecare, de exemplu `node:22-alpine` (Linux Alpine, foarte mic, cu Node 22 deja instalat).
- **Multi-stage build**: Dockerfile-ul are două etape. Prima compilează tot. A doua copiază doar rezultatul compilat, fără TypeScript și fără uneltele de build, deci imaginea finală e mai mică și mai sigură.
- **Volum**: un folder care supraviețuiește când containerul e șters. `pgdata` ține datele bazei locale, iar `pki` ține certificatele de test.
- **Port**: `"3000:3000"` înseamnă că portul 3000 de pe calculatorul tău duce la portul 3000 din container.

### Docker Compose

`docker-compose.yml` descrie **mai multe containere** care lucrează împreună și le pornește cu o singură comandă, `docker compose up --build`:

| Serviciu | Ce rulează | Port |
| --- | --- | --- |
| `db` | PostgreSQL 16 local (folosit doar dacă `DATABASE_URL` lipsește din `.env`) | intern |
| `backend` | Serverul NestJS | 3000 |
| `web` | Site-ul, servit de nginx | 8080 |

`depends_on` cu `condition: service_healthy` înseamnă: backend-ul pornește doar după ce baza răspunde. `healthcheck` e comanda prin care Docker verifică periodic dacă un serviciu e sănătos.

### nginx

Un server web foarte rapid pentru fișiere statice. După `npm run build`, site-ul e doar un set de fișiere HTML, JS și CSS. nginx le servește pe portul 80 din container (8080 la tine). Regula `try_files $uri /index.html` trimite orice adresă necunoscută spre `index.html`, ca React Router să poată afișa pagina potrivită.

**De ce Docker:** planul cerea o demonstrație pornită cu o singură comandă, repetabilă pe orice calculator. Pentru găzduirea online, aceleași imagini se pot urca pe orice serviciu (Render, Railway, un VPS).

### WSL

**Windows Subsystem for Linux**: un Linux care rulează în Windows. Docker Desktop îl folosește pe Windows, pentru că containerele sunt, în fond, procese Linux.

## 2.10 GitHub Actions: CI și APK-ul

**CI** (Continuous Integration) înseamnă că la fiecare `git push`, un server GitHub descarcă codul și rulează automat testele. Dacă ceva pică, vezi un ✗ roșu.

Fișierele sunt în `.github/workflows/` și sunt scrise în **YAML** (un format de configurare bazat pe indentare):

| Workflow | Când rulează | Ce face |
| --- | --- | --- |
| `ci.yml` | La fiecare push | Pornește un PostgreSQL de test, instalează tot, rulează cele 63 de teste și build-ul. Separat, verifică tipurile aplicației mobile și o împachetează pentru Android. |
| `android-apk.yml` | Când se schimbă `apps/mobile` sau `packages`, sau manual | Instalează Java 17 (Android SDK există deja pe serverele GitHub), rulează `expo prebuild` și `gradlew assembleRelease`, apoi salvează APK-ul în `apk/` și îl face commit. |

**De ce pe GitHub:** construirea unui APK cere Android SDK (câțiva GB). Pe serverele GitHub e gratuit și nu-ți ocupă PC-ul.

## 2.11 Uneltele de lucru

| Unealtă | Ce este | Unde apare |
| --- | --- | --- |
| **Git** | Ține istoria tuturor modificărilor (commit-uri). Poți vedea cine a schimbat ce și te poți întoarce oricând. | Tot proiectul |
| **GitHub** | Site-ul unde stă repository-ul online. | `CerneaBogdanAndrei/E-VOTING-Platform` |
| **Branch** | O linie separată de lucru în Git. Proiectul lucrează acum doar pe `master`. | – |
| **Commit** | Un „punct salvat” în istorie, cu un mesaj. | – |
| **`.gitignore`** | Lista fișierelor pe care Git le ignoră: `node_modules`, `dist`, `.env`. | rădăcină și fiecare pachet |
| **`.gitattributes`** | Reguli pentru Git. Aici forțează capete de rând Linux (LF) pentru scripturile `.sh`, ca Docker să le poată rula de pe Windows. | rădăcină |
| **`.env`** | Fișier cu secrete și configurări (`DATABASE_URL`, `CNP_HMAC_KEY`, `ADMIN_TOKEN`). Nu intră niciodată în Git. `.env.example` e modelul, fără valori secrete. | rădăcină, `apps/backend`, `apps/web` |
| **Playwright** | Un browser controlat de un program. A fost folosit pentru a testa site-ul și aplicația în varianta web, dar nu e o dependență a proiectului. | – |
| **`node --test`** | Programul de teste încorporat în Node. Proiectul nu folosește Jest sau Mocha, deci are o dependență mai puțin. | `test/*.test.ts` |
