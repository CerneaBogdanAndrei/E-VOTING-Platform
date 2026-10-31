# 1. Ideea și conceptele de bază

## 1.1 Problema pe care o rezolvă proiectul

La un vot pe hârtie, două lucruri sunt garantate de faptul că lumea vede fizic urna:

- **Secretul votului:** nimeni nu știe ce a pus fiecare om în plic.
- **Corectitudinea:** observatorii văd că urna e goală la început, că nu se adaugă plicuri pe ascuns și că se numără corect.

La un vot pe internet, „urna” e un calculator al altcuiva (serverul). Nu-l poți vedea. Dacă serverul primește votul în clar, cine administrează serverul vede cu cine a votat fiecare. Dacă serverul doar spune „B a câștigat cu 37 de voturi”, n-ai de unde ști că e adevărat.

Proiectul rezolvă ambele probleme cu **criptografie**: votul pleacă de pe telefon deja încuiat, serverul nu-l poate deschide, dar oricine poate verifica matematic că toate voturile încuiate au fost numărate corect.

## 1.2 Cine sunt actorii

| Actor | Cine e în realitate | Ce face în sistem |
| --- | --- | --- |
| **Alegătorul** | Studentul sau angajatul care votează | Se înregistrează cu buletinul, votează din aplicație, își verifică votul. |
| **Comisia** | Comisia electorală a facultății | Creează scrutinul, încarcă lista celor care au drept de vot, deschide și închide votul. Folosește site-ul și se autentifică cu un token secret (`ADMIN_TOKEN`). |
| **Trustees** | 2–5 persoane de încredere (de exemplu, un profesor, un student, un reprezentant al sindicatului) | Fiecare ține o bucată din cheia care deschide rezultatul. Rezultatul se poate afla doar dacă toți își folosesc bucata. |
| **Serverul** | Programul din `apps/backend`, care rulează pe un calculator | Primește cererile, verifică totul, ține evidența în baza de date. Nu e considerat de încredere: tot ce face poate fi verificat. |
| **Publicul / auditorul** | Oricine | Descarcă datele publice și rulează verificatorul. |

## 1.3 Cuvintele de bază, explicate de la zero

### Criptare

A cripta înseamnă a transforma un mesaj („votez B”) într-un șir de caractere care arată ca un zgomot (`a3f9…`), astfel încât doar cine are o anumită **cheie** să-l poată transforma înapoi. Transformarea înapoi se numește **decriptare**. Rezultatul criptării se numește **criptotext**.

### Cheie publică și cheie secretă

În criptografia folosită aici, cheile vin în perechi:

- **cheia secretă** (sau privată): un număr foarte mare, ales la întâmplare, pe care îl ține doar proprietarul;
- **cheia publică**: un număr calculat din cheia secretă, pe care îl poate vedea oricine.

Calculul de la cheia secretă la cea publică e ușor; calculul invers e practic imposibil (ar dura mai mult decât vârsta universului). De aceea cheia publică poate fi dată oricui.

Cu cheia publică a scrutinului **oricine poate cripta** un vot. Doar cu cheia secretă **se poate decripta**. Asta e ca o cutie poștală: oricine poate pune o scrisoare prin fantă, dar doar cine are cheia o deschide.

### Hash (amprentă)

O funcție hash ia orice text, oricât de lung, și scoate o „amprentă” de lungime fixă, de exemplu 64 de caractere hexazecimale. Proprietăți:

- același text dă mereu aceeași amprentă;
- o singură literă schimbată dă o amprentă complet diferită;
- din amprentă nu poți reconstrui textul.

În proiect se folosește **SHA-256** (amprentă de 256 de biți, adică 64 de caractere hex) și **SHA-512**. Exemplu: dacă cineva schimbă un vot de pe registrul public, amprenta lui se schimbă și verificatorul observă.

### Hexazecimal (hex)

Un mod de a scrie numere folosind 16 simboluri: `0–9` și `a–f`. Un octet (8 biți) se scrie ca două caractere hex, de exemplu `ff` = 255. Aproape toate cheile, amprentele și criptotextele din proiect sunt scrise în hex, pentru că așa pot fi puse ușor în JSON și în baza de date.

### HMAC

Un hash cu o **cheie secretă** amestecată în calcul. Fără cheie, nimeni nu poate calcula amprenta.

