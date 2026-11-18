# 5. Harta fișierelor

Fiecare fișier din proiect, cu o propoziție simplă despre ce face. Fișierele generate automat (`node_modules/`, `dist/`, `package-lock.json`) nu sunt descrise unul câte unul. Fiecare pachet și aplicație are și un `README.md` propriu, cu aceeași hartă, mai pe scurt.

Cum citești structura:

```
E-VOTING-Platform
├── packages/        biblioteci comune, folosite de toate celelalte
│   ├── crypto/      criptografia
│   └── api/         contractul HTTP, clientul, serverul simulat, citirea actelor
├── apps/            aplicațiile propriu-zise
│   ├── backend/     serverul (un folder per modul)
│   ├── web/         site-ul
│   └── mobile/      aplicația de telefon
├── tools/           programe în linia de comandă (trustee, verificator, simulator)
├── demos/           demonstrații de atac și macheta veche
├── docs/            toată documentația, inclusiv acest ghid și măsurătorile
├── infra/           configurarea lui Caddy (HTTPS pentru Docker Compose)
├── apk/             aplicația Android construită
└── .github/         automatizările de pe GitHub
```

## Rădăcina proiectului

| Fișier | Ce face |
| --- | --- |
| `package.json` | Spune că proiectul e un monorepo, lista pachetelor și comenzile `npm run build`, `npm test`, `npm run lint`, `npm run format`, `npm run typecheck`. |
| `package-lock.json` | Versiunile exacte ale tuturor bibliotecilor (generat automat). |
| `tsconfig.base.json` | Setările TypeScript comune. |
| `docker-compose.yml` | Pornește baza, serverul, site-ul și Caddy (HTTPS) cu `docker compose up --build`. |
| `infra/Caddyfile` | Configurarea lui Caddy: `https://localhost`, API-ul la `/api`, site-ul la `/`. |
| `.env` | Secretele tale pentru Docker Compose: `CNP_HMAC_KEY`, `ADMIN_TOKEN`, `SESSION_SECRET`, eventual `DATABASE_URL` și `DATABASE_SSL=on` (Supabase). Nu intră în Git. |
| `.env.example` | Modelul pentru `.env`, fără secrete. |
| `.prettierrc`, `.prettierignore` | Cum se formatează codul (`npm run format`) și ce nu se formatează. |
| `.oxlintrc.json` | Regulile linterului (`npm run lint`). |
| `.gitignore` | Ce nu intră în Git. |
| `.gitattributes` | Scripturile `.sh` și Dockerfile-urile rămân cu capete de rând Linux. |
| `.dockerignore` | Ce nu se copiază în imaginile Docker (`node_modules`, `.env` etc.). |
| `README.md` | Prezentarea scurtă, structura și pornirea rapidă. |

## `docs/`: documentația

| Fișier | Ce face |
| --- | --- |
| `README.md` | Indexul documentației: ce să citești și în ce ordine. |
| `GHID-COMPLET.md` | Tot proiectul explicat de la zero, într-un singur fișier (inclusiv întrebări pentru susținere). |
| `DOCUMENTATIE.md` | Documentația tehnică pentru licență: teorie, pași, securitate, evaluare. |
| `EXPLICATIE.md` | Istoria construcției și descrierea tehnică a fiecărui fișier. |
| `ANALIZA.md` | Ce e bun, ce lipsește, ce s-a rezolvat și planul de dezvoltare. |
| `explicatii/01…07` | Acest ghid, în șapte capitole. |
| `evaluare/simulare-100.json`, `-1000.json`, `-10000.json` | Măsurătorile de performanță (vezi capitolul 6). |
| `evaluare/simulare-1000-18-nov.json` | Remăsurarea cu 1.000 de alegători pe codul final. |

## `.github/workflows/`

