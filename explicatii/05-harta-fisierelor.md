# 5. Harta fișierelor

Fiecare fișier din proiect, cu o propoziție simplă despre ce face. Fișierele generate automat (`node_modules/`, `dist/`, `package-lock.json`) nu sunt descrise unul câte unul.

Cum citești structura:

```
D:\Licenta_E-vote
├── packages/        biblioteci comune, folosite de toate celelalte
│   ├── crypto/      criptografia
│   └── api/         comunicarea cu serverul și citirea actelor
├── apps/            aplicațiile propriu-zise
│   ├── backend/     serverul
│   ├── web/         site-ul
│   └── mobile/      aplicația de telefon
├── tools/           programe în linia de comandă
├── demos/           demonstrații de atac și macheta veche
├── docs/evaluare/   rezultatele măsurătorilor
├── apk/             aplicația Android construită
├── explicatii/      acest ghid
└── .github/         automatizările de pe GitHub
```

## Rădăcina proiectului

| Fișier | Ce face |
| --- | --- |
| `package.json` | Spune că proiectul e un monorepo, lista pachetelor și comenzile `npm run build`, `npm test`, `npm run typecheck`. |
| `package-lock.json` | Versiunile exacte ale tuturor bibliotecilor (generat automat). |
| `tsconfig.base.json` | Setările TypeScript comune. |
| `docker-compose.yml` | Pornește baza, serverul și site-ul cu `docker compose up --build`. |
| `.env` | Secretele tale pentru Docker Compose: `CNP_HMAC_KEY`, `ADMIN_TOKEN`, `DATABASE_URL` (Supabase). Nu intră în Git. |
| `.env.example` | Modelul pentru `.env`, fără secrete. |
| `.gitignore` | Ce nu intră în Git. |
| `.gitattributes` | Scripturile `.sh` și Dockerfile-urile rămân cu capete de rând Linux. |
| `.dockerignore` | Ce nu se copiază în imaginile Docker (`node_modules`, `.env` etc.). |
| `README.md` | Prezentarea scurtă a proiectului. |
| `DOCUMENTATIE.md` | Documentația tehnică pentru licență. |
| `EXPLICATIE.md` | Istoria construcției și descrierea tehnică a fișierelor. |
| `frontend/` | Rămășițe vechi, neurmărite de Git, de dinainte de restructurare. Pot fi șterse. |

## `.github/workflows/`

| Fișier | Ce face |
| --- | --- |
| `ci.yml` | La fiecare push rulează testele (cu o bază PostgreSQL de test), build-ul și verificarea aplicației mobile. |
| `android-apk.yml` | Construiește APK-ul și îl pune în `apk/`. |

## `packages/crypto/`: criptografia

| Fișier | Ce face |
| --- | --- |
| `src/encoding.ts` | Verifică textele hex și transformă obiectele în JSON „canonic” (chei sortate), ca același obiect să dea mereu același hash. |
| `src/group.ts` | Operațiile pe grupul ristretto255: numere aleatoare, punctul G, înmulțiri, transformarea punctelor în hex și înapoi. |
| `src/hash.ts` | SHA-256, HMAC (inclusiv pentru CNP) și hash-ul folosit în dovezi (Fiat-Shamir). |
| `src/types.ts` | Forma datelor criptografice: criptotext, dovadă, buletin, intrare pe board. |
| `src/elgamal.ts` | Criptarea ElGamal și adunarea criptotextelor. |
| `src/proofs.ts` | Dovezile zero-knowledge: Schnorr, Chaum-Pedersen și dovada 0/1. |
| `src/credential.ts` | Cheile Ed25519 ale alegătorului: generare, semnare, verificare. |
| `src/ballot.ts` | Construiește buletinul (criptotexte, dovezi, semnătură), îl verifică și face auditul Benaloh. |
| `src/board.ts` | Registrul public: lanțul de hash-uri și verificarea propriului vot. |
| `src/trustee.ts` | Cheile trustees și decriptarea parțială. |
| `src/tally.ts` | Calculul totalurilor criptate și aflarea numerelor (baby-step giant-step). |
| `src/verify.ts` | Verificatorul public, cu cei șase pași. |
| `src/index.ts` | Exportă tot ce folosesc celelalte pachete. |
| `test/crypto.test.ts` | 35 de teste pentru tot ce e mai sus. |
| `test/helpers.ts` | Simulează un scrutin complet fără server, pentru teste. |
| `package.json`, `tsconfig*.json`, `.gitignore` | Numele pachetului, comenzile și setările de compilare. |

## `packages/api/`: comunicarea și actele