De ce contează: CNP-ul are o structură previzibilă (sex, dată de naștere, județ, număr de ordine, cifră de control). Dacă serverul ar păstra doar SHA-256(CNP), un hoț care fură baza de date ar putea încerca toate CNP-urile posibile pentru o dată de naștere și ar găsi persoana în câteva milisecunde. Demonstrația `demos/attacks/src/cnp-dictionary.ts` arată exact asta: 68 ms. Cu HMAC, hoțul ar avea nevoie și de cheia `CNP_HMAC_KEY`, care **nu stă în baza de date**, ci doar în fișierul `.env` al serverului.

Deci în baza de date nu există niciun CNP, doar amprente HMAC.

### Semnătură digitală

Cu cheia secretă poți „semna” un mesaj. Oricine are cheia publică poate verifica că semnătura e bună, adică:

1. mesajul a fost semnat de cine are cheia secretă;
2. mesajul nu a fost modificat după semnare.

În proiect se folosește **Ed25519**, un algoritm de semnătură modern, rapid și sigur. Fiecare alegător primește la înregistrare o pereche Ed25519, numită **credential**. Cheia secretă stă doar pe telefonul lui. Cu ea semnează buletinul de vot.

### Credential

Perechea de chei a alegătorului, generată pe telefon la înregistrare. Serverul ține minte doar cheia publică, legată de HMAC(CNP). Rolul credentialului:

- dovedește că un buletin vine de la un alegător înregistrat (prin semnătură);
- permite un singur vot per credential;
- nu dezvăluie cine e persoana, pentru că pe registrul public apare doar cheia publică, nu numele sau CNP-ul.

### Nonce și provocare

Un **nonce** e un număr aleator folosit o singură dată. La autentificare, serverul îi trimite telefonului un nonce („provocarea”), iar telefonul îl semnează. Astfel serverul știe că telefonul chiar are cheia secretă în acest moment. Nimeni nu poate refolosi o semnătură veche, pentru că nonce-ul e de fiecare dată altul.

### Token

Un șir lung, aleator, care funcționează ca o parolă generată de calculator. În proiect există trei feluri:

- **token-ul comisiei** (`ADMIN_TOKEN`), pus în `.env`;
- **token-urile trustees**, generate la crearea scrutinului și afișate o singură dată;
- **token-ul de sesiune al alegătorului**, primit după autentificare și valabil 10 minute.

### Bulletin board (registrul public)

Lista publică a tuturor buletinelor criptate, în ordinea sosirii. E **append-only**: se pot doar adăuga intrări, nu modifica sau șterge. Asta se asigură în două feluri:

1. **Lanțul de hash-uri:** fiecare intrare conține amprenta intrării dinainte. Dacă cineva schimbă intrarea #10, amprenta ei se schimbă, deci #11 nu mai „se leagă” de ea. E același principiu ca la blockchain, dar fără minerit.
2. **Un trigger în PostgreSQL** care refuză orice `UPDATE` sau `DELETE` pe tabela `ballots`.

### Cod de urmărire

După vot, alegătorul primește amprenta intrării lui de pe board. Cu ea își poate căuta oricând votul și verifica faptul că e acolo, neschimbat. Codul nu arată pe cine a votat, pentru că votul e criptat.

## 1.4 Cum rămâne votul secret și totuși numărabil

### ElGamal exponențial

E algoritmul de criptare folosit pentru vot. Pe scurt:

- un vot pentru un candidat e un 1, un vot împotrivă e un 0;
- dacă sunt 3 candidați și votezi B, telefonul criptează trei numere: `0, 1, 0`;
- fiecare criptare folosește un număr aleator nou (`r`), deci două criptări ale lui 0 arată complet diferit. Nimeni nu poate compara criptotextele ca să ghicească votul (demonstrația `deterministic-encryption.ts`).

Proprietatea magică: **dacă aduni două criptotexte, obții criptarea sumei**. Asta se numește **criptare homomorfă**. La închidere, serverul adună toate criptotextele candidatului B și obține criptarea numărului total de voturi pentru B, fără să fi decriptat vreun vot individual.

### Grupul ristretto255

Matematica de mai sus are nevoie de o „structură” în care se fac calculele: un **grup** de puncte pe o curbă eliptică. Proiectul folosește **ristretto255**, construit peste aceeași curbă ca Ed25519 (Curve25519). E rapid, are chei scurte (32 de octeți) și e proiectat să evite capcanele clasice ale curbelor eliptice.

În formule apar:

- `G`: punctul de start al grupului (generatorul);
- `x`: o cheie secretă (un număr);
- `Y = x·G`: cheia publică (un punct). Înmulțirea înseamnă „adună punctul G cu el însuși de x ori”;
- `Q`: numărul de elemente al grupului; toate calculele cu numere se fac „modulo Q”, adică după ce ajungi la Q, o iei de la zero, ca la ceas.