| Fișier | Ce face |
| --- | --- |
| `ci.yml` | La fiecare push rulează linterul, verificarea formatării, testele (cu o bază PostgreSQL de test), build-ul, `npm audit` și verificarea aplicației mobile. |
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
| `src/tally.ts` | Calculul totalurilor criptate (și pe bucăți, pentru verificarea în paralel) și aflarea numerelor (baby-step giant-step). |
| `src/verify.ts` | Verificatorul public, cu cei șase pași. |
| `src/parallel.ts` | Verificarea în paralel: împarte board-ul în bucăți, le dă mai multor fire și pune rezultatele la loc, în ordine. |
| `src/node/parallel.ts`, `src/node/worker.ts` | Firele din Node (`worker_threads`), pentru verificatorul din terminal, CLI-ul trustee și simulator. |
| `src/index.ts` | Exportă tot ce folosesc celelalte pachete. |
| `test/encoding.test.ts` | Codificări, JSON canonic, HMAC, hex invalid. |
| `test/elgamal.test.ts` | Criptare, randomizare, adunarea criptotextelor, baby-step giant-step. |
| `test/ballot.test.ts` | Buletine valide și toate felurile de buletine trișate, Benaloh. |
| `test/trustee.test.ts` | Cheile trustees, decriptarea, trustee care trișează. |
| `test/verifier.test.ts` | Verificatorul public pe 13 feluri de manipulare, inclusiv ore greșite. |
| `test/helpers.ts` | Simulează un scrutin complet fără server și construiește buletine „trișate”. |
| `README.md` | Harta pachetului. |

## `packages/api/`: comunicarea și actele

| Fișier | Ce face |
| --- | --- |
| `src/contract/election.ts` | Forma scrutinului, a candidaților (inclusiv votul alb), a trustees și a cererilor de creare și modificare. |
| `src/contract/voter.ts` | Forma înregistrării, a autentificării și a chitanței de vot. |
| `src/contract/board.ts` | Forma a ce se publică: board (și o pagină din el), agregat, rezultat, jurnal, pachetul de audit. |
| `src/contract/admin.ts` | Forma membrilor comisiei și a rolurilor (`comisie`, `observator`). |
| `src/contract/errors.ts` | `ApiError`, eroarea cu cod HTTP. |
| `src/contract/client.ts` | Interfața `ApiClient`: lista tuturor metodelor pe care le are orice client. |
| `src/client/http.ts` | Clientul care trimite cereri reale la server. |
| `src/mock/index.ts` | Pornește serverul simulat: leagă starea, scrutinele de demonstrație, clientul și uneltele. |
| `src/mock/state.ts` | Ce ține minte serverul simulat (ca tabelele serverului real). |
| `src/mock/rules.ts` | Regulile serverului: modificare și ștergere, chei, import, înregistrare și re-înregistrare, vot în interval, închidere (și automată), decriptare. |
| `src/mock/seed.ts` | Cele trei scrutine de demonstrație. |
| `src/mock/client.ts` | Fiecare rută a serverului, simulată în memorie. |
| `src/mock/tools.ts` | Butoanele de test: cheile trustees, alegători simulați, decriptarea, CNP-ul tău în lista de eligibili. |
| `src/mock/random.ts` | Numere aleatoare reproductibile și latența simulată. |
| `src/mock/contract-helpers.ts` | Două constante ale simulatorului (votul alb, identitatea comisiei). |
| `src/identity/cnp.ts` | Validarea CNP-ului și generarea de CNP-uri fictive pentru teste. |
| `src/identity/mrz.ts` | Citește MRZ-ul (TD1, TD2, TD3), verifică cifrele de control și reconstituie CNP-ul. |
| `src/identity/mrz-build.ts` | Construiește MRZ-uri de test (buletin vechi, CEI). |
| `src/identity/dg1.ts` | Scoate MRZ-ul din DG1-ul citit de pe cip. |
| `src/voter.ts` | Pașii alegătorului: autentificare, criptare, trimitere, verificare. |
| `src/format.ts` | Etichetele și formatările comune site-ului și aplicației (stări, date, durate, „Vot alb”, cât mai e din interval). |
| `src/index.ts` | Exportă tot. |
| `test/cnp.test.ts`, `mrz.test.ts`, `dg1.test.ts`, `mock.test.ts`, `format.test.ts` | 27 de teste: CNP (și lista CSV), MRZ, DG1, formatările în română și scrutine complete pe serverul simulat (inclusiv re-înregistrare, vot alb, interval, membri, scoaterea din lista de eligibili, „doar NFC”). |
| `README.md` | Harta pachetului. |

## `apps/backend/`: serverul