| Fișier | Ce face |
| --- | --- |
| `src/types.ts` | Contractul dintre aplicații și server: forma fiecărei cereri și a fiecărui răspuns, plus `ApiError`. |
| `src/http.ts` | Clientul care trimite cereri reale la server. |
| `src/mock.ts` | Serverul simulat, în memorie, cu aceleași reguli și aceeași criptografie. Are și butonul de test care adaugă CNP-ul tău în lista de eligibili. |
| `src/cnp.ts` | Validarea CNP-ului și generarea de CNP-uri fictive pentru teste. |
| `src/mrz.ts` | Citește MRZ-ul (TD1, TD2, TD3), verifică cifrele de control și reconstituie CNP-ul. |
| `src/dg1.ts` | Scoate MRZ-ul din DG1-ul citit de pe cip. |
| `src/voter.ts` | Pașii alegătorului: autentificare, criptare, trimitere, verificare. |
| `src/index.ts` | Exportă tot. |
| `test/api.test.ts` | 11 teste: CNP, MRZ, DG1 și un scrutin complet pe serverul simulat. |

## `apps/backend/`: serverul

| Fișier | Ce face |
| --- | --- |
| `.env` | Secretele serverului pentru `npm run dev`: `DATABASE_URL` (Supabase), `CNP_HMAC_KEY`, `ADMIN_TOKEN`. Nu intră în Git. |
| `.env.example` | Modelul, fără secrete. |
| `Dockerfile` | Rețeta imaginii Docker a serverului. |
| `docker-entrypoint.sh` | La pornirea containerului, generează certificatele de test dacă e cerut. |
| `migrations/001_init.sql` | Creează cele nouă tabele și trigger-ul care interzice modificarea board-ului. |
| `migrations/002_rls.sql` | Activează Row Level Security pe toate tabelele (blochează API-ul public Supabase). |
| `src/main.ts` | Pornește serverul. |
| `src/app.ts` | Aplică migrările și construiește aplicația Nest. |
| `src/app.module.ts` | Leagă controllerele, serviciile și limitarea de rată. |
| `src/config.ts` | Citește și verifică variabilele de mediu. |
| `src/db/database.service.ts` | Conexiunea la bază și tranzacțiile. |
| `src/db/pg-options.ts` | Pornește SSL pentru bazele online (Supabase). |
| `src/db/migrate.ts` | Aplică migrările o singură dată, în ordine. |
| `src/db/migrate-cli.ts` | Același lucru, din linia de comandă (`npm run migrate`). |
| `src/common/security.ts` | Token-uri aleatoare, comparație în timp constant, sesiunile alegătorilor. |
| `src/common/admin.guard.ts` | Verifică token-ul comisiei. |
| `src/common/throttle.ts` | Limita strictă de rată (30 de cereri pe minut). |
| `src/common/validate.ts` | Verifică datele primite și dă erori clare, în română. |
| `src/common/audit.service.ts` | Scrie și citește jurnalul de audit. |
| `src/elections/elections.controller.ts` | Rutele `/elections/...`. |
| `src/elections/elections.service.ts` | Logica scrutinelor: creare, import eligibili, deschidere, închidere, chei trustees, citiri publice. |
| `src/voting/voting.service.ts` | Înregistrarea, autentificarea și votul. |
| `src/tally/tally.service.ts` | Decriptările parțiale și publicarea rezultatului. |
| `src/auth/auth.controller.ts` | Rutele `/auth/challenge`, `/auth/verify`, `/health`, `/admin/check`. |
| `src/nfc/passive-auth.ts` | Verifică semnătura statului pe datele cipului. |
| `src/nfc/passive-auth.service.ts` | Încarcă certificatele CSCA și cheamă verificarea. |
| `src/nfc/test-pki.ts` | Creează un CSCA și un DSC de test și „cipuri” de test. |
| `src/nfc/test-pki-cli.ts` | Același lucru, din linia de comandă. |
| `test/e2e.test.ts` | 17 teste care pornesc serverul real pe o bază de test și parcurg tot fluxul. |
| `test/helpers.ts` | Pregătește baza de test (o golește!) și pornește serverul pentru teste. |

## `apps/web/`: site-ul

| Fișier | Ce face |
| --- | --- |
| `index.html` | Pagina goală în care React desenează site-ul. |
| `vite.config.ts` | Configurarea Vite (pluginul React). |
| `.env` | `VITE_API_URL=http://localhost:3000`, pentru `npm run dev`. Nu intră în Git. |
| `.oxlintrc.json` | Regulile linter-ului. |
| `Dockerfile`, `nginx.conf` | Construirea și servirea site-ului în Docker. |
| `public/favicon.svg` | Iconița din tab-ul browserului. |
| `src/main.tsx` | Punctul de intrare: pornește React. |
| `src/App.tsx` | Lista paginilor și adresele lor. |
| `src/index.css` | Tot stilul vizual. |
| `src/api/index.ts` | Alege serverul real sau cel simulat. |
| `src/api/config.ts` | Citește `VITE_API_URL`. |
| `src/api/admin.ts` | Ține token-ul comisiei în `sessionStorage`. |
| `src/components/Layout.tsx` | Bara de sus și meniul. |
| `src/components/AdminGate.tsx` | Ecranul de login al comisiei. |
| `src/components/ui.tsx` | Componente mici: insigna de stare, hash-ul scurtat, mesajele. |
| `src/pages/Home.tsx` | Lista scrutinelor. |
| `src/pages/Commission.tsx` | Lista scrutinelor pentru comisie. |
| `src/pages/CommissionNew.tsx` | Formularul de creare a unui scrutin. |
| `src/pages/CommissionElection.tsx` | Administrarea unui scrutin: token-uri trustees, import CSV, deschidere, închidere, jurnal. |
| `src/pages/ElectionPublic.tsx` | Pagina publică: board, rezultat, verificare publică, audit Benaloh, parametri. |
| `src/pages/About.tsx` | „Cum funcționează”, pentru public. |
| `src/lib/format.ts` | Formatarea datelor și a numerelor. |
| `src/lib/useAsync.ts` | Încărcarea datelor în pagini. |

