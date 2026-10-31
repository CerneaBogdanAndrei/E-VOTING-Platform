# 6. Performanța și testele

## 6.1 Cum s-a măsurat

Programul `tools/simulator` rulează un scrutin **complet** contra serverului real:

1. creează un scrutin cu 3 candidați și 3 trustees;
2. importă N CNP-uri fictive, dar valide ca format;
3. pentru fiecare alegător, câte 8 în paralel: înregistrare (o parte prin OCR, o parte prin NFC cu cipuri de test; la 10.000 de alegători, 10% NFC), autentificare, criptare, trimitere;
4. închide votul și face decriptarea fiecărui trustee;
5. compară rezultatul publicat cu voturile simulate;
6. rulează verificatorul public;
7. salvează toate timpii în `docs/evaluare/simulare-N.json`.

Comanda (cu serverul pornit cu `RATE_LIMIT=off`, pentru că toți alegătorii simulați vin de pe aceeași adresă):

```bash
npx evoting-simulate --admin-token <TOKEN> --voters 1000 --nfc 0.2 --pki apps/backend/pki --report raport.json
```

**Atenție la interpretare:** clientul (alegătorii simulați), serverul și PostgreSQL au rulat **pe același calculator**, împărțind procesorul. Pe un server real, cu clienții pe telefoanele lor, timpii de server ar fi mai mici.

## 6.2 Rezultatele

| Ce s-a măsurat | 100 de alegători | 1.000 | 10.000 |
| --- | --- | --- | --- |
| Criptare + dovezi pentru un buletin (client, în Node) | 20,8 ms | 19,2 ms | 19,5 ms |
| Trimiterea unui vot, dus-întors, sub încărcare | 218 ms | 209 ms | 230 ms |
| Voturi procesate pe secundă | 17,4 | 19,5 | 19,0 |
| Închiderea (calculul totalurilor criptate) | 115 ms | 718 ms | 7,8 s |
| Decriptarea parțială a unui trustee | 16 ms | 13 ms | 13 ms |
| Verificarea publică completă | 2,5 s | 25,8 s | 239 s (4 minute) |
| Verificare per buletin | 24,9 ms | 25,8 ms | 23,9 ms |
| Rezultatul publicat e identic cu voturile simulate | da | da | da |
| Verificatorul public trece | da | da | da |

Alte valori din raportul pentru 10.000:

- înregistrarea, dus-întors: 89 ms în medie;
- pachetul public de audit (`audit-bundle`): 21,7 MB;
- durata totală a simulării: ~13 minute.

### Cum citești coloanele din fișierele JSON

| Câmp | Ce înseamnă |
| --- | --- |
| `avg` | Media. |
| `p50` | Mediana: jumătate din valori sunt sub ea. |
| `p95` | 95% din valori sunt sub ea; arată cazurile lente, dar nu extreme. |
| `max` | Cea mai lentă valoare. |
| `ms` | Milisecunde (1.000 ms = 1 secundă). |

## 6.3 Ce înseamnă rezultatele, pe înțeles

- **Criptarea durează ~20 ms.** Telefonul alegătorului face 3 criptări, 3 dovezi 0/1, o dovadă a sumei și o semnătură în mai puțin de o zecime de secundă. În browser, pe varianta web a aplicației, a durat ~9 ms. Pe un telefon Android real încă nu s-a măsurat (e una dintre metricile cerute de plan).
- **Serverul validează ~40 de buletine pe secundă.** Verificarea unui buletin costă ~25 ms de procesor. La 10.000 de voturi într-o zi, media e sub 0,2 voturi pe secundă, deci serverul e de 200 de ori mai rapid decât e nevoie.
- **Închiderea și verificarea cresc liniar.** De 10 ori mai multe voturi înseamnă de ~10 ori mai mult timp: ~24 ms per buletin la verificare. La 10.000 de voturi, verificarea completă durează 4 minute, iar o poate face oricine, pe laptopul propriu.
- **Decriptarea nu depinde de numărul de voturi.** Trustees decriptează doar cele 3 totaluri, nu fiecare vot, deci durează ~13 ms indiferent dacă au votat 100 sau 10.000 de oameni.
- **Rezultatul a fost corect de fiecare dată**, iar verificatorul a trecut toți pașii.

## 6.4 Testele automate

Un **test** e un mic program care folosește codul proiectului și verifică dacă rezultatul e cel așteptat. Exemplu, în cuvinte: „criptează un vot pentru candidatul 2; verifică dovezile; trebuie să treacă”. Sau invers: „modifică un criptotext; verificarea trebuie să pice”.

Testele folosesc `node --test`, programul de teste încorporat în Node, și `assert` pentru verificări:

```ts
assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
```

= „exact una dintre cele două trimiteri trebuie să fi reușit”.

