# 7. Glosar: toate cuvintele, de la A la Z

| Termen | Explicație |
| --- | --- |
| **`.env`** | Fișier cu secrete și setări (adresa bazei, chei, token-uri). Nu intră niciodată în Git. |
| **`.env.example`** | Modelul lui `.env`, fără valorile secrete, care intră în Git. |
| **`.gitignore`** | Lista fișierelor pe care Git le ignoră. |
| **`.gitattributes`** | Reguli pentru Git despre fișiere, de exemplu capetele de rând. |
| **Agregat** | Totalurile criptate: suma tuturor criptotextelor fiecărui candidat. Se calculează la închidere. |
| **Append-only** | Se poate doar adăuga, nu modifica sau șterge. Așa e board-ul. |
| **Alpine** | O variantă foarte mică de Linux, folosită ca bază pentru imaginile Docker. |
| **API** | Application Programming Interface: setul de rute prin care un program vorbește cu altul. API-ul serverului e lista din capitolul 3.3. |
| **`ApiClient`** | Interfața comună a clientului real și a celui simulat. |
| **`ApiError`** | Eroarea proiectului, care ține codul HTTP și mesajul. |
| **APK** | Fișierul de instalare al unei aplicații Android. |
| **Argument** | Valoarea dată unei funcții sau unei comenzi. |
| **ASN.1** | Formatul binar al certificatelor și al SOD-ului. |
| **`asn1js`** | Biblioteca care citește ASN.1. |
| **`assert`** | Verificare în teste: dacă nu e adevărată, testul pică. |
| **`async` / `await`** | Funcție care așteaptă operații lente / „așteaptă rezultatul aici”. |
| **Audit Benaloh** | Vezi „Provocarea Benaloh”. |
| **Audit bundle** | Pachetul cu toate datele publice ale unui scrutin, pentru verificator. |
| **Audit log (jurnal de audit)** | Lista acțiunilor importante: cine a creat scrutinul, cine l-a deschis, când a trimis un trustee cheia etc. |
| **Autentificare** | Dovedirea identității. Alegătorul se autentifică semnând un nonce. |
| **Baby-step giant-step (BSGS)** | Algoritmul care află un număr mic `t` din punctul `t·G`, în ~√t pași. |
| **Backend** | Partea de server a unui sistem. Aici, `apps/backend`. |
| **Backend simulat (mock)** | Varianta în memorie a serverului, din `packages/api/src/mock.ts`. |
| **Base64 / base64url** | Codificare care transformă octeți în litere, cifre și câteva simboluri, ca să poată sta în JSON sau într-o adresă. |
| **Bază de date** | Programul care păstrează datele organizat. Aici, PostgreSQL. |
| **Bearer** | Felul în care se trimite un token: antetul `Authorization: Bearer <token>`. |
| **`bigint`** | Număr întreg oricât de mare, în JavaScript. Se scrie cu `n` la final: `5n`. |
| **Bibliotecă (pachet, dependență)** | Cod scris de alții, folosit în proiect. Se instalează cu npm. |
| **Body (corp)** | Datele trimise într-o cerere sau un răspuns HTTP. |
| **Body parser** | Partea serverului care transformă corpul cererii din text în obiect. |
| **BouncyCastle** | Bibliotecă Java de criptografie, folosită de modulul NFC pentru PACE. |
| **Branch** | O linie separată de lucru în Git. Proiectul folosește doar `master`. |
| **Build** | Transformarea codului sursă în ceva care rulează: TypeScript → JavaScript, site → fișiere statice, aplicație → APK. |
| **Bulletin board (board)** | Registrul public al buletinelor criptate, legate prin hash-uri. |
| **Buletin (ballot)** | Votul criptat al unui alegător: criptotexte, dovezi și semnătură. |
| **Cache** | Memorie temporară pentru rezultate deja calculate, ca să nu fie recalculate. |
| **CAN** | Card Access Number: 6 cifre de pe cartea de identitate electronică, necesare pentru PACE. |
| **CEI** | Cartea electronică de identitate, cu cip. |
| **Cerere (request)** | Mesajul trimis de un client către server. |
| **Certificat (X.509)** | Un document digital care leagă o cheie publică de un proprietar, semnat de o autoritate. |
| **Chaum-Pedersen** | Dovadă că două valori folosesc același număr secret în baze diferite. |
| **Cheie privată (secretă)** | Numărul secret dintr-o pereche de chei. |
| **Cheie publică** | Partea care poate fi dată oricui. |
| **Chip Authentication** | Protocol care dovedește că cipul nu e clonat. Neimplementat. |
| **CI** | Continuous Integration: testele rulate automat la fiecare push. |
| **Cifră de control** | O cifră calculată din celelalte, care arată dacă s-a citit ceva greșit. |
| **Clasă** | Un șablon de obiecte, cu date și metode. |
| **Client** | Programul care trimite cereri: telefonul, site-ul, CLI-urile. |
| **CLI** | Command Line Interface: program folosit din terminal, prin comenzi. |
| **CMS SignedData** | Formatul standard al unui document semnat digital. SOD-ul e unul. |
| **CNP** | Codul numeric personal. |
| **Cod de stare** | Numărul din răspunsul HTTP care spune cum a mers (200, 404, 409…). |
| **Cod de urmărire (tracking code)** | Hash-ul intrării alegătorului de pe board. |
| **Comisia** | Comisia electorală, care administrează scrutinul. |
| **Commit** | Un punct salvat în istoria Git. |
| **`COMMIT`** | Comanda SQL care face definitive modificările unei tranzacții. |
| **Compilare** | Transformarea codului dintr-un limbaj în altul, de exemplu TypeScript în JavaScript. |
| **Componentă** | O bucată de interfață în React. |
| **Constrângere (constraint)** | O regulă impusă de baza de date, de exemplu `UNIQUE`. |
| **Container** | O imagine Docker pornită: un mic calculator izolat. |
| **Context Fiat-Shamir** | Datele puse în hash-ul unei dovezi (scrutin, cheie, credential), ca dovada să nu poată fi refolosită în altă parte. |
| **Controller** | Clasa NestJS care primește cererile unor rute. |
| **CORS** | Regula browserului care decide dacă o pagină poate trimite cereri la alt server. |
| **Credential** | Perechea de chei Ed25519 a alegătorului, făcută pe telefon. |
| **Criptare / decriptare** | Încuierea unui mesaj cu o cheie / descuierea lui. |
| **Criptare homomorfă** | Criptare la care suma criptotextelor criptează suma mesajelor. |
| **Criptotext** | Rezultatul criptării. În ElGamal, o pereche de puncte `(A, B)`. |
| **CSCA** | Country Signing Certificate Authority: certificatul rădăcină al unui stat, pentru documentele de identitate. |
| **CSV** | Comma Separated Values: tabel scris ca text, cu valorile separate prin virgulă. Lista de eligibili se importă așa. |
| **Curbă eliptică** | Structura matematică pe care se fac calculele criptografice. Aici, Curve25519. |
| **Decorator** | Adnotarea cu `@` deasupra unei clase sau metode. |
| **Decriptare parțială** | Aplicarea bucății de cheie a unui trustee pe agregat. |
| **Dependency injection** | NestJS creează serviciile și le dă automat cui are nevoie de ele. |
| **`devDependencies`** | Biblioteci necesare doar la dezvoltare, nu la rulare. |
| **DG1** | Data Group 1 de pe cip: conține MRZ-ul. |
| **`dist/`** | Folderul cu codul compilat. Nu intră în Git. |
| **Docker** | Programul care împachetează aplicațiile în imagini și le rulează în containere. |
| **Docker Compose** | Pornește mai multe containere împreună, după `docker-compose.yml`. |
| **Docker Desktop** | Aplicația Docker pentru Windows și Mac. |
| **Dockerfile** | Rețeta unei imagini Docker. |
| **Dovadă zero-knowledge (ZK)** | Dovedește că ceva e adevărat fără să dezvăluie nimic în plus. |
| **Dovada 0/1 (disjunctivă)** | Arată că un criptotext conține 0 sau 1, fără să spună care. |
| **DSC** | Document Signer Certificate: certificatul care semnează SOD-ul, semnat la rândul lui de CSCA. |
| **Ed25519** | Algoritmul de semnătură digitală folosit pentru credentiale. |
| **ElGamal exponențial** | Algoritmul de criptare a voturilor: `(r·G, m·G + r·Y)`. |
| **Eligibil** | Cineva care are drept de vot, adică e pe lista importată de comisie. |
| **Endpoint (rută)** | O adresă a serverului, de exemplu `/elections/:id/ballots`. |
| **Excepție** | O eroare aruncată cu `throw`. |
| **Expo** | Platforma peste React Native folosită pentru aplicația de telefon. |
| **Expo Router** | Navigarea între ecrane după structura folderelor. |
| **Export** | Facerea unei funcții disponibile altor fișiere. |
| **Express** | Serverul HTTP pe care rulează NestJS. |
| **`fetch`** | Funcția care trimite o cerere HTTP. |
| **Fiat-Shamir** | Transformarea unei dovezi interactive în una neinteractivă, cu un hash în loc de întrebarea verificatorului. |
| **Framework** | Un schelet de aplicație în care tu scrii doar logica. |
| **Funcție** | Un bloc de cod cu nume, care primește parametri și întoarce un rezultat. |
| **Funcție săgeată** | Funcție scurtă: `(a) => a + 1`. |
| **`G` (generator)** | Punctul de start al grupului. |
| **Generic (`<T>`)** | Un tip-parametru, completat la folosire. |
| **Genesis hash** | „Hash-ul anterior” al primei intrări de pe board. |
| **Git / GitHub** | Programul care ține istoria codului / site-ul unde stă repository-ul online. |
| **GitHub Actions** | Automatizările care rulează pe serverele GitHub (testele, APK-ul). |
| **Gradle** | Programul care compilează proiectele Android. |
| **Grup** | Mulțimea de puncte în care se fac calculele criptografice. Aici, ristretto255. |
| **Guard** | O verificare NestJS făcută înainte de o rută. |
| **Hash (amprentă)** | Rezultatul unei funcții care transformă orice text într-o amprentă scurtă, fixă, imposibil de inversat. |
| **Header (antet)** | O informație despre cerere, de forma `Nume: valoare`. |
| **Healthcheck** | Verificarea periodică a stării unui container. |
| **Hermes** | Motorul JavaScript al aplicațiilor React Native. |
| **Hex (hexazecimal)** | Scrierea numerelor cu `0–9` și `a–f`. |
| **HMAC** | Hash cu cheie secretă. |
| **Hook** | Funcție React care începe cu `use` (`useState`, `useEffect`, `useAsync`). |
| **HTTP** | Protocolul prin care clienții și serverele comunică. |
| **ICAO** | Organizația Aviației Civile Internaționale, care a standardizat MRZ-ul și cipurile documentelor. |
| **Imagine Docker** | Pachetul cu program + tot ce-i trebuie, din care se pornesc containere. |
| **Import** | Folosirea într-un fișier a ceva exportat de altul. |
| **Index (SQL)** | O structură care face căutările mai rapide. |
| **Înregistrare** | Legarea credentialului de HMAC(CNP), după ce buletinul a fost citit. |
| **Interfață (TypeScript)** | Descrierea formei unui obiect. |
| **IP** | Adresa unui calculator în rețea. Limitarea de rată numără cererile per IP. |
| **JMRTD** | Biblioteca Java care citește documentele electronice ICAO. |
| **JSON** | Formatul text în care circulă datele: `{ "cheie": valoare }`. |
| **JSON canonic** | JSON cu cheile sortate și fără spații, ca același obiect să dea mereu același text. |
| **`jsonb`** | Coloană PostgreSQL care ține JSON. |
| **JSX / TSX** | Sintaxa React care arată ca HTML, în fișiere `.tsx`. |
| **Keystore (Android)** | Zona protejată a telefonului pentru chei. |
| **Kotlin** | Limbajul modulelor native Android (NFC, OCR). |
| **Limitarea de rată (rate limiting)** | Câte cereri pe minut acceptă serverul de la aceeași adresă. |
| **Linter** | Program care găsește greșeli probabile în cod fără să-l ruleze. Aici, oxlint. |
| **`localhost`** | Calculatorul tău. `localhost:3000` = programul care ascultă pe portul 3000 la tine. |
| **`master`** | Branch-ul principal al proiectului. |
| **Metodă** | O funcție care aparține unei clase. |
| **Metro** | Împachetatorul de cod al aplicațiilor React Native. |
| **Migrare** | Un fișier SQL care modifică structura bazei, aplicat o singură dată, în ordine. |
| **ML Kit** | Biblioteca Google de recunoaștere a textului, care rulează pe telefon. |
| **Mock** | Varianta simulată a ceva real. |
| **Modul (Nest)** | Lista componentelor unei aplicații NestJS. |
| **Modul nativ** | Cod Kotlin (Android) chemat din JavaScript. |
| **Modulo (mod Q)** | Restul împărțirii la Q; calculele „se întorc la zero” după Q, ca la ceas. |
| **Monorepo** | Un repository cu mai multe proiecte legate între ele. |
| **MRZ** | Machine Readable Zone: rândurile cu `<<<` de pe acte. |
| **Multi-stage build** | Dockerfile cu mai multe etape: una compilează, ultima păstrează doar rezultatul. |
| **n-din-n** | Schema în care e nevoie de toți trustees ca să se afle rezultatul. |
| **NestJS** | Framework-ul serverului. |
| **NFC** | Near Field Communication: comunicare pe distanță foarte mică, cu cipul buletinului. |
| **nginx** | Server web care servește site-ul în Docker. |
| **Node.js** | Programul care rulează JavaScript în afara browserului. |
| **`node_modules/`** | Folderul cu bibliotecile instalate. |
| **Nonce** | Număr aleator folosit o singură dată. |
| **npm** | Managerul de pachete al Node. |
| **`npm ci`** | Instalare exactă, după `package-lock.json`. |
| **Obiect** | O colecție de câmpuri cu nume: `{ title: 'Senat', status: 'open' }`. |
| **OCR** | Recunoașterea textului dintr-o imagine. |
| **Octet (byte)** | 8 biți; un număr de la 0 la 255. |
| **OpenSSL** | Biblioteca de criptografie folosită de Node pentru certificate. |
| **ORM** | Bibliotecă care scrie SQL în locul tău. Proiectul nu folosește. |
| **oxlint** | Linter-ul site-ului. |
| **PACE** | Protocolul care deschide un canal criptat cu cipul, folosind CAN-ul. |
| **`package.json`** | Descrierea unui pachet: nume, dependențe, comenzi. |
| **`package-lock.json`** | Versiunile exacte ale tuturor dependențelor. |
| **Parametru** | Valoarea pe care o primește o funcție. |
| **Parametru SQL (`$1`)** | Valoare trimisă separat de interogare, ca protecție împotriva SQL injection. |
| **Passive Authentication** | Verificarea semnăturii statului pe datele cipului. |
| **`pg`** | Driverul PostgreSQL pentru Node. |
| **PKI** | Public Key Infrastructure: ierarhia de certificate (CSCA → DSC → SOD). |
| **`pkijs`** | Biblioteca pentru certificate și documente semnate. |
| **Plugin (Expo)** | Cod care modifică automat proiectul Android generat. |
| **Polyfill** | Cod care adaugă o funcție lipsă dintr-un mediu. |
| **Pool de conexiuni** | Conexiuni la bază ținute deschise și refolosite. |
| **Port** | „Ușa” pe care ascultă un program: 3000 serverul, 5173 site-ul în dezvoltare, 8080 site-ul în Docker, 5432 PostgreSQL. |
| **PostgreSQL** | Baza de date folosită. |
| **Primary key** | Identificatorul unic al unui rând dintr-o tabelă. |
| **Promise** | O valoare care va veni mai târziu. |
| **Props** | Parametrii unei componente React. |
| **Provider / Service** | Clasa NestJS cu logica propriu-zisă. |
| **Provocare (challenge)** | Nonce-ul pe care serverul îl dă telefonului spre semnare. |
| **Provocarea Benaloh** | Auditul unui buletin prin dezvăluirea numerelor aleatoare, ca să verifici că telefonul a criptat ce ai ales. |
| **Push** | Trimiterea commit-urilor tale pe GitHub. |
| **`Q`** | Numărul de elemente al grupului (un număr prim de ~252 de biți). |
| **`r` (randomness)** | Numărul aleator folosit la o criptare. |
| **React** | Biblioteca pentru interfețe. |
| **React Native** | React pentru aplicații de telefon. |
| **React Router** | Navigarea după adresă, pe site. |
| **`reflect-metadata`** | Bibliotecă necesară decoratorilor NestJS. |
| **Regex** | Șablon de căutare în text. |
| **Repository (repo)** | Folderul proiectului urmărit de Git, cu toată istoria. |
| **Răspuns (response)** | Mesajul trimis de server înapoi clientului. |
| **Ristretto255** | Grupul criptografic folosit, construit peste Curve25519. |
| **RLS** | Row Level Security: reguli de acces la rânduri în PostgreSQL; aici blochează API-ul public Supabase. |
| **`ROLLBACK`** | Anularea tuturor modificărilor unei tranzacții. |
| **Rută** | Vezi „Endpoint”. |
| **`rxjs`** | Bibliotecă de fluxuri de evenimente, folosită intern de NestJS. |
| **Scalar** | Un număr (spre deosebire de un punct), de exemplu o cheie secretă sau `r`. |
| **Schnorr** | Dovada că știi cheia secretă a unei chei publice. |
| **Scrutin (election)** | O alegere: titlu, candidați, trustees, perioadă. |
| **SCUBA** | Biblioteca de acces la carduri inteligente, folosită de JMRTD. |
| **SecureStore** | Stocarea criptată de pe telefon (Expo), unde stă cheia de credential. |
| **Semnătură digitală** | Dovada că un mesaj vine de la cine are cheia secretă și n-a fost modificat. |
| **Server** | Programul care primește cereri și răspunde. |
| **Sesiune** | Token-ul de 10 minute primit după autentificare, cu care alegătorul trimite votul. |
| **`sessionStorage`** | Memoria unui tab de browser; se golește la închiderea tab-ului. |
| **SHA-256 / SHA-512** | Funcții hash standard. |
| **SOD** | Security Object Document: amprentele datelor de pe cip, semnate de stat. |
| **SQL** | Limbajul bazelor de date relaționale. |
| **SQL injection** | Atac în care cineva strecoară cod SQL într-un câmp. Prevenit cu parametri (`$1`). |
| **SSL / TLS** | Criptarea conexiunii la rețea (lacătul din browser). Obligatorie spre Supabase. |
| **Stare (status)** | `draft`, `open`, `closed`, `tallied`. |
| **Supabase** | Serviciul online care găzduiește baza ta PostgreSQL. |
| **Tabelă** | O „foaie” din baza de date, cu coloane fixe. |
| **TD1 / TD2 / TD3** | Formatele MRZ: CEI (3 × 30), buletin vechi (2 × 36), pașaport (2 × 44). |
| **Template string** | Text cu valori inserate: `` `Bearer ${token}` ``. |
| **Test** | Program care verifică automat dacă alt cod face ce trebuie. |
| **Timp constant** | Calcul care durează la fel indiferent de valorile secrete, ca timpul să nu dezvăluie nimic. |
| **Token** | Un șir lung, aleator, folosit ca parolă generată. |
| **Tranzacție** | Mai multe operații în bază făcute „toate sau niciuna”. |
| **Trigger** | Cod din bază care rulează automat la o anumită operație. |
| **Trustee** | Persoană care ține o bucată din cheia de decriptare. |
| **Tip (type)** | Ce fel de valoare e într-o variabilă: text, număr, listă, obiect. |
| **TypeScript** | JavaScript cu tipuri. Limbajul proiectului. |
| **`tsc`** | Compilatorul TypeScript. |
| **`tsconfig.json`** | Setările compilatorului TypeScript. |
| **`UNIQUE`** | Constrângere SQL: o valoare (sau combinație) nu se poate repeta. |
| **URL** | Adresa completă: `http://localhost:3000/elections`. |
| **Validare** | Verificarea datelor primite înainte de folosire. |
| **Variabilă de mediu** | O setare dată programului din afară, de exemplu din `.env`. |
| **Verificator public** | Programul care reface toate verificările din datele publice. |
| **Vite** | Unealta de dezvoltare și build a site-ului. |
| **Volum Docker** | Folder care supraviețuiește ștergerii containerului. |
| **Workflow** | O automatizare GitHub Actions, descrisă în YAML. |
| **Workspace (npm)** | Un pachet din monorepo. |
| **WSL** | Linux în Windows, folosit de Docker Desktop. |
| **`xᵢ` / `Yᵢ`** | Cheia secretă / publică a trustee-ului `i`. |
| **`Y`** | Cheia publică a scrutinului: suma `Yᵢ`. |
| **YAML** | Format de configurare bazat pe indentare. |