## `apps/mobile/`: aplicația de telefon

| Fișier | Ce face |
| --- | --- |
| `app.json` | Numele aplicației, pachetul Android `ro.udjg.evoting`, permisiunile (cameră, NFC) și pluginurile. |
| `package.json` | Dependențele aplicației (instalate separat de restul proiectului). |
| `metro.config.js` | Îi spune împachetatorului Metro să includă și `packages/`. |
| `tsconfig.json` | Setările TypeScript ale aplicației. |
| `.env.example` | Modelul pentru `EXPO_PUBLIC_API_URL`. |
| `plugins/with-packaging-excludes.js` | Rezolvă conflictul de fișiere META-INF la construirea APK-ului. |
| `assets/` | Iconițele aplicației. |
| `src/lib/polyfills.ts` | Adaugă numerele aleatoare sigure, care lipsesc pe telefon. |
| `src/lib/session.tsx` | Ține credentialul, înregistrarea și chitanța în SecureStore. |
| `src/lib/native.ts` | Încarcă modulele native NFC și OCR, dacă există. |
| `src/lib/theme.ts` | Culorile. |
| `src/lib/format.ts`, `src/lib/useAsync.ts` | Formatare și încărcarea datelor. |
| `src/api/index.ts`, `src/api/config.ts` | Alege serverul real sau cel simulat. |
| `src/components/ui.tsx` | Butoane, carduri, mesaje, câmpuri. |
| `src/app/_layout.tsx` | Navigarea și titlurile ecranelor. |
| `src/app/index.tsx` | Lista scrutinelor. |
| `src/app/scrutin/[id]/index.tsx` | Pagina unui scrutin: pașii și ce urmează de făcut. |
| `src/app/scrutin/[id]/inregistrare.tsx` | Alegerea între scanare și NFC. |
| `src/app/scrutin/[id]/ocr.tsx` | Scanarea MRZ-ului cu camera, text MRZ sau doar CNP. |
| `src/app/scrutin/[id]/nfc.tsx` | Citirea cipului cu CAN-ul. |
| `src/app/scrutin/[id]/vot.tsx` | Alegerea, criptarea, auditul Benaloh și trimiterea votului. |
| `src/app/scrutin/[id]/confirmare.tsx` | Codul de urmărire după vot. |
| `src/app/scrutin/[id]/verifica.tsx` | Verificarea votului după cod. |
| `modules/evoting-nfc/` | Modulul Kotlin pentru cip (PACE, DG1, SOD), cu JMRTD. |
| `modules/evoting-ocr/` | Modulul Kotlin pentru OCR, cu ML Kit. |
| `AGENTS.md`, `.claude/settings.json`, `LICENSE` | Veneau cu șablonul Expo; nu fac parte din aplicație. |

## `tools/`: programele din linia de comandă

| Fișier | Ce face |
| --- | --- |
| `trustee/src/cli.ts` | `evoting-trustee`: `keygen` (generează și trimite cheia), `decrypt` (verifică totul, apoi trimite decriptarea parțială), `status`. |
| `verifier/src/cli.ts` | `evoting-verify`: verificarea publică completă, plus auditul unui buletin. |
| `simulator/src/cli.ts` | `evoting-simulate`: rulează un scrutin întreg cu mii de alegători sintetici și măsoară timpii. |

## `demos/`

| Fișier | Ce arată |
| --- | --- |
| `attacks/src/cnp-dictionary.ts` | De ce HMAC și nu SHA-256 pentru CNP. |
| `attacks/src/deterministic-encryption.ts` | De ce criptarea trebuie să fie aleatoare. |
| `attacks/src/bsgs-vs-key.ts` | Totalurile se află ușor, cheia secretă nu. |
| `attacks/src/api-bruteforce.ts` | Limitarea de rată oprește ghicirea token-urilor. |
| `attacks/src/tamper-board.ts` | Verificatorul prinde un vot modificat direct în bază. |
| `macheta/` | Prima variantă a criptografiei, păstrată pentru istoric. |

## `docs/evaluare/` și `apk/`

| Fișier | Ce conține |
| --- | --- |
| `simulare-100.json`, `simulare-1000.json`, `simulare-10000.json` | Măsurătorile de performanță (vezi capitolul 6). |
| `apk/vot-verificabil.apk` | Aplicația Android, gata de instalat. Fără server configurat, folosește serverul simulat de pe telefon. |
