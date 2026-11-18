# Ghidul complet al proiectului, explicat de la zero

Acest fișier explică **tot** proiectul, pas cu pas, pentru cineva care n-a mai văzut codul și nu știe nici criptografie, nici programare web. Explică ce face sistemul, ideile matematice din spate, fiecare tehnologie și de ce a fost aleasă, fiecare folder și fiecare fișier, drumul unui vot prin cod, baza de date, securitatea, testele, cum pornești totul și ce te pot întreba la susținere.

> Starea descrisă: **18 noiembrie 2026**, după reorganizarea codului (16 nov.) și după etapa de dezvoltare care a adăugat intervalul aplicat, editarea scrutinelor, votul alb, re-înregistrarea, membrii comisiei, HTTPS și restul (Partea 9). Toate cifrele de aici (teste, tabele, rute) sunt numărate pe codul de acum.

## Cum să folosești ghidul

Se citește de sus până jos: fiecare parte se sprijină pe cele dinainte. Cuvintele noi sunt explicate prima dată când apar și adunate în glosarul de la final (Partea 15).

| Dacă ai… | Citește |
| --- | --- |
| o oră înainte de o discuție cu coordonatorul | Partea 1, Partea 9, Partea 14 |
| de scris capitolul teoretic al lucrării | Partea 2 |
| de scris capitolul de implementare | Părțile 3, 4, 5, 6, 7 |
| de scris capitolul de securitate și evaluare | Părțile 8, 11, 12, 13 |
| de făcut demonstrația practică | Partea 10 |

Celelalte documente din `docs/` rămân valabile și intră mai adânc în anumite teme: `DOCUMENTATIE.md` (formulele și cifrele, pentru lucrare), `EXPLICATIE.md` (istoria proiectului și fiecare fișier), `explicatii/` (șapte capitole, inclusiv codul explicat linie cu linie), `ANALIZA.md` (ce e bun, ce nu, planul). Ghidul de față le adună într-un singur loc, la zi.

## Cuprins