| Suită | Câte teste | Ce verifică |
| --- | --- | --- |
| `packages/crypto` | 35 | JSON canonic, HMAC (cu vectorul oficial RFC 4231), ElGamal, adunarea criptotextelor, baby-step giant-step, buletine valide, toate tipurile de buletine invalide (vot 2, vot −1, două voturi, niciun vot, dovezi copiate din alt scrutin, buletin copiat de alt alegător), Benaloh, trustees care trișează, verificatorul pe 11 tipuri de manipulare. |
| `packages/api` | 11 | CNP, MRZ (exemplele oficiale ICAO, buletinul vechi, CEI, zgomot de OCR), DG1 și un scrutin complet pe serverul simulat. |
| `apps/backend` | 17 | Pe un PostgreSQL real: tot fluxul, token-uri greșite, NFC (cip valid, DG1 modificat, CSCA străin, semnătură alterată), autentificare, buletine invalide, două voturi simultane, board-ul append-only, trustee care trișează, verificatorul, căutarea CNP-urilor în toată baza (nu trebuie să existe niciunul), un administrator care modifică board-ul direct în bază, jurnalul de audit, limitarea de rată. |
| **Total** | **63** | |

### Cum rulezi testele pe PC

Din `D:\Licenta_E-vote`, în PowerShell:

```bash
$env:TEST_DATABASE_URL="postgres://evoting:evoting@localhost:5433/evoting_test"; npm test
```

Testele de server au nevoie de containerul de test `evoting-test`, pornit pe portul 5433. Dacă e oprit (de exemplu, după o repornire a calculatorului), îl pornești cu:

```bash
docker start evoting-test
```

Fără `TEST_DATABASE_URL`, testele de server apar ca „sărite” (`SKIP`), nu ca picate.

**Nu rula niciodată testele pe Supabase:** `test/helpers.ts` șterge toate tabelele bazei la început (`DROP SCHEMA public CASCADE`).

### Pe GitHub

La fiecare `git push`, `ci.yml` rulează aceleași 63 de teste pe serverele GitHub, cu un PostgreSQL pornit ca serviciu. Pe pagina proiectului, la **Actions**, vezi ✓ sau ✗ pentru fiecare push.

### Testul reparat recent

Testul „două voturi trimise simultan cu același credential” trimite două voturi diferite în același timp și verifică dacă doar unul intră. Ordinea în care ajung e întâmplătoare. Testul presupunea că intră mereu primul, deci uneori numărătoarea finală nu se potrivea și CI-ul pica. Acum testul ține cont de votul care a intrat efectiv. Aplicația a fost corectă tot timpul.

## 6.5 Demonstrațiile de atac

Programele din `demos/attacks` arată, cu cifre, de ce s-au făcut anumite alegeri:

| Demonstrație | Rezultat |
| --- | --- |
| 1. CNP: SHA-256 vs HMAC | Cu SHA-256, CNP-ul a fost găsit după 18.909 încercări, în 68 ms. Cu HMAC fără cheie: 0 potriviri. |
| 2. Ghicirea votului | La RSA fără padding, votul se află comparând criptotextele. La ElGamal: 0 potriviri, pentru că fiecare criptare e diferită. |
| 3. Baby-step giant-step vs cheia secretă | Totaluri de până la un milion, aflate în ≤ 260 ms. Căutarea cheii: ~10⁶³ ani. |
| 4. Ghicirea token-ului prin API | Primele 30 de încercări primesc 401, următoarele 429 (blocate). |
| 5. Board modificat direct în bază | Verificatorul arată exact buletinul #42 ca fiind modificat; după restaurare, trece din nou. |

Comenzile:

```bash
npm run build -w @evoting/attacks
npm run cnp -w @evoting/attacks
npm run deterministic -w @evoting/attacks
npm run bsgs -w @evoting/attacks
```

## 6.6 Comenzile utile, într-un singur loc

Toate din `D:\Licenta_E-vote`:

| Ce vrei | Comanda |
| --- | --- |
| Instalezi tot (o dată, sau după `git pull`) | `npm install` |
| Compilezi tot | `npm run build` |
| Rulezi testele | vezi 6.4 |
| Pornești serverul pe Supabase, fără Docker | `cd apps/backend` apoi `npm run dev` |
| Pornești site-ul în dezvoltare (port 5173) | `cd apps/web` apoi `npm run dev` |
| Pornești tot cu Docker (site 8080, API 3000) | `docker compose up --build -d` |
| Oprești Docker | `docker compose down` |
| Vezi ce containere rulează | `docker compose ps` |
| Vezi jurnalul serverului din Docker | `docker compose logs backend` |
| Aplici migrările pe bază | `cd apps/backend` apoi `npm run migrate` |