| Fișier | Ce face |
| --- | --- |
| `.env` | Secretele serverului pentru `npm run dev`: `DATABASE_URL` (Supabase), `CNP_HMAC_KEY`, `ADMIN_TOKEN`. Nu intră în Git. |
| `.env.example` | Modelul, fără secrete. |
| `Dockerfile` | Rețeta imaginii Docker a serverului. |
| `docker-entrypoint.sh` | La pornirea containerului, generează certificatele de test dacă e cerut. |
| `migrations/001_init.sql` | Creează cele nouă tabele și trigger-ul care interzice modificarea board-ului. |
| `migrations/002_rls.sql` | Activează Row Level Security pe toate tabelele (blochează API-ul public Supabase). |
| `migrations/003_settings_members_challenges.sql` | Votul alb (`candidates.kind`), membrii comisiei și provocările de autentificare în bază. |
| `src/main.ts` | Pornește serverul. |
| `src/app.ts` | Aplică migrările, construiește aplicația Nest, adaugă antetele de securitate (`helmet`) și CORS. |
| `src/app.module.ts` | Leagă controllerele, serviciile și limitarea de rată; comentariul de sus e harta modulelor. |
| `src/config.ts` | Citește și verifică variabilele de mediu. |
| `src/db/database.service.ts` | Conexiunea la bază și tranzacțiile. |
| `src/db/pg-options.ts` | Pornește SSL pentru bazele online (Supabase) și avertizează dacă certificatul nu se verifică. |
| `src/db/migrate.ts` | Aplică migrările o singură dată, în ordine. |
| `src/db/migrate-cli.ts` | Același lucru, din linia de comandă (`npm run migrate`). |
| `src/common/security.ts` | Token-uri aleatoare, comparație în timp constant, sesiunile alegătorilor. |
| `src/common/throttle.ts` | Limita strictă de rată (30 de cereri pe minut). |
| `src/common/validate.ts` | Verifică datele primite și dă erori clare, în română. |
| `src/admin/admin.guard.ts` | Verifică token-ul comisiei (rădăcina sau un membru) și rolul (`comisie` sau `observator`). |
| `src/admin/admin.controller.ts` | Rutele `/admin/check` și `/admin/members`. |
| `src/admin/members.service.ts` | Membrii comisiei: creare, listă, revocare. |
| `src/audit/audit.service.ts` | Scrie și citește jurnalul de audit. |
| `src/elections/elections.controller.ts` | Rutele `/elections/...`. |
| `src/elections/elections.repository.ts` | Citirile publice (lista, scrutinul, board-ul, rezultatul, pachetul de audit) și blocarea rândului scrutinului. |
| `src/elections/elections.service.ts` | Acțiunile comisiei: creare, modificare, ștergere, import eligibili, deschidere, închidere. |
| `src/elections/auto-close.service.ts` | Închide singur scrutinele ajunse la ora închiderii. |
| `src/elections/election.rows.ts` | Rândurile din bază transformate în obiectele din contract. |
| `src/trustees/trustees.service.ts` | Token-urile trustees și primirea cheilor Yᵢ. |
| `src/registration/registration.service.ts` | Înregistrarea prin OCR sau NFC și re-înregistrarea înainte de vot. |
| `src/auth/auth.service.ts`, `auth.controller.ts` | Provocarea semnată (păstrată în bază) și sesiunea alegătorului; rutele `/auth/...`. |
| `src/ballots/ballots.service.ts` | Primirea buletinului pe board, doar în intervalul scrutinului. |
| `src/tally/tally.service.ts` | Decriptările parțiale și publicarea rezultatului. |
| `src/system/system.controller.ts` | Ruta `/health`. |
| `src/nfc/passive-auth.ts` | Verifică semnătura statului pe datele cipului. |
| `src/nfc/passive-auth.service.ts` | Încarcă certificatele CSCA și cheamă verificarea. |
| `src/nfc/test-pki.ts` | Creează un CSCA și un DSC de test și „cipuri” de test. |
| `src/nfc/test-pki-cli.ts` | Același lucru, din linia de comandă. |
| `test/election-flow.e2e.test.ts` | 16 teste care pornesc serverul real pe o bază de test și parcurg tot fluxul. |
| `test/interval.e2e.test.ts` | 5 teste pentru intervalul scrutinului, orele de pe board și închiderea automată. |
| `test/commission.e2e.test.ts` | 3 teste pentru membrii comisiei, modificare/ștergere și votul alb. |
| `test/rate-limit.e2e.test.ts` | 3 teste pentru limitarea de rată și `/health`. |
| `test/cli.e2e.test.ts` | 1 test care rulează CLI-urile reale (trustee și verificator, pe unul și pe două fire). |
| `test/pg-options.test.ts` | 3 teste, fără bază de date: când se folosește SSL la conexiunea cu baza. |
| `test/helpers.ts` | Pregătește baza de test (o golește!) și pornește serverul pentru teste. |
| `README.md` | Harta serverului și comenzile. |

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
| `src/styles/index.css` | Importă celelalte fișiere CSS, în ordine. |
| `src/styles/tokens.css` | Culorile și fonturile. |
| `src/styles/base.css`, `layout.css`, `cards.css`, `forms.css`, `feedback.css`, `tables.css`, `results.css`, `verification.css`, `responsive.css` | Stilurile, pe teme: tipografie, bara de sus și pagina, carduri și insigne, butoane și câmpuri, alerte și tab-uri, tabele, rezultatul, raportul de verificare, telefon. |
| `src/api/index.ts` | Alege serverul real sau cel simulat. |
| `src/api/config.ts` | Citește `VITE_API_URL`. |
| `src/api/admin.ts` | Ține token-ul comisiei în `sessionStorage` și identitatea (nume, rol) autentificată. |
| `src/components/layout/Layout.tsx` | Bara de sus și meniul. |
| `src/components/layout/AdminGate.tsx` | Ecranul de login al comisiei. |
| `src/components/ui/StatusBadge.tsx`, `Hash.tsx`, `Stat.tsx`, `Countdown.tsx`, `Feedback.tsx` | Insigna de stare, hash-ul scurtat, cifrele statistice, „se închide peste…”, mesajele (se încarcă, eroare, confirmare). |
| `src/pages/Home.tsx` | Lista scrutinelor. |
| `src/pages/About.tsx` | „Cum funcționează”, pentru public. |
| `src/pages/commission/CommissionList.tsx` | Lista scrutinelor pentru comisie. |
| `src/pages/commission/CommissionNew.tsx` | Crearea unui scrutin. |
| `src/pages/commission/CommissionEdit.tsx` | Modificarea unui scrutin în configurare. |
| `src/pages/commission/ElectionForm.tsx` | Formularul comun de creare și modificare (titlu, interval, candidați, vot alb, trustees). |
| `src/pages/commission/CommissionMembers.tsx` | Membrii comisiei: creare, listă, revocare. |
| `src/pages/commission/CommissionElection.tsx` | Administrarea unui scrutin: starea, modificare, ștergere, deschidere, închidere. |
| `src/pages/commission/parts/Steps.tsx` | Etapele scrutinului. |
| `src/pages/commission/parts/TrusteeTokens.tsx` | Comenzile trustees, afișate o singură dată. |
| `src/pages/commission/parts/EligibleImport.tsx` | Importul CSV al eligibililor. |
| `src/pages/commission/parts/BoardHead.tsx` | Hash-ul board-ului de publicat independent. |
| `src/pages/commission/parts/AuditLog.tsx` | Jurnalul de audit. |
| `src/pages/commission/parts/MockToolsPanel.tsx` | Uneltele de test (doar cu serverul simulat). |
| `src/pages/election/ElectionPublic.tsx` | Pagina publică: statisticile și tab-urile. |
| `src/pages/election/tabs/BoardTab.tsx` | Bulletin board-ul, pe pagini, și căutarea după cod. |
| `src/pages/election/tabs/ResultTab.tsx` | Rezultatul. |
| `src/pages/election/tabs/VerificationTab.tsx` | Verificarea publică în browser. |
| `src/pages/election/tabs/BenalohTab.tsx` | Auditul unui buletin (Benaloh). |
| `src/pages/election/tabs/ParametersTab.tsx` | Parametrii publici. |
| `src/lib/format.ts` | Formatările (re-exportate din `@evoting/api`). |
| `src/lib/useAsync.ts` | Încărcarea datelor în pagini. |
| `src/lib/verify-workers.ts`, `src/lib/verify.worker.ts` | Verificarea publică în paralel, în browser (Web Workers). |
| `src/lib/trusteeTokens.ts` | Token-urile trustees păstrate în tab până la confirmare și descărcarea lor ca `.txt`. |
| `src/pages/election/ProcesVerbal.tsx`, `src/styles/print.css` | Procesul-verbal de tipărit (sau salvat ca PDF) și stilurile de tipărire. |
| `vitest.config.ts`, `test/` | Testele automate ale site-ului (Vitest, jsdom, Testing Library). |
| `README.md` | Harta site-ului și comenzile. |

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
| `src/components/ui/` | Câte un fișier per componentă: `Screen`, `Card`, `Button`, `Tag`, `Notice`, `Field`, `Typography`, `ModeBanner`, `Loading`; `tones.ts` are culorile semantice. |
| `src/components/election/VoterSteps.tsx` | Cei trei pași ai alegătorului. |
| `src/components/election/PrimaryAction.tsx` | Butonul principal al paginii scrutinului. |
| `src/components/election/CandidateList.tsx`, `ResultCard.tsx` | Lista candidaților și rezultatul (votul alb la final). |
| `src/components/election/IntervalNote.tsx` | „Votul se închide peste…”, „începe peste…”. |
| `src/components/identity/MrzSummary.tsx` | Datele citite de pe act și cifrele de control. |
| `src/components/identity/ModeTabs.tsx`, `KeyValueRow.tsx` | Comutatorul de moduri și rândul „etichetă: valoare”. |
| `src/components/vote/CandidateOption.tsx` | Un candidat din lista de vot, cu buton radio. |
| `src/components/vote/BallotReview.tsx` | Confirmarea votului, cu amprenta buletinului criptat. |
| `src/components/vote/BenalohAudit.tsx` | Auditul buletinului (Benaloh). |
| `src/app/_layout.tsx` | Navigarea și titlurile ecranelor. |
| `src/app/index.tsx` | Lista scrutinelor. |
| `src/app/scrutin/[id]/index.tsx` | Pagina unui scrutin: pașii și ce urmează de făcut. |
| `src/app/scrutin/[id]/inregistrare.tsx` | Alegerea între scanare și NFC; explică re-înregistrarea de pe alt telefon. |
| `src/app/scrutin/[id]/ocr.tsx` | Scanarea MRZ-ului cu camera, text MRZ sau doar CNP. |
| `src/app/scrutin/[id]/nfc.tsx` | Citirea cipului cu CAN-ul. |
| `src/app/scrutin/[id]/vot.tsx` | Alegerea, criptarea, auditul Benaloh și trimiterea votului. |
| `src/app/scrutin/[id]/confirmare.tsx` | Codul de urmărire după vot. |
| `src/app/scrutin/[id]/verifica.tsx` | Verificarea votului după cod. |
| `modules/evoting-nfc/` | Modulul Kotlin pentru cip (PACE, DG1, SOD), cu JMRTD. |
| `modules/evoting-ocr/` | Modulul Kotlin pentru OCR, cu ML Kit. |
| `AGENTS.md` | Îndrumări generice pentru unelte AI (venite cu șablonul Expo). |
| `README.md` | Harta aplicației și comenzile. |