1. [Ce face proiectul, pe înțelesul oricui](#partea-1-ce-face-proiectul-pe-înțelesul-oricui)
2. [Ideile din spate, explicate simplu](#partea-2-ideile-din-spate-explicate-simplu)
3. [Tehnologiile, una câte una, și de ce au fost alese](#partea-3-tehnologiile-una-câte-una-și-de-ce-au-fost-alese)
4. [Harta proiectului: fiecare folder și fiecare fișier](#partea-4-harta-proiectului-fiecare-folder-și-fiecare-fișier)
5. [Un vot urmărit prin cod, de la deget la rezultat](#partea-5-un-vot-urmărit-prin-cod-de-la-deget-la-rezultat)
6. [Baza de date: cele unsprezece tabele](#partea-6-baza-de-date-cele-unsprezece-tabele)
7. [API-ul: toate rutele serverului](#partea-7-api-ul-toate-rutele-serverului)
8. [Securitatea: cine ar putea trișa și ce îl oprește](#partea-8-securitatea-cine-ar-putea-trișa-și-ce-îl-oprește)
9. [Ce s-a schimbat în ultima etapă (16–18 nov. 2026)](#partea-9-ce-s-a-schimbat-în-ultima-etapă-1618-nov-2026)
10. [Cum pornești și folosești totul, pas cu pas](#partea-10-cum-pornești-și-folosești-totul-pas-cu-pas)
11. [Testele: ce verifică fiecare](#partea-11-testele-ce-verifică-fiecare)
12. [Performanța, pe înțeles](#partea-12-performanța-pe-înțeles)
13. [Limitări spuse cinstit și ce ar urma](#partea-13-limitări-spuse-cinstit-și-ce-ar-urma)
14. [Pregătirea pentru susținere: întrebări și răspunsuri](#partea-14-pregătirea-pentru-susținere-întrebări-și-răspunsuri)
15. [Glosar](#partea-15-glosar)

---

# Partea 1. Ce face proiectul, pe înțelesul oricui

## 1.1 Problema

La un vot pe hârtie, trei lucruri importante se întâmplă aproape de la sine:

1. **Votul e secret.** Votezi singur în cabină, iar buletinul ajunge în urnă amestecat cu celelalte. Nimeni nu știe ce ai ștampilat.
2. **Numărarea e verificabilă.** Buletinele se numără în fața observatorilor, iar dacă cineva are dubii, se pot renumăra.
3. **O persoană, un vot.** Ești pe listă, semnezi și primești un singur buletin.

Online, toate trei devin grele, pentru că totul trece printr-un calculator pe care alegătorul nu-l vede: **serverul**. Dacă serverul primește votul „în clar”, îl poate citi (secretul dispare) și îl poate schimba (corectitudinea dispare). Dacă îl primește criptat, cum îl mai numără? Și cum află alegătorul că votul lui a fost numărat așa cum l-a dat?

Proiectul răspunde la întrebarea asta: **un sistem de vot online în care nimeni nu trebuie crezut pe cuvânt**. Nici serverul, nici comisia, nici aplicația. Fiecare pas lasă o urmă publică pe care oricine o poate verifica matematic.

Scenariul concret e cel al lucrării: **alegerile studențești de la Universitatea „Dunărea de Jos” din Galați (UDJG), Facultatea de Automatică, Calculatoare, Inginerie Electrică și Electronică (ACIEE)**, adică reprezentanții studenților în Consiliul facultății și în Senat.

## 1.2 Soluția, în șase idei

1. **Votul se criptează pe telefonul alegătorului.** Pleacă de pe telefon deja „încuiat”. Serverul primește doar niște numere mari care nu spun nimic.
2. **Toate voturile criptate se publică** pe un „avizier” public numit *bulletin board*. Fiecare intrare e legată de cea dinainte ca zalele unui lanț: nimeni nu poate scoate, muta sau schimba o intrare fără ca lanțul să se rupă.
3. **Voturile se adună fără să fie descuiate.** Criptarea folosită (ElGamal exponențial) are o proprietate rară: dacă „aduni” două voturi criptate, obții criptarea sumei lor. Se adună deci toate buletinele încă încuiate și se descuie **doar totalul**.
4. **Cheia de descuiere e împărțită** între mai mulți oameni de încredere, numiți *trustees*. Totalul se descuie doar dacă participă toți. Niciunul singur nu poate descuia nimic.
5. **Fiecare buletin vine cu dovezi matematice** (dovezi *zero-knowledge*) că e un vot valid, adică exact un candidat ales, fără să dezvăluie care. Așa nimeni nu poate strecura un buletin cu „100 de voturi pentru Ana” sau cu „−1 voturi pentru Bogdan”.
6. **Oricine poate verifica tot**, cu un program public numit *verificator*, în browser sau în linia de comandă. Programul reface toate calculele și spune dacă ceva a fost falsificat și exact unde („buletinul #42”, „trustee-ul 2, candidatul B”).

La acestea se adaugă **identitatea**: ca să voteze, alegătorul se înregistrează cu buletinul. Fie fotografiază zona de jos a buletinului, cea cu `<<<` (zona MRZ), fie apropie de telefon cartea electronică de identitate (CEI), iar telefonul citește cipul prin NFC. Serverul nu păstrează CNP-ul, ci doar o „amprentă” a lui din care CNP-ul nu se poate recupera.

## 1.3 Personajele

| Cine | Ce face | Ce **nu** trebuie să poată face |
| --- | --- | --- |
| **Comisia electorală** | Creează scrutinul, importă lista alegătorilor eligibili, deschide și închide votul. Are membri cu nume și rol: `comisie` (poate face orice) sau `observator` (doar citește). | Să afle cum a votat cineva; să schimbe voturile fără să fie prinsă. |
| **Trustees** (de obicei trei: comisia, observatorii, reprezentanții candidaților) | Fiecare își generează pe calculatorul lui o bucată din cheie. La final descuie împreună doar totalul. | Să descuie un vot individual, singur sau doar o parte dintre ei (toți împreună ar putea, de aceea vin din tabere diferite); să trișeze la descuiere. |
| **Alegătorul** | Se înregistrează cu buletinul, votează din aplicație, își verifică votul cu codul de urmărire. | Să voteze de două ori; să voteze în locul altcuiva. |
| **Serverul** | Primește, verifică, publică și adună voturile criptate. | Să citească voturile; să modifice ce a publicat fără să fie prins. |
| **Oricine** (alt student, un profesor, un jurnalist) | Descarcă tot ce e public și rulează verificatorul. | Nu are nevoie de niciun drept special. |

## 1.4 Un scrutin ca o poveste: Ana votează

Un scrutin trece prin patru **stări**: `draft` (configurare), `open` (vot deschis), `closed` (vot închis, numărare) și `tallied` (rezultat publicat). Iată toată povestea, cu starea în paranteză.

1. **(draft)** Un membru al comisiei intră pe site cu token-ul lui și creează scrutinul „Reprezentanți studenți – Consiliul Facultății”: intervalul de vot (de exemplu 20 nov., 8:00 → 22 nov., 18:00), trei candidați, opțiunea „vot alb” și trei trustees. Site-ul afișează **o singură dată** câte o comandă pentru fiecare trustee. Până la deschidere, comisia mai poate corecta titlul, intervalul sau candidații, ori poate șterge scrutinul.
2. **(draft)** Fiecare trustee rulează comanda pe calculatorul lui. Programul alege un număr secret xᵢ, îl salvează într-un fișier (opțional criptat cu o parolă) și trimite serverului doar „partea publică” Yᵢ, cu o dovadă că știe numărul secret. Când au trimis toți, serverul calculează **cheia scrutinului** Y.
3. **(draft)** Comisia importă lista CNP-urilor studenților, ca fișier CSV. Serverul verifică fiecare CNP, calculează amprenta HMAC și aruncă imediat CNP-ul în clar.
4. **(open)** Comisia apasă „Deschide votul”. De acum, votul se poate trimite doar între ora de deschidere și cea de închidere. Lista de eligibili se poate completa în continuare (un student înmatriculat târziu).
5. **(open)** Ana deschide aplicația pe telefon, alege scrutinul și apasă „Înregistrează-te”. Fotografiază buletinul sau apropie CEI-ul de telefon. Telefonul generează o pereche de chei, numită **credential**, și trimite serverului cheia publică. Serverul verifică faptul că CNP-ul Anei e pe listă și leagă cheia ei publică de amprenta CNP-ului. Dacă Ana își schimbă telefonul înainte să voteze, se poate înregistra din nou, iar cheia veche devine inutilizabilă.
6. **(open)** Ana alege candidatul. Telefonul criptează votul în aproximativ 20 ms și atașează dovezile. Dacă vrea, Ana cere un **audit Benaloh**: telefonul îi arată că a criptat exact ce a ales ea, apoi aruncă buletinul auditat și criptează din nou. Ana trimite votul și primește un **cod de urmărire**, un șir de 64 de caractere.
7. **(open)** Ana caută codul pe board, din aplicație sau de pe site. Telefonul recalculează amprentele și confirmă: buletinul de pe board e exact cel trimis de ea.
8. **(closed)** La 22 nov., 18:00, serverul **închide singur** votul (sau comisia îl închide mai devreme, manual). Serverul adună toate buletinele criptate și publică totalul încă criptat al fiecărui candidat.
9. **(closed)** Fiecare trustee rulează „decrypt”. Programul lui **verifică întâi tot board-ul**, apoi trimite partea lui de descuiere a totalurilor, cu o dovadă că a folosit cheia corectă.
10. **(tallied)** După ultimul trustee, serverul combină descuierile, află totalurile și publică rezultatul.
11. Oricine apasă „Verifică tot” pe site sau rulează `evoting-verify` în terminal. Trec șase verificări: cheile, lanțul (inclusiv orele), semnăturile, dovezile, totalul criptat și descuierea.

## 1.5 Ce garantează sistemul și ce nu

**Ce garantează** (și unde se vede în cod):

| Garanție | Cum e obținută |
| --- | --- |
| Votul e secret | Se descuie doar totalurile; cheia e împărțită între toți trustees (schema „n-din-n”). |
| Votul e criptat cum a vrut alegătorul | Provocarea Benaloh: alegătorul poate audita orice buletin înainte de trimitere. |
| Votul e înregistrat cum a fost trimis | Codul de urmărire și lanțul de hash-uri al board-ului. |
| Votul e numărat cum a fost înregistrat | Totalul criptat se poate recalcula de oricine; descuierea vine cu dovezi. |
| Fiecare buletin e valid | Dovezi zero-knowledge: fiecare candidat primește 0 sau 1, iar suma e exact 1. |
| O persoană, un vot | Listă de eligibili, o singură înregistrare activă per persoană, un singur vot per credential. |
| CNP-ul nu e expus | Serverul păstrează doar `HMAC(k, CNP)`, cu cheia k în afara bazei de date. |
| Votul se dă doar în interval | Serverul refuză votul înainte de deschidere și după închidere, închide singur la ora stabilită, iar verificatorul verifică orele de pe board. |

Primele patru rânduri, luate împreună, se numesc **verificabilitate end-to-end** (de la un capăt la altul).

**Ce nu garantează** (spus deschis și în lucrare):

- **Constrângerea și cumpărarea voturilor.** Cineva te poate obliga să votezi de față cu el. Nici Helios, cel mai cunoscut sistem academic, nu rezolvă asta.
- **Telefonul alegătorului e de încredere.** Auditul Benaloh prinde o aplicație care trișează, dar doar dacă cineva auditează.
- **Serverul controlează și înregistrarea**, deci ar putea „înregistra” alegători inventați. Lista publică de credentiale și numărul de înregistrări limitează riscul, dar nu îl elimină (Partea 8).
- **Dacă un trustee își pierde cheia, rezultatul nu se mai poate descuia** (schema n-din-n).
- **NFC-ul acceptă deocamdată doar cipuri de test**, pentru că certificatul rădăcină al României (CSCA) nu e inclus.
- **Codul criptografic nu e auditat independent.** E potrivit pentru o lucrare de licență și pentru alegeri studențești, nu pentru alegeri naționale.

---

# Partea 2. Ideile din spate, explicate simplu

Partea asta e „teoria”. Fiecare idee e explicată întâi cu o comparație din viața de zi cu zi, apoi cu formula exactă folosită în cod. Nu trebuie să știi matematică avansată: e suficient să accepți că unele calcule sunt ușoare într-un sens și practic imposibile în sens invers.

## 2.1 Biți, octeți și hex

Calculatorul lucrează cu **biți** (0 sau 1). Opt biți fac un **octet** (byte), adică un număr între 0 și 255. Numerele mari din criptografie au 32 de octeți (256 de biți) și se scriu în **hexazecimal** (hex): fiecare octet devine două caractere din `0123456789abcdef`. De aceea o cheie publică sau un cod de urmărire arată ca `3fa4c1…` și are 64 de caractere: 32 de octeți × 2.

## 2.2 Hash: amprenta unui text

Un **hash** (funcție de rezumat) primește orice text și scoate o amprentă de lungime fixă. Proiectul folosește **SHA-256**, care dă 32 de octeți. Trei proprietăți contează:

- același text dă mereu aceeași amprentă;
- o schimbare de o literă dă o amprentă complet diferită;
- din amprentă nu se poate reconstitui textul și nu se pot găsi două texte cu aceeași amprentă.

În proiect, hash-ul leagă intrările board-ului între ele, dă codul de urmărire și „sigilează” buletinele. Ca același obiect să dea aceeași amprentă pe telefon, pe server și în browser, obiectele se transformă întâi în **JSON canonic**: text JSON cu cheile sortate alfabetic și fără spații (`canonicalJson`, `packages/crypto/src/encoding.ts`).

## 2.3 HMAC: amprenta cu cheie, și de ce CNP-ul nu se păstrează ca hash

**HMAC** e un hash care cere și o **cheie secretă**: `HMAC(k, text)`. Fără cheie, amprenta nu se poate calcula.

De ce contează pentru CNP: un CNP are o structură fixă (sex, data nașterii, județ, număr de ordine, cifră de control), deci există puține CNP-uri posibile. Dacă serverul ar păstra `SHA-256(CNP)` și cineva ar fura baza de date, ar putea încerca toate CNP-urile posibile și ar găsi potrivirile. Demonstrația 1 din proiect arată exact asta: un CNP găsit în **68 de milisecunde** dacă se știe data nașterii.

Cu `HMAC(k, CNP)`, unde cheia `k` (variabila `CNP_HMAC_KEY`) stă doar în configurarea serverului, niciodată în baza de date, hoțul bazei nu are cu ce să calculeze încercările. Codul: `cnpHmac` în `packages/crypto/src/hash.ts`.

## 2.4 Criptarea cu cheie publică

O comparație utilă: o **cutie poștală cu fantă**. Oricine poate arunca o scrisoare prin fantă (oricine are **cheia publică** poate cripta), dar doar cine are cheia cutiei o poate deschide (doar cine are **cheia secretă** poate decripta). În proiect, cheia publică a scrutinului Y e afișată oricui, iar cheia secretă nu există întreagă nicăieri: e împărțită între trustees (2.9).

## 2.5 Semnătura digitală și credentialul

O **semnătură digitală** e inversul: doar cine are cheia secretă poate semna, dar oricine cu cheia publică poate verifica semnătura. Dacă se schimbă un singur caracter din mesajul semnat, verificarea pică.

În proiect, la înregistrare telefonul generează o pereche de chei **Ed25519** (un algoritm de semnătură modern, rapid). Perechea se numește **credential**:

- cheia **publică** ajunge pe server și e legată de amprenta CNP-ului;
- cheia **secretă** rămâne pe telefon, în `SecureStore` (stocare criptată cu o cheie din Android Keystore).

Cu cheia secretă, telefonul semnează două lucruri: provocarea de autentificare (2.13) și buletinul. Pe board apare doar cheia publică a credentialului, fără nicio legătură vizibilă cu persoana. Codul: `packages/crypto/src/credential.ts`.

## 2.6 Grupul ristretto255: un „ceas” uriaș

Criptografia proiectului lucrează într-un **grup**: o mulțime de „puncte” care se pot aduna între ele. Comparația: un ceas cu foarte multe poziții. Pe un ceas cu 12 ore, 10 + 5 = 3, pentru că după 12 o iei de la capăt. Grupul folosit, **ristretto255**, are un număr **prim** de poziții, q ≈ 2²⁵² (un număr cu 76 de cifre).

Notații folosite în tot proiectul:

- **G** e un punct fix, cunoscut de toți (generatorul).
- **xG** înseamnă G adunat cu el însuși de x ori. Calculul e rapid chiar pentru x uriaș (prin dublări repetate: 2G, 4G, 8G, …).
- **Invers e imposibil**: dacă știi doar punctul Y = xG, găsirea lui x (numită *logaritmul discret*) ar cere, pentru q ≈ 2²⁵², mai mulți pași decât poate face orice calculator vreodată.

Pe asta se sprijină totul: **x e secret, xG e public**. Numerele ca x se numesc **scalari**, iar rezultatele ca xG, **puncte**. Ambele circulă ca 64 de caractere hex.

De ce ristretto255 și nu alt grup: are ordin prim și **nu are cofactor**, deci orice punct valid decodat aparține grupului de lucru (la curbele obișnuite, unele puncte „ciudate” trebuie filtrate, iar o greșeală acolo e o vulnerabilitate clasică). E standardizat în **RFC 9496** și e construit peste Curve25519, aceeași curbă ca la Ed25519. Codul: `packages/crypto/src/group.ts`.

## 2.7 ElGamal exponențial: cum se criptează un vot

Votul pentru un candidat e un număr **m**: 1 dacă e ales, 0 dacă nu. Ca să-l cripteze, telefonul alege un număr aleator nou **r** și calculează perechea:

```
A = r·G
B = m·G + r·Y          (Y = cheia publică a scrutinului)
```

Perechea (A, B) se numește **criptotext**. Comparația: B e votul „acoperit” cu o mască r·Y pe care n-o poate scoate decât cine știe cheia secretă x (unde Y = x·G):

```
B − x·A = m·G + r·Y − x·r·G = m·G + r·x·G − x·r·G = m·G
```

Rămâne m·G, iar din m·G se află m (pentru m mic e ușor, vezi 2.10). „Exponențial” vine de la faptul că mesajul stă „în exponent” (aici, în multiplicatorul lui G).

**De ce numărul aleator r e esențial.** Fără el, același vot ar da mereu același criptotext. Cum sunt doar câteva opțiuni, oricine ar cripta fiecare opțiune cu cheia publică și ar compara: ar afla votul fără nicio cheie secretă. Demonstrația 2 din proiect arată atacul pe RSA „de manual” (determinist) și arată că la ElGamal nu merge: același vot dă de fiecare dată alt criptotext.

**Un buletin întreg** are câte un criptotext pentru fiecare opțiune, în ordinea pozițiilor. Pentru trei candidați și vot pentru al doilea: Enc(0), Enc(1), Enc(0). Dacă scrutinul are „vot alb”, acesta e pur și simplu încă o opțiune, ultima. Codul: `packages/crypto/src/elgamal.ts` și `encryptBallot` în `ballot.ts`.

## 2.8 Proprietatea homomorfă: adunarea fără descuiere

Dacă aduni două criptotexte componentă cu componentă:

```
(A₁ + A₂, B₁ + B₂) = ((r₁ + r₂)·G, (m₁ + m₂)·G + (r₁ + r₂)·Y) = Enc(m₁ + m₂)
```

obții criptarea **sumei** voturilor, cu numărul aleator r₁ + r₂. Asta se numește proprietate **homomorfă**. La închiderea votului, serverul adună, pentru fiecare candidat j, criptotextele tuturor buletinelor:

```
(Aⱼ, Bⱼ) = (Σₖ Aₖⱼ, Σₖ Bₖⱼ) = Enc(Tⱼ)        Tⱼ = numărul de voturi ale candidatului j
```

Acesta e **agregatul**. Nimeni n-a descuiat niciun vot individual, iar oricine poate reface adunarea de pe board și compara cu agregatul publicat. Codul: `computeAggregate` în `packages/crypto/src/tally.ts`.

## 2.9 Cheia împărțită între trustees (n-din-n)

Dacă cheia secretă ar fi a unei singure persoane, persoana aceea ar putea descuia orice vot. De aceea cheia **nu există întreagă nicăieri**:

- fiecare trustee i alege pe calculatorul lui un secret **xᵢ** și publică doar **Yᵢ = xᵢ·G**;
- cheia scrutinului e suma: **Y = Y₁ + Y₂ + … + Yₙ = (x₁ + x₂ + … + xₙ)·G**;
- cheia secretă „totală” ar fi x = x₁ + … + xₙ, dar n-o calculează nimeni.

La numărare, fiecare trustee calculează din agregat doar partea lui, **Dᵢⱼ = xᵢ·Aⱼ**, numită *decriptare parțială*. Suma lor e exact ce trebuie scăzut:

```
Σᵢ Dᵢⱼ = (x₁ + … + xₙ)·Aⱼ = x·Aⱼ        ⇒        Bⱼ − Σᵢ Dᵢⱼ = Tⱼ·G
```

Trustees descuie astfel **doar totalurile**, fiindcă primesc doar agregatul. Ca un server rău-intenționat să nu le strecoare un buletin individual în loc de agregat, programul trustee-ului **verifică întâi tot board-ul** și faptul că agregatul e chiar suma lui (Partea 5, pasul 12).

„n-din-n” înseamnă că trebuie **toți** n trustees. Avantaj: niciun grup mai mic nu poate descuia nimic. Dezavantaj: dacă unul își pierde cheia, rezultatul nu se mai poate afla (Partea 13). Codul: `packages/crypto/src/trustee.ts`.

## 2.10 Baby-step giant-step: de ce aflăm totalul, dar nu cheia

După descuiere rămâne Tⱼ·G, nu Tⱼ. Trebuie găsit numărul Tⱼ, adică exact „problema imposibilă” de la 2.6. Diferența e că **Tⱼ e mic**: cel mult numărul de buletine.

Algoritmul **baby-step giant-step** găsește T ≤ N în aproximativ √N pași, nu N. Pentru N = 10.000: calculează „pașii mici” 0·G, 1·G, …, 99·G și îi ține într-un tabel, apoi face „pași mari” de câte 100·G înapoi de la țintă până nimerește în tabel. Cel mult 100 + 100 de pași.

Pentru cheia secretă x, același algoritm ar avea nevoie de √(2²⁵²) = 2¹²⁶ pași. Demonstrația 3 din proiect pune cifrele alături: totaluri până la 1.000.000 aflate în sub 260 ms, iar căutarea naivă a cheii ar dura ~10⁶³ ani. Codul: `babyStepGiantStep` în `tally.ts`.

## 2.11 Dovezile zero-knowledge

O **dovadă zero-knowledge** (ZK, „cu zero cunoaștere”) convinge pe cineva că o afirmație e adevărată fără să-i spună nimic în plus.

O comparație clasică: ai un prieten daltonist și două bile identice ca formă, una roșie și una verde. Vrei să-i dovedești că sunt de culori diferite fără să-i spui care e care. El le ascunde la spate, le schimbă sau nu între ele, ți le arată și te întreabă „le-am schimbat?”. Dacă bilele ar fi la fel, ai ghici doar în jumătate din cazuri; după 30 de runde corecte, șansa să fi ghicit mereu e de o miliardime. Iar el tot nu știe care bilă e roșie.

Dovezile din proiect au aceeași structură în trei mișcări: **angajament** (dovezitorul trimite ceva calculat cu un număr aleator k), **provocare** (un număr c ales de verificator) și **răspuns** (s, calculat din k, c și secret). Toate sunt **Σ-protocoale** („sigma”). Proiectul folosește patru:

| Dovada | Ce dovedește | Unde |
| --- | --- | --- |
| **Schnorr** | Trustee-ul știe xᵢ pentru Yᵢ = xᵢ·G (deci nu a publicat o cheie „furată” sau calculată ca să anuleze cheile altora). | la trimiterea cheii |
| **Disjunctivă 0/1** (Cramer-Damgård-Schoenmakers) | Criptotextul (A, B) conține 0 **sau** 1, fără să spună care. | câte una pentru fiecare opțiune din buletin |
| **Chaum-Pedersen** pentru sumă | Suma criptotextelor din buletin conține exact 1, deci a fost ales exact un candidat. | una per buletin |
| **Chaum-Pedersen** pentru decriptare | Trustee-ul a folosit la Dᵢⱼ același xᵢ ca în cheia lui publică. | câte una per candidat, la numărare |

**Schnorr, pe scurt.** Trustee-ul alege k aleator și trimite T = k·G. Primește provocarea c și răspunde s = k + c·xᵢ. Verificatorul acceptă dacă s·G = T + c·Yᵢ. Răspunsul s nu dezvăluie xᵢ, pentru că e „amestecat” cu k, care e aleator și nu se publică.

**Dovada 0/1, pe scurt.** Afirmația are două ramuri: „(A, B) criptează 0” sau „(A, B) criptează 1”. Pentru ramura adevărată, dovada se face normal. Pentru cea falsă, se **simulează**: se aleg întâi provocarea și răspunsul, iar angajamentul se calculează înapoi din ele. Trucul: provocarea totală c = c₀ + c₁ e fixată de un hash, deci se poate simula **cel mult o** ramură. Cealaltă trebuie să fie adevărată. Verificatorul vede două ramuri care verifică și nu știe care a fost simulată.

**Dovada sumei.** Dacă buletinul e corect, perechea (ΣAⱼ, ΣBⱼ − G) e o criptare a lui 0 cu numărul aleator R = Σrⱼ, adică ΣAⱼ = R·G și ΣBⱼ − G = R·Y. Chaum-Pedersen dovedește exact asta: că două puncte au „același multiplicator” față de două baze diferite (G și Y).

Ce prind dovezile, testat explicit: un vot de 2 pentru un candidat, un vot de −1, două voturi, un buletin gol, un buletin „viclean” cu +2 și −1 (suma 1, dar dovezile 0/1 pică), dovezi copiate din alt scrutin, un buletin copiat de pe board și semnat de alt credential.

**Fiat-Shamir: dovezi fără conversație.** Ca dovada să nu ceară un dialog (verificatorul nu e de față când votezi), provocarea c se calculează ca **hash al tuturor datelor publice**: `c = H(context, puncte, angajamente)`. Dovezitorul nu poate alege angajamentul după provocare, pentru că provocarea depinde de angajament. Proiectul folosește SHA-512 redus modulo q și prefixează fiecare parte cu lungimea ei, ca împărțirea în părți să nu fie ambiguă (`hashToScalar`, `hash.ts`).

**Contextul.** În hash intră și un **context**: ID-ul scrutinului, cheia lui, numărul de opțiuni, credentialul alegătorului și poziția opțiunii. O dovadă copiată în alt scrutin, pentru alt alegător sau la altă poziție nu mai verifică. Codul tuturor dovezilor: `packages/crypto/src/proofs.ts`.

## 2.12 Bulletin board-ul, lanțul de hash-uri și codul de urmărire

Board-ul e o listă publică în care buletinele doar se **adaugă** (*append-only*). Fiecare intrare k conține buletinul, ora primirii și două amprente:

```
ballotHash = SHA-256(JSON canonic al buletinului semnat)
hashₖ      = SHA-256(JSON canonic al {scrutin, poziția k, hashₖ₋₁, ballotHash, ora primirii})
```

Fiecare intrare include amprenta celei dinainte, ca zalele unui lanț. Prima intrare se leagă de un hash „genesis” derivat din ID-ul scrutinului, ca board-urile a două scrutine să nu se poată amesteca.

- **Codul de urmărire** primit de alegător e hashₖ al intrării lui. Depinde de tot ce e înainte, deci o modificare a oricărui buletin anterior l-ar schimba.
- **Hash-ul publicat independent.** Comisia publică periodic perechea `poziție:hash` a ultimei intrări pe un canal pe care serverul nu-l controlează (site-ul facultății, un anunț semnat). Dacă serverul ar rescrie mai târziu istoria, verificatorul ar observa nepotrivirea.
- **Ora primirii** intră în hash, iar verificatorul cere ca orele să fie **crescătoare** și **în intervalul scrutinului**. Un server care ar strecura un buletin după închidere, cu o oră falsă, ar trebui să rescrie tot lanțul de după el.

În baza de date, un **trigger** (o regulă a bazei) refuză orice modificare sau ștergere din tabela de buletine, chiar și pentru cine are acces direct la bază. Codul: `packages/crypto/src/board.ts`, `apps/backend/migrations/001_init.sql`.

## 2.13 Autentificarea cu provocare

Când Ana trimite votul, serverul trebuie să știe că trimite chiar posesorul credentialului, fără ca Ana să trimită vreodată cheia secretă:

1. telefonul cere o **provocare**; serverul răspunde cu un număr aleator de 32 de octeți (**nonce**), valabil 2 minute, păstrat în tabela `auth_challenges`;
2. telefonul semnează textul `evoting/v1/auth|scrutin|credential|nonce` cu cheia secretă;
3. serverul verifică semnătura, **consumă** provocarea (se șterge la prima încercare, reușită sau nu) și dă o **sesiune** de 10 minute;
4. sesiunea e un token semnat cu HMAC de server (fără să fie păstrat undeva), valabil doar pentru trimiterea buletinului la acel scrutin.

Codul: `apps/backend/src/auth/auth.service.ts`, `apps/backend/src/common/security.ts`.

## 2.14 Provocarea Benaloh: cum știi că telefonul n-a mințit

Ce se întâmplă dacă aplicația de pe telefon e compromisă și criptează alt candidat decât cel ales? Ana n-ar vedea nimic, pentru că votul criptat arată ca zgomot.

Soluția lui Josh Benaloh: după criptare, aplicația întreabă „trimiți sau verifici?”. Dacă Ana alege **verificarea**, aplicația dezvăluie numerele aleatoare r folosite. Cu ele, oricine (pe site, în tab-ul „Audit buletin”, sau cu verificatorul în linia de comandă) recriptează opțiunea declarată și compară cu criptotextele. Buletinul auditat **nu se mai trimite** niciodată, pentru că dezvăluie votul; aplicația îl recriptează cu numere noi.

Aplicația nu știe dinainte dacă un buletin va fi verificat sau trimis, deci, dacă trișează des, e prinsă repede. Codul: `auditBallot` în `packages/crypto/src/ballot.ts`, ecranul `apps/mobile/src/components/vote/BenalohAudit.tsx`.

## 2.15 Verificabilitatea end-to-end

Punând totul cap la cap, sistemul permite trei verificări, cerute în orice lucrare despre vot verificabil:

| Verificare | Cine o face | Cu ce |
| --- | --- | --- |
| **Cast as intended** (criptat cum ai vrut) | alegătorul | provocarea Benaloh |
| **Recorded as cast** (înregistrat cum l-ai trimis) | alegătorul | codul de urmărire, căutat pe board |
| **Counted as recorded** (numărat cum a fost înregistrat) | oricine | verificatorul public: agregatul recalculat și dovezile de decriptare |

## 2.16 Identitatea: CNP, MRZ, OCR, NFC

**CNP-ul** are 13 cifre: `S AA LL ZZ JJ NNN C`, adică sexul și secolul (S), data nașterii (AA LL ZZ), județul (JJ, 01–52 sau 70), un număr de ordine (NNN) și cifra de control (C). Cifra de control se calculează cu cheia `279146358279`: fiecare din primele 12 cifre se înmulțește cu cifra corespunzătoare din cheie, suma se împarte la 11, iar restul e cifra de control (10 devine 1). Codul: `packages/api/src/identity/cnp.ts`.

**MRZ-ul** (*Machine Readable Zone*) e zona cu `<<<` de jos a actului, standardizată de ICAO în documentul 9303. Proiectul citește trei formate:

| Format | Document | Mărime |
| --- | --- | --- |
| TD2 | cartea de identitate „veche” | 2 rânduri × 36 de caractere |
| TD1 | cartea electronică de identitate (CEI) | 3 rânduri × 30 de caractere |
| TD3 | pașaportul | 2 rânduri × 44 de caractere |

Fiecare câmp important (numărul documentului, data nașterii, data expirării) are o **cifră de control** (ponderi 7, 3, 1, modulo 10), plus o cifră compusă peste toate. Dacă OCR-ul citește greșit o singură literă, cifrele de control pică. Pe buletinul vechi, CNP-ul se reconstituie din prima lui cifră și ultimele șase (din câmpul opțional) plus data nașterii din MRZ. Codul: `packages/api/src/identity/mrz.ts`.

**OCR-ul** (*recunoașterea optică a caracterelor*) transformă fotografia în text. Pe telefon îl face **ML Kit** de la Google, local, fără internet: imaginea nu pleacă de pe telefon. Nivelul de încredere al unei înregistrări prin OCR e **„optic”**: un buletin fals, bine printat, ar trece.

**NFC-ul** e comunicarea fără fir la câțiva centimetri, ca la plata cu cardul. Cartea electronică de identitate (CEI) are un cip care păstrează datele din MRZ, semnate digital de stat. Pașii:

1. **CAN** (*Card Access Number*): cele 6 cifre tipărite pe fața CEI. Alegătorul le introduce în aplicație.
2. **PACE**: cu CAN-ul, telefonul și cipul deschid un **canal criptat** (cine nu are cardul în mână nu poate citi cipul de la distanță). PIN-ul cardului nu se folosește niciodată, ca să nu se poată bloca.
3. Telefonul citește **DG1** (*Data Group 1*: datele din MRZ) și **SOD** (*Document Security Object*: amprentele tuturor grupurilor de date, semnate de stat). Poza (DG2) nu se citește.
4. Serverul face **Passive Authentication**: verifică faptul că amprenta lui DG1 e cea din SOD, că SOD-ul e semnat de un **DSC** (*Document Signer Certificate*) și că DSC-ul e semnat de **CSCA**-ul statului (*Country Signing Certificate Authority*), certificatul rădăcină în care serverul are încredere.
5. Dacă trec toate, datele din DG1 sunt cele scrise de stat pe cip. Serverul extrage CNP-ul. Nivelul de încredere e **„criptografic”**.

Verificarea se face pe **server**, nu în aplicație, pentru că o aplicație modificată ar putea pretinde orice. Codul: modulul Kotlin `apps/mobile/modules/evoting-nfc` (citirea), `apps/backend/src/nfc/passive-auth.ts` (verificarea).

---

# Partea 3. Tehnologiile, una câte una, și de ce au fost alese

## 3.1 Imaginea de ansamblu

Proiectul are cinci programe care rulează în locuri diferite, dar sunt scrise toate în **același limbaj, TypeScript**, și folosesc **aceeași bibliotecă de criptografie**:

| Program | Unde rulează | Tehnologia principală |
| --- | --- | --- |
| Serverul (`apps/backend`) | pe un calculator-server, în Docker | Node.js + NestJS + PostgreSQL |
| Site-ul (`apps/web`) | în browserul comisiei și al oricui | React + Vite |
| Aplicația alegătorului (`apps/mobile`) | pe telefonul Android | React Native + Expo, plus două module Kotlin |
| Programul trustee-ului (`tools/trustee`) | pe calculatorul fiecărui trustee | Node.js, linie de comandă |
| Verificatorul (`tools/verifier`) | oriunde | Node.js, linie de comandă (și în browser, pe site) |

Motivul principal pentru un singur limbaj: **o dovadă generată pe telefon e verificată de exact același cod pe server, în browser și în verificator**. Dacă telefonul ar fi scris în Kotlin și serverul în Java, ar exista două implementări ale aceleiași matematici, care ar putea diferi într-un detaliu (ordinea câmpurilor la hash, de exemplu) și atunci voturile corecte ar fi respinse sau, mai rău, cele greșite acceptate.

```
                    ┌────────────────────────────┐
  Alegător ───────▶ │ apps/mobile (Expo / RN)    │──┐
  (telefon)         │ + module Kotlin NFC și OCR │  │
                    └────────────────────────────┘  │   HTTPS, JSON
  Comisie,          ┌────────────────────────────┐  │   ┌──────────┐   ┌───────────────────────┐   ┌────────────┐
  observatori ────▶ │ apps/web (React / Vite)    │──┼──▶│  Caddy   │──▶│ apps/backend (NestJS) │──▶│ PostgreSQL │
                    └────────────────────────────┘  │   └──────────┘   └───────────────────────┘   └────────────┘
  Trustee ────────▶   tools/trustee (CLI)  ─────────┤
  Oricine ────────▶   tools/verifier (CLI) ─────────┘
                            ▲
        toate folosesc packages/crypto (matematica) și packages/api (contractul HTTP)
```

## 3.2 Limbajul și unealta de bază

**TypeScript** e JavaScript cu **tipuri**: scrii că o variabilă e un număr, un text sau un obiect cu anumite câmpuri, iar compilatorul (`tsc`) te oprește înainte să rulezi dacă amesteci lucrurile. Codul TypeScript se transformă (compilează) în JavaScript, pe care îl rulează Node.js, browserul sau telefonul. Versiunea folosită: **TypeScript 6.0**. De ce: pentru un sistem de vot, o greșeală prinsă la compilare (un câmp lipsă într-un buletin, o funcție chemată cu argumentele inversate) e mult mai ieftină decât una prinsă în ziua votului.

**Node.js** (versiunea **22**, minimum 22.12) rulează JavaScript în afara browserului: serverul, CLI-urile și testele. Vine cu module încorporate pe care proiectul le folosește direct, fără biblioteci în plus:

| Modul Node | Pentru ce |
| --- | --- |
| `node:crypto` | hash-uri și HMAC pe server, numere aleatoare, `timingSafeEqual`, scrypt + AES-GCM pentru fișierul de cheie al trustee-ului, verificarea semnăturilor de pe cip (OpenSSL) |
| `node:test` | rularea testelor (nu e nevoie de Jest sau Mocha) |
| `node:util` (`parseArgs`) | citirea argumentelor din linia de comandă la CLI-uri |
| `node:fs`, `node:path`, `node:readline` | fișiere, căi, citirea parolei din terminal fără ecou |

**npm** instalează bibliotecile (pachetele) descrise în fiecare `package.json`. `package-lock.json` fixează versiunile exacte, ca instalarea să dea același rezultat pe orice calculator.

**npm workspaces (monorepo).** Tot proiectul stă într-un singur depozit git, cu mai multe pachete legate între ele: `packages/crypto`, `packages/api`, `apps/backend`, `apps/web`, `tools/*`, `demos/attacks`. Un `npm install` la rădăcină le instalează pe toate, iar un pachet îl poate importa pe altul după nume (`import { encryptBallot } from '@evoting/crypto'`). Excepție: **aplicația mobilă** are instalarea ei separată (`cd apps/mobile && npm install`), pentru că Expo cere o versiune exactă de React, diferită de cea a site-ului. Leagă pachetele comune prin `file:../../packages/...`, deci după o modificare în `packages/` trebuie rulat `npm run build:packages`.

## 3.3 Fiecare pachet folosit, și de ce

### Criptografia (`packages/crypto`)

| Pachet | Ce face | De ce el |
| --- | --- | --- |
| `@noble/curves` 2.4.0 | Grupul **ristretto255** și semnăturile **Ed25519**. | JavaScript pur, fără cod nativ, deci rulează identic în Node, browser și pe telefon (motorul Hermes al React Native). E open-source, folosit pe scară largă, cu audituri de securitate publicate, iar proiectul îi fixează versiunea exactă. `node:crypto` nu există pe telefon, iar WebCrypto nu are ristretto255. |
| `@noble/hashes` 2.4.0 | **SHA-256**, **SHA-512**, **HMAC**, numere aleatoare. | Același motiv: aceeași bibliotecă peste tot. Sincron (fără `await`), deci se potrivește cu calculele dovezilor. |

Restul matematicii (ElGamal, dovezile, board-ul, numărarea, verificatorul) e scris în proiect, în `packages/crypto/src`, pentru că nu există o bibliotecă gata făcută pentru schema din plan.

### Contractul și clientul (`packages/api`)

Depinde doar de `@evoting/crypto`. Cererile HTTP folosesc `fetch`, încorporat în Node, browser și React Native, deci nu e nevoie de `axios`. Tot aici stă **backend-ul simulat**: o implementare în memorie a tuturor rutelor serverului, cu aceleași reguli și cu criptografia reală, ca site-ul și aplicația să poată fi demonstrate fără server.

### Serverul (`apps/backend`)

| Pachet | Ce face | De ce el |
| --- | --- | --- |
| `@nestjs/core`, `@nestjs/common` (NestJS 12) | Cadrul serverului: **controllere** (rutele), **servicii** (logica), **guard-uri** (cine are voie), **module** (cum se leagă). | Impune o structură clară, ușor de explicat într-o lucrare: fiecare modul în folderul lui, fiecare responsabilitate într-o clasă. **Injecția de dependențe** (Nest dă fiecărei clase obiectele de care are nevoie) face codul ușor de testat. |
| `@nestjs/platform-express` | Leagă NestJS de **Express**, serverul HTTP clasic din Node. | E adaptorul implicit, cel mai cunoscut. |
| `@nestjs/throttler` | **Limitarea de rată**: câte cereri pe minut are voie o adresă IP. | Oprește ghicirea token-urilor și a CNP-urilor prin forță brută (demonstrația 4). |
| `reflect-metadata`, `rxjs` | Biblioteci de care NestJS are nevoie intern (metadatele decoratorilor `@Controller`, `@Get`; fluxurile asincrone). | Cerute de NestJS. |
| `pg` (node-postgres) | Conexiunea la **PostgreSQL**: trimite SQL și primește rânduri. | Proiectul scrie SQL de mână, **fără ORM**: fiecare interogare e vizibilă în cod, iar lucrurile delicate (`SELECT … FOR UPDATE`, tranzacții, constrângeri `UNIQUE`) se văd exact. Un ORM ar ascunde tocmai detaliile care contează pentru securitate. |
| `helmet` | Adaugă **antetele de securitate** la fiecare răspuns: HSTS (browserul folosește doar HTTPS), `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy` și altele; scoate `X-Powered-By`. | Standardul de facto pentru Express; o linie de cod. |
| `multer` | Încărcarea de fișiere, adusă automat de `platform-express`. Proiectul nu o folosește direct. | Versiunea e **forțată** la 2.5.0 în `package.json` de la rădăcină (`overrides`), pentru că versiunile vechi aveau vulnerabilități cunoscute. |
| `asn1js`, `pkijs` | Citesc structurile **ASN.1** și **CMS** din SOD-ul cipului (formatul binar al certificatelor și semnăturilor). | Singurele biblioteci JavaScript complete pentru CMS. Semnăturile se verifică apoi prin `node:crypto` (OpenSSL), care suportă și curbele **brainpool** folosite de multe documente europene, spre deosebire de WebCrypto. |
| `@types/node`, `@types/pg`, `typescript` | Tipurile pentru TypeScript și compilatorul. | Doar la dezvoltare. |

**PostgreSQL 16** e baza de date: tabele cu coloane fixe, legături garantate între tabele, tranzacții. De ce el și nu MongoDB: votul are nevoie de **garanții tari**: o constrângere `UNIQUE` care face imposibil al doilea vot cu același credential, chiar dacă două cereri sosesc în aceeași milisecundă; un trigger care face board-ul imposibil de modificat; o tranzacție `REPEATABLE READ` care dă verificatorului un instantaneu consistent. **Supabase** e un serviciu care oferă PostgreSQL găzduit; proiectul îl poate folosi în loc de baza locală, prin variabila `DATABASE_URL`.

### Site-ul (`apps/web`)

| Pachet | Ce face | De ce el |
| --- | --- | --- |
| `react`, `react-dom` (React 19) | Construiește interfața din **componente**: funcții care primesc date și întorc ce se vede (JSX). Când datele se schimbă, React actualizează doar ce trebuie. | Cel mai răspândit, același model ca React Native, deci o singură „gândire” pentru site și telefon. |
| `react-router` | **Rutele** site-ului: `/`, `/scrutin/:id`, `/comisie`, `/comisie/nou` etc. Schimbă pagina fără reîncărcare. | Standardul pentru React. |
| `vite`, `@vitejs/plugin-react` | Unealta de **dezvoltare** (pornește site-ul local pe portul 5173 și îl reîncarcă instant la modificări) și de **build** (produce fișierele statice optimizate din `dist/`). | Foarte rapid, configurare minimă (fișierul `vite.config.ts` are câteva rânduri: pluginul React și formatul Web Workers). |
| `oxlint` | **Linter**: caută greșeli tipice în cod (variabile nefolosite, reguli ale hook-urilor React). | Scris în Rust, de zeci de ori mai rapid decât ESLint, fără configurare complicată. |
| `vitest` (doar pentru teste) | Rulează **testele automate ale site-ului** (`npm test -w @evoting/web`). | Folosește aceeași configurare ca Vite, deci înțelege direct TypeScript, JSX și importurile site-ului, fără pași în plus. |
| `jsdom` (doar pentru teste) | Un **browser simulat** în Node: DOM-ul (elementele paginii), evenimentele, `sessionStorage`. | Testele rulează în câteva secunde, fără Chrome și fără ecran, inclusiv în GitHub Actions. |
| `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event` (doar pentru teste) | Afișează componentele și le folosesc **ca un om**: caută butoane după text („Închide votul”), câmpuri după etichetă, tastează și dă clic. | Testele verifică ce vede utilizatorul, nu detaliile interne; o refactorizare care nu schimbă interfața nu le strică. |

Site-ul nu folosește nicio bibliotecă de componente (Material UI, Bootstrap): CSS-ul e scris de mână, în zece fișiere din `src/styles/`, ca interfața să rămână mică și ușor de explicat.

### Aplicația mobilă (`apps/mobile`)

| Pachet | Ce face | De ce el |
| --- | --- | --- |
| `react-native` 0.86 | React pentru telefon: componentele devin elemente native Android (nu o pagină web). | Același limbaj și aceleași pachete comune ca restul proiectului. |
| `expo` (SDK 57) | O platformă peste React Native: unelte de build, module gata făcute, aplicația Expo Go pentru teste rapide. | Elimină aproape toată configurarea Android. Modulele native proprii se scriu ca **Expo Modules** (Kotlin). |
| `expo-router` | Navigarea între ecrane după **structura folderelor**: fișierul `src/app/scrutin/[id]/vot.tsx` devine ecranul `/scrutin/<id>/vot`. | Același model ca rutele web; ecranele se găsesc ușor. |
| `expo-camera` | Camera, pentru fotografierea zonei MRZ. | Modulul oficial Expo. |
| `expo-secure-store` | Stocare **criptată** pe telefon (cu o cheie din Android Keystore) pentru credential și chitanța votului. | Cheia secretă a credentialului nu trebuie să stea în clar. |
| `expo-crypto` | Numere aleatoare sigure. Motorul Hermes nu are `crypto.getRandomValues`, iar `src/lib/polyfills.ts` îl adaugă din acest modul. | Fără el, `@noble` n-ar avea de unde lua numere aleatoare. |
| `expo-clipboard` | Copierea codului de urmărire și a datelor de audit. | Modulul oficial. |
| `expo-constants`, `expo-linking`, `expo-status-bar` | Cerute de Expo Router (configurarea aplicației, legăturile, bara de stare). | Dependențe standard ale unui proiect Expo. |
| `react-native-screens`, `react-native-safe-area-context` | Ecranele native și marginile sigure (zona camerei, bara de jos). | Cerute de navigare. |
| `react-native-web`, `react-dom` | Rularea aplicației și în browser (`npx expo start --web`). | Pentru demonstrații și teste fără telefon. |
| `@noble/curves`, `@noble/hashes` | Aceleași ca la `packages/crypto`, instalate și aici. | Pentru că aplicația are `node_modules` propriu, bibliotecile pachetelor comune trebuie să fie și în el. |
| `@evoting/crypto`, `@evoting/api` | Pachetele comune ale proiectului, prin `file:`. | Același cod ca pe server. |

**Modulele native Kotlin** (în `apps/mobile/modules/`):

| Bibliotecă | Ce face | De ce |
| --- | --- | --- |
| **JMRTD** 0.8.9 | Implementarea ICAO 9303 pentru documente cu cip: PACE, citirea DG1 și SOD. | Biblioteca de referință open-source pentru pașapoarte și cărți de identitate electronice. |
| **SCUBA** (`scuba-sc-android`) | Legătura dintre JMRTD și NFC-ul Android (IsoDep). | Cerută de JMRTD pe Android. |
| **BouncyCastle** (`bcprov`) | Criptografia de care are nevoie PACE pe curbe eliptice. | Android are o versiune redusă; modulul o înlocuiește cu cea completă. |
| **ML Kit Text Recognition** 16.0.1 | Recunoașterea textului din fotografie (OCR), pe telefon, fără internet. | Alternativa din plan la Tesseract: biblioteca Google pentru Android, cu modelul inclus în aplicație, fără configurare în plus. Parserul MRZ e separat, deci motorul se poate schimba fără să atingă restul. |

### Uneltele din linia de comandă (`tools/`)

`tools/trustee`, `tools/verifier` și `tools/simulator` nu au nicio bibliotecă externă: folosesc doar `@evoting/crypto`, `@evoting/api` și modulele încorporate în Node (`parseArgs`, `readline`, `crypto`). Cu cât mai puține dependențe are programul care ține cheia secretă a unui trustee, cu atât e mai mică suprafața de atac.

### Demonstrațiile de atac (`demos/attacks`)

Folosesc `pg` (demonstrația 5 modifică direct baza de date) și pachetele comune.

### Calitatea codului (rădăcina)

| Unealtă | Ce face |
| --- | --- |
| `prettier` | **Formatează** tot codul la fel (ghilimele simple, fără `;`, rânduri de cel mult 160 de caractere). Comanda `npm run format`; CI-ul verifică cu `npm run format:check`. |
| `oxlint` | **Linter** pe tot monorepo-ul, cu regulile din `.oxlintrc.json`. Comanda `npm run lint`. |

### Infrastructura

| Unealtă | Ce face | De ce |
| --- | --- | --- |
| **Docker** | Împachetează un program cu tot ce-i trebuie (Node, biblioteci) într-o **imagine**, care rulează la fel pe orice calculator, ca **container**. | „Merge pe calculatorul meu” devine „merge oriunde”. |
| **Docker Compose** | Pornește mai multe containere legate între ele, descrise în `docker-compose.yml`: PostgreSQL, serverul, site-ul și Caddy. | Tot sistemul pornește cu o comandă. |
| **nginx** | Server web care livrează fișierele statice ale site-ului, în containerul `web`. | Mic, rapid, standard pentru site-uri statice. |
| **Caddy** | **Reverse proxy** cu **HTTPS automat**: primește cererile pe portul 443, le criptează cu TLS și le trimite site-ului sau serverului (`/api`). | Obține și reînnoiește singur certificatele (Let's Encrypt pentru un domeniu real, un certificat local pentru `localhost`). Configurarea are 17 rânduri. |
| **GitHub Actions** | Rulează automat, la fiecare `git push`, lint-ul, formatarea, toate testele și build-ul (`ci.yml`), plus construirea APK-ului Android (`android-apk.yml`). | Orice greșeală e prinsă înainte să ajungă în versiunea finală. |

## 3.4 Ce nu s-a folosit, și de ce

| Nu s-a folosit | De ce |
| --- | --- |
| Un ORM (Prisma, TypeORM) | SQL-ul scris de mână arată exact blocările și constrângerile de care depinde securitatea. |
| Jest, Mocha | `node:test`, încorporat în Node, e suficient și nu adaugă dependențe. |
| Redux sau alte biblioteci de stare | Starea e mică: un hook `useAsync` pentru încărcări și un context React pentru sesiunea alegătorului. |
| O bibliotecă de componente UI | CSS scris de mână, ca interfața să fie mică și controlată. |
| Biblioteci criptografice native (libsodium, OpenSSL pe telefon) | Ar fi însemnat cod diferit pe fiecare platformă; `@noble` e același peste tot. |
| Blockchain | Un registru append-only cu lanț de hash-uri și hash publicat independent dă aceeași proprietate (istoria nu se poate rescrie fără să se observe), fără costul și complexitatea unui blockchain. |

---

# Partea 4. Harta proiectului: fiecare folder și fiecare fișier

## 4.1 Cum citești numele fișierelor

| Terminația | Ce conține |
| --- | --- |
| `.ts` | cod TypeScript |
| `.tsx` | cod TypeScript cu JSX, adică interfață React (site sau telefon) |
| `.js`, `.mjs` | JavaScript (configurări Expo, macheta veche) |
| `.json` | date sau configurări (`package.json`, `tsconfig.json`, rapoarte) |
| `.sql` | instrucțiuni pentru baza de date (migrările) |
| `.kt`, `.gradle` | cod Kotlin și build-ul Android ale modulelor native |
| `.css` | stilurile site-ului |
| `.yml` | configurări YAML (Docker Compose, GitHub Actions) |
| `.md` | documentație Markdown |
| `.sh`, `Dockerfile`, `Caddyfile`, `nginx.conf` | scripturi și configurări de infrastructură |

Câteva foldere apar doar pe calculatorul tău și **nu sunt în git**: `node_modules/` (bibliotecile instalate), `dist/` și `dist-test/` (codul compilat), `apps/mobile/android/` (proiectul Android generat de Expo), `apps/backend/pki/` (PKI-ul de test generat). Fișierele `.env` cu secretele nu se urcă niciodată.

Pentru că toate pachetele se compilează din `src/` în `dist/`, importurile din cod se scriu cu `.js` la final (`import { x } from './y.js'`), chiar dacă fișierul sursă e `y.ts`: Node rulează fișierele compilate.

## 4.2 Rădăcina proiectului

| Fișier | Ce face |
| --- | --- |
| `package.json` | Declară monorepo-ul (lista `workspaces`), scripturile comune (`build`, `build:packages`, `test`, `lint`, `format`, `format:check`, `typecheck`), versiunea minimă de Node (22.12), forțarea versiunii `multer` și cele două unelte de calitate (`oxlint`, `prettier`). |
| `package-lock.json` | Versiunile exacte ale tuturor bibliotecilor instalate. Nu se editează de mână. |
| `tsconfig.base.json` | Setările TypeScript comune tuturor pachetelor: JavaScript modern (ES2022), module Node (`NodeNext`), modul `strict`, erori pentru variabile și parametri nefolosiți. Fiecare pachet le moștenește cu `extends`. |
| `.prettierrc` | Regulile de formatare: fără `;`, ghilimele simple, rânduri de 160 de caractere, virgulă finală, sfârșit de rând LF. |
| `.prettierignore` | Ce nu formatează prettier: fișierele generate, macheta, APK-ul și documentația Markdown (tabelele se scriu de mână). |
| `.oxlintrc.json` | Regulile linterului pentru tot proiectul: categoriile „corectitudine” (eroare) și „suspect” (avertisment), regulile hook-urilor React, variabilele nefolosite permise doar cu prefixul `_`. |
| `.gitignore` | Ce nu intră în git: `node_modules`, `dist`, `.env`, jurnalele și fișierele de cheie ale trustees (`*.trustee-key.json`). |
| `.gitattributes` | Scripturile `.sh` și Dockerfile-urile rămân cu sfârșit de rând LF și pe Windows, altfel nu rulează în containerele Linux. |
| `.dockerignore` | Ce nu se trimite la construirea imaginilor Docker (`node_modules`, `.env`, aplicația mobilă, PKI-ul de test). |
| `.env.example` | Șablonul fișierului `.env` pentru Docker Compose: cheia HMAC, token-ul comisiei, cheia sesiunilor, adresa Supabase, adresa site-ului pentru Caddy, originile CORS. Se copiază în `.env` și se completează. |
| `docker-compose.yml` | Cele patru containere ale demo-ului: `db` (PostgreSQL 16), `backend`, `web` (nginx cu site-ul) și `proxy` (Caddy, HTTPS). Partea 10.5. |
| `README.md` | Prezentarea proiectului, structura, pornirea rapidă, Supabase. |
| `infra/Caddyfile` | Configurarea lui Caddy: certificat local pentru `localhost`, `/api/*` trimis la server (fără prefix), restul la site. Pentru un domeniu real se schimbă adresa și se scoate `tls internal`. |
| `.github/workflows/ci.yml` | La fiecare `git push`: instalare, lint, verificarea formatării, toate testele (cu un PostgreSQL pornit ca serviciu), build, `npm audit`; separat, tipurile aplicației mobile și împachetarea ei pentru Android. |
| `.github/workflows/android-apk.yml` | Construiește APK-ul Android pe serverele GitHub (care au Android SDK) și îl pune în `apk/`. Se poate porni manual cu adresa unui server real. |
| `apk/vot-verificabil.apk` | Aplicația de instalat pe telefon, construită de workflow-ul de mai sus. Fără adresă de server, folosește backend-ul simulat. |

## 4.3 `packages/crypto`: matematica

Tot ce ține de criptografie, scris o singură dată și folosit de server, telefon, site, CLI-ul trustee-ului și verificator.

| Fișier | Ce face |
| --- | --- |
| `package.json` | Numele `@evoting/crypto`, cele două dependențe `@noble/*` cu versiuni fixate exact, scripturile `build`, `test`, `typecheck` și cele două intrări: `@evoting/crypto` (peste tot) și `@evoting/crypto/node` (doar în Node). |
| `tsconfig.json`, `tsconfig.node.json`, `tsconfig.test.json` | Compilarea surselor (`src` → `dist`, fără tipurile Node, ca biblioteca să meargă și în browser și pe telefon), a folderului `src/node` separat (cu tipurile Node) și a surselor plus testelor (`→ dist-test`). |
| `README.md` | Lista fișierelor și a testelor. |
| `src/encoding.ts` | Hex (`bytesToHex`, `hexToBytes`, `isHex` strict) și **JSON canonic** (`canonicalJson`: chei sortate, câmpurile `undefined` scoase, numerele infinite respinse). |
| `src/group.ts` | Grupul **ristretto255**: ordinul `Q`, generatorul `G`, scalari aleatori din 64 de octeți reduși modulo q, codificări stricte (`pointFromHex` respinge punctele invalide, `scalarFromHex` respinge valorile ≥ q), înmulțiri în timp constant pentru secrete (`mulSecret`) și rapide pentru date publice (`mulPublic`). |
| `src/hash.ts` | SHA-256 (`sha256Hex`), `hashObject` (hash-ul JSON-ului canonic), HMAC, `cnpHmac` și `hashToScalar` (provocarea Fiat-Shamir, cu lungimea fiecărei părți în față). |
| `src/types.ts` | Formele JSON publice: `Ciphertext` (a, b), `ChaumPedersenProof` (c, s), `ZeroOneProof` (c0, c1, s0, s1), `Ballot`, `ElectionParams`, `TrusteePublicKey`, `PartialDecryption`, `BoardEntry`. |
| `src/elgamal.ts` | Criptarea ElGamal exponențială (`encrypt`, `encryptPoints`), adunarea criptotextelor (`addCiphertexts`), cheia publică decodată o dată și ținută minte cu tabele precalculate (`preparePublicKey`), decriptarea cu cheia completă (doar în teste). |
| `src/proofs.ts` | Cele patru dovezi: Schnorr (`proveSchnorr`, `verifySchnorr`), Chaum-Pedersen (`proveEqualLogs`, `verifyEqualLogs`), disjunctiva 0/1 (`proveZeroOne`, `verifyZeroOne`) și etichetele lor (`DOMAIN`). |
| `src/credential.ts` | Credentialul **Ed25519**: generare, verificarea unei chei publice, semnare, verificarea semnăturii, textul semnat la autentificare (`authMessage`). |
| `src/ballot.ts` | `encryptBallot` (criptotextele, dovezile, semnătura), `verifyBallot` (forma, semnătura, dovezile), `auditBallot` (provocarea Benaloh), amprentele buletinului (`ballotDigest`, `ballotHash`). |
| `src/board.ts` | Board-ul: hash-ul genesis, hash-ul unei intrări, `appendEntry` (intrarea următoare), `checkOwnEntry` (verificarea propriului vot după cod), `normalizeTrackingCode`. |
| `src/trustee.ts` | `generateTrusteeKey` (xᵢ, Yᵢ și dovada Schnorr), `verifyTrusteeKey`, `combinePublicKeys` (Y = ΣYᵢ), `partialDecrypt` și `verifyPartialDecryption`. |
| `src/tally.ts` | `computeAggregate` (suma criptotextelor per candidat, și pentru o bucată din board), `sumAggregates` (suma unor agregate parțiale), `babyStepGiantStep`, `combinePartialDecryptions` (totalurile). |
| `src/verify.ts` | **Verificatorul public**, `verifyElection`: cei șase pași (cheile, lanțul cu orele, credentialele, dovezile, agregatul, decriptarea), fiecare eroare cu locul ei exact, progres (inclusiv începutul fiecărui pas) și cedarea periodică a controlului (ca browserul să nu înghețe). Partea scumpă (semnăturile, dovezile, agregatul) o face un `BallotWork`: implicit firul curent, opțional mai multe fire. O intrare malformată e raportată („Intrare malformată”), nu oprește verificarea. |
| `src/parallel.ts` | **Verificarea în paralel**, partea comună tuturor platformelor: `sequentialWork` (totul pe firul curent, ca înainte), `createParallelWork` (bazinul de „lucrători”: împarte board-ul în bucăți, le dă primului fir liber, pune rezultatele la loc în ordine), `handleWorkRequest` (ce face un fir cu o bucată). Raportul iese identic cu cel de pe un singur fir. |
| `src/node/parallel.ts`, `src/node/worker.ts` | Adaptorul pentru Node (`@evoting/crypto/node`): `createNodeWork` pornește `worker_threads` care rulează `worker.ts`; `defaultThreads` = numărul de nuclee. Folosit de `evoting-verify`, de CLI-ul trustee-ului și de simulator. |
| `src/index.ts` | Ce se exportă din pachet (tot ce folosesc celelalte componente). |
| `test/helpers.ts` | `simulateElection` (un scrutin complet fără server, cu tot cu decriptare) și `forgeBallot` (buletine trișate care încearcă să păcălească dovezile). |
| `test/encoding.test.ts` | 6 teste: JSON canonic, HMAC pe vectorul oficial RFC 4231, scalari și hex invalide. |
| `test/elgamal.test.ts` | 4 teste: criptare/decriptare, criptotexte diferite pentru același vot, adunarea, baby-step giant-step. |
| `test/ballot.test.ts` | 13 teste: buletinul corect și toate felurile de buletin trișat, semnătura, provocarea Benaloh. |
| `test/trustee.test.ts` | 6 teste: dovada Schnorr, chei invalide, decriptarea cu toți trustees, trustee care trișează. |
| `test/verifier.test.ts` | 16 teste: scrutinul corect și 13 feluri de manipulare (inclusiv ore greșite), verificarea propriului vot, progresul. |
| `test/parallel.test.ts` | 9 teste: raport identic pe `worker_threads` reale (și cu buletine trișate), ordinea rezultatelor când bucățile se termină în altă ordine, agregatul pe bucăți, un fir căzut, o intrare malformată, auditul Benaloh cu date incomplete, cheile Ed25519 de ordin mic. |

## 4.4 `packages/api`: legătura dintre programe

Tot ce au în comun clienții (site, telefon, CLI-uri) cu serverul: forma cererilor și a răspunsurilor, clientul HTTP, backend-ul simulat, citirea actelor de identitate și pașii alegătorului.

| Fișier | Ce face |
| --- | --- |
| `package.json`, `tsconfig*.json`, `README.md` | Ca la `crypto`; singura dependență e `@evoting/crypto`. |
| `src/index.ts` | Exporturile pachetului `@evoting/api`. |
| `src/contract/index.ts` | Adună toate tipurile contractului. |
| `src/contract/election.ts` | Scrutinul (`Election`, stările, `Candidate` cu `kind: 'candidate' \| 'blank'`, `Trustee`, statisticile), cererile comisiei (`CreateElectionInput` cu `allowBlank`, `UpdateElectionInput`), token-urile trustees, rezultatul importului și al scoaterii din listă (`EligibleRemoveResult`), setarea `requireNfc` („doar NFC”). |
| `src/contract/voter.ts` | Înregistrarea (OCR, NFC, nivelul de încredere, `replacedPrevious` la re-înregistrare), provocarea, sesiunea, chitanța votului (`BallotReceipt`). |
| `src/contract/board.ts` | Ce publică serverul pentru verificare: capul board-ului, o pagină din board (`BoardPage`), agregatul, rezultatul, jurnalul, pachetul de audit. |
| `src/contract/admin.ts` | Comisia: rolurile `comisie` / `observator`, identitatea autentificată, membrii, membrul creat (cu token-ul afișat o dată). |
| `src/contract/errors.ts` | `ApiError`: o eroare cu codul HTTP (0 = serverul nu răspunde). |
| `src/contract/client.ts` | Interfața `ApiClient`: lista tuturor operațiilor (citiri publice, comisie, trustees, alegător). Clientul real și cel simulat o implementează identic, deci ecranele nu știu cu care vorbesc. |
| `src/client/http.ts` | **Clientul HTTP real**: `fetch` cu `Authorization: Bearer …`, erorile NestJS transformate în mesaje clare, `429` tradus în „Prea multe încercări”. |
| `src/mock/index.ts` | `createMockBackend`: pornește backend-ul simulat, generează scrutinele de demonstrație la prima cerere, simulează latența rețelei și închiderea automată. |
| `src/mock/state.ts` | Starea în memorie (echivalentul tabelelor serverului) și contextul comun: HMAC-ul, jurnalul, „fotografiile” scrutinelor. |
| `src/mock/rules.ts` | Regulile serverului, aplicate pe starea din memorie: modificare, ștergere, deschidere, închidere automată, chei, import, înregistrare și re-înregistrare, vot în interval, numărare. Aceleași mesaje ca serverul real. |
| `src/mock/seed.ts` | Cele trei scrutine de demonstrație (unul deschis, cu vot alb; unul în configurare; unul numărat), cu date relative la „acum”. |
| `src/mock/client.ts` | Implementarea `ApiClient` rută cu rută peste starea din memorie. |
| `src/mock/tools.ts` | **Uneltele de test**: țin locul CLI-ului de trustee și al alegătorilor (chei simulate, alegători simulați — prin NFC, cu un cip de test, la scrutinele „doar NFC” —, decriptare simulată, un CNP propriu adăugat în listă, MRZ de test). |
| `src/mock/random.ts` | Numere aleatoare cu sămânță (ca demonstrațiile să fie la fel la fiecare pornire), latență, copiere. |
| `src/mock/contract-helpers.ts` | Re-exporturi și două constante (sufixul ID-ului „vot alb”, identitatea comisiei în simulator). |
| `src/identity/cnp.ts` | Validarea CNP-ului (format, prima cifră, data, județul, cifra de control), un generator de CNP-uri fictive valide și `parseCnpList` (CSV-ul cu CNP-uri: antet, coloane, ghilimele, liniile greșite cu numărul lor), comun importului și scoaterii, pe serverul real și pe cel simulat. |
| `src/identity/mrz.ts` | Parserul MRZ (TD1, TD2, TD3): curăță textul OCR, corectează confuziile (O/0, I/1, „«”), verifică toate cifrele de control, reconstituie CNP-ul, spune dacă actul e expirat. |
| `src/identity/mrz-build.ts` | Construiește MRZ-uri de test (TD1 pentru CEI, TD2 pentru buletinul vechi). |
| `src/identity/dg1.ts` | DG1 de pe cip: extrage MRZ-ul din structura binară `61 { 5F1F <MRZ> }` și invers; conversii base64. |
| `src/voter.ts` | **Pașii alegătorului**, comuni telefonului, simulatorului și testelor: `authenticate` (provocare semnată → sesiune), `prepareBallot` (criptare), `submitBallot` (autentificare + trimitere), `verifyOwnBallot` (caută codul și verifică local). |
| `src/format.ts` | Etichete și formatări comune site-ului și telefonului: numele stărilor, metodelor, nivelurilor și rolurilor, „Vot alb”, date în română, hash-uri scurtate, procente, `plural` („1 cheie”, „2 chei”, „20 de chei”), `decimal` și procentele cu virgulă („58,2%”), durate („2 zile și 3 ore”, „21 de ore”), poziția față de intervalul scrutinului (`intervalPhase`). |
| `test/cnp.test.ts` | 4 teste: validarea, formatele greșite, generatorul, lista CSV. |
| `test/mrz.test.ts` | 7 teste: exemplele oficiale ICAO, buletinul vechi, CEI, zgomotul OCR, text fără MRZ. |
| `test/dg1.test.ts` | 3 teste: împachetare/despachetare, DG1 invalid, base64. |
| `test/mock.test.ts` | 9 teste: un scrutin complet pe backend-ul simulat (verificat de verificatorul public), scrutinele de demonstrație, re-înregistrarea, votul alb, modificarea și ștergerea, intervalul și închiderea automată, uneltele de test și membrii comisiei, scoaterea din lista de eligibili, scrutinul „doar NFC”. |
| `test/format.test.ts` | 4 teste: acordul numeralelor („20 de chei”, „105 voturi”), duratele, procentele și zecimalele cu virgulă, faza intervalului. |

## 4.5 `apps/backend`: serverul

NestJS + PostgreSQL. Un folder per modul (o „responsabilitate”). Fiecare modul are de obicei un **controller** (primește cererile HTTP) sau un **serviciu** (face treaba), ori amândouă.

**Configurare și pornire**

| Fișier | Ce face |
| --- | --- |
| `package.json` | Numele `@evoting/backend`, dependențele (Partea 3.3), scripturile: `build`, `start`, `dev` (compilează și pornește cu `.env`), `migrate`, `test-pki`, `test`. |
| `tsconfig.json` | Compilarea `src` și `test` în `dist`, cu decoratorii activați (NestJS are nevoie de ei). |
| `.env.example` | Șablonul variabilelor de mediu ale serverului, cu explicații (Partea 10.4). |
| `README.md` | Comenzile și structura serverului. |
| `Dockerfile` | Imaginea serverului, în două etape: în prima se instalează și se compilează tot, în a doua se copiază doar codul compilat și bibliotecile de producție. Rulează ca utilizatorul `node`, nu ca administrator. |
| `docker-entrypoint.sh` | La pornirea containerului, dacă e cerut (`GENERATE_TEST_PKI=true`), generează PKI-ul de test pentru cipuri NFC simulate, apoi pornește serverul. |
| `src/main.ts` | Punctul de pornire: citește configurarea, construiește aplicația, ascultă pe portul 3000. |
| `src/config.ts` | Citește variabilele de mediu și le verifică: lipsesc `DATABASE_URL`, `CNP_HMAC_KEY` sau `ADMIN_TOKEN` → serverul refuză să pornească; cheia HMAC trebuie să aibă cel puțin 32 de octeți; token-ul comisiei cel puțin 16 caractere. Setează limitele, intervalul închiderii automate, încrederea în proxy. |
| `src/app.ts` | Construiește aplicația: aplică migrările, pornește NestJS, adaugă `helmet` (antetele de securitate), `trust proxy` (în spatele lui Caddy), limitele de mărime ale cererilor (2 MB JSON, 20 MB CSV), CORS, avertismentele (CORS deschis în producție, SSL fără verificarea certificatului). |
| `src/app.module.ts` | Lista tuturor controllerelor și serviciilor, plus limitarea de rată generală (600 de cereri pe minut per IP). Comentariul de sus spune ce face fiecare folder. |

**Baza de date**

| Fișier | Ce face |
| --- | --- |
| `migrations/001_init.sql` | Primele nouă tabele (Partea 6) și trigger-ul care face tabela `ballots` imposibil de modificat sau șters. |
| `migrations/002_rls.sql` | Pornește **Row Level Security** pe toate tabelele, fără nicio regulă: pe Supabase, asta blochează accesul prin API-ul REST public; serverul se conectează ca proprietar și nu e afectat. |
| `migrations/003_settings_members_challenges.sql` | Coloana `kind` la candidați (votul alb), tabelele `commission_members` și `auth_challenges`. |
| `migrations/004_require_nfc.sql` | Coloana `require_nfc` la scrutine: setarea „doar NFC” (implicit `false`, deci scrutinele vechi rămân cum erau). |
| `src/db/database.service.ts` | Grupul de conexiuni (`pg.Pool`, maximum 20), `query` și `transaction` (BEGIN, COMMIT sau ROLLBACK la eroare), `isUniqueViolation` (recunoaște eroarea PostgreSQL 23505). |
| `src/db/pg-options.ts` | Opțiunile conexiunii: SSL pornit automat pentru orice server care nu e local, `DATABASE_SSL=on/off` pentru forțare, verificarea certificatului dacă e dat `DATABASE_CA`; mesajul de avertizare când certificatul nu e verificat. |
| `src/db/migrate.ts` | Aplică fișierele din `migrations/` în ordine, o singură dată fiecare, într-o tranzacție, cu un lacăt PostgreSQL (`pg_advisory_lock`) ca două instanțe să nu le aplice simultan. Ține evidența în tabela `schema_migrations`. |
| `src/db/migrate-cli.ts` | Comanda `npm run migrate`: doar migrările, fără server. |

**Securitate comună**

| Fișier | Ce face |
| --- | --- |
| `src/common/security.ts` | Token-uri aleatoare, SHA-256, `safeEqual` (comparație în **timp constant**: durata nu depinde de câte caractere se potrivesc, deci un atacator nu poate ghici token-ul literă cu literă după timpul de răspuns), extragerea token-ului din `Authorization: Bearer`, sesiunile alegătorilor semnate cu HMAC (`signSession`, `verifySession`). |
| `src/common/throttle.ts` | Limita **strictă** pentru rutele sensibile (implicit 30 de cereri pe minut per IP, `SENSITIVE_RATE_LIMIT`). |
| `src/common/validate.ts` | Verificarea datelor primite: text obligatoriu și cu lungime maximă, dată validă, obiect, listă cu număr minim și maxim de elemente. Orice abatere → `400 Bad Request` cu un mesaj clar. |

**Modulele**

| Fișier | Ce face |
| --- | --- |
| `src/admin/admin.guard.ts` | Autentificarea comisiei. `AdminGuard` acceptă `ADMIN_TOKEN` (administratorul „rădăcină”) sau token-ul unui membru (căutat după SHA-256, doar dacă nu e revocat) și pune identitatea pe cerere. `CommissionGuard` cere în plus rolul `comisie`. Decoratorul `@Admin()` dă identitatea controllerului; `adminActor` o transformă în actorul din jurnal (`comisie:Maria Pop`). |
| `src/admin/admin.controller.ts` | Rutele `/admin/check` (cine sunt), `/admin/members` (listă, creare) și `/admin/members/:id` (revocare). |
| `src/admin/members.service.ts` | Membrii comisiei: creare (token aleator, păstrat doar ca SHA-256, întors o singură dată), listare, revocare (rândul rămâne, ca jurnalul să rămână lizibil). |
| `src/audit/audit.service.ts` | Jurnalul de audit: scrie și citește acțiunile comisiei, ale trustees, ale alegătorilor (fără date personale) și ale serverului. |
| `src/elections/elections.controller.ts` | **Toate rutele `/elections`**: citirile publice, acțiunile comisiei, trustees și alegătorul. Doar leagă fiecare rută de serviciul potrivit și pune protecțiile (guard, limită de rată). Ruta paginată `board/page` e declarată înaintea lui `board/:hash`, ca „page” să nu fie luat drept cod de urmărire. |
| `src/elections/elections.repository.ts` | **Citirile**: scrutinele cu candidații, trustees și statisticile lor, board-ul (întreg sau pe pagini), căutarea după cod, capul board-ului, înregistrările publice, agregatul, rezultatul, pachetul de audit (dintr-un singur instantaneu `REPEATABLE READ`). Plus `lock` (blochează rândul scrutinului până la sfârșitul tranzacției) și `params` (cheia, numărul de opțiuni, starea și intervalul). |
| `src/elections/elections.service.ts` | **Acțiunile comisiei**: creare, modificare și ștergere (doar în configurare), importul și **scoaterea** eligibililor (în configurare sau cu votul deschis; la scoatere, înregistrarea celor care n-au votat se șterge și ea, cine a votat rămâne), deschiderea (cu toate cheile, lista nevidă și data închiderii încă în viitor), închiderea (calculează și publică agregatul) și `closeExpired` (scrutinele deschise cu data închiderii trecută; o eroare neașteptată apare în log, iar celelalte scrutine se închid în continuare). |
| `src/elections/election.rows.ts` | Rândurile din PostgreSQL transformate în obiectele contractului; interogarea comună cu statisticile; lista candidaților de inserat (votul alb ultimul); `slug` (ID-ul scrutinului din titlu, fără diacritice). |
| `src/elections/auto-close.service.ts` | **Închiderea automată**: la fiecare minut (`AUTO_CLOSE_INTERVAL_MS`), cheamă `closeExpired`. În jurnal, actorul e `server`, cu `automatic: true`. |
| `src/trustees/trustees.service.ts` | Trustees: autentificarea cu token-ul (căutat după SHA-256) și primirea cheii Yᵢ cu dovada Schnorr; când au trimis toți, publică cheia scrutinului. |
| `src/registration/registration.service.ts` | **Înregistrarea**: prin OCR (CNP-ul, nivel „optic”) sau NFC (DG1 + SOD, Passive Authentication, nivel „criptografic”); la un scrutin „doar NFC”, OCR-ul e refuzat cu 403. Verifică eligibilitatea; dacă persoana e deja înregistrată și **n-a votat**, înlocuiește credentialul vechi (re-înregistrare), dar nu cu un nivel de încredere mai mic. |
| `src/auth/auth.controller.ts`, `auth.service.ts` | Rutele `/auth/challenge` și `/auth/verify`: provocarea (păstrată în tabela `auth_challenges`, valabilă 2 minute, consumată la prima încercare) și sesiunea de 10 minute. |
| `src/ballots/ballots.service.ts` | **Primirea votului** (`cast`): sesiunea, scrutinul deschis, intervalul, semnătura și dovezile (verificate în afara tranzacției, pentru că durează ~25 ms), apoi, cu rândul scrutinului blocat: credentialul înregistrat, n-a mai votat, ora primirii (luată abia acum, ca orele să urmeze ordinea de pe board) și adăugarea pe board. |
| `src/tally/tally.service.ts` | Numărarea: primește decriptarea parțială a fiecărui trustee, o verifică; după ultimul, combină, află totalurile și publică rezultatul (starea devine `tallied`). |
| `src/nfc/passive-auth.ts` | **Passive Authentication**: SOD → CMS → LDSSecurityObject, hash-ul DG1, atributele semnate, semnătura Document Signer-ului (ECDSA, RSA, RSA-PSS, prin OpenSSL), lanțul până la un CSCA de încredere și perioadele de valabilitate. |
| `src/nfc/passive-auth.service.ts` | Încarcă certificatele CSCA din `CSCA_DIR` la pornire și oferă verificarea celorlalte module. |
| `src/nfc/test-pki.ts`, `test-pki-cli.ts` | Un PKI „de laborator” (un CSCA, un Document Signer) și **cipuri simulate** (DG1 + SOD semnat), pentru teste, simulator și demo. Comanda `npm run test-pki`. |
| `src/system/system.controller.ts` | `/health` (pentru Docker și monitorizare). |

**Testele serverului** (pe PostgreSQL real)

| Fișier | Ce face |
| --- | --- |
| `test/helpers.ts` | Baza de test (o **golește** la fiecare suită!), pornirea serverului pe un port liber, clienți cu și fără token, datele unui scrutin de test. |
| `test/election-flow.e2e.test.ts` | 16 teste: tot fluxul, de la creare la verificarea publică, cu toate încercările de fraudă. |
| `test/interval.e2e.test.ts` | 5 teste: vot înainte de deschidere, scrutin cu închiderea în trecut, voturi simultane cu ore crescătoare, ceasuri diferite, închiderea automată. |
| `test/commission.e2e.test.ts` | 5 teste: membrii și rolurile, modificarea și ștergerea, votul alb, scoaterea din lista de eligibili, scrutinul „doar NFC” (cu un cip de test semnat). |
| `test/rate-limit.e2e.test.ts` | 3 teste: ghicirea token-ului oprită cu 429, rutele publice neafectate, `/health`. |
| `test/cli.e2e.test.ts` | 1 test lung: CLI-urile reale, ca procese separate (keygen cu cheie criptată și necriptată, decrypt, verificare online și offline, pe un fir și pe două, un fișier Benaloh incomplet → codul 2). |
| `test/pg-options.test.ts` | 3 teste, fără bază de date: când se cere SSL (local, la distanță, `sslmode`, `DATABASE_SSL`) și când se verifică certificatul (`DATABASE_CA`). |

## 4.6 `apps/web`: site-ul

Panoul comisiei și pagina publică a fiecărui scrutin. React + Vite + React Router.

**Configurare**

| Fișier | Ce face |
| --- | --- |
| `package.json` | `@evoting/web`, dependențele, scripturile `dev`, `build`, `lint`, `typecheck`. |
| `index.html` | Pagina în care React își „montează” aplicația (`<div id="root">`). |
| `vite.config.ts` | Configurarea Vite: pluginul React și `worker.format: 'es'` (Web Workers-ii verificatorului, ca module ES). |
| `vitest.config.ts` | Configurarea testelor: aceeași configurare Vite, plus mediul `jsdom`, fișierele `test/**/*.test.tsx`, pregătirea din `test/setup.ts` și `VITE_API_URL` gol (testele merg mereu pe backend-ul simulat). |
| `tsconfig.test.json` | Verificarea tipurilor pentru teste (`src` plus `test`), inclusă în `npm run typecheck` și în build. |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | TypeScript pentru codul site-ului (cu tipurile browserului) și pentru fișierul de configurare Vite. |
| `.oxlintrc.json` | Reguli de lint specifice site-ului (componentele React). |
| `.env.example` | `VITE_API_URL`: adresa serverului. Necompletat = backend simulat. |
| `.gitignore` | Fișierele generate de Vite. |
| `Dockerfile`, `nginx.conf` | Imaginea site-ului: build cu Vite, apoi nginx livrează fișierele; orice rută necunoscută primește `index.html` (React Router o tratează). |
| `public/favicon.svg` | Iconița din tab-ul browserului. |
| `README.md` | Comenzile și structura. |

**Codul**

| Fișier | Ce face |
| --- | --- |
| `src/main.tsx` | Pornirea: importă stilurile și montează `App` în `index.html`. |
| `src/App.tsx` | Lista rutelor: `/` (scrutinele), `/scrutin/:id` (pagina publică), `/scrutin/:id/proces-verbal` (procesul-verbal), `/comisie`, `/comisie/nou`, `/comisie/membri`, `/comisie/:id`, `/comisie/:id/editare`, `/despre`. Rutele comisiei sunt învelite în `AdminGate`. |
| `src/api/index.ts` | Alege clientul: cel real dacă există `VITE_API_URL`, altfel backend-ul simulat (cu uneltele de test; fără latența artificială când rulează testele). |
| `src/api/config.ts` | Citește `VITE_API_URL`. |
| `src/api/admin.ts` | Token-ul comisiei în `sessionStorage` (dispare la închiderea tab-ului), identitatea autentificată într-un context React (`useAdmin`), `canEdit` (doar rolul `comisie` vede butoanele care schimbă ceva). |
| `src/lib/format.ts` | Re-exportă formatările comune din `@evoting/api`. |
| `src/lib/useAsync.ts` | Hook-ul care încarcă date la deschiderea unei pagini și le reîncarcă la cerere (stările „se încarcă”, „eroare”, „date”). |
| `src/lib/trusteeTokens.ts` | Token-urile trustees păstrate în `sessionStorage` (doar în acest tab) până când comisia confirmă că le-a transmis; comanda `keygen` a fiecărui trustee și fișierul `.txt` cu toate comenzile. |
| `src/lib/verify-workers.ts` | Verificarea în paralel în browser: `createBrowserWork` pornește câte un **Web Worker** pe nucleu (cel mult 16), legat de bazinul din `@evoting/crypto`. |
| `src/lib/verify.worker.ts` | Codul unui Web Worker: primește o bucată din board și o verifică (aceeași funcție ca firele din Node). |
| `src/components/layout/Layout.tsx` | Bara de sus (sigla, meniul, modul: backend simulat sau adresa API-ului) și locul paginii. |
| `src/components/layout/AdminGate.tsx` | Login-ul comisiei: cere token-ul, îl verifică la `/admin/check` și pune identitatea (nume, rol) în context. Cu backend-ul simulat nu cere nimic. |
| `src/components/ui/` | Componente mici: `StatusBadge` (eticheta stării), `Hash` (hash scurtat, copiat la click), `Stat` (o cifră cu etichetă), `Countdown` („se închide peste 2 zile”, reîmprospătat la fiecare minut), `Feedback` (`Loading`, `ErrorBox`, `Message`), `index.ts` (exporturile). |
| `src/pages/Home.tsx` | Lista scrutinelor, cu starea, intervalul, numărul de opțiuni (și „+ vot alb”), participarea și cât mai e până la deschidere sau închidere. |
| `src/pages/About.tsx` | „Cum funcționează”: explicația publică, pentru alegători și observatori. |
| `src/pages/commission/CommissionList.tsx` | Panoul comisiei: cine e autentificat și cu ce rol, tabelul scrutinelor, butoanele „Membri”, „Scrutin nou”, „Ieșire”. |
| `src/pages/commission/CommissionNew.tsx` | Crearea unui scrutin (folosește `ElectionForm`); după creare, deschide pagina scrutinului cu token-urile trustees. |
| `src/pages/commission/CommissionEdit.tsx` | Modificarea unui scrutin în configurare (același formular, fără trustees). |
| `src/pages/commission/ElectionForm.tsx` | Formularul comun: titlu, interval (implicit de mâine la 8:00, trei zile), candidați (adăugare, ștergere, mutare sus/jos), „permite votul alb”, „doar cu cartea electronică (NFC)”, trustees (doar la creare). |
| `src/pages/commission/CommissionElection.tsx` | Pagina unui scrutin pentru comisie: starea, ceasul, acțiunile (modifică, șterge cu confirmare, deschide, închide tot cu confirmare), etapele, statisticile, trustees, opțiunile, importul, hash-ul de publicat, jurnalul, uneltele de test. Observatorul vede tot, fără butoane. |
| `src/pages/commission/CommissionMembers.tsx` | Membrii comisiei: creare (token-ul afișat o singură dată), listă, revocare. |
| `src/pages/commission/parts/` | Bucățile paginii de mai sus: `Steps` (configurare → vot → numărare → rezultat), `TrusteeTokens` (comenzile trustees, păstrate în tab până la „Am transmis token-urile”, descărcabile ca `.txt`), `EligibleImport` (CSV lipit sau din fișier, și cu votul deschis; modul „Adaugă” sau „Scoate”, scoaterea cu confirmare), `BoardHead` (`poziție:hash` de publicat independent), `AuditLog` (jurnalul, cu acțiunile traduse, scoaterile din listă rezumate ca numere și înregistrările alegătorilor doar numărate), `MockToolsPanel` (butoanele „Simulează…”). |
| `src/pages/election/ElectionPublic.tsx` | Pagina publică a unui scrutin: starea, ceasul, statisticile, legătura spre procesul-verbal și cele cinci tab-uri. |
| `src/pages/election/ProcesVerbal.tsx` | **Procesul-verbal**: date generale (interval, felul înregistrării, opțiuni, trustees, cheia publică), participarea (eligibili, înregistrați OCR/NFC, buletine, cvorum), rezultatul, ultimul hash al board-ului, verificarea publică rulată din pagină (pe Web Workers) și locul semnăturilor; butonul „Tipărește / salvează PDF”. |
| `src/pages/election/tabs/BoardTab.tsx` | Board-ul, câte 50 de intrări pe pagină (cele mai noi primele), și căutarea după codul de urmărire, verificată în browser față de codul căutat (nu față de ce scrie ulterior în câmp). |
| `src/pages/election/tabs/ResultTab.tsx` | Rezultatul, cu bare proporționale; votul alb apare separat, la final. |
| `src/pages/election/tabs/VerificationTab.tsx` | **Verificatorul public în browser**: descarcă pachetul de audit și rulează `verifyElection`, cu bară de progres și opțional hash-ul publicat independent; bifa „în paralel, pe N fire” (Web Workers, implicit pornită); timpul și numărul de fire în rezultat; descărcarea pachetului ca JSON. |
| `src/pages/election/tabs/BenalohTab.tsx` | Verificarea unui buletin auditat (provocarea Benaloh), cu datele copiate din aplicație. Trei rezultate distincte: verde (corect), roșu (aplicația a criptat altceva), galben (text incomplet, alt scrutin, JSON greșit: nu se poate verifica, dar nu e o acuzație). |
| `src/pages/election/tabs/ParametersTab.tsx` | Parametrii publici: cheia scrutinului, opțiunile în ordinea din vectorul de vot, cheile trustees, felul înregistrării (OCR și NFC sau doar NFC). |
| `src/styles/` | CSS-ul, pe teme, importat în ordine de `index.css`: `tokens` (culorile și mărimile), `base`, `layout`, `cards`, `forms`, `feedback`, `tables`, `results`, `verification`, `responsive` (telefon), `print` (procesul-verbal și tipărirea: fără bara de sus și fără butoane). |

**Testele site-ului** (`test/`, rulate cu `npm test -w @evoting/web`)

| Fișier | Ce face |
| --- | --- |
| `test/setup.ts` | După fiecare test golește pagina și `sessionStorage`; așteptări de până la 20 s (backend-ul simulat face criptografie reală). |
| `test/render.tsx` | `renderAt(adresă)` pornește tot site-ul, cu rutele reale, ca și cum ar fi deschis în browser; `demoElection(stare)` găsește un scrutin de demonstrație. |
| `test/public.test.tsx` | 7 teste: lista scrutinelor; căutarea pe board fără alarma falsă după editarea câmpului; un cod inexistent; Benaloh (verde, roșu, galben); verificatorul public (șase pași trecuți); hash-ul publicat greșit; procesul-verbal (cu verificarea rulată din pagină). |
| `test/commission.test.tsx` | 4 teste: „Închide votul” cu confirmare; token-urile trustees păstrate după „Modifică” și după reîncărcare, până la „Am transmis”; „Scoate” din lista de eligibili; scrutinul „doar NFC” (bifa, refuzul OCR, afișarea publică). |

## 4.7 `apps/mobile`: aplicația alegătorului

Expo SDK 57 + React Native + Expo Router, plus două module native Kotlin.

**Configurare**

| Fișier | Ce face |
| --- | --- |
| `package.json`, `package-lock.json` | Dependențele aplicației, instalate separat de restul monorepo-ului (`cd apps/mobile && npm install`). |
| `app.json` | Configurarea Expo: numele „Vot verificabil”, pachetul Android `ro.udjg.evoting`, permisiunile (cameră, NFC), iconițele, pluginurile (router, camera cu textul permisiunii, SecureStore, excluderile Android). |
| `metro.config.js` | Metro (unealta care împachetează JavaScript-ul aplicației) urmărește și `packages/`, ca pachetele comune să fie văzute. |
| `tsconfig.json` | TypeScript pentru Expo. |
| `.env.example` | `EXPO_PUBLIC_API_URL`: adresa serverului (pe telefon, IP-ul calculatorului, nu `localhost`). Necompletat = backend simulat. |
| `plugins/with-packaging-excludes.js` | Plugin Expo: la generarea proiectului Android, adaugă excluderea fișierelor `META-INF` duplicate aduse de BouncyCastle (altfel build-ul Android pică). |
| `assets/` | Iconița, iconițele adaptive Android, ecranul de pornire, favicon-ul pentru web. |
| `AGENTS.md` | Indicații pentru asistenții de programare (comenzile Expo, regulile proiectului). |
| `README.md` | Comenzile și structura. |

**Modulele native**

| Fișier | Ce face |
| --- | --- |
| `modules/evoting-nfc/expo-module.config.json` | Declară modulul pentru Expo (autolinking). |
| `modules/evoting-nfc/android/build.gradle` | Dependențele Kotlin: JMRTD, SCUBA, BouncyCastle. |
| `modules/evoting-nfc/android/src/main/AndroidManifest.xml` | Permisiunea NFC. |
| `modules/evoting-nfc/.../EvotingNfcModule.kt` | Citirea CEI: `isSupported`, `isEnabled`, `readDocument(can)` (modul cititor NFC → IsoDep → PACE cu CAN-ul → DG1 și SOD, întoarse în base64), `cancel`. Nu încearcă niciodată PIN-ul. |
| `modules/evoting-ocr/...` | La fel, pentru OCR: `recognizeText(uri)` cu ML Kit, local, întoarce textul brut. |

**Codul**

| Fișier | Ce face |
| --- | --- |
| `src/app/_layout.tsx` | Rama aplicației: polyfill-ul pentru numere aleatoare (importat primul), sesiunea alegătorului, navigarea și titlurile ecranelor. |
| `src/app/index.tsx` | Lista scrutinelor, cele deschise primele, cu eticheta „Înregistrat” sau „Ai votat”. |
| `src/app/scrutin/[id]/index.tsx` | Pagina scrutinului: starea, intervalul și cât mai e, pașii alegătorului, butonul principal (înregistrează-te / votează / verifică), candidații sau rezultatul. |
| `src/app/scrutin/[id]/inregistrare.tsx` | Alegerea metodei: scanarea buletinului (optic) sau cipul CEI (criptografic); la un scrutin „doar NFC”, scanarea nu mai e oferită, iar o notă explică de ce. Plus explicația despre confidențialitate și despre re-înregistrarea după schimbarea telefonului. |
| `src/app/scrutin/[id]/ocr.tsx` | Înregistrarea prin OCR: camera + modulul nativ, text MRZ introdus de mână sau doar CNP; afișează datele citite și cifrele de control; generează credentialul și trimite înregistrarea. |
| `src/app/scrutin/[id]/nfc.tsx` | Înregistrarea prin NFC: CAN-ul, citirea cipului, trimiterea DG1 + SOD la server; cu backend-ul simulat și fără modul nativ, simulează cipul. |
| `src/app/scrutin/[id]/vot.tsx` | Votul: alegerea opțiunii, criptarea pe telefon, confirmarea, auditul Benaloh (opțional), trimiterea. |
| `src/app/scrutin/[id]/confirmare.tsx` | Chitanța: poziția pe board, ora, codul de urmărire (copiabil). |
| `src/app/scrutin/[id]/verifica.tsx` | Verificarea pe board: caută codul, recalculează hash-urile local și le compară cu amprenta păstrată la trimitere. |
| `src/components/ui/` | Componentele de bază: `Screen` (ecran derulabil), `Card`, `Button` și `LinkButton`, `Tag` și `StatusTag`, `Notice` (mesaj colorat), `Field` (câmp cu etichetă și eroare), `Typography` (`H1`, `H2`, `P`), `ModeBanner` (backend simulat sau adresa serverului), `Loading`, `tones.ts` (culorile pe tonuri), `index.ts`. |
| `src/components/election/` | `VoterSteps` (cei trei pași, bifați), `PrimaryAction` (ce poate face alegătorul acum), `CandidateList` (cu nota despre votul alb), `ResultCard` (rezultatul, votul alb la final), `IntervalNote` („votul se închide peste…”). |
| `src/components/identity/` | `MrzSummary` (datele citite și fiecare cifră de control), `ModeTabs` (cameră / text MRZ / doar CNP), `KeyValueRow`. |
| `src/components/vote/` | `CandidateOption` (o opțiune cu buton radio; votul alb cu chenar punctat), `BallotReview` (confirmarea: opțiunea, amprenta buletinului, butoanele), `BenalohAudit` (auditul și datele de copiat). |
| `src/lib/polyfills.ts` | Adaugă `crypto.getRandomValues` în Hermes, din `expo-crypto`. |
| `src/lib/session.tsx` | Ce ține telefonul per scrutin: credentialul, înregistrarea și chitanța, **niciodată opțiunea aleasă**. În `SecureStore` pe Android, în `localStorage` pe web. |
| `src/lib/native.ts` | Încarcă modulele native dacă există (în Expo Go și pe web lipsesc, iar ecranele trec pe variantele manuale). |
| `src/lib/theme.ts`, `format.ts`, `useAsync.ts` | Culorile, formatările comune (din `@evoting/api`), hook-ul de încărcare. |
| `src/api/index.ts`, `config.ts` | Alege clientul real (`EXPO_PUBLIC_API_URL`) sau backend-ul simulat (cu mai puțini votanți de demonstrație, pentru că telefonul criptează mai încet). |

## 4.8 `tools`: programele din linia de comandă

| Fișier | Ce face |
| --- | --- |
| `README.md` | Comenzile celor trei programe. |
| `trustee/src/cli.ts` | Programul `evoting-trustee`: citește argumentele și pornește una din comenzi. |
| `trustee/src/commands/keygen.ts` | Generează local xᵢ, scrie fișierul de cheie **înainte** de trimitere (ca cheia să nu se poată pierde), apoi trimite doar Yᵢ cu dovada. Refuză să suprascrie un fișier existent. |
| `trustee/src/commands/decrypt.ts` | După închidere: deschide fișierul de cheie (cu parola, dacă e criptat), descarcă tot, **verifică board-ul și agregatul** cu verificatorul public (pe toate nucleele, de la 32 de buletine în sus), apoi calculează și trimite decriptarea parțială. |
| `trustee/src/commands/status.ts` | Starea scrutinului și a fiecărui trustee. |
| `trustee/src/key-file.ts` | Fișierul de cheie: permisiuni 600, niciodată suprascris, opțional **criptat cu parolă** (scrypt pentru a obține cheia din parolă, AES-256-GCM pentru criptare; o parolă greșită sau un fișier modificat sunt detectate). |
| `trustee/src/password.ts` | Parola: din `--password`, din `TRUSTEE_KEY_PASSWORD` sau cerută în terminal fără ecou (de două ori la creare, minimum 8 caractere). |
| `trustee/src/output.ts` | Bife verzi, cruci roșii, oprirea cu eroare (prin `CliExit`, fără `process.exit()`; vezi 9.16). |
| `verifier/src/cli.ts` | Programul `evoting-verify`: verificarea completă sau `audit-ballot`. |
| `verifier/src/commands/verify.ts` | Descarcă pachetul de audit (sau îl citește dintr-un fișier salvat), rulează `verifyElection` **pe mai multe fire** (`--workers N`; implicit toate nucleele, dar cel mult un fir la 16 buletine; `--workers 1` = un singur fir), afișează fiecare pas cu timpul lui și numărul de fire. Codul de ieșire: 0 dacă trece tot, 1 dacă pică ceva, 2 la o eroare de utilizare. |
| `verifier/src/commands/audit-ballot.ts` | Provocarea Benaloh dintr-un fișier exportat de aplicație. Codul 0: corect; 1: aplicația a criptat altceva; 2: fișierul e incomplet sau nu e JSON (nu se poate verifica). |
| `verifier/src/output.ts` | Culori și oprirea cu eroare (prin `CliExit`, fără `process.exit()`). |
| `simulator/src/cli.ts` | `evoting-simulate`: alegeri complete cu alegători sintetici contra serverului real, în opt etape, cu metrici de performanță și raport JSON. Verificarea publică se măsoară de două ori: pe un fir și pe toate nucleele (`--workers N`), cu accelerarea și confirmarea că rapoartele sunt identice. |
| `simulator/src/lib/` | `metrics.ts` (medie, mediană, percentila 95, maximul), `pool.ts` (alegători în paralel), `synthetic.ts` (CNP-uri și MRZ-uri fictive reproductibile, cipuri de test), `output.ts`. |
| `*/package.json`, `*/tsconfig.json`, `*/.gitignore` | Configurarea fiecărui program; `bin` dă numele comenzii. |

## 4.9 `demos`: demonstrațiile

| Fișier | Ce face |
| --- | --- |
| `attacks/src/cnp-dictionary.ts` | Demonstrația 1: SHA-256(CNP) se sparge prin încercări; HMAC fără cheie nu. |
| `attacks/src/deterministic-encryption.ts` | Demonstrația 2: votul ghicit la RSA „de manual”; imposibil la ElGamal. |
| `attacks/src/bsgs-vs-key.ts` | Demonstrația 3: totalurile se află în milisecunde, cheia secretă nu. |
| `attacks/src/api-bruteforce.ts` | Demonstrația 4: ghicirea token-ului comisiei oprită de limitarea de rată (401, apoi 429). |
| `attacks/src/tamper-board.ts` | Demonstrația 5: un administrator modifică un buletin direct în baza de date; verificatorul arată exact care; la final se restaurează. |
| `attacks/README.md`, `package.json`, `tsconfig.json` | Comenzile și configurarea. |
| `macheta/` | Prima variantă a criptografiei (ElGamal pe grupul MODP-2048, într-o pagină HTML, cu 22 de teste proprii), păstrată pentru capitolul despre evoluția soluției. |

## 4.10 `docs`: documentația

| Fișier | Ce conține |
| --- | --- |
| `README.md` | Indexul documentației. |
| `GHID-COMPLET.md` | Acest ghid. |
| `DOCUMENTATIE.md` | Documentația tehnică, pentru lucrare: formulele, pașii, modelul de amenințare, rezultatele măsurate. |
| `EXPLICATIE.md` | Ce s-a construit, în ordinea construirii, și fiecare fișier; un vot urmărit prin sistem; testul cu buletinul real. |
| `ANALIZA.md` | Ce e bun, ce nu, ce s-a rezolvat și planul pe etape. |
| `explicatii/` | Șapte capitole de la zero: conceptele, tehnologiile, cererile HTTP, codul linie cu linie, harta fișierelor, performanța și testele, glosarul. |
| `evaluare/simulare-*.json` | Rapoartele simulărilor cu 100, 1.000 și 10.000 de alegători. |
| `evaluare/verificare-paralela-18-nov.json` | Verificarea aceluiași pachet de 1.000 de buletine pe 1, 2, 4, 8 și 16 fire (mediana a trei rulări, plus rulările brute). |

---

# Partea 5. Un vot urmărit prin cod, de la deget la rezultat

Aici reluăm povestea din Partea 1.4, dar de data asta cu fișierele, funcțiile, rutele HTTP și tabelele atinse la fiecare pas. Dacă deschizi fișierele în paralel, vezi exact unde se întâmplă fiecare lucru.

O **cerere HTTP** e un mesaj trimis de un program (site, telefon, CLI) serverului: o metodă (`GET` = citește, `POST` = trimite/creează, `PATCH` = modifică, `DELETE` = șterge), o adresă (ruta, de exemplu `/elections/abc/open`), opțional un **antet** `Authorization: Bearer <token>` și un corp JSON. Serverul răspunde cu un **cod de stare** (200 = bine, 201 = creat, 204 = bine, fără conținut, 400 = date greșite, 401 = neautentificat, 403 = interzis, 404 = nu există, 409 = conflict cu starea curentă, 429 = prea multe cereri) și un corp JSON.

```
 telefon / site / CLI            serverul (NestJS)                              PostgreSQL
 ────────────────────            ─────────────────────────────────────          ──────────
 @evoting/api                    controller  ──▶  guard (cine are voie?)
 (client/http.ts)   ── HTTPS ──▶     │            limită de rată
                                     ▼
                                 serviciu  ──▶  validate.ts (datele)
                                     │          @evoting/crypto (dovezi)
                                     ▼
                                 Database.transaction(...)  ──── SQL ────▶      tabele
                    ◀── JSON ──  răspuns
```

## Pasul 1. Comisia intră în panou

- **Site:** `AdminGate.tsx` cere token-ul și îl pune în `sessionStorage` (`api/admin.ts`).
- **Cerere:** `GET /admin/check` cu `Authorization: Bearer <token>`.
- **Server:** `AdminGuard.identify` (`admin/admin.guard.ts`) compară token-ul cu `ADMIN_TOKEN` în timp constant; dacă nu e el, caută `SHA-256(token)` în `commission_members`, doar printre membrii nerevocați. Ruta are limita strictă de rată, deci ghicirea e oprită după 30 de încercări pe minut.
- **Răspuns:** `{ id, name, role }`. Site-ul îl ține în contextul React: un observator vede pagini fără butoane de acțiune.

## Pasul 2. Comisia creează scrutinul

- **Site:** `ElectionForm.tsx` → `api.createElection(input)`.
- **Cerere:** `POST /elections` cu titlul, intervalul, candidații, trustees, `allowBlank` și `requireNfc` („doar NFC”).
- **Server:** `CommissionGuard` (rolul `comisie`) → `ElectionsService.create` (`elections/elections.service.ts`):
  1. verifică datele cu `validate.ts`: titlu de cel mult 200 de caractere, închiderea după deschidere, între 2 și 50 de candidați, între 1 și 10 trustees;
  2. construiește ID-ul din titlu (`slug`, fără diacritice) plus 6 caractere aleatoare;
  3. într-o **tranzacție**: `INSERT` în `elections`, în `candidates` (votul alb, dacă e cerut, ultimul, cu `kind = 'blank'`) și în `trustees` (doar `SHA-256` al fiecărui token), plus o linie în `audit_log` (`election.create`, actorul `comisie:<nume>`).
- **Răspuns:** scrutinul și token-urile trustees **în clar, o singură dată**. Site-ul le afișează ca un rând de comandă pentru fiecare trustee (`parts/TrusteeTokens.tsx`).
- **Corecturi:** cât timp scrutinul e în `draft`, `PATCH /elections/:id` (`ElectionsService.update`) schimbă titlul, intervalul, candidații sau votul alb, iar `DELETE /elections/:id` (`remove`) șterge tot. Ambele blochează întâi rândul scrutinului (`SELECT … FOR UPDATE`), ca o deschidere simultană să nu se amestece cu modificarea.

## Pasul 3. Fiecare trustee își generează cheia

- **Pe calculatorul trustee-ului:** `npx evoting-trustee keygen --api … --election … --trustee … --token … --encrypt` (`tools/trustee/src/commands/keygen.ts`):
  1. citește scrutinul (`GET /elections/:id`) și verifică faptul că trustee-ul există și nu și-a trimis deja cheia;
  2. cere o parolă (`password.ts`), dacă s-a cerut criptarea;
  3. `generateTrusteeKey` (`packages/crypto/src/trustee.ts`): xᵢ aleator, Yᵢ = xᵢ·G, dovada Schnorr legată de scrutin și de trustee;
  4. **scrie fișierul de cheie înainte de trimitere** (`key-file.ts`: permisiuni 600, niciodată suprascris, cheia secretă criptată cu scrypt + AES-256-GCM dacă există parolă).
- **Cerere:** `POST /elections/:id/trustees` cu `Authorization: Bearer <token-trustee>` și `{ trusteeId, publicKeyShare, proof }`.
- **Server:** `TrusteesService.submitKey`: blochează scrutinul, găsește trustee-ul după `SHA-256(token)`, verifică că token-ul e chiar al acestui trustee, că scrutinul e în configurare, că nu a mai trimis cheia și că **dovada Schnorr** e validă. Salvează Yᵢ. Dacă toți au trimis, calculează **Y = ΣYᵢ** și îl scrie în `elections.public_key`.

## Pasul 4. Lista de eligibili și deschiderea

- **Site:** `parts/EligibleImport.tsx` → `POST /elections/:id/eligible`, corp `text/csv` (un CNP pe linie).
- **Server:** `ElectionsService.importEligible`:
  1. pentru fiecare linie: `isValidCnp`; cele invalide apar în răspuns doar ca număr de linie și o **mască** (`50…12`), ca un CNP greșit să nu ajungă în jurnale;
  2. `cnpHmac(CNP_HMAC_KEY, cnp)`; CNP-ul în clar nu se scrie nicăieri;
  3. într-o tranzacție, permisă în `draft` **sau** `open`: `INSERT … ON CONFLICT DO NOTHING` în `eligible_voters`, câte 1.000 deodată; în jurnal intră doar numerele (importați, duplicate, invalide).
  4. dacă cineva a fost adăugat din greșeală, modul „Scoate” trimite CSV-ul la `POST /elections/:id/eligible/remove`: cine n-a votat e scos (cu tot cu înregistrare, dacă are), cine a votat rămâne (9.18).
- **Deschiderea:** `POST /elections/:id/open` → `ElectionsService.open`: doar din `draft`, cu toate cheile trimise, lista nevidă și **data închiderii încă în viitor**. Starea devine `open`.

## Pasul 5. Ana se înregistrează

**Varianta OCR** (`apps/mobile/src/app/scrutin/[id]/ocr.tsx`):

1. camera fotografiază MRZ-ul, modulul Kotlin `EvotingOcr` întoarce textul, `parseMrz` (`packages/api/src/identity/mrz.ts`) verifică cifrele de control și reconstituie CNP-ul; Ana vede datele în `MrzSummary`;
2. `generateCredential()` creează perechea Ed25519 **pe telefon**;
3. `POST /elections/:id/register/ocr` cu `{ cnp, credentialPubkey }`.

**Varianta NFC** (`nfc.tsx`): `nfcModule.readDocument(can)` (Kotlin, JMRTD) întoarce DG1 și SOD, apoi `POST /elections/:id/register/nfc` cu `{ dg1, sod, credentialPubkey }`. Pe server, `RegistrationService.registerNfc` face întâi **Passive Authentication** (`nfc/passive-auth.ts`), apoi extrage CNP-ul din DG1 și verifică faptul că actul nu e expirat.

**Pe server, în ambele cazuri** (`RegistrationService.register`):

1. cheia publică trebuie să fie un punct Ed25519 valid;
2. calculează `HMAC(CNP)`; blochează scrutinul (înregistrarea e permisă în `draft` și `open`); la un scrutin „doar NFC”, o înregistrare prin OCR e refuzată aici, cu `403`;
3. CNP-ul trebuie să fie în `eligible_voters`, altfel `403`;
4. dacă persoana e **deja înregistrată**: dacă a votat → `409`; dacă noua înregistrare are un nivel de încredere mai mic (OCR peste NFC) → `409`; altfel șterge înregistrarea veche și provocările ei (**re-înregistrare**, de exemplu după schimbarea telefonului);
5. `INSERT` în `registrations`; în jurnal intră doar credentialul și metoda, **nu** HMAC-ul (care ar lega credentialul de persoană).

**Pe telefon:** `session.tsx` păstrează credentialul și înregistrarea în `SecureStore`.

## Pasul 6. Ana își criptează votul

- **Telefon:** `vot.tsx` → `prepareBallot(election, credential, poziție)` (`packages/api/src/voter.ts`) → `encryptBallot` (`packages/crypto/src/ballot.ts`):
  1. pentru fiecare opțiune j: un r nou, criptotextul Enc(1) pentru opțiunea aleasă și Enc(0) pentru celelalte, plus **dovada 0/1**, cu contextul (scrutin, cheie, număr de opțiuni, credential, poziția j);
  2. **dovada sumei** (Chaum-Pedersen) pe suma criptotextelor;
  3. semnătura Ed25519 peste amprenta buletinului (`ballotDigest`).
- **Opțional, auditul Benaloh:** `BenalohAudit.tsx` → `auditBallot` verifică local, iar datele (criptotextele, opțiunea, r-urile) se pot copia și verifica pe site (`tabs/BenalohTab.tsx`) sau cu `evoting-verify audit-ballot`. Buletinul auditat se aruncă; votul se recriptează.
- **Confirmarea:** `BallotReview.tsx` arată opțiunea aleasă și amprenta buletinului.

## Pasul 7. Ana se autentifică

`submitBallot` (`packages/api/src/voter.ts`) cheamă întâi `authenticate`:

1. `POST /auth/challenge` cu `{ electionId, credentialPubkey }` → `AuthService.challenge`: credentialul trebuie să fie înregistrat; șterge provocările expirate; inserează în `auth_challenges` un nonce de 32 de octeți, valabil 2 minute;
2. telefonul semnează `evoting/v1/auth|<scrutin>|<credential>|<nonce>`;
3. `POST /auth/verify` cu `{ challengeId, signature }` → `AuthService.verify`: `DELETE … RETURNING` (provocarea se **consumă** la prima încercare, reușită sau nu), verifică expirarea și semnătura, apoi semnează o sesiune HMAC de 10 minute (`signSession`).

## Pasul 8. Ana trimite votul

- **Cerere:** `POST /elections/:id/ballots` cu `Authorization: Bearer <sesiune>` și buletinul.
- **Server:** `BallotsService.cast` (`ballots/ballots.service.ts`):
  1. verifică sesiunea (semnătura HMAC și expirarea) și faptul că sesiunea și buletinul sunt pentru acest scrutin și acest credential;
  2. citește parametrii (`ElectionsRepository.params`): scrutinul trebuie să fie `open`, iar ora curentă **între deschidere și închidere** (altfel `409 Votul nu a început încă` / `Votul s-a încheiat`);
  3. **în afara tranzacției**, pentru că durează ~25 ms: `verifyBallot` (forma, semnătura, toate dovezile);
  4. **în tranzacție, cu rândul scrutinului blocat** (`SELECT … FOR UPDATE`): scrutinul încă deschis, credentialul înregistrat, n-a mai votat; citește ultima intrare; ia **ora primirii acum**, după blocare (`boardTime`, niciodată mai devreme decât intrarea anterioară), și verifică din nou intervalul; `appendEntry` calculează poziția, hash-ul anterior, `ballotHash` și hash-ul intrării; `INSERT` în `ballots`.
- **Dacă două voturi cu același credential sosesc deodată:** blocarea le pune la coadă, iar constrângerea `UNIQUE (election_id, credential_pubkey)` o oprește pe a doua chiar și în cel mai rău caz → `409`.
- **Răspuns:** chitanța `{ seq, trackingCode, ballotHash, receivedAt }`. Telefonul o păstrează în `SecureStore` și afișează `confirmare.tsx`.

## Pasul 9. Ana își verifică votul

- **Telefon:** `verifica.tsx` → `GET /elections/:id/board/:cod` → `checkOwnEntry` (`packages/crypto/src/board.ts`): recalculează `ballotHash` din conținutul intrării, îl compară cu amprenta păstrată la trimitere, recalculează hash-ul intrării și îl compară cu codul. Pe site, `tabs/BoardTab.tsx` face aceeași verificare în browser.

## Pasul 10. Închiderea

- **Manual:** `POST /elections/:id/close` (comisia).
- **Automat:** `AutoCloseService` (`elections/auto-close.service.ts`) rulează la fiecare minut `closeExpired`, care închide scrutinele deschise cu data închiderii trecută; actorul din jurnal e `server`, cu `automatic: true`.
- **În ambele cazuri,** `ElectionsService.close`: blochează scrutinul, citește toate criptotextele de pe board, `computeAggregate` adună pe coloane (câte o sumă per opțiune), scrie agregatul în `elections.aggregate`, starea devine `closed`, iar în jurnal intră și ultimul `seq:hash`.

## Pasul 11. Comisia publică hash-ul board-ului

Pe tot parcursul votului, panoul afișează `poziție:hash` al ultimei intrări (`parts/BoardHead.tsx`, ruta `GET /elections/:id/board-head`). Comisia îl publică periodic pe un canal independent. Orice verificare ulterioară poate primi valoarea cu `--head` și verifică faptul că istoria n-a fost rescrisă.

## Pasul 12. Trustees decriptează

- **Pe calculatorul trustee-ului:** `npx evoting-trustee decrypt --key <fișier> --token <token>` (`commands/decrypt.ts`):
  1. deschide fișierul de cheie (cere parola dacă e criptat);
  2. descarcă pachetul de audit (`GET /elections/:id/audit-bundle`) și verifică faptul că scrutinul e închis, cheia îi aparține și n-a trimis deja;
  3. **rulează verificatorul public** pe tot (cheile, lanțul, credentialele, dovezile, agregatul). Dacă ceva pică, se oprește: altfel un server rău-intenționat i-ar putea da spre decriptare un buletin individual în loc de agregat;
  4. `partialDecrypt`: Dᵢⱼ = xᵢ·Aⱼ pentru fiecare opțiune, cu dovada Chaum-Pedersen.
- **Cerere:** `POST /elections/:id/tally/partial`.
- **Server:** `TallyService.submitPartial`: verifică token-ul, starea `closed`, dovezile (`verifyPartialDecryption`), salvează în `partial_decryptions`. După ultimul trustee, `publishResult`: `combinePartialDecryptions` (Bⱼ − ΣDᵢⱼ = Tⱼ·G, apoi baby-step giant-step), `INSERT` în `results`, starea devine `tallied`.

## Pasul 13. Oricine verifică

- **Site:** `tabs/VerificationTab.tsx` (sau butonul din procesul-verbal, `ProcesVerbal.tsx`). **Linia de comandă:** `npx evoting-verify --api … --election … [--head SEQ:HASH]`.
- **Server:** `GET /elections/:id/audit-bundle` → `ElectionsRepository.auditBundle`: scrutinul, înregistrările publice (doar credentialele), tot board-ul, agregatul, decriptările parțiale și rezultatul, citite într-o **singură tranzacție `REPEATABLE READ`**, ca un vot sosit între două citiri să nu facă pachetul inconsistent.
- **Verificare:** `verifyElection` (`packages/crypto/src/verify.ts`), în șase pași:

| Pas | Ce reface |
| --- | --- |
| 0. Cheile | Dovada Schnorr a fiecărui Yᵢ și Y = ΣYᵢ. |
| 1. Lanțul | Pozițiile 1, 2, 3…, fiecare `prevHash`, `ballotHash` recalculat, hash-ul fiecărei intrări; orele primirii crescătoare și în intervalul scrutinului; opțional, hash-ul publicat independent. |
| 2. Credentialele | Fiecare credential e în lista publică de înregistrări, votează o singură dată, semnătura buletinului e validă. |
| 3. Dovezile | Dovezile 0/1 și ale sumei, pentru fiecare buletin. |
| 4. Agregatul | Recalculat de la zero și comparat cu cel publicat. |
| 5. Decriptarea | Dovezile fiecărui trustee, combinarea, totalurile publicate și suma lor față de numărul de buletine. |

Fiecare problemă are un loc exact („buletinul #42: Hash-ul anterior nu corespunde intrării dinainte”). Verificatorul CLI iese cu codul 0 doar dacă trec toate.

---

# Partea 6. Baza de date: cele unsprezece tabele

Baza de date e **PostgreSQL**. Tabelele se creează automat la pornirea serverului, din fișierele `apps/backend/migrations/*.sql`, aplicate în ordine și o singură dată (`src/db/migrate.ts` ține evidența în tabela tehnică `schema_migrations`). Pe toate tabelele e pornit **Row Level Security** fără reguli (migrările 002 și 003), ca pe Supabase datele să nu fie accesibile prin API-ul public al platformei.

Câteva cuvinte SQL folosite mai jos: **PK** (*primary key*, cheia primară: identifică unic un rând), **FK** (*foreign key*: valoarea trebuie să existe în altă tabelă), **UNIQUE** (nu pot exista două rânduri cu aceeași valoare), **CHECK** (o condiție pe care orice rând trebuie s-o respecte), **jsonb** (o coloană cu un obiect JSON).

| Tabela | Ce ține | Reguli importante | Cine scrie |
| --- | --- | --- | --- |
| `elections` | ID, titlu, stare (`draft`, `open`, `closed`, `tallied`), `opens_at`, `closes_at`, cheia publică Y, `require_nfc` („doar NFC”, migrarea 004), agregatul (jsonb), data creării | `CHECK (closes_at > opens_at)`; starea doar din cele patru valori | comisia (creare, modificare, ștergere, deschidere, închidere), trustees (Y), serverul (închiderea automată) |
| `candidates` | ID, scrutinul, nume, descriere, poziția în vectorul de vot, `kind` (`candidate` sau `blank`) | `UNIQUE (election_id, position)` | comisia |
| `trustees` | ID, scrutinul, nume, poziție, `token_hash` (SHA-256 al token-ului), Yᵢ, dovada Schnorr | **niciodată xᵢ**; token-ul în clar nu se păstrează | comisia (creare), trustee-ul (Yᵢ) |
| `eligible_voters` | perechea (scrutin, `cnp_hmac`) | PK pe pereche: un CNP o singură dată per scrutin | comisia (importul) |
| `registrations` | scrutinul, `cnp_hmac`, credentialul (cheia publică Ed25519), metoda (`ocr`/`nfc`), nivelul (`optic`/`criptografic`), data | `UNIQUE (scrutin, cnp_hmac)`: o singură înregistrare activă per persoană; `UNIQUE (scrutin, credential)`; FK spre `eligible_voters` | alegătorul |
| `ballots` | **board-ul**: scrutinul, `seq` (poziția), credentialul, criptotextele, dovezile, semnătura, `ballot_hash`, `prev_hash`, `hash` (codul de urmărire), `received_at` (text ISO, exact cum intră în hash) | PK `(scrutin, seq)`; `hash` unic; `UNIQUE (scrutin, credential)`: un singur vot per credential; FK spre `registrations`; **trigger** care refuză `UPDATE` și `DELETE` | alegătorul (prin server) |
| `partial_decryptions` | scrutinul, trustee-ul, Dᵢⱼ (`shares`), dovezile, data | PK `(scrutin, trustee)`: o decriptare per trustee | trustee-ul |
| `results` | scrutinul, totalurile (jsonb), numărul de buletine, data publicării | un rând per scrutin | serverul, după ultima decriptare |
| `audit_log` | ID, scrutinul (gol pentru acțiunile fără scrutin), actorul (`comisie:Maria Pop`, `trustee:…-t1`, `alegător`, `server`), acțiunea, detaliile (jsonb), ora | fără CNP-uri și fără HMAC-uri | toți |
| `commission_members` | ID, nume, rol (`comisie`/`observator`), `token_hash`, data creării, data revocării | `token_hash` unic; rândul nu se șterge la revocare | comisia |
| `auth_challenges` | ID, scrutinul, credentialul, nonce-ul, expirarea | se șterg la folosire, la expirare și la ștergerea scrutinului (`ON DELETE CASCADE`) | serverul, la autentificare |

**Ce leagă tabelele, pe scurt:** un rând din `ballots` cere un rând în `registrations` (cu același credential), care cere un rând în `eligible_voters` (cu același HMAC). Deci baza de date însăși refuză un vot de la cineva neînregistrat sau o înregistrare a cuiva care nu e pe listă, chiar dacă codul serverului ar avea o greșeală.

**Unde e identitatea:** singura legătură cu persoana reală e `cnp_hmac`, iar cheia HMAC nu e în bază. Un test e2e caută fiecare CNP de test în toate tabelele, ca text, și nu-l găsește.

**Ce știe totuși cine administrează serverul:** cu cheia HMAC (din configurarea serverului) și cu lista de CNP-uri importată, operatorul poate afla **cine** s-a înregistrat și cine a votat (participarea), dar **nu și cum** a votat: conținutul votului e criptat cu cheia trustees. Așa e și la Helios și la votul pe hârtie (lista semnată arată cine a votat).

---

# Partea 7. API-ul: toate rutele serverului

Serverul are **29 de rute**. Toate cer și întorc JSON, cu o excepție: importul de eligibili primește `text/csv`.

**Publice** (fără niciun token):

| Metodă | Ruta | Ce întoarce |
| --- | --- | --- |
| GET | `/elections` | Lista scrutinelor, cu candidații, trustees și statisticile. |
| GET | `/elections/:id` | Un scrutin. |
| GET | `/elections/:id/board` | Tot board-ul (pentru arhivă). |
| GET | `/elections/:id/board/page?page=1&size=50` | O pagină din board, cele mai noi intrări primele (cel mult 500 pe pagină). |
| GET | `/elections/:id/board/:cod` | Intrarea cu acest cod de urmărire (404 dacă nu există). |
| GET | `/elections/:id/board-head` | Poziția și hash-ul ultimei intrări. |
| GET | `/elections/:id/registrations` | Credentialele înregistrate (fără nicio legătură cu persoana). |
| GET | `/elections/:id/tally` | Agregatul și decriptările parțiale primite. |
| GET | `/elections/:id/result` | Rezultatul (404 până la publicare). |
| GET | `/elections/:id/audit-bundle` | Tot ce trebuie verificatorului, dintr-un singur instantaneu. |
| GET | `/health` | `{ ok: true }`, pentru Docker și monitorizare. |

**Comisia** (`Authorization: Bearer <ADMIN_TOKEN sau token de membru>`; „orice rol” include observatorii, „comisie” doar rolul `comisie`):

| Metodă | Ruta | Cine | Ce face |
| --- | --- | --- | --- |
| GET | `/admin/check` | orice rol (limită strictă) | Cine sunt: `{ id, name, role }`. |
| GET | `/admin/members` | orice rol | Lista membrilor (fără token-uri). |
| POST | `/admin/members` | comisie (limită strictă) | Membru nou; token-ul se întoarce o singură dată. |
| DELETE | `/admin/members/:id` | comisie | Revocă un membru. |
| POST | `/elections` | comisie | Creează un scrutin; întoarce token-urile trustees o singură dată. |
| PATCH | `/elections/:id` | comisie | Modifică titlul, intervalul, candidații, votul alb (doar în `draft`). |
| DELETE | `/elections/:id` | comisie | Șterge scrutinul (doar în `draft`). |
| POST | `/elections/:id/eligible` | comisie | Importă CNP-uri dintr-un CSV (în `draft` sau `open`). |
| POST | `/elections/:id/eligible/remove` | comisie | Scoate CNP-uri din listă (CSV, în `draft` sau `open`). Înregistrarea celor care n-au votat se șterge și ea; cine a votat rămâne. Răspunde cu numerele: scoși, înregistrări șterse, absenți din listă, păstrați pentru că au votat, invalide. |
| POST | `/elections/:id/open` | comisie | Deschide votul. |
| POST | `/elections/:id/close` | comisie | Închide votul și publică agregatul. |
| GET | `/elections/:id/audit-log` | orice rol | Jurnalul de audit al scrutinului. |

**Trustees** (`Authorization: Bearer <token-trustee>`, limită strictă):

| Metodă | Ruta | Ce face |
| --- | --- | --- |
| POST | `/elections/:id/trustees` | Trimite Yᵢ cu dovada Schnorr (doar în `draft`). |
| POST | `/elections/:id/tally/partial` | Trimite decriptarea parțială cu dovezile (doar în `closed`). |

**Alegătorul**:

| Metodă | Ruta | Protecție | Ce face |
| --- | --- | --- | --- |
| POST | `/elections/:id/register/ocr` | limită strictă | Înregistrare cu CNP-ul citit din MRZ. |
| POST | `/elections/:id/register/nfc` | limită strictă | Înregistrare cu DG1 + SOD de pe cip. |
| POST | `/auth/challenge` | limită strictă | Cere o provocare pentru un credential înregistrat. |
| POST | `/auth/verify` | limită strictă | Trimite provocarea semnată; primește sesiunea de 10 minute. |
| POST | `/elections/:id/ballots` | sesiunea | Trimite buletinul; primește chitanța cu codul de urmărire. |

**Limitarea de rată:** fiecare adresă IP are voie la 600 de cereri pe minut în general și la 30 pe minut pe rutele cu „limită strictă” (`SENSITIVE_RATE_LIMIT`). Peste limită, serverul răspunde `429`. În spatele lui Caddy, adresa IP reală vine din antetul `X-Forwarded-For` (`TRUST_PROXY=1`). Pentru simulări de încărcare, în care toți alegătorii vin de pe același calculator, se pornește serverul cu `RATE_LIMIT=off`.

**Regulile de stare**, adică ce e permis în fiecare etapă:

| Acțiune | Permisă când |
| --- | --- |
| Modificarea și ștergerea scrutinului, trimiterea cheilor trustees | `draft` |
| Importul eligibililor, înregistrarea și re-înregistrarea | `draft` sau `open` (re-înregistrarea doar înainte de vot) |
| Deschiderea | `draft`, cu toate cheile, lista nevidă și data închiderii în viitor |
| Votul | `open` **și** ora curentă în intervalul `[opensAt, closesAt]` |
| Închiderea | `open`; manual de comisie oricând, automat de server la `closesAt` |
| Decriptarea parțială | `closed` |
| Rezultatul | publicat automat după ultima decriptare; starea devine `tallied` |

---

# Partea 8. Securitatea: cine ar putea trișa și ce îl oprește

Un sistem de vot se analizează întrebând, pentru fiecare participant: „dacă ar vrea să trișeze, ce l-ar opri?”. Acesta e **modelul de amenințare**.

## 8.1 Serverul (sau cine administrează baza de date)

| Ce ar încerca | Ce îl oprește | Unde se vede |
| --- | --- | --- |
| Să citească voturile | Nu are cheia: e împărțită între trustees (n-din-n). | `trustee.ts` |
| Să modifice sau să șteargă un buletin | Lanțul de hash-uri, trigger-ul append-only, codul de urmărire al alegătorului, hash-ul publicat independent. Verificatorul arată exact buletinul modificat. | testul e2e „administrator rău-intenționat”, demonstrația 5 |
| Să adauge un buletin după închidere sau să antedateze o intrare | Orele primirii intră în hash; verificatorul cere ore crescătoare și în intervalul scrutinului; o intrare inserată în mijloc ar rupe lanțul față de hash-ul publicat. | `verifier.test.ts` („timpii primirii”) |
| Să publice un agregat sau un rezultat fals | Oricine recalculează agregatul de pe board; decriptarea vine cu dovezi. | `verifier.test.ts` |
| Să-i ceară unui trustee să decripteze un singur buletin | CLI-ul trustee-ului verifică întâi tot board-ul și agregatul. | `tools/trustee/src/commands/decrypt.ts` |
| Să voteze cu credentiale inventate (*ballot stuffing*) | Fiecare buletin trebuie semnat de un credential din lista publică de înregistrări; numărul de înregistrări e public și se poate compara cu numărul de eligibili. **Protecție parțială:** serverul controlează și înregistrarea. Soluția completă ar fi o autoritate de înregistrare separată (Partea 13). | `verifier.test.ts` („ballot stuffing”) |

## 8.2 Un trustee

| Ce ar încerca | Ce îl oprește |
| --- | --- |
| Să descuie singur un vot | Ar avea nevoie de cheile tuturor celorlalți trustees. |
| Să trimită o decriptare falsă (ca să schimbe rezultatul) | Dovada Chaum-Pedersen pentru fiecare Dᵢⱼ; serverul și verificatorul o resping și spun ce trustee a trișat. |
| Să aleagă o cheie publică „otrăvită” care anulează cheile celorlalți | Dovada Schnorr: cine nu știe xᵢ nu poate publica un Yᵢ cu dovadă validă. |

## 8.3 Un alegător

| Ce ar încerca | Ce îl oprește |
| --- | --- |
| Să dea 2 voturi unui candidat, −1 altuia sau niciun vot | Dovezile 0/1 și dovada sumei; serverul și verificatorul le verifică. |
| Să voteze de două ori | Un singur vot per credential (blocare + `UNIQUE`), o singură înregistrare activă per persoană; verificatorul verifică și el. |
| Să voteze în locul altcuiva | Trebuie să fie pe listă cu CNP-ul celuilalt. Prin NFC, ar avea nevoie de cartea lui fizică (și de CAN). Prin OCR, i-ar ajunge datele din MRZ: de aceea nivelul „optic” e marcat separat, iar comisia poate cere „doar NFC” la scrutinele unde contează (9.21). |
| Să copieze buletinul altcuiva de pe board | Dovezile sunt legate de credentialul original prin context; semnătura e a celuilalt. |
| Să-și „fure” înregistrarea altcuiva cu re-înregistrarea | Doar înainte ca acela să voteze și **doar la același nivel de încredere sau mai mare**: o înregistrare NFC nu poate fi înlocuită prin OCR. La nivelul optic rămâne un risc asumat: cine are datele MRZ ale cuiva poate înlocui credentialul, iar persoana o poate lua înapoi la fel. Fiecare înlocuire apare în jurnalul de audit (`voter.reregister`). |

## 8.4 Un membru al comisiei

| Ce ar încerca | Ce îl oprește |
| --- | --- |
| Să acționeze anonim | Fiecare membru are token propriu; jurnalul de audit reține numele (`comisie:Maria Pop`). |
| Un observator să schimbe ceva | Rutele care schimbă ceva cer rolul `comisie` (`CommissionGuard`); site-ul nici nu afișează butoanele. |
| Un membru plecat să mai intre | Revocarea: token-ul nu mai e acceptat de server. |

## 8.5 Un atacator din afară

| Ce ar încerca | Ce îl oprește |
| --- | --- |
| Să ghicească token-ul comisiei, al unui trustee sau un CNP eligibil | Limitarea de rată (30 de încercări pe minut), token-uri aleatoare lungi (48 de caractere hex), comparații în timp constant. |
| Să intercepteze traficul (Wi-Fi public) | HTTPS prin Caddy; antetul HSTS obligă browserul să folosească doar HTTPS. |
| Să fure baza de date | Nu găsește CNP-uri (doar HMAC), nici token-uri (doar SHA-256), nici chei secrete de trustee (nu sunt pe server). |
| Să pună site-ul într-un cadru ascuns (*clickjacking*) sau să-l facă să interpreteze greșit un fișier | Antetele `X-Frame-Options` și `X-Content-Type-Options` puse de `helmet`. |
| CSRF (să te facă să trimiți o cerere fără să știi) | Token-urile stau în antetul `Authorization`, nu în cookie-uri, deci browserul nu le trimite singur. |

## 8.6 Aplicația de pe telefon

| Ce ar încerca | Ce o oprește |
| --- | --- |
| Să cripteze alt candidat decât cel ales | Provocarea Benaloh: orice buletin poate fi auditat, iar aplicația nu știe dinainte care. |
| Să pretindă că a citit un cip valid | Passive Authentication se face pe server, nu în aplicație. |

## 8.7 Demonstrațiile de atac

Cele cinci demonstrații din `demos/attacks` rulează atacurile pe sistemul propriu, cu date fictive, și arată de ce măsurile de mai sus sunt necesare:

| Demonstrația | Ce arată | Rezultatul măsurat |
| --- | --- | --- |
| 1. CNP | De ce HMAC și nu SHA-256. | SHA-256: CNP găsit după 18.909 încercări, în 68 ms. HMAC fără cheie: nicio potrivire. |
| 2. Vot ghicit | De ce criptarea trebuie să fie randomizată. | RSA fără padding: votul aflat prin comparație. ElGamal: nicio potrivire. |
| 3. BSGS vs. cheie | De ce totalul se află, dar cheia nu. | Totaluri până la 1.000.000 în ≤ 260 ms; căutarea cheii: ~10⁶³ ani. |
| 4. Forță brută pe API | Limitarea de rată. | Primele 30 de încercări primesc 401, următoarele 429. |
| 5. Board modificat în bază | Verificatorul prinde un administrator care umblă direct în PostgreSQL. | Buletinul modificat e arătat la lanț, semnătură, dovezi și agregat; după restaurare, totul trece. |

## 8.8 Ce rămâne neacoperit

Constrângerea și cumpărarea voturilor; un telefon infectat care fură credentialul din SecureStore; atacurile de tip „blocarea serviciului” (prea multe cereri de la multe adrese); clonarea cipului (Chip Authentication nu e implementată). Toate sunt trecute la limitări (Partea 13).

---

# Partea 9. Ce s-a schimbat în ultima etapă (16–18 nov. 2026)

Pe 16 noiembrie codul a fost **reorganizat** fără să i se schimbe comportamentul (fișiere mari împărțite pe module, documentația mutată în `docs/`, analiza scrisă în `ANALIZA.md`). Analiza a găsit 30 de puncte slabe. Etapa următoare a rezolvat o mare parte din ele. Pentru fiecare: problema, soluția, unde e în cod și testul care o dovedește.

## 9.1 Intervalul scrutinului e aplicat, iar serverul închide singur

- **Problema:** `opensAt` și `closesAt` erau doar afișate. Se putea vota după ora închiderii dacă nimeni din comisie nu apăsa „Închide”.
- **Soluția:**
  - serverul refuză votul înainte de deschidere (`409 Votul nu a început încă`) și după închidere (`409 Votul s-a încheiat`);
  - comisia poate deschide mai devreme (scrutinul e „deschis”, dar votul tot așteaptă ora), dar nu poate deschide un scrutin cu ora închiderii deja trecută;
  - la ora închiderii, **serverul închide singur** scrutinul și publică agregatul (verifică la fiecare minut); în jurnal apare actorul `server`;
  - site-ul și aplicația afișează „se închide peste 2 zile”, „începe peste 3 ore” (`Countdown.tsx`, `IntervalNote.tsx`, `intervalPhase` în `packages/api/src/format.ts`).
- **Cod:** `ballots/ballots.service.ts` (`checkInterval`), `elections/elections.service.ts` (`open`, `closeExpired`), `elections/auto-close.service.ts`, `config.ts` (`AUTO_CLOSE_INTERVAL_MS`); la fel în backend-ul simulat (`mock/rules.ts`, `autoClose`).
- **Teste:** `interval.e2e.test.ts` (votul înainte de deschidere, scrutin cu închiderea în trecut, închiderea automată), `mock.test.ts`.

## 9.2 Modificarea și ștergerea scrutinului în configurare

- **Problema:** o greșeală la creare (un nume scris greșit) însemna un scrutin nou și token-uri noi pentru trustees.
- **Soluția:** cât timp scrutinul e în `draft`, comisia îi poate schimba titlul, intervalul, candidații și opțiunea de vot alb (`PATCH /elections/:id`) sau îl poate șterge (`DELETE`). Trustees nu se schimbă, pentru că au primit deja token-urile. La ștergere, jurnalul păstrează acțiunea, fără legătură cu scrutinul dispărut.
- **Cod:** `ElectionsService.update` și `remove`, `pages/commission/CommissionEdit.tsx`, `ElectionForm.tsx` (formularul comun de creare și modificare), butoanele „Modifică” și „Șterge” (cu confirmare) din `CommissionElection.tsx`.
- **Teste:** `commission.e2e.test.ts` („scrutinul se poate modifica și șterge doar în configurare”), `mock.test.ts`.

## 9.3 Lista de eligibili se poate completa și cu votul deschis

- **Problema:** după deschidere nu se mai putea adăuga nimeni (un student înmatriculat târziu, un CSV incomplet).
- **Soluția:** importul e permis în `draft` și în `open`; cei adăugați se pot înregistra imediat.
- **Cod:** `ElectionsService.importEligible`, `parts/EligibleImport.tsx`.
- **Test:** `election-flow.e2e.test.ts` („importul de eligibili … merge și după deschidere”).

## 9.4 Votul alb

- **Problema:** schema cerea exact un candidat ales, deci nu exista abținere explicită.
- **Soluția:** opțiunea „Vot alb” e **un candidat special**, adăugat la sfârșitul listei (`kind = 'blank'`). Criptografia nu se schimbă deloc: rămâne „exact una din n + 1 opțiuni”, cu aceleași dovezi. Rezultatul îl afișează separat, la final.
- **Cod:** migrarea `003` (coloana `kind`), `election.rows.ts` (`candidateRows`), `mock/state.ts` (`buildCandidates`), `candidateLabel` în `format.ts`, `CandidateOption.tsx` (chenar punctat), `ResultTab.tsx` și `ResultCard.tsx`.
- **Teste:** `commission.e2e.test.ts` („votul alb e un candidat special”), `mock.test.ts`.

## 9.5 Re-înregistrarea înainte de vot

- **Problema:** un alegător care își schimba telefonul (sau ștergea aplicația) după înregistrare pierdea credentialul, iar CNP-ul lui rămânea „înregistrat”: nu mai putea vota.
- **Soluția:** o persoană deja înregistrată care **n-a votat** se poate înregistra din nou; credentialul vechi e șters, iar provocările lui sunt anulate. Două reguli: după vot nu se mai poate; o înregistrare NFC nu poate fi înlocuită de una OCR (nivel de încredere mai mic). Răspunsul conține `replacedPrevious: true`, iar jurnalul scrie `voter.reregister`. Aplicația explică regula pe ecranul de înregistrare.
- **Cod:** `RegistrationService.register` (`TRUST_RANK`), `mock/rules.ts` (`register`), `inregistrare.tsx`.
- **Teste:** `election-flow.e2e.test.ts` (înregistrarea optică și NFC, re-înregistrarea refuzată după vot), `mock.test.ts`.

## 9.6 Membrii comisiei, cu roluri

- **Problema:** comisia era un singur token comun; jurnalul nu știa **cine** a apăsat „Închide votul”.
- **Soluția:** `ADMIN_TOKEN` rămâne „rădăcina”. Cu el (sau cu orice membru cu rol `comisie`) se creează **membri** cu nume, rol și token propriu (afișat o singură dată, păstrat doar ca SHA-256). Rolul `observator` vede tot (inclusiv jurnalul), dar nu poate schimba nimic. Un membru se poate **revoca**. Jurnalul scrie `comisie:<nume>`.
- **Cod:** migrarea `003` (`commission_members`), folderul `admin/` (guard-urile, controllerul, serviciul), `contract/admin.ts`, `pages/commission/CommissionMembers.tsx`, `api/admin.ts` (`useAdmin`, `canEdit`).
- **Test:** `commission.e2e.test.ts` („membrii comisiei: token propriu, rol observator doar cu citire, revocare”).

## 9.7 Provocările de autentificare stau în baza de date

- **Problema:** provocările erau ținute în memoria serverului: o repornire le pierdea, iar două instanțe ale serverului nu le vedeau una pe a celeilalte.
- **Soluția:** tabela `auth_challenges`; provocarea se șterge la prima folosire (`DELETE … RETURNING`), iar cele expirate se curăță la fiecare cerere nouă. În producție (`NODE_ENV=production`), serverul avertizează dacă lipsește `SESSION_SECRET` (fără el, sesiunile nu supraviețuiesc unei reporniri).
- **Cod:** migrarea `003`, `auth/auth.service.ts`, `config.ts`.
- **Test:** `election-flow.e2e.test.ts` (provocarea apare în tabelă și dispare după folosire).

## 9.8 Board-ul se citește pe pagini

- **Problema:** board-ul se încărca întreg în pagină; la 10.000 de buletine, zeci de megaocteți.
- **Soluția:** ruta `GET /elections/:id/board/page`, cele mai noi intrări primele; site-ul afișează câte 50. Verificatorul folosește în continuare pachetul de audit complet (are nevoie de tot).
- **Cod:** `ElectionsRepository.boardPage`, `getBoardPage` în client, `tabs/BoardTab.tsx`.
- **Test:** `election-flow.e2e.test.ts` („board-ul se poate citi pe pagini”).

## 9.9 Antete de securitate și avertismente de configurare

- **Soluția:** `helmet` adaugă antetele de securitate la fiecare răspuns; `TRUST_PROXY` face limitarea de rată să vadă adresa reală a clientului în spatele lui Caddy; la pornire, serverul avertizează dacă, în producție, CORS e deschis oricui sau dacă conexiunea la baza de date e criptată, dar fără verificarea certificatului (`DATABASE_CA` lipsă).
- **Cod:** `app.ts`, `config.ts`, `db/pg-options.ts` (`sslWarning`).

## 9.10 Cheia trustee-ului criptată cu parolă

- **Problema:** fișierul cu xᵢ era JSON în clar, protejat doar de permisiunile fișierului.
- **Soluția:** `keygen --encrypt` (sau `--password`, sau variabila `TRUSTEE_KEY_PASSWORD`) criptează cheia secretă: din parolă se obține o cheie cu **scrypt** (lent intenționat, ca ghicirea parolei să fie scumpă), iar cheia secretă se criptează cu **AES-256-GCM** (care detectează și orice modificare a fișierului). `decrypt` cere parola. Fără parolă, comportamentul vechi rămâne valabil.
- **Cod:** `tools/trustee/src/key-file.ts`, `password.ts`.
- **Test:** `cli.e2e.test.ts` (un trustee cu cheie criptată, unul fără; fără parolă sau cu parola greșită, decriptarea refuză să pornească).

## 9.11 Verificatorul verifică și orele

- **Problema:** `receivedAt` intra în hash, dar nimeni nu verifica dacă orele au sens. Un server ar fi putut strecura un buletin cu o oră de după închidere.
- **Soluția:** la pasul „lanț”, verificatorul cere ore valide, crescătoare de la o intrare la alta și în intervalul `[opensAt, closesAt]` al scrutinului.
- **Cod:** `packages/crypto/src/verify.ts`.
- **Test:** `verifier.test.ts` („timpii primirii trebuie să fie ordonați și în intervalul scrutinului”).

## 9.12 HTTPS în Docker Compose

- **Problema:** în Compose, site-ul și API-ul mergeau pe HTTP simplu; token-ul comisiei ar fi circulat în clar.
- **Soluția:** un al patrulea container, **Caddy**, primește totul pe `https://localhost`: site-ul la `/`, API-ul la `/api`. Pentru `localhost` folosește un certificat local; pentru un domeniu real obține singur unul de la Let's Encrypt. CORS-ul e închis implicit la originile site-ului.
- **Cod:** `infra/Caddyfile`, `docker-compose.yml`, `.env.example`.

## 9.13 Calitatea codului

- `prettier` și `oxlint` la rădăcină, pentru tot proiectul; CI-ul rulează `lint`, `format:check`, testele, build-ul și `npm audit`.
- Etichetele și formatările comune site-ului și aplicației (stările, datele, duratele, procentele) au fost mutate în `packages/api/src/format.ts`, deci nu mai sunt duplicate.
- CLI-urile reale (trustee și verificator) sunt testate ca procese separate, contra serverului de test (`cli.e2e.test.ts`).
- Numărul de teste a crescut de la 78 la **93**.

## 9.14 Reparate la verificarea finală (18 nov.)

La verificarea finală a codului de mai sus au apărut două probleme, reparate:

1. **Ora primirii putea ieși în ordine inversă.** Serverul lua ora *înainte* să blocheze board-ul, iar verificarea dovezilor durează ~25 ms. Două voturi simultane (sau două instanțe ale serverului cu ceasuri ușor diferite) puteau intra pe board în ordinea inversă orelor lor, iar verificatorul, care cere acum ore crescătoare (9.11), ar fi raportat fals o manipulare. Acum ora se ia **după** blocare și nu poate fi mai devreme decât a intrării anterioare (`boardTime` în `ballots.service.ts`). Două teste noi în `interval.e2e.test.ts`: 16 voturi trimise deodată primesc ore crescătoare și trec de verificator; ceasul unei instanțe rămase în urmă nu dă o oră mai veche decât a intrării anterioare.
2. **Docker marca serverul „unhealthy”** deși funcționa: verificarea de sănătate chema `localhost`, care în container înseamnă adresa IPv6 `::1`, iar serverul ascultă pe IPv4. Acum cheamă `127.0.0.1`. Tot sistemul a fost apoi pornit cu Docker Compose și un scrutin complet a trecut prin HTTPS (Caddy), cu limitarea de rată activă: creare, chei, import, înregistrare, vot, închidere, decriptare, rezultat corect și verificare publică.

## 9.15 Verificarea în paralel (18 nov., a doua verificare)

**Problema.** Verificatorul public lua ~25–30 ms per buletin pe un singur fir: ~30 de secunde la 1.000 de buletine, ~4 minute la 10.000 (punctul 22 din analiză). Aproape tot timpul se duce pe semnătura și pe cele patru dovezi ZK ale fiecărui buletin.

**Ideea.** Buletinele sunt **independente** unul de altul: semnătura și dovezile buletinului #7 nu depind de buletinul #6. Deci se pot verifica în același timp, pe nuclee diferite ale procesorului. Doar lanțul de hash-uri (care chiar depinde de intrarea anterioară, dar e rapid) rămâne pe firul principal.

**Cum e făcut.**

- `packages/crypto/src/parallel.ts` conține partea comună: verificatorul nu mai cheamă direct funcțiile de verificare, ci un `BallotWork` cu trei operații (semnăturile, dovezile, agregatul). Implicit, `sequentialWork` face totul pe firul curent, exact ca înainte (așa rulează și pe telefon). `createParallelWork` e un **bazin de lucrători**: împarte board-ul în bucăți (cam patru per fir, între 4 și 64 de buletine), dă fiecare bucată primului fir liber și pune rezultatele la loc în ordinea board-ului. Agregatul se calculează pe bucăți, iar sumele parțiale se adună la final (adunarea punctelor e asociativă, deci rezultatul e identic).
- Lucrătorii sunt **`worker_threads`** în Node (`@evoting/crypto/node`, folosit de `evoting-verify --workers N`, de CLI-ul trustee-ului înainte de decriptare și de simulator) și **Web Workers** în browser (`apps/web/src/lib/verify-workers.ts`, bifa „În paralel, pe N fire” din tab-ul de verificare).
- **Raportul e identic** cu cel de pe un singur fir, inclusiv la buletine trișate: aceleași eșecuri, în aceeași ordine, cu aceleași mesaje (verificat în teste pe `worker_threads` reale). Dacă un fir cade, verificarea se oprește cu eroare; nu „ghicește” un rezultat.

**Rezultatul** (1.000 de buletine, 3 candidați, Intel i7-10700F cu 8 nuclee fizice și 16 logice; detaliile în Partea 12): **~30 s pe un fir → ~6 s pe 16 fire (de ~5 ori mai rapid)** în Node; în Chrome, ~16 s → ~6 s. Accelerarea nu e 16×: pornirea firelor costă ~0,25 s, iar 16 nuclee „logice” sunt de fapt 8 fizice, fiecare cu două fire (hyperthreading).

## 9.16 Reparații găsite la a doua verificare (18 nov., seara)

Tot proiectul a fost reverificat: citirea codului, testele pe PostgreSQL, apoi folosirea reală a site-ului în Chrome (comisie, membri, trustees cu CLI-ul, vot, închidere, decriptare, verificare). Au ieșit la iveală:

1. **Alarmă falsă pe board.** După o căutare reușită a codului de urmărire, orice tastă apăsată în câmp transforma mesajul verde în „conținutul a fost modificat, raportează comisiei”, pentru că verificarea se refăcea față de textul nou din câmp. Acum se face față de codul căutat.
2. **Acuzație falsă la auditul Benaloh.** Un text incomplet (copiat pe jumătate) afișa o eroare JavaScript în engleză urmată de „Aplicația NU a criptat opțiunea aleasă”. Acum `auditBallot` deosebește datele **incomplete** (`malformed`: avertisment galben, „nu se poate verifica”) de o **nepotrivire reală** (roșu). În CLI, codul de ieșire e 2, nu 1.
3. **„Închide votul” dintr-un singur clic.** Acțiunea e ireversibilă, deci cere acum confirmare, ca ștergerea.
4. **CLI-urile se prăbușeau pe Windows** la ieșire: `process.exit()` chemat imediat după un `fetch` oprea Node cu „Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)” și un cod de ieșire greșit (o verificare reușită putea părea picată). Acum comenzile aruncă `CliExit`, iar `cli.ts` pune `process.exitCode`; procesul se termină singur.
5. **`npm run format:check` pica local pe Windows** pe ~180 de fișiere: Git le scotea cu CRLF (`core.autocrlf=true`), iar Prettier cere LF. `.gitattributes` cere acum LF pentru toate fișierele text.
6. **`sslmode=disable` în `DATABASE_URL` era ignorat** pentru o bază la distanță (SSL rămânea pornit). Acum îl oprește; trei teste noi (`pg-options.test.ts`).
7. **Închiderea automată ascundea erorile**: orice eroare era tratată ca „altă instanță l-a închis deja”. Acum doar 409 e ignorat; restul apare în log, iar celelalte scrutine se închid în continuare.
8. **Chei Ed25519 de ordin mic** (de exemplu punctul identitate) erau acceptate ca credential; pentru ele oricine poate „semna”. Acum sunt respinse.
9. **Verificatorul putea arunca o excepție** la o intrare care nu are forma unei intrări (de exemplu `null`); acum o raportează („Intrare malformată”) și continuă cu restul.
10. **Româna:** „Mai lipsesc 1 chei”, „liniile 4”, „21 ore”, „Lipsesc cheile de la 2 trustee(s)” au devenit „Mai lipsește o cheie”, „linia 4”, „21 de ore”, „Lipsesc cheile de la 2 trustees” (funcția `plural` din `format.ts`). Pentru observatori, panoul nu mai spune „Creează scrutine…”.

## 9.17 Ce nu a fost o problemă

Pentru completitudine: un CSV de eligibili salvat din Excel (cu BOM UTF-8 la început) e citit corect, pentru că serverul (body-parser) și browserul (`File.text()`) elimină BOM-ul. Titlul „Magazin Gestiune” văzut în browser pe `localhost:5174` venea de la un *service worker* al altui proiect rămas în Chrome pe aceeași adresă, nu de la acest proiect (al cărui titlu e „Vot verificabil”). Un service worker e un mic program pe care un site îl lasă în browser ca să meargă și offline; el răspunde în locul serverului la orice cerere către aceeași adresă (`localhost:5174`), deci și pentru alt proiect pornit ulterior pe acel port. A fost șters pe 18 nov. (service worker-ul dezînregistrat și cache-ul lui, `magazin-app-cache-v1`, golit); după reîncărcare, titlul e „Vot verificabil”. Cum se face de mână: tabelul din 10.10.

## 9.18 Scoaterea din lista de eligibili (punctul 2 din analiză)

Până acum, un CNP importat greșit nu mai putea fi scos. Acum, în cardul „Lista alegătorilor eligibili”, comisia alege **„Scoate”**, lipește CNP-urile (sau încarcă un CSV) și confirmă a doua oară. Ruta e `POST /elections/:id/eligible/remove`, doar pentru rolul `comisie`, în configurare sau cu votul deschis.

- Persoana scoasă **nu se mai poate înregistra**.
- Dacă s-a înregistrat, dar **n-a votat**, înregistrarea și provocările ei se șterg: credentialul de pe telefonul ei nu mai poate vota. Lista publică de credentiale se micșorează corespunzător, deci verificatorul trece în continuare.
- Dacă **a votat deja**, rămâne în listă: votul de pe board nu se poate scoate (board-ul e append-only, iar baza de date ar refuza oricum ștergerea înregistrării unui credential care a votat).
- În jurnal intră doar numerele (scoși, înregistrări șterse, absenți, păstrați, invalide), niciun CNP sau HMAC; la fel ca la import, CNP-urile invalide apar în răspuns doar mascat.
- Totul se face într-o singură tranzacție, cu rândul scrutinului blocat, deci nu se poate amesteca cu un vot trimis în aceeași clipă.

Codul: `ElectionsService.removeEligible` (backend), `removeCsv` (backend-ul simulat), `parseCnpList` (CSV-ul, comun), `EligibleImport.tsx` (site). Teste: unul e2e pe PostgreSQL (inclusiv verificatorul public la final), unul pe backend-ul simulat, unul pentru parserul CSV.

## 9.19 Token-urile trustees nu se mai pierd

Serverul păstrează doar hash-ul token-urilor trustees, deci le arată o singură dată, la crearea scrutinului. Până acum erau doar în starea navigării: un clic pe „Modifică” sau o reîncărcare a paginii înainte de copiere le pierdea definitiv, iar scrutinul nu mai putea primi chei (trebuia șters și refăcut). Acum:

- rămân în `sessionStorage` (doar în tab-ul curent, ca token-ul comisiei) până când comisia apasă **„Am transmis token-urile, ascunde-le”**;
- se pot descărca toate într-un fișier `.txt`, cu comanda fiecărui trustee;
- comanda afișată include `--encrypt`, deci trustee-ul își protejează fișierul de cheie cu o parolă (9.10).

Testat în Chrome: panoul rămâne după „Modifică → Renunță” și după reîncărcare, iar după „Am transmis” nu mai apare nici la reîncărcare.

## 9.20 Teste automate pentru site (punctul 25)

Site-ul are acum **11 teste automate** (`apps/web/test/`), rulate de `npm test` (deci și de GitHub Actions). Uneltele, instalate pe 19 nov. cu acordul autorului: **Vitest** (rulează testele, cu aceeași configurare ca Vite), **jsdom** (un browser simulat în Node) și **Testing Library** (folosește pagina ca un om: caută butoane după text, câmpuri după etichetă, tastează, dă clic).

Testele pornesc **tot site-ul**, cu rutele reale, pe **backend-ul simulat** din `@evoting/api` (criptografie reală, fără server și fără bază de date), deci verifică exact ce ar vedea cineva în browser:

- **paginile publice** (7): lista scrutinelor; căutarea pe board și **regresia alarmei false** (9.16); un cod inexistent; auditul Benaloh în cele trei culori (corect, aplicație necinstită, date incomplete); verificatorul public cu toți cei șase pași; hash-ul publicat greșit, prins la lanț; procesul-verbal, cu verificarea rulată din pagină;
- **panoul comisiei** (4): „Închide votul” cu confirmare; token-urile trustees păstrate după „Modifică” și după reîncărcare (9.19); „Scoate” din lista de eligibili (9.18); scrutinul „doar NFC” (9.21).

Cum le rulezi: `npm test -w @evoting/web` (după `npm run build:packages`). Durează ~30 de secunde, pentru că backend-ul simulat generează scrutinele de demonstrație cu criptografie reală. Aplicația mobilă nu are încă teste de interfață (ar cere unelte pentru React Native).

## 9.21 Scrutinul „doar NFC” (punctul 17)

Scanarea optică (OCR) acceptă orice MRZ cu cifre de control corecte, deci și unul **printat** pe hârtie: cine are datele MRZ ale altei persoane de pe listă s-ar putea înregistra în locul ei (limitarea 8 din Partea 13). Citirea cipului (NFC) nu are problema asta, pentru că datele de pe cip sunt semnate de stat și verificate de server (Passive Authentication).

Acum comisia poate bifa, la creare sau cât scrutinul e în configurare, **„Doar cu cartea electronică (NFC)”**:

- **serverul** refuză orice înregistrare prin OCR la acel scrutin (`403`), înainte să se uite la lista de eligibili; coloana nouă e `elections.require_nfc` (migrarea 004, implicit `false`, deci scrutinele vechi rămân cum erau);
- **setarea e publică**: în API (`requireNfc`), pe pagina de start („doar NFC”), în parametrii publici, în panoul comisiei și în procesul-verbal; apare și în jurnalul de audit, la crearea scrutinului;
- **aplicația mobilă** nu mai oferă scanarea la astfel de scrutine și explică de ce;
- **backend-ul simulat** aplică aceeași regulă, iar alegătorii lui simulați se înregistrează atunci cu un cip de test.

Teste: unul e2e pe PostgreSQL (OCR refuzat, cipul de test semnat acceptat, setarea schimbată doar în configurare, jurnalul), unul pe backend-ul simulat, unul pe site.

## 9.22 Procesul-verbal al scrutinului

O pagină nouă, **`/scrutin/:id/proces-verbal`** (butonul „Proces-verbal” de pe pagina publică și din panoul comisiei), gândită pentru tipărit sau salvat ca PDF din browser (butonul „Tipărește / salvează PDF”; la tipărire dispar bara de sus și butoanele, `styles/print.css`). Conține doar date publice:

1. **date generale**: starea, intervalul, felul înregistrării, opțiunile, trustees, cheia publică a scrutinului;
2. **participarea**: eligibili, înregistrați (câți prin NFC, câți prin OCR), buletine, participarea, cvorumul orientativ;
3. **rezultatul** (după numărare), cu procente;
4. **integritatea**: ultima intrare de pe board (`poziție:hash`, de publicat independent) și, la cerere, **verificarea publică rulată chiar din pagină** (pe Web Workers), cu ora, durata și numărul de fire;
5. **locul semnăturilor** comisiei.

Testat în Chrome pe scrutinul cu 1.000 de alegători: verificarea din procesul-verbal a durat 4,4 s, pe 16 fire.

Tot acum, **zecimalele** se scriu cu virgulă, ca în română: procentele („58,2%”), duratele verificării pe site și în CLI-uri (funcțiile `decimal` și `percent` din `format.ts`).

## 9.23 Ce a rămas din analiză

Din cele 30 de puncte ale analizei, 14 sunt rezolvate, 6 parțial, iar 10 rămân (lista completă, cu starea fiecăruia, în `docs/ANALIZA.md`, secțiunea 5). Cele mai importante rămase: schema t-din-n pentru trustees, autoritatea de înregistrare separată (împotriva ballot stuffing), certificatul CSCA al României și testele de interfață pentru aplicația mobilă.

## 9.24 Jurnalul celei de-a doua verificări (18–19 nov.), pe scurt

În ordinea în care s-au făcut:

1. **Verificarea:** PR-ul #5 era deja în `master`. Codul a fost recitit integral (backend, criptografie, API, CLI-uri, site); lint, formatare, tipuri, build și cele 93 de teste pe PostgreSQL. Aici a ieșit problema CRLF de pe Windows (9.16, punctul 5).
2. **Folosirea reală, în Chrome:** serverul pornit pe o bază separată (`evoting_dev`, în containerul de test), populată cu simulatorul (60 de alegători), apoi site-ul folosit pas cu pas. Au ieșit alarma falsă de pe board, acuzația falsă de la Benaloh, închiderea fără confirmare și textele în română (9.16).
3. **Reparațiile și verificarea în paralel** (9.15, 9.16), cu teste noi; în timpul testelor CLI a ieșit și prăbușirea de pe Windows (9.16, punctul 4).
4. **Măsurătorile:** o simulare cu 1.000 de alegători și verificarea aceluiași pachet pe 1, 2, 4, 8 și 16 fire, de trei ori (Partea 12); verificarea și în Chrome.
5. **Livrarea:** două commit-uri (codul, documentația) pe ramura `claude/verificare-paralela-si-reparatii`, **PR #6**. GitHub Actions a trecut: testele pe Linux (inclusiv `worker_threads`) și bundle-ul Android.
6. **A doua rundă, pe aceeași ramură:** scoaterea din lista de eligibili (9.18) și token-urile trustees care nu se mai pierd (9.19), testate automat și în Chrome. Instalarea uneltelor de test pentru site a fost oprită atunci de sistemul de permisiuni al asistentului.
7. **Curățenia în Chrome:** service worker-ul altui proiect de pe `localhost:5174` („Magazin Gestiune”) a fost dezînregistrat și cache-ul lui golit (9.17); serverele de dezvoltare pornite pentru teste au fost oprite.
8. **A treia rundă (19 nov.), cu acordul autorului pentru pachetele noi:** Vitest, jsdom și Testing Library, cu 11 teste pentru site (9.20); scrutinul „doar NFC” (9.21); procesul-verbal și zecimalele cu virgulă (9.22). Testele au ajuns la 125. Totul pe același PR #6.

---

# Partea 10. Cum pornești și folosești totul, pas cu pas

Comenzile sunt scrise pentru un terminal Bash (Git Bash pe Windows, sau Linux/macOS). Unde PowerShell are altă formă, e dată și aceea.

## 10.1 Ce instalezi o singură dată

1. **Node.js 22** (sau mai nou): de pe nodejs.org. Verifici cu `node -v`.
2. **Git**: de pe git-scm.com (pe Windows vine și cu Git Bash).
3. **Docker Desktop**: pentru baza de date de test și pentru sistemul complet. Pe Windows trebuie **pornit** (iconița cu balena) înainte de orice comandă `docker`.
4. Opțional, pentru telefon: aplicația **Expo Go** din Google Play; pentru NFC și OCR reale, **Android Studio** (Partea 10.8).

**Secretele** (cheia HMAC, token-urile) se generează cu `openssl rand -hex 32` sau, dacă nu ai `openssl`, cu Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 10.2 Prima rulare: instalare, build, teste

```bash
git clone <adresa-depozitului> && cd E-VOTING-Platform
npm install          # toate pachetele, fără aplicația mobilă
npm run build        # compilează pachetele, serverul, CLI-urile și site-ul
npm run lint         # linterul (0 erori)
npm run format:check # formatarea
npm test             # testele (cele de server sunt sărite fără baza de test)
```

Testele serverului au nevoie de un PostgreSQL de test. Cu Docker, o singură dată:

```bash
docker run -d --name evoting-test -p 5433:5432 -e POSTGRES_USER=evoting -e POSTGRES_PASSWORD=evoting -e POSTGRES_DB=evoting_test postgres:16-alpine
```

Apoi, la fiecare rulare (după ce pornești Docker Desktop și containerul, cu `docker start evoting-test`):

```bash
TEST_DATABASE_URL=postgres://evoting:evoting@localhost:5433/evoting_test npm test
```

```powershell
# PowerShell
$env:TEST_DATABASE_URL = "postgres://evoting:evoting@localhost:5433/evoting_test"; npm test
```

Rezultatul așteptat: **54 + 27 + 33 = 114 teste** (criptografie, API, server) **plus 11 teste ale site-ului** (Vitest), deci **125**, toate trecute. Doar testele site-ului: `npm test -w @evoting/web` (după `npm run build:packages`). Atenție: testele **golesc** baza de test la fiecare rulare, deci nu folosi o bază cu date de păstrat.

## 10.3 Demonstrație fără server (backend-ul simulat)

Fără nicio configurare, site-ul și aplicația folosesc backend-ul simulat din `packages/api/src/mock/`: aceleași reguli și aceeași criptografie, totul în memorie (se pierde la reîncărcare). Are trei scrutine de demonstrație și butoane „Simulează…” care țin locul trustees și al alegătorilor.

```bash
npm run dev -w @evoting/web                        # site-ul: http://localhost:5173
cd apps/mobile && npm install && npx expo start    # aplicația: scanezi QR-ul cu Expo Go, sau apeși „w” pentru browser
```

Un scrutin complet în modul simulat: pe site, **Comisie** → **Scrutin nou** → „Simulează cheile trustees” → importi câteva CNP-uri (sau folosești scrutinul deschis existent) → **Deschide votul** → „Simulează 10 alegători” → **Închide votul** → „Simulează decriptarea” → pe pagina publică, **Verificare publică** → **Verifică tot**.

## 10.4 Cu serverul real, pe calculatorul tău

1. O bază PostgreSQL. Cel mai simplu, tot cu Docker:

   ```bash
   docker run -d --name evoting-db -p 5432:5432 -e POSTGRES_USER=evoting -e POSTGRES_PASSWORD=evoting -e POSTGRES_DB=evoting postgres:16-alpine
   ```

2. Configurarea serverului: copiezi `apps/backend/.env.example` în `apps/backend/.env` și completezi cel puțin `CNP_HMAC_KEY` și `ADMIN_TOKEN`.
3. Pornirea:

   ```bash
   npm run build -w @evoting/backend
   npm run test-pki -w @evoting/backend -- pki   # opțional: PKI de test pentru cipuri NFC simulate (CSCA_DIR=./pki/csca)
   npm run dev -w @evoting/backend               # aplică migrările și ascultă pe http://localhost:3000
   ```

4. Site-ul spre server: creezi `apps/web/.env.local` cu `VITE_API_URL=http://localhost:3000`, apoi `npm run dev -w @evoting/web`.

**Variabilele de mediu ale serverului:**

| Variabila | Obligatorie | Implicit | Ce face |
| --- | --- | --- | --- |
| `DATABASE_URL` | da | – | Adresa bazei PostgreSQL (locală sau Supabase). |
| `CNP_HMAC_KEY` | da | – | Cheia HMAC pentru CNP-uri, cel puțin 32 de octeți în hex. **Dacă o pierzi, lista de eligibili devine inutilizabilă.** |
| `ADMIN_TOKEN` | da | – | Token-ul „rădăcină” al comisiei, cel puțin 16 caractere. |
| `SESSION_SECRET` | recomandat | generat la fiecare pornire | Semnează sesiunile alegătorilor; fără el, o repornire anulează sesiunile în curs. |
| `CSCA_DIR` | pentru NFC | – | Folderul cu certificatele CSCA de încredere. |
| `PORT` | nu | 3000 | Portul serverului. |
| `CORS_ORIGINS` | în producție | toate | Site-urile care au voie să cheme API-ul din browser, separate prin virgulă. |
| `RATE_LIMIT` | nu | `on` | `off` doar pentru simulări de încărcare. |
| `SENSITIVE_RATE_LIMIT` | nu | 30 | Câte cereri pe minut au voie rutele sensibile, per IP. |
| `AUTO_CLOSE_INTERVAL_MS` | nu | 60000 | La câte milisecunde verifică serverul închiderea automată (0 = deloc). |
| `TRUST_PROXY` | în spatele unui proxy | 0 | Câte proxy-uri de încredere sunt în față (Caddy = 1). |
| `DATABASE_SSL` | nu | automat | `on`/`off` forțează SSL-ul spre bază; implicit e pornit pentru orice server care nu e local. |
| `DATABASE_CA` | recomandat cu Supabase | – | Certificatul CA al furnizorului (PEM); cu el, serverul verifică identitatea bazei de date. |
| `NODE_ENV` | nu | – | `production` pornește avertismentele de configurare. |

## 10.5 Tot sistemul cu Docker Compose și HTTPS

```bash
cp .env.example .env
# completează în .env: CNP_HMAC_KEY, ADMIN_TOKEN, SESSION_SECRET
docker compose up --build
```

Pornesc patru containere: `db` (PostgreSQL), `backend`, `web` (nginx cu site-ul) și `proxy` (Caddy). Prima construire durează câteva minute.

- Deschide **https://localhost**. Browserul va spune că certificatul nu e de încredere: e normal, Caddy a emis un certificat local doar pentru acest calculator. Alegi „Avansat” → „Continuă”. Site-ul e la `/`, API-ul la `/api`.
- Direct, fără Caddy: site-ul pe `http://localhost:8080`, API-ul pe `http://localhost:3000`. Site-ul cheamă totuși API-ul prin `https://localhost/api`, deci acceptă întâi certificatul pe `https://localhost`.
- Ca browserul să aibă încredere permanent în certificat (opțional): `docker compose cp proxy:/data/caddy/pki/authorities/local/root.crt caddy-root.crt`, apoi, pe Windows, dublu-click pe fișier → „Install Certificate” → „Local Machine” → „Trusted Root Certification Authorities”.
- Pentru un domeniu real: în `.env`, `SITE_ADDRESS=vot.exemplu.ro`, `PUBLIC_API_URL=https://vot.exemplu.ro/api`, `CORS_ORIGINS=https://vot.exemplu.ro`; în `infra/Caddyfile` scoți rândul `tls internal`. Caddy obține singur certificatul Let's Encrypt.
- Oprirea: `docker compose down` (datele rămân) sau `docker compose down -v` (șterge și datele).
- Comisia intră cu `ADMIN_TOKEN` din `.env`. Pentru demo, serverul generează singur un PKI de test pentru cipuri simulate (`GENERATE_TEST_PKI=true`).

## 10.6 Baza de date în Supabase

1. Creezi proiectul pe supabase.com; parola bazei o păstrezi doar tu.
2. **Connect** → **Session pooler** → copiezi adresa (portul 5432) și pui parola.
3. În `apps/backend/.env` (sau în `.env` de la rădăcină, pentru Compose): `DATABASE_URL=postgresql://postgres.<ref>:<parola>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`. În Compose adaugi și `DATABASE_SSL=on`.
4. Opțional, `DATABASE_CA` cu certificatul CA descărcat din Supabase, ca serverul să verifice identitatea bazei (altfel apare un avertisment la pornire).
5. La pornire, serverul creează singur tabelele; nu trebuie lipit nimic în editorul SQL.

## 10.7 Un scrutin real, cu CLI-urile

Cu serverul pornit (10.4 sau 10.5):

1. **Comisia**, pe site: **Comisie** → token → **Scrutin nou**. Copiază comenzile trustees afișate o singură dată. Opțional, **Membri** → creează membri cu rol.
2. **Fiecare trustee**, pe calculatorul lui (după `npm install && npm run build` în proiect):

   ```bash
   npx evoting-trustee keygen --api http://localhost:3000 --election <ID> --trustee <ID>-t1 --token <TOKEN> --encrypt
   npx evoting-trustee status --api http://localhost:3000 --election <ID>
   ```

3. **Comisia** importă CSV-ul cu CNP-uri și apasă **Deschide votul** (în intervalul stabilit).
4. **Alegătorii** votează din aplicație (10.8). Pentru o încercare rapidă fără telefoane, simulatorul (10.9).
5. **Comisia** publică periodic hash-ul board-ului afișat în panou. La ora închiderii, serverul închide singur votul (sau comisia apasă **Închide votul**).
6. **Fiecare trustee**:

   ```bash
   npx evoting-trustee decrypt --key <ID>-t1.trustee-key.json --token <TOKEN>   # cere parola dacă e criptat
   ```

7. **Oricine**:

   ```bash
   npx evoting-verify --api http://localhost:3000 --election <ID> --head <SEQ:HASH publicat>
   npx evoting-verify --api http://localhost:3000 --election <ID> --save arhiva.json   # păstrezi totul pentru verificare offline
   npx evoting-verify --bundle arhiva.json
   npx evoting-verify --bundle arhiva.json --workers 1      # pe un singur fir, pentru comparație (implicit: toate nucleele)
   ```

8. **Comisia** deschide **Proces-verbal** (pe pagina publică a scrutinului sau în panou), apasă „Rulează verificarea publică”, apoi „Tipărește / salvează PDF”, și îl semnează.

La pasul 1, dacă scrutinul cere identificare sigură, comisia bifează **„Doar cu cartea electronică (NFC)”**: alegătorii se pot înregistra atunci doar citind cipul CEI cu telefonul (9.21).

Prin Caddy, adresa API-ului e `https://localhost/api`; cu certificatul local, Node cere încrederea în el, deci pentru CLI-uri e mai simplu `http://localhost:3000`.

## 10.8 Aplicația pe telefon

| Variantă | Ce merge | Cum |
| --- | --- | --- |
| **Expo Go** | tot, cu OCR manual (rândurile MRZ tastate) și NFC simulat (doar cu backend-ul simulat) | `cd apps/mobile && npx expo start`, apoi scanezi QR-ul. |
| **Development build** | tot, cu camera + OCR și NFC reale | `cd apps/mobile && npx expo run:android` (cere Android Studio și telefonul conectat cu USB, cu „USB debugging”). |
| **APK** | ca development build-ul, fără calculator | `apk/vot-verificabil.apk`, construit de GitHub Actions; fără adresă de server folosește backend-ul simulat. Pentru un server: Actions → „Android APK” → „Run workflow” → `api_url`. |

Spre serverul real: în `apps/mobile/.env.local`, `EXPO_PUBLIC_API_URL=http://<IP-ul calculatorului>:3000` (de exemplu `http://192.168.1.20:3000`). Pe telefon, `localhost` e telefonul însuși. Telefonul și calculatorul trebuie să fie în aceeași rețea Wi-Fi, iar firewall-ul Windows trebuie să permită portul 3000.

## 10.9 Simulatorul și demonstrațiile de atac

```bash
# serverul pornit cu RATE_LIMIT=off (în apps/backend/.env)
npx evoting-simulate --admin-token <TOKEN> --voters 1000 --report raport.json
npx evoting-simulate --admin-token <TOKEN> --voters 1000 --nfc 0.2 --pki apps/backend/pki   # 20% prin NFC, cu cipuri de test

npm run build -w @evoting/attacks
npm run cnp -w @evoting/attacks              # 1. SHA-256 vs HMAC
npm run deterministic -w @evoting/attacks    # 2. vot ghicit: RSA vs ElGamal
npm run bsgs -w @evoting/attacks             # 3. totaluri vs. cheie
node demos/attacks/dist/api-bruteforce.js --api http://localhost:3000                  # 4. cu RATE_LIMIT=on
DATABASE_URL=... node demos/attacks/dist/tamper-board.js --election <ID> --seq 3       # 5. modifică și restaurează
```

## 10.10 Probleme frecvente

| Ce vezi | Cauza și rezolvarea |
| --- | --- |
| `PostgreSQL de test indisponibil … testele end-to-end sunt sărite` | Docker Desktop nu e pornit, containerul `evoting-test` e oprit sau lipsește `TEST_DATABASE_URL`. |
| `Lipsesc variabilele de mediu: …` la pornirea serverului | Lipsește `apps/backend/.env` (sau `.env` de la rădăcină, pentru Compose). |
| Browserul avertizează la `https://localhost` | Normal: certificat local. Continui sau instalezi `root.crt` (10.5). |
| Site-ul de pe `:8080` nu încarcă datele | Nu ai acceptat încă certificatul de pe `https://localhost`. |
| Telefonul nu vede serverul | Folosește IP-ul calculatorului, aceeași rețea Wi-Fi, portul 3000 permis în firewall. |
| `429 Prea multe încercări` | Limitarea de rată: aștepți un minut. Pentru simulări, `RATE_LIMIT=off`. |
| `Cheia scrutinului nu e încă publicată` | Nu toți trustees și-au trimis cheia. |
| `Data închiderii a trecut deja` la deschidere | Modifici intervalul scrutinului (e încă în configurare). |
| `Votul nu a început încă` | Comisia a deschis mai devreme, dar votul începe la `opensAt`. |
| Portul 80 sau 443 e ocupat la `docker compose up` | Alt program îl folosește (IIS, Skype); îl oprești sau schimbi porturile în `docker-compose.yml`. |
| Aplicația mobilă nu vede o modificare din `packages/` | `npm run build:packages` la rădăcină, apoi repornești Expo. |
| `fișierul de cheie e criptat` la `decrypt` | Dai parola cu `--password` sau prin `TRUSTEE_KEY_PASSWORD`. |
| Pe `localhost:<port>` apare alt site (alt titlu, de exemplu „Magazin Gestiune”) | Un *service worker* al unui proiect pornit înainte pe același port. În Chrome: F12 → **Application** → **Service workers** → **Unregister**, apoi **Storage** → **Clear site data** (sau `chrome://serviceworker-internals` → **Unregister**). Ori deschizi site-ul pe `127.0.0.1:<port>`, care e altă origine. |
| `npm run format:check` pică pe aproape toate fișierele, pe Windows | Fișiere scoase cu CRLF dintr-o clonă mai veche. `.gitattributes` cere acum LF; o dată, `npx prettier --write .` (sau o clonă nouă) le aduce la LF fără să schimbe conținutul. |
| Un CLI se termină cu `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` | Versiune veche a CLI-urilor (cu `process.exit()` după `fetch`, care prăbușește Node pe Windows). `npm run build` la rădăcină. |

---

# Partea 11. Testele: ce verifică fiecare

Un **test automat** e un mic program care folosește codul proiectului și verifică un rezultat așteptat („buletinul cu două voturi trebuie respins”). Dacă o modificare strică ceva, testul pică. Proiectul are **125 de teste** (114 pentru criptografie, API și server, 11 pentru site), rulate cu `npm test` și, la fiecare `git push`, de GitHub Actions.

| Suită | Teste | Rulează pe |
| --- | --- | --- |
| `packages/crypto` | 54 | doar matematica, fără server (inclusiv verificarea pe `worker_threads` reale) |
| `packages/api` | 27 | parserele de identitate (și lista CSV de CNP-uri), formatările în română și backend-ul simulat |
| `apps/backend` | 33 | serverul real, pornit pe un PostgreSQL real; testele CLI rulează programele ca procese separate; 3 teste fără bază (opțiunile SSL) |
| `apps/web` | 11 | site-ul întreg, cu rutele reale, într-un browser simulat (jsdom), pe backend-ul simulat |

Testele serverului se numesc **end-to-end** (e2e): pornesc serverul adevărat, îi trimit cereri HTTP adevărate și verifică inclusiv ce a ajuns în baza de date.

## 11.1 `packages/crypto` (54)

**`encoding.test.ts` (6):** JSON-ul canonic nu depinde de ordinea cheilor; ignoră câmpurile `undefined` și respinge valorile instabile; HMAC-SHA256 respectă vectorul de test oficial RFC 4231; HMAC(CNP) diferă la chei diferite și e același la aceeași cheie; scalarii se codifică reversibil, iar valorile ≥ q sunt respinse; hex-ul de lungime greșită sau cu caractere invalide e respins.

**`elgamal.test.ts` (4):** criptare și decriptare; același vot dă de fiecare dată alt criptotext; suma criptotextelor criptează suma voturilor; baby-step giant-step găsește totaluri mici, inclusiv 0 și maximul.

**`ballot.test.ts` (13):** un buletin corect trece; o opțiune în afara listei e refuzată la criptare; vot 2 → pică dovada 0/1; vot −1 → pică dovada 0/1; două voturi → trec dovezile 0/1, pică dovada sumei; buletin gol → pică dovada sumei; buletin „viclean” +2/−1 → trece suma, pică dovezile 0/1; dovezile refolosite în alt scrutin sunt respinse chiar cu semnătură refăcută; un buletin copiat și semnat de alt credential e respins; o modificare a criptotextului invalidează semnătura; un buletin cu număr greșit de criptotexte sau fără dovezi e respins la formă; semnătura Ed25519 a provocării; provocarea Benaloh confirmă opțiunea și prinde o aplicație care criptează altceva.

**`trustee.test.ts` (6):** dovada Schnorr e legată de scrutin și de trustee; o cheie publică invalidă sau o dovadă stricată sunt respinse fără ca programul să cadă; cheia secretă trebuie să corespundă celei publice; decriptarea cere toți trustees și dă totalurile corecte; un trustee care trișează e detectat; agregatul nu se poate decripta fără cheia completă.

**`verifier.test.ts` (16):** un scrutin corect trece toți pașii; un scrutin deschis are agregatul și decriptarea „sărite”, nu „picate”; un buletin modificat e găsit exact; un buletin modificat cu hash-urile refăcute e trădat de semnătură; ordinea schimbată e detectată; un buletin șters e detectat; un vot de la un credential neînregistrat (ballot stuffing) e detectat; un credential care votează de două ori e detectat; o decriptare parțială modificată e atribuită trustee-ului vinovat; un rezultat falsificat e detectat; un agregat greșit e detectat; board-ul rescris față de hash-ul publicat independent e detectat; alegătorul își verifică buletinul după cod; o cheie de trustee fără dovadă validă e detectată; orele primirii trebuie să fie crescătoare și în interval; progresul e raportat (inclusiv începutul fiecărui pas), iar verificatorul cedează periodic controlul.

**`parallel.test.ts` (9):** pe `worker_threads` reale, raportul e identic cu cel de pe un singur fir; cu un buletin trișat și o semnătură furată, eșecurile sunt aceleași, în aceeași ordine; rezultatele revin în ordinea board-ului chiar dacă bucățile se termină în altă ordine, iar progresul ajunge la total; agregatul adunat pe bucăți e identic, iar un buletin trunchiat dă aceeași eroare ca pe un fir; un fir căzut oprește verificarea cu eroare; o intrare `null` pe board e raportată, fără ca verificarea să se oprească; auditul Benaloh deosebește datele incomplete de o nepotrivire reală (2 teste); cheile Ed25519 de ordin mic sunt respinse.

## 11.2 `packages/api` (27)

**`cnp.test.ts` (4):** cifra de control și data; formatul, prima cifră și județul greșite; generatorul produce doar CNP-uri valide; lista CSV (antet, coloane separate prin `;` sau `,`, ghilimele, CRLF, liniile invalide cu numărul lor).

**`mrz.test.ts` (7):** cifra de control ICAO pe exemplele din documentul 9303; exemplul oficial TD1; exemplul oficial TD2; buletinul vechi (CNP-ul reconstituit); CEI (CNP-ul din câmpul opțional); text OCR cu zgomot și confuzii O/0 citit corect, iar o cifră greșită prinsă; text fără MRZ.

**`dg1.test.ts` (3):** MRZ-ul TD1 și TD2 împachetat și despachetat; DG1 fără eticheta 61 sau fără MRZ respins; base64 reversibil.

**`mock.test.ts` (9):** un scrutin complet pe backend-ul simulat, verificat de verificatorul public; scrutinele de demonstrație trec verificatorul; re-înregistrarea înlocuiește credentialul dacă persoana n-a votat, fără să coboare nivelul de încredere; votul alb e criptat ca oricare altă opțiune și apare în rezultat; modificarea și ștergerea doar în configurare; votul refuzat în afara intervalului și închiderea automată; uneltele de test, CNP-ul propriu adăugat în listă și membrii comisiei; scoaterea din lista de eligibili, cu aceleași reguli ca serverul real; scrutinul „doar NFC” (OCR refuzat, NFC acceptat, alegătorii simulați trec prin NFC).

**`format.test.ts` (4):** acordul numeralelor („1 cheie”, „2 chei”, „20 de chei”, „105 voturi”, „120 de voturi”); duratele („45 de minute”, „21 de ore”, „2 zile și 3 ore”); procentele și zecimalele cu virgulă („58,2%”, „60%”); faza intervalului, cu marginile incluse.

## 11.3 `apps/backend` (33, dintre care 30 pe PostgreSQL)

**`election-flow.e2e.test.ts` (16), un scrutin cap-coadă:**

1. comisia creează scrutinul; fără token, cererea e refuzată; token-urile trustees nu se păstrează în clar;
2. trustees trimit Yᵢ cu dovadă Schnorr; token greșit, token al altui trustee sau dovadă invalidă sunt refuzate;
3. importul păstrează doar HMAC(CNP) și merge și după deschidere;
4. înregistrarea optică: eligibilitate, re-înregistrare înainte de vot, un credential per persoană;
5. înregistrarea NFC: Passive Authentication acceptă cipul semnat și respinge un DG1 modificat, un CSCA străin și o semnătură alterată; o înregistrare NFC nu poate fi înlocuită prin OCR;
6. votul: provocare semnată, buletin verificat, cod de urmărire; al doilea vot și re-înregistrarea după vot sunt refuzate;
7. autentificarea respinge semnături greșite, provocări refolosite și credentiale neînregistrate;
8. buletinele invalide sunt respinse: semnătură greșită, dovezi care nu se potrivesc, buletin făcut pentru alt scrutin;
9. două voturi trimise simultan cu același credential: doar unul intră pe board;
10. board-ul e append-only chiar și pentru cine are acces direct la baza de date;
11. board-ul se citește pe pagini, cele mai noi intrări primele;
12. la închidere se publică agregatul; un trustee care trișează e respins; după toți, rezultatul e corect;
13. verificatorul public trece pe datele publicate;
14. CNP-urile nu apar nicăieri în clar în baza de date;
15. un administrator care modifică board-ul direct în bază e prins de verificator, exact la buletinul modificat;
16. jurnalul de audit conține acțiunile comisiei (cu numele) și ale trustees și e accesibil doar comisiei.

**`interval.e2e.test.ts` (5):** votul nu se poate trimite înainte de deschidere; un scrutin cu data închiderii trecută nu se poate deschide; 16 voturi trimise deodată primesc ore crescătoare, în ordinea de pe board, și trec de verificator; ora unei intrări noi nu e niciodată mai veche decât a celei anterioare (ceasuri diferite pe instanțe); după `closesAt` votul e refuzat, iar serverul închide singur scrutinul.

**`commission.e2e.test.ts` (5):** membrii comisiei (token propriu, observatorul doar citește, revocarea, actorul din jurnal); modificarea și ștergerea doar în configurare; votul alb, numărat separat; scoaterea din lista de eligibili (observatorul refuzat, înregistrarea nevotată ștearsă, votul păstrat, persoana scoasă nu mai votează și nu se mai înregistrează, re-adăugarea, jurnalul fără CNP-uri, refuz după închidere, verificatorul public trece); scrutinul „doar NFC” (OCR refuzat, un cip de test semnat acceptat, setarea schimbată doar în configurare, jurnalul).

**`rate-limit.e2e.test.ts` (3):** ghicirea token-ului comisiei e oprită după câteva încercări (429); rutele publice nu sunt afectate; `/health` răspunde fără token.

**`cli.e2e.test.ts` (1):** CLI-urile reale, ca procese separate: `keygen` (un trustee cu cheie criptată cu parolă, unul fără; a doua rulare nu suprascrie cheia), `status`, vot, `decrypt` refuzat înainte de închidere și fără parolă sau cu parola greșită, `decrypt` reușit, verificarea online și offline (din arhivă), aceeași verificare pe două fire (`--workers 2`, raport identic), `--workers` invalid refuzat, un fișier Benaloh incomplet cu codul 2, codul de ieșire 1 la un hash publicat greșit.

**`pg-options.test.ts` (3, fără bază de date):** local fără SSL, la distanță cu SSL și avertisment; `sslmode=disable` oprește SSL-ul și dispare din URL; `DATABASE_SSL` are întâietate, iar `DATABASE_CA` pornește verificarea certificatului.

## 11.4 `apps/web` (11, Vitest și jsdom)

**`public.test.tsx` (7):** pagina de start arată cele trei scrutine de demonstrație; după o căutare reușită pe board, editarea câmpului nu mai produce alarma falsă; un cod inexistent e raportat ca negăsit; auditul Benaloh: date corecte → verde, opțiune declarată greșit → roșu, date incomplete sau JSON greșit → galben, fără acuzație; verificatorul public trece toți cei șase pași pe scrutinul numărat; un hash publicat independent greșit face lanțul să pice; procesul-verbal arată participarea, rezultatul și hash-ul board-ului, iar verificarea rulată din pagină trece.

**`commission.test.tsx` (4):** „Închide votul” cere confirmare, „Nu” lasă votul deschis, „Da” îl închide; token-urile trustees rămân după „Modifică → Renunță” și după reîncărcare, până la „Am transmis”; „Scoate” din lista de eligibili cere confirmare și raportează scoși, păstrați, absenți, invalide; scrutinul „doar NFC”: bifa din formular ajunge la scrutin, OCR-ul e refuzat, setarea apare în parametrii publici.

## 11.5 Ce nu e testat automat

Aplicația mobilă nu are teste de interfață (a fost verificată manual și cu Playwright pe build-ul web). Site-ul are testele de mai sus; în plus, a fost verificat cap-coadă în Chrome (18–19 nov.). Modulele Kotlin s-au verificat pe un telefon real (citirea unei CEI), nu automat. Simulatorul nu are test propriu, dar rularea lui e ea însăși un test complet (rezultatul publicat trebuie să fie egal cu voturile simulate, iar verificatorul trebuie să treacă).

---

# Partea 12. Performanța, pe înțeles

Performanța s-a măsurat cu **simulatorul** (`tools/simulator`): un scrutin complet contra serverului real, cu alegători sintetici care se înregistrează, se autentifică, criptează și trimit voturi, câte 8 în paralel; apoi închiderea, decriptarea și verificarea publică. Simulatorul compară la final rezultatul publicat cu voturile „în clar” pe care le-a generat.

**Măsurătorile din plan** (26 octombrie 2026, 3 candidați, 3 trustees, clientul, serverul și PostgreSQL pe același calculator; rapoartele în `docs/evaluare/simulare-*.json`):

| Metrică | 100 de alegători | 1.000 | 10.000 |
| --- | --- | --- | --- |
| Criptare + dovezi per buletin (client) | 20,8 ms | 19,2 ms | 19,5 ms |
| Trimitere + validare (dus-întors, sub încărcare) | 218 ms | 209 ms | 230 ms |
| Buletine pe secundă | 17,4 | 19,5 | 19,0 |
| Închidere (calculul agregatului) | 115 ms | 718 ms | 7,8 s |
| Decriptare parțială per trustee | 16 ms | 13 ms | 13 ms |
| Verificare publică completă | 2,5 s | 25,8 s | 239 s (4 min) |
| Verificare per buletin | 24,9 ms | 25,8 ms | 23,9 ms |
| Mărimea pachetului de audit | 0,2 MB | 2,2 MB | 21,7 MB |
| Rezultat = voturile simulate | da | da | da |

**Remăsurat pe 18 noiembrie**, pe codul final, pe un PC cu Windows și PostgreSQL în Docker Desktop, cu 1.000 de alegători (`docs/evaluare/simulare-1000-18-nov.json`): rezultatul a fost din nou exact, iar verificatorul (inclusiv noua verificare a orelor) a trecut. Timpii au fost cu 25–30% mai mari la toate metricile (criptare 24 ms, verificare 32,9 ms per buletin, 14,3 buletine pe secundă), **inclusiv la cele care nu depind deloc de server** (criptarea și verificarea rulează doar local). Diferența vine deci de la calculator, nu de la modificările din etapa a doua.

**Ce înseamnă cifrele:**

- **Criptarea pe telefon e instantanee pentru om**: ~20 ms în Node, ~9 ms în browser. Pe un telefon Android real rămâne de măsurat, dar chiar și de zece ori mai lent ar fi sub un sfert de secundă.
- **Serverul validează un buletin în ~25 ms de procesor** (semnătura și toate dovezile), deci un singur proces Node primește ~40 de buletine pe secundă. Pentru o facultate cu 10.000 de alegători care votează pe parcursul unei zile, media e sub 0,2 voturi pe secundă: de peste 200 de ori sub capacitate.
- **Verificarea publică și închiderea cresc liniar** cu numărul de buletine: fiecare buletin înseamnă 3 dovezi 0/1, o dovadă a sumei și o semnătură de verificat. Pe un singur fir, 4 minute pentru 10.000 de buletine; **în paralel** (vezi mai jos), de ~5 ori mai puțin pe un PC obișnuit.
- **Decriptarea nu depinde de numărul de buletine** (~13 ms per trustee), pentru că trustees decriptează doar cele 3 totaluri, nu buletinele.

**Verificarea în paralel** (18 noiembrie, 1.000 de buletine, 3 candidați, același pachet de audit verificat de `evoting-verify --bundle … --workers N`; Intel i7-10700F, 8 nuclee fizice și 16 logice, Windows; mediana a trei rulări; raportul complet în `docs/evaluare/verificare-paralela-18-nov.json`):

| Fire | Total | Semnături | Dovezi ZK | Agregat | Accelerare |
| --- | --- | --- | --- | --- | --- |
| 1 | 30,2 s | 1,97 s | 27,3 s | 0,87 s | ×1,0 |
| 2 | 18,7 s | 1,23 s | 16,8 s | 0,60 s | ×1,61 |
| 4 | 10,5 s | 0,79 s | 9,2 s | 0,33 s | ×2,88 |
| 8 | 6,6 s | 0,74 s | 5,5 s | 0,21 s | ×4,57 |
| 16 | 6,1 s | 0,72 s | 4,9 s | 0,24 s | ×4,93 |

Pe fiecare rând, raportul e identic. Dovezile ZK (90% din timp pe un fir) se accelerează cel mai mult; semnăturile sunt puține și rapide, deci acolo contează mai mult pornirea firelor (~0,25 s). De la 8 la 16 fire câștigul e mic, pentru că procesorul are 8 nuclee fizice: al doilea fir de pe fiecare nucleu (hyperthreading) împarte aceleași unități de calcul. În browser (Chrome, tab-ul „Verificare publică”, serverul de dezvoltare Vite, cu descărcarea pachetului inclusă): **16,1 s pe un fir, 6,1 s pe 16 Web Workers**. La 10.000 de buletine, asta înseamnă cam 1 minut în loc de 5.

---

# Partea 13. Limitări spuse cinstit și ce ar urma

O lucrare bună spune deschis ce **nu** face sistemul. Iată limitările, grupate.

**Limitări de principiu (asumate, ca la Helios):**

1. **Constrângerea și cumpărarea voturilor.** Cineva poate sta lângă tine când votezi; codul de urmărire nu dezvăluie votul, dar nici nu te poate apăra de cineva care te privește.
2. **Telefonul alegătorului e de încredere.** Benaloh prinde o aplicație care criptează altceva, dar un telefon infectat ar putea fura credentialul din SecureStore.
3. **Toți trustees împreună** ar putea decripta orice buletin individual. Secretul votului presupune că **cel puțin un trustee e onest**; de aceea trustees se aleg din tabere diferite (comisia, observatorii, reprezentanții candidaților).
4. **Serverul controlează și înregistrarea**, deci ar putea vota cu credentiale inventate pentru alegătorii care nu se prezintă. Lista publică de credentiale și numărul public de înregistrări fac frauda vizibilă statistic, dar nu o împiedică. Soluția completă e o **autoritate de înregistrare separată**, ca în Belenios.
5. **Cine administrează serverul poate afla cine a votat** (nu și cum), pentru că are cheia HMAC și lista importată.

**Limitări ale implementării actuale:**

6. **Schema n-din-n:** dacă un trustee își pierde cheia, rezultatul nu se mai poate decripta. Extensia firească e **t-din-n** (de exemplu 2 din 3), cu Shamir sau Pedersen DKG. Fișierul de cheie criptat cu parolă (9.10) permite măcar copii de siguranță fără riscul de a fi citite.
7. **NFC pe documente reale:** certificatul CSCA al României nu e inclus, deci serverul real acceptă doar cipurile de test. **Chip Authentication** (anti-clonare) nu e implementată.
8. **Nivelul „optic”** acceptă orice MRZ cu cifre de control corecte, inclusiv unul printat; la acest nivel, re-înregistrarea permite cuiva care are datele MRZ ale altei persoane să-i înlocuiască credentialul înainte ca aceasta să voteze (vizibil în jurnal). La scrutinele unde contează, comisia bifează acum **„doar NFC”** (9.21) și riscul dispare, cu prețul că fiecare alegător are nevoie de o carte electronică și de un telefon cu NFC.
9. **Mai multe instanțe ale serverului:** provocările sunt în baza de date, iar sesiunile merg dacă toate instanțele au același `SESSION_SECRET`; contoarele limitării de rată sunt însă în memoria fiecărei instanțe.
10. **Certificatul bazei de date** se verifică doar dacă e dat `DATABASE_CA`; altfel conexiunea e criptată, dar serverul doar avertizează.
11. **Scalare:** verificarea publică merge acum pe toate nucleele (~6 s la 1.000 de buletine pe un PC cu 8 nuclee, față de ~30 s pe un fir), dar serverul tot validează fiecare buletin pe un singur fir (~25 ms, ~40 pe secundă per proces), iar pachetul de audit se descarcă întreg (~22 MB la 10.000 de buletine).
12. **Codul criptografic nu e auditat independent**, iar BigInt-ul din JavaScript nu e în timp constant la nivel de procesor.
13. **Fără teste automate pentru interfața aplicației mobile** (site-ul are 11, 9.20), fără notificări pentru alegători, un singur scrutin per buletin, cvorumul (1/3 + 1) doar afișat, politica „primul vot contează” explicată într-o singură propoziție.
14. **De măsurat pe un telefon real:** timpul de criptare și rata de citire corectă a OCR-ului (pe build-ul web, criptarea a durat ~9 ms; în Node, ~20 ms).
15. **Serverul nu e găzduit online.** Pentru o demonstrație publică e nevoie de un server (un VPS, Render, Railway) și de reconstruirea APK-ului cu adresa lui.

**Ce ar urma**, în ordinea valorii pentru lucrare (detaliat în `docs/ANALIZA.md`):

1. t-din-n pentru trustees;
2. semnăturile verificate în lot și pachetul de audit descărcat pe bucăți (verificarea în paralel e făcută, 9.15);
3. certificatul CSCA al României și, opțional, Chip Authentication;
4. autoritatea de înregistrare separată;
5. teste de interfață pentru aplicația mobilă și un pachet comun pentru codul încă duplicat între site și aplicație (`useAsync`);
6. măsurătorile pe telefon.

---

# Partea 14. Pregătirea pentru susținere: întrebări și răspunsuri

Întrebări pe care le poate pune comisia de licență, cu răspunsuri scurte pe care le poți dezvolta.

**1. De ce nu e suficient HTTPS? Ce aduce criptarea votului pe telefon?**
HTTPS protejează doar drumul până la server; serverul vede votul în clar. Criptat pe telefon cu cheia trustees, votul nu poate fi citit nici de server, nici de cine administrează baza de date.

**2. Cum numărați voturi pe care nu le puteți citi?**
Prin proprietatea homomorfă a lui ElGamal exponențial: suma criptotextelor e criptarea sumei voturilor. Se adună toate buletinele încă criptate și se decriptează doar totalul fiecărui candidat.

**3. Cine poate decripta un vot individual?**
Niciun trustee singur și nicio parte din ei: cheia e Y = Y₁ + … + Yₙ, iar decriptarea cere toate cele n părți. Toți împreună ar putea, deci secretul presupune cel puțin un trustee onest; de aceea trustees vin din tabere diferite. În plus, programul trustee-ului decriptează doar agregatul, după ce verifică tot board-ul.

**4. Ce e o dovadă zero-knowledge și de ce aveți nevoie de ea?**
O dovadă că o afirmație e adevărată fără să dezvăluie nimic în plus. Fără ea, un alegător ar putea cripta „5 voturi pentru Ana” sau „−3 pentru Bogdan”, iar serverul n-ar observa, pentru că nu vede votul. Cu dovezile 0/1 și cu dovada sumei, fiecare buletin e garantat valid, fără să se afle pe cine votează.

**5. Ce înseamnă Fiat-Shamir?**
O dovadă interactivă (angajament, provocare, răspuns) devine neinteractivă dacă provocarea e hash-ul datelor publice. În hash intră și contextul (scrutinul, credentialul, poziția), deci o dovadă nu poate fi copiată în alt buletin.

**6. Ce împiedică un alegător să voteze de două ori?**
O singură înregistrare activă per HMAC(CNP), un singur vot per credential (blocarea rândului scrutinului plus constrângerea `UNIQUE` din baza de date, testate cu două voturi trimise simultan), iar verificatorul public verifică din nou.

**7. Cum știe alegătorul că votul lui a fost numărat?**
Primește un cod de urmărire (hash-ul intrării lui de pe board), își găsește buletinul pe board, iar telefonul recalculează amprentele. Agregatul e suma tuturor buletinelor de pe board, iar oricine o poate recalcula; decriptarea vine cu dovezi. Deci votul de pe board e sigur în total.

**8. Ce se întâmplă dacă serverul modifică un vot după ce a fost trimis?**
Lanțul de hash-uri se rupe, iar codul de urmărire al alegătorului nu mai corespunde. Dacă serverul ar reface tot lanțul de după vot, hash-ul publicat independent de comisie n-ar mai corespunde. Testul e2e și demonstrația 5 arată exact asta: verificatorul indică buletinul modificat.

**9. De ce ristretto255 și nu RSA?**
ElGamal pe curbe eliptice dă chei și criptotexte mici (32 de octeți), operații rapide și, mai ales, proprietatea homomorfă aditivă de care e nevoie la numărare. Ristretto255 elimină capcanele de cofactor ale curbei 25519 și e standardizat (RFC 9496). RSA-ul „de manual” e determinist, deci voturile se pot ghici (demonstrația 2).

**10. De ce ElGamal „exponențial”?**
Pentru că votul stă în exponent (m·G): așa, suma criptotextelor dă suma voturilor. Prețul e că la decriptare se obține T·G, nu T, dar T e mic (cel mult numărul de alegători) și se află prin baby-step giant-step în milisecunde.

**11. Dacă puteți afla T din T·G, de ce nu se poate afla și cheia secretă din Y?**
Pentru că T ≤ numărul de alegători (√10.000 = 100 de pași), iar cheia e un număr de 252 de biți (2¹²⁶ pași, imposibil). Demonstrația 3 pune cifrele alături.

**12. De ce HMAC pentru CNP și nu criptare?**
Serverul nu are nevoie să afle CNP-ul înapoi, doar să compare. HMAC e o amprentă într-un singur sens; fără cheie, nu se poate nici calcula, nici inversa. SHA-256 simplu s-ar sparge prin încercări, pentru că CNP-urile sunt puține (demonstrația 1: 68 ms).

**13. Ce garantează Passive Authentication? Dovedește că persoana e titularul actului?**
Garantează că datele de pe cip au fost scrise și semnate de stat și n-au fost modificate. Nu dovedește că persoana care ține actul e titularul (nu se verifică biometria) și nu împiedică un cip clonat (Chip Authentication nu e implementată). CAN-ul cere însă accesul fizic la card.

**14. De ce două niveluri de încredere?**
Pentru că nu toți studenții au carte electronică de identitate. Nivelul „optic” (OCR) e mai slab, iar sistemul îl marchează separat, ca să fie vizibil câte înregistrări au fost făcute așa; o înregistrare NFC nu poate fi înlocuită printr-una optică.

**15. Ce e provocarea Benaloh și de ce nu poate trișa aplicația?**
După criptare, alegătorul poate cere ca aplicația să dezvăluie numerele aleatoare; oricine recriptează și compară. Buletinul auditat se aruncă. Aplicația nu știe dinainte care buletin va fi auditat, deci, dacă trișează, riscă să fie prinsă de fiecare dată.

**16. Ce se întâmplă dacă alegătorul își pierde telefonul?**
Dacă n-a votat, se înregistrează din nou de pe alt telefon, iar credentialul vechi devine inutilizabil. Dacă a votat, votul lui e deja pe board; nu mai poate vota a doua oară.

**17. Ce se întâmplă dacă un trustee își pierde cheia?**
Cu schema n-din-n, rezultatul nu se mai poate decripta. De aceea fișierul de cheie se poate cripta cu o parolă și păstra în mai multe copii. Soluția de fond e t-din-n.

**18. Poate serverul să voteze în locul celor care nu votează?**
Doar dacă inventează și înregistrări. Fiecare buletin trebuie semnat de un credential din lista publică, iar numărul de înregistrări e public. E protecția parțială descrisă în lucrare; protecția completă cere o autoritate de înregistrare separată (Belenios).

**19. Votul e anonim? Cine știe că am votat?**
Conținutul votului e secret. Faptul că ai votat (participarea) îl poate afla cine administrează serverul, ca la votul pe hârtie, unde lista semnată arată cine a venit.

**20. Ce se întâmplă la ora închiderii?**
Serverul refuză orice vot după `closesAt`, închide singur scrutinul (verifică la fiecare minut) și publică agregatul. Verificatorul verifică faptul că niciun buletin nu are ora în afara intervalului.

**21. Cât de rapid e sistemul?**
Criptarea unui buletin durează ~20 ms; serverul validează ~40 de buletine pe secundă pe un singur proces; verificarea publică ia ~24 ms per buletin pe un fir (4 minute la 10.000), dar se împarte pe toate nucleele: ~6 s în loc de ~30 s la 1.000 de buletine, pe un PC cu 8 nuclee. Pentru o facultate (10.000 de voturi într-o zi, sub 0,2 pe secundă în medie) e suficient (Partea 12).

**22. Cum ați testat?**
125 de teste automate, dintre care 30 pornesc serverul real pe PostgreSQL, 9 verifică verificarea în paralel pe fire reale, iar 11 folosesc site-ul ca un om, într-un browser simulat; cinci demonstrații de atac; simulări cu 100, 1.000 și 10.000 de alegători, în care rezultatul publicat a fost egal cu voturile simulate și verificatorul a trecut; GitHub Actions rulează totul la fiecare modificare; tot sistemul pornit în Docker, prin HTTPS.

**23. De ce TypeScript peste tot?**
Ca o dovadă generată pe telefon să fie verificată de exact același cod pe server și la audit. Două implementări ale aceleiași matematici, în limbaje diferite, ar putea diferi într-un detaliu.

**24. Prin ce diferă de Helios și Belenios?**
Folosește aceleași idei (numărare homomorfă, dovezi ZK, verificare publică), dar adaugă identitatea cu actul național (OCR și NFC cu Passive Authentication) și protecția CNP-ului prin HMAC. Belenios are, în plus, o autoritate de credentiale separată, pe care proiectul o are doar ca extensie viitoare.

**25. De ce nu blockchain?**
Proprietatea necesară (istoria nu se poate rescrie fără să se observe) o dau lanțul de hash-uri și hash-ul publicat independent, fără costul, consumul și complexitatea unui blockchain.

**26. Ce s-ar întâmpla la 100.000 de alegători?**
Serverul ar face față votului (în medie, câteva voturi pe minut), dar verificarea publică ar dura ~40 de minute pe un singur fir. Verificarea în paralel (făcută: `worker_threads` și Web Workers) o reduce de ~5 ori pe un PC obișnuit, deci la ~8 minute; restul ar veni din semnăturile verificate în lot și din descărcarea pachetului de audit pe bucăți.

**27. Ce ați face diferit dacă ați reîncepe?**
Un răspuns onest: aș pune de la început t-din-n și o autoritate de înregistrare separată, și aș scrie testele de interfață odată cu interfețele (site-ul le are acum, 9.20; aplicația mobilă încă nu).

**28. Cum ați accelerat verificarea publică și de ce nu e de 16 ori mai rapidă pe 16 nuclee?**
Buletinele sunt independente, deci semnăturile, dovezile și agregatul lor se verifică pe bucăți, pe mai multe fire (`worker_threads` în Node, Web Workers în browser); doar lanțul de hash-uri, care leagă fiecare intrare de cea dinainte, rămâne pe firul principal. Rezultatele se pun la loc în ordinea board-ului, deci raportul e identic, lucru verificat în teste. Accelerarea e de ~5 ori, nu 16: cele 16 nuclee „logice” sunt 8 fizice cu hyperthreading, pornirea firelor costă ~0,25 s, iar partea secvențială (lanțul, combinarea) rămâne (legea lui Amdahl).

**29. Poate comisia să scoată pe cineva din listă după ce a votat? Sau să „șteargă” un vot?**
Nu. Scoaterea din listă (9.18) refuză persoanele care au votat deja: votul lor e pe board, iar board-ul e append-only (un trigger în baza de date refuză orice modificare sau ștergere) și legat prin hash-uri. Cine n-a votat poate fi scos, iar credentialul lui dispare din lista publică; acțiunea apare în jurnalul de audit, cu numele membrului comisiei, dar fără CNP-uri.

**30. Cum vă apărați de cineva care printează MRZ-ul altei persoane?**
Prin două lucruri. Înregistrarea prin OCR e marcată public drept „optică”, separat de cea prin NFC. Iar la scrutinele unde contează, comisia bifează „doar NFC” (9.21): serverul refuză atunci orice înregistrare prin scanare, iar datele de pe cip sunt semnate de stat și verificate prin Passive Authentication, deci nu pot fi printate sau inventate.

**31. Ce e procesul-verbal și de ce e util?**
O pagină de tipărit (sau de salvat ca PDF) cu tot ce e public despre scrutin: parametrii, participarea, rezultatul, hash-ul board-ului și verificarea publică rulată chiar atunci, în browser (9.22). Comisia îl semnează ca pe un proces-verbal obișnuit, dar cifrele din el pot fi reverificate oricând de oricine.

---

# Partea 15. Glosar

| Termen | Ce înseamnă |
| --- | --- |
| **AES-256-GCM** | Criptare simetrică (aceeași cheie criptează și decriptează) care detectează și orice modificare a datelor. Folosită la fișierul de cheie al trustee-ului. |
| **Agregat** | Suma criptotextelor tuturor buletinelor, câte una per opțiune. Criptează totalul fiecărui candidat. |
| **API** | Lista de operații pe care serverul le oferă programelor (rutele HTTP). |
| **Append-only** | Se poate doar adăuga, nu modifica sau șterge. Board-ul e append-only. |
| **Audit Benaloh** | Vezi *provocarea Benaloh*. |
| **Baby-step giant-step (BSGS)** | Algoritm care află un număr mic T din T·G în aproximativ √T pași. |
| **Backend simulat (mock)** | Varianta în memorie a serverului (`packages/api/src/mock`), cu aceleași reguli și criptografia reală, pentru demonstrații fără server. |
| **Ballot stuffing** | Adăugarea de buletine false, de exemplu în numele celor care nu votează. |
| **Bulletin board (board)** | Registrul public al tuturor buletinelor criptate, legate între ele prin hash-uri. |
| **CAN** | *Card Access Number*: cele 6 cifre tipărite pe fața CEI, necesare pentru PACE. |
| **Caddy** | Server web care face HTTPS automat; în proiect, primește traficul pe portul 443 și îl trimite site-ului și serverului. |
| **CEI** | Cartea electronică de identitate, cu cip. |
| **Chaum-Pedersen** | Dovadă zero-knowledge că două puncte au același multiplicator față de două baze. Folosită la suma buletinului și la decriptarea parțială. |
| **Chip Authentication** | Protocol care dovedește că cipul nu e o copie. Neimplementat. |
| **CI** | *Continuous Integration*: rularea automată a testelor la fiecare modificare (GitHub Actions). |
| **Cifră de control** | O cifră calculată din celelalte, care prinde greșelile de citire (la CNP și în MRZ). |
| **CLI** | Program din linia de comandă (terminal): `evoting-trustee`, `evoting-verify`, `evoting-simulate`. |
| **CNP** | Codul numeric personal, 13 cifre. |
| **Cod de urmărire** | Hash-ul intrării alegătorului de pe board; cu el își caută buletinul. |
| **Comisie / observator** | Cele două roluri ale membrilor comisiei: primul poate face orice, al doilea doar citește. |
| **Container / imagine (Docker)** | Imaginea e un program împachetat cu tot ce-i trebuie; containerul e imaginea pornită. |
| **Context (Fiat-Shamir)** | Datele care intră în hash-ul unei dovezi (scrutin, credential, poziție), ca dovada să nu poată fi copiată în alt loc. |
| **CORS** | Regula browserului care spune ce site-uri au voie să cheme API-ul; serverul declară originile permise (`CORS_ORIGINS`). |
| **Credential** | Perechea de chei Ed25519 a alegătorului, generată pe telefon. Cheia publică e pe server, cea secretă rămâne pe telefon. |
| **Criptotext** | Rezultatul criptării; la ElGamal, perechea (A, B). |
| **CSCA / DSC** | Certificatul rădăcină al statului emitent / certificatul care semnează SOD-ul unui document. |
| **CSV** | Fișier text cu valori separate prin virgulă; lista de eligibili e un CSV cu un CNP pe linie. |
| **DG1 / SOD** | Grupul de date cu MRZ-ul / obiectul cu amprentele grupurilor de date, semnat de stat. Ambele citite de pe cip. |
| **Docker Compose** | Pornirea mai multor containere legate între ele dintr-un singur fișier (`docker-compose.yml`). |
| **Draft / open / closed / tallied** | Stările scrutinului: configurare, vot deschis, vot închis, rezultat publicat. |
| **Dovadă zero-knowledge (ZK)** | Dovadă că o afirmație e adevărată, fără să dezvăluie nimic altceva. |
| **Ed25519** | Algoritm de semnătură digitală, folosit pentru credentiale. |
| **ElGamal exponențial** | Criptarea folosită pentru voturi: Enc(m) = (r·G, m·G + r·Y). Suma criptotextelor criptează suma voturilor. |
| **End-to-end (verificabilitate)** | Votul se poate verifica de la un capăt la altul: criptat cum a vrut alegătorul, înregistrat cum l-a trimis, numărat cum a fost înregistrat. |
| **Expo / React Native** | Platforma și cadrul cu care e scrisă aplicația mobilă, în TypeScript. |
| **Fiat-Shamir** | Transformarea unei dovezi interactive în una neinteractivă: provocarea devine hash-ul datelor publice. |
| **Genesis (hash)** | Hash-ul de pornire al lanțului, derivat din ID-ul scrutinului. |
| **Grup / punct / scalar** | Mulțimea în care se fac calculele (ristretto255) / elementele ei / numerele cu care se înmulțesc punctele. |
| **Guard** | În NestJS, clasa care decide dacă o cerere are voie la o rută (`AdminGuard`, `CommissionGuard`). |
| **Hash** | Amprentă de lungime fixă a unui text; proiectul folosește SHA-256. |
| **Hash publicat independent** | Perechea `poziție:hash` a ultimei intrări, publicată de comisie în afara serverului, ca istoria board-ului să nu poată fi rescrisă. |
| **Helmet** | Bibliotecă ce adaugă antetele de securitate HTTP. |
| **Hex** | Scrierea octeților cu caracterele 0–9 și a–f, câte două per octet. |
| **HMAC** | Hash cu cheie secretă; fără cheie, amprenta nu se poate calcula. |
| **Homomorfă (proprietate)** | Operația pe criptotexte corespunde unei operații pe mesaje: suma criptotextelor criptează suma voturilor. |
| **HSTS** | Antet care obligă browserul să folosească doar HTTPS pentru acel site. |
| **HTTPS / TLS** | HTTP criptat; TLS e protocolul de criptare. |
| **Jurnal de audit** | Lista acțiunilor (cine, ce, când), vizibilă comisiei. |
| **JSON canonic** | JSON cu cheile sortate și fără spații, ca același obiect să dea mereu același hash. |
| **Logaritm discret** | Problema găsirii lui x din x·G; practic imposibilă pentru x mare. Pe ea se bazează securitatea. |
| **Migrare** | Fișier SQL care creează sau modifică tabelele; se aplică automat, o singură dată. |
| **Monorepo / workspaces** | Mai multe pachete într-un singur depozit git, instalate și legate împreună de npm. |
| **jsdom** | Un browser simulat în Node, folosit de testele site-ului: pagina există doar în memorie, fără ecran. |
| **MRZ** | *Machine Readable Zone*: rândurile cu `<<<` de pe act. |
| **n-din-n** | Schema în care decriptarea cere toți cei n trustees. |
| **NestJS** | Cadrul cu care e scris serverul (controllere, servicii, guard-uri, module). |
| **NFC** | Comunicare fără fir la câțiva centimetri; telefonul citește cipul CEI. |
| **Nonce** | Număr aleator folosit o singură dată (la provocarea de autentificare). |
| **OCR** | Recunoașterea textului dintr-o imagine. |
| **Proces-verbal** | Documentul de tipărit al scrutinului (`/scrutin/:id/proces-verbal`): parametrii, participarea, rezultatul, hash-ul board-ului și verificarea publică. |
| **Optic / criptografic** | Nivelul de încredere al înregistrării: prin OCR (MRZ citit din fotografie) sau prin NFC (datele semnate de stat, verificate). |
| **PACE** | Protocolul care deschide un canal criptat între telefon și cip, pe baza CAN-ului. |
| **Passive Authentication** | Verificarea semnăturii statului pe datele cipului (SOD → DSC → CSCA). |
| **PKI de test** | Un CSCA și un DSC „de laborator” pentru cipuri simulate; nu au legătură cu certificatele reale. |
| **PostgreSQL** | Baza de date a serverului. |
| **Provocare (challenge)** | Număr aleator trimis de server, pe care telefonul îl semnează ca să dovedească posesia cheii. |
| **Provocarea Benaloh** | Auditul unui buletin prin dezvăluirea numerelor aleatoare; buletinul auditat se aruncă. |
| **Re-înregistrare** | Înlocuirea credentialului unei persoane care n-a votat încă (alt telefon), la același nivel de încredere sau mai mare. |
| **Ristretto255** | Grupul de ordin prim (RFC 9496), construit peste Curve25519, în care se fac toate calculele. |
| **Rută** | O adresă a API-ului cu o metodă HTTP, de exemplu `POST /elections/:id/ballots`. |
| **Schnorr (dovadă)** | Dovadă zero-knowledge că știi x pentru Y = x·G; folosită la cheile trustees. |
| **scrypt** | Funcție care obține o cheie dintr-o parolă, lentă intenționat, ca ghicirea parolei să fie scumpă. |
| **SecureStore** | Stocarea criptată de pe telefon (cu cheie din Android Keystore). |
| **Sesiune** | Token semnat de server, valabil 10 minute, care permite trimiterea buletinului. |
| **SHA-256 / SHA-512** | Funcții hash standard, cu amprente de 32, respectiv 64 de octeți. |
| **Supabase** | Serviciu care oferă PostgreSQL găzduit. |
| **Timp constant (comparație)** | Comparație a cărei durată nu depinde de conținut, ca un atacator să nu afle nimic din timpul de răspuns. |
| **Token** | Șir secret care dă acces (comisie, membru, trustee); serverul păstrează doar SHA-256 al lui. |
| **Tranzacție** | Grup de operații pe baza de date care reușesc toate sau niciuna. |
| **Trigger** | Regulă a bazei de date care rulează automat la o operație; aici, refuză modificarea board-ului. |
| **Trustee** | Deținătorul unei părți din cheia de decriptare. |
| **t-din-n** | Schema în care oricare t din n trustees pot decripta (extensie viitoare). |
| **TypeScript** | JavaScript cu tipuri; limbajul întregului proiect, în afară de modulele Kotlin. |
| **Verificator public** | Programul care reface toate verificările unui scrutin (`verifyElection`, în browser și CLI). |
| **Vot alb** | Opțiunea „niciun candidat”, tratată criptografic ca orice altă opțiune și afișată separat. |

---

*Ghid scris pe 18 noiembrie 2026, pe codul de atunci. Dacă se schimbă codul, actualizează în special Părțile 4, 6, 7, 9 și 11 (fișierele, tabelele, rutele, schimbările și numărul de teste).*