### Trustees și cheia împărțită

Dacă o singură persoană ar avea cheia secretă a scrutinului, ar putea decripta orice vot individual. De aceea cheia e împărțită:

- fiecare trustee `i` își alege singur cheia secretă `xᵢ`, pe calculatorul lui, cu programul `tools/trustee`;
- trimite serverului doar cheia publică `Yᵢ = xᵢ·G`;
- cheia scrutinului este `Y = Y₁ + Y₂ + … + Yₙ`;
- cheia secretă completă, `x = x₁ + x₂ + … + xₙ`, **nu există nicăieri**. Nimeni nu o are.

La final, fiecare trustee aplică bucata lui de cheie doar pe **totalurile** criptate („decriptare parțială”), iar serverul combină bucățile și obține totalurile. Un vot individual nu se poate decripta decât dacă toți trustees se înțeleg să facă asta, iar programul trustee-ului refuză să decripteze altceva decât totalul verificat.

Varianta folosită e „n-din-n”: e nevoie de toți. Dacă unul își pierde cheia, rezultatul nu mai poate fi aflat. Varianta „t-din-n” (oricare 3 din 5) e o extensie posibilă.

### Baby-step giant-step

După decriptare, serverul nu obține direct numărul 37, ci punctul `37·G`. Ca să afle 37, trebuie să caute numărul `t` pentru care `t·G` dă acel punct. Algoritmul baby-step giant-step face asta în aproximativ √t pași, deci pentru totaluri de până la un milion durează sub o secundă. Pentru o cheie secretă (un număr de 252 de biți), aceeași căutare ar dura ~10⁶³ ani. Asta arată `demos/attacks/src/bsgs-vs-key.ts`.

## 1.5 Dovezile zero-knowledge

O **dovadă zero-knowledge** (ZK) e un calcul prin care cineva dovedește că o afirmație e adevărată fără să dezvăluie nimic în plus.

Problema: serverul primește trei criptotexte și nu le poate deschide. Cum știe că nu sunt `5, 0, 0` (5 voturi pentru A) sau `1, 1, 1` (vot pentru toți)? Răspunsul: telefonul atașează dovezi.

| Dovadă | Ce dovedește | Unde |
| --- | --- | --- |
| **Dovada 0/1** (disjunctivă) | Fiecare criptotext conține 0 sau 1, fără să spună care. | `packages/crypto/src/proofs.ts`, `proveZeroOne` |
| **Dovada sumei** (Chaum-Pedersen) | Suma criptotextelor conține exact 1, deci un singur vot. | `proveEqualLogs` |
| **Dovada cheii trustee-ului** (Schnorr) | Trustee-ul știe cheia secretă pentru cheia publică trimisă. | `proveSchnorr` |
| **Dovada decriptării parțiale** (Chaum-Pedersen) | Trustee-ul a decriptat corect, cu aceeași cheie pe care a declarat-o. | `partialDecrypt` |

### Fiat-Shamir

Dovezile clasice sunt „conversații”: verificatorul pune o întrebare aleatoare, cel care dovedește răspunde. Ca să nu fie nevoie de conversație, întrebarea aleatoare se înlocuiește cu un hash al tuturor datelor publice. Asta e transformarea **Fiat-Shamir**. În proiect, hash-ul include și ID-ul scrutinului și credentialul alegătorului, ca o dovadă să nu poată fi copiată într-un alt scrutin sau de alt alegător.

## 1.6 Provocarea Benaloh: cum știi că telefonul n-a mințit

Ce se întâmplă dacă aplicația de pe telefon e modificată și criptează A când tu ai apăsat B? Dovezile ar trece, pentru că A e tot un vot valid.

Soluția e **provocarea Benaloh**:

1. Telefonul criptează votul și îți arată amprenta buletinului.
2. Tu poți alege „Verifică întâi criptarea”. Telefonul dezvăluie atunci numerele aleatoare `r` folosite.
3. Oricine, cu orice alt program, poate recripta votul declarat cu acele `r` și compara rezultatul. Dacă dă același criptotext, telefonul a fost cinstit.
4. Buletinul verificat se aruncă, pentru că `r`-urile lui sunt acum publice, și se criptează din nou cu `r` noi.

Telefonul nu știe dinainte dacă vei verifica sau vei trimite. O aplicație care trișează ar fi prinsă la întâmplare.

## 1.7 Identitatea: buletinul, MRZ-ul și cipul

### CNP