## `tools/`: programele din linia de comandă

| Fișier | Ce face |
| --- | --- |
| `trustee/src/cli.ts` | `evoting-trustee`: citește argumentele și alege comanda. |
| `trustee/src/commands/keygen.ts` | Generează și trimite cheia. |
| `trustee/src/commands/decrypt.ts` | Verifică totul, apoi trimite decriptarea parțială. |
| `trustee/src/commands/status.ts` | Starea trustees. |
| `trustee/src/key-file.ts`, `output.ts` | Fișierul de cheie (permisiuni 600, opțional criptat cu parolă) și afișarea. |
| `trustee/src/password.ts` | Parola fișierului de cheie: din argument, din mediu sau cerută în terminal. |
| `verifier/src/cli.ts` | `evoting-verify`: citește argumentele și alege comanda. |
| `verifier/src/commands/verify.ts` | Verificarea publică completă, de pe server sau dintr-un fișier, pe toate nucleele (`--workers N`). |
| `verifier/src/commands/audit-ballot.ts` | Auditul unui buletin (Benaloh). |
| `verifier/src/output.ts` | Afișarea. |
| `simulator/src/cli.ts` | `evoting-simulate`: rulează un scrutin întreg cu mii de alegători sintetici și măsoară timpii. |
| `simulator/src/lib/metrics.ts`, `pool.ts`, `synthetic.ts`, `output.ts` | Statisticile de timp, paralelismul, alegătorii sintetici, afișarea. |
| `README.md` | Cum se folosesc cele trei programe. |

## `demos/`

| Fișier | Ce arată |
| --- | --- |
| `attacks/src/cnp-dictionary.ts` | De ce HMAC și nu SHA-256 pentru CNP. |
| `attacks/src/deterministic-encryption.ts` | De ce criptarea trebuie să fie aleatoare. |
| `attacks/src/bsgs-vs-key.ts` | Totalurile se află ușor, cheia secretă nu. |
| `attacks/src/api-bruteforce.ts` | Limitarea de rată oprește ghicirea token-urilor. |
| `attacks/src/tamper-board.ts` | Verificatorul prinde un vot modificat direct în bază. |
| `attacks/README.md` | Cum se rulează demonstrațiile. |
| `macheta/` | Prima variantă a criptografiei, păstrată pentru istoric. |

## `apk/`

| Fișier | Ce conține |
| --- | --- |
| `apk/vot-verificabil.apk` | Aplicația Android, gata de instalat. Fără server configurat, folosește serverul simulat de pe telefon. |
