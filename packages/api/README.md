# @evoting/api

Stratul comun dintre clienți (web, mobil, CLI-uri) și server: contractul HTTP, clientul, backend-ul simulat cu criptografie reală, citirea actelor de identitate și pașii alegătorului.

## Foldere

| Folder / fișier | Ce face |
| --- | --- |
| `src/contract/` | Tipurile cererilor și răspunsurilor, câte un fișier pe temă: `election.ts` (inclusiv votul alb și modificarea), `voter.ts`, `board.ts` (inclusiv pagina de board), `admin.ts` (membrii comisiei și rolurile), `errors.ts` (`ApiError`), `client.ts` (interfața `ApiClient`). |
| `src/client/http.ts` | Clientul HTTP real (`fetch`, `Authorization: Bearer …`, erorile NestJS traduse). |
| `src/mock/` | Backend-ul simulat în memorie, cu aceleași reguli ca serverul: `state.ts` (starea), `rules.ts` (regulile), `seed.ts` (scrutinele de demonstrație), `client.ts` (rutele), `tools.ts` (uneltele de test), `random.ts`, `index.ts` (`createMockBackend`). |
| `src/identity/` | `cnp.ts` (validare și generator), `mrz.ts` (parserul ICAO 9303: TD1, TD2, TD3, cifre de control, CNP), `mrz-build.ts` (MRZ-uri de test), `dg1.ts` (MRZ-ul din DG1 de pe cip). |
| `src/voter.ts` | `authenticate`, `prepareBallot`, `submitBallot`, `verifyOwnBallot`. |
| `src/format.ts` | Etichetele și formatările comune site-ului și aplicației: stări, metode, niveluri, roluri, „Vot alb”, date, hash-uri, procente, durate, `intervalPhase`. |
| `src/index.ts` | Exporturile publice (neschimbate de reorganizare). |

## Teste

`npm test -w @evoting/api` rulează 20 de teste: `cnp.test.ts` (3), `mrz.test.ts` (7), `dg1.test.ts` (3), `mock.test.ts` (7: un scrutin complet pe backend-ul simulat, verificat de verificatorul public; scrutinele de demonstrație; re-înregistrarea; votul alb; modificarea și ștergerea; intervalul și închiderea automată; uneltele de test și membrii).

Detalii: [docs/DOCUMENTATIE.md §6](../../docs/DOCUMENTATIE.md#6-identitatea-cnp-mrz-și-nfc) și [docs/explicatii/03](../../docs/explicatii/03-cum-circula-cererile.md).