Codul numeric personal, 13 cifre. Proiectul îl validează complet (`packages/api/src/cnp.ts`): sexul și secolul, o dată de naștere care există, județul și cifra de control calculată cu cheia `279146358279`.

### MRZ

**Machine Readable Zone**: rândurile de la baza buletinului, cu multe `<<<`. Sunt făcute special pentru citirea automată și au **cifre de control** (calculate cu ponderile 7, 3, 1), deci o greșeală de citire se observă. Din MRZ se reconstituie CNP-ul.

Formate:

- **TD1**: 3 rânduri de 30 de caractere (cartea electronică de identitate, CEI);
- **TD2**: 2 rânduri de 36 de caractere (buletinul vechi);
- **TD3**: 2 rânduri de 44 de caractere (pașaportul).

### OCR

**Optical Character Recognition**: recunoașterea textului dintr-o fotografie. Aplicația fotografiază MRZ-ul și îl transformă în text cu **ML Kit** de la Google, care rulează direct pe telefon. Imaginea nu pleacă nicăieri.

Nivelul de încredere al acestei metode e „optic”: un buletin fals, bine printat, ar trece.

### NFC și cartea electronică (CEI)

CEI are un cip. Telefonul vorbește cu el prin **NFC** (Near Field Communication, comunicare la câțiva centimetri).

1. **CAN** (Card Access Number): 6 cifre tipărite pe buletin. Fără el, cipul nu vorbește.
2. **PACE**: protocolul care deschide un canal criptat între telefon și cip, folosind CAN-ul.
3. Telefonul citește **DG1** (Data Group 1, care conține MRZ-ul) și **SOD** (Security Object Document, care conține amprentele tuturor datelor, semnate de stat).
4. Serverul face **Passive Authentication**: verifică semnătura statului pe SOD și că amprenta din SOD se potrivește cu DG1. Un DG1 modificat pică.
5. Lanțul de încredere: SOD-ul e semnat de un **DSC** (Document Signer Certificate), iar DSC-ul e semnat de **CSCA** (Country Signing Certificate Authority), certificatul rădăcină al României.

Nivelul de încredere al acestei metode e „criptografic”. Certificatul CSCA real al României încă nu e pus în proiect, deci acum serverul acceptă doar cipurile de test generate de proiect.

## 1.8 Stările unui scrutin

Un scrutin trece prin patru stări, în ordine:

| Stare | Ce înseamnă | Ce se poate face |
| --- | --- | --- |
| `draft` | În configurare | Trustees își trimit cheile, comisia încarcă lista de eligibili, alegătorii se pot înregistra. |
| `open` | Deschis | Alegătorii se înregistrează și votează. |
| `closed` | Închis | Nu se mai votează. Serverul a calculat și a publicat totalurile criptate. Trustees decriptează. |
| `tallied` | Numărat | Rezultatul e publicat. Oricine poate verifica. |

## 1.9 Verificatorul public

E un program (`packages/crypto/src/verify.ts`, folosit de `tools/verifier` și de site) care ia **toate datele publice** ale unui scrutin și reface totul de la zero:

| Pas | Ce verifică |
| --- | --- |
| 0 | Cheia fiecărui trustee are dovadă validă, iar cheia scrutinului e suma lor. |
| 1 | Lanțul de hash-uri e intact, fără intrări schimbate, șterse sau mutate. |
| 2 | Fiecare buletin vine de la un credential înregistrat, câte unul per credential, cu semnătură validă. |
| 3 | Dovezile zero-knowledge ale fiecărui buletin sunt valide. |
| 4 | Totalurile criptate se potrivesc cu suma buletinelor. |
| 5 | Decriptările trustees au dovezi valide, iar rezultatul publicat e cel corect. |

Dacă serverul ar minți la oricare pas, verificatorul spune exact unde, de exemplu „buletinul #42”.

## 1.10 Ce nu rezolvă proiectul (spus cinstit)

- **Constrângerea**: dacă cineva stă lângă tine și te obligă să votezi într-un fel, sistemul nu te poate apăra. La fel e și la Helios, sistemul cu care se compară.
- **Ballot stuffing de către server**: serverul controlează și înregistrarea, deci teoretic ar putea înregistra alegători falși. Numărul public de înregistrări îl face vizibil, dar soluția completă ar fi o autoritate de înregistrare separată.
- **Clonarea cipului**: ar necesita Chip Authentication, care nu e implementată.
- **Codul nu e auditat** de experți externi. E potrivit pentru o licență și o demonstrație, nu pentru alegeri naționale.
