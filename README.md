# Vot electronic verificabil

Sistem de vot online în care fiecare alegător își poate verifica votul, iar oricine poate verifica rezultatul, fără ca vreun vot individual să fie decriptat. Este proiectul de licență pentru UDJG (ACIEE); scenariul principal sunt alegerile studențești.

- **Criptografie:** ElGamal exponențial pe ristretto255, dovezi zero-knowledge Chaum-Pedersen (0/1 și suma = 1), numărare homomorfă, decriptare n-din-n de către trustees, bulletin board cu lanț de hash-uri.
- **Identitate:** înregistrare cu buletinul, prin OCR pe zona MRZ sau prin NFC pe CEI, cu Passive Authentication. Serverul păstrează doar `HMAC(k, CNP)`.
- **Verificare:** cod de urmărire pentru fiecare alegător, provocarea Benaloh și un verificator public (în browser și CLI) care reface toate dovezile.

## Documentația

Toată documentația e în [docs/](docs/README.md):

| Document | Pentru ce |
| --- | --- |
| [docs/GHID-COMPLET.md](docs/GHID-COMPLET.md) | **Începe de aici.** Tot proiectul explicat de la zero, într-un singur fișier: ideile, tehnologiile și de ce, fiecare fișier, drumul unui vot prin cod, baza de date, rutele, securitatea, cum pornești totul, testele, întrebări pentru susținere. |
| [docs/DOCUMENTATIE.md](docs/DOCUMENTATIE.md) | Documentația completă, pas cu pas: teorie, pornire, securitate, evaluare. |
| [docs/EXPLICATIE.md](docs/EXPLICATIE.md) | Ce s-a construit, în ordine, și ce face fiecare fișier. |
| [docs/ANALIZA.md](docs/ANALIZA.md) | Ce e bun, ce lipsește, ce s-a rezolvat și planul de dezvoltare. |
| [docs/explicatii/](docs/explicatii/README.md) | Totul explicat de la zero, cuvânt cu cuvânt, în șapte capitole, inclusiv codul linie cu linie. |

Fiecare pachet și aplicație are un `README.md` cu harta fișierelor lui.

## Structura

```
packages/crypto/    criptografia, folosită de toate componentele
packages/api/       contractul HTTP (contract/), clientul (client/), backend-ul simulat (mock/),
                    CNP, MRZ și DG1 (identity/), pașii alegătorului (voter.ts)
apps/backend/       NestJS + PostgreSQL, un folder per modul:
                    admin, elections, trustees, registration, auth, ballots, tally, nfc, audit, system
apps/web/           panoul comisiei (scrutine, membri) și pagina publică (React): pages/commission, pages/election, components, styles
apps/mobile/        aplicația alegătorului (Expo / React Native): app/ (ecranele), components/, lib/, module Kotlin NFC și OCR
tools/trustee/      CLI-ul trustee-ului: keygen, decrypt, status
tools/verifier/     verificatorul public: verify, audit-ballot
tools/simulator/    alegeri simulate cu alegători sintetici și metrici
demos/attacks/      cele cinci demonstrații de atac
demos/macheta/      macheta inițială (MODP-2048), păstrată pentru istoric
docs/               documentația și măsurătorile (evaluare/)
infra/              Caddyfile: HTTPS pentru Docker Compose
apk/                APK-ul construit de GitHub Actions
```

## Pornire rapidă

```bash
npm install && npm run build
npm run lint && npm run format:check
npm test                                   # 54 + 27 de teste unitare, 33 pentru server (30 end-to-end pe PostgreSQL), 11 pentru site

npm run dev -w @evoting/web                # site-ul, cu backend simulat: http://localhost:5173
cd apps/mobile && npm install && npx expo start   # aplicația mobilă (Expo Go)

cp .env.example .env && docker compose up --build # tot sistemul: https://localhost (API la /api); direct web :8080, API :3000
```

La `https://localhost`, browserul cere o confirmare: certificatul e unul local, emis de Caddy pentru demo. Pașii pe larg, inclusiv pe Windows, sunt în [docs/GHID-COMPLET.md, Partea 10](docs/GHID-COMPLET.md#partea-10-cum-pornești-și-folosești-totul-pas-cu-pas).

Testele end-to-end au nevoie de un PostgreSQL de test. Cu Docker:

```bash
docker run -d --name evoting-test -p 5433:5432 -e POSTGRES_USER=evoting -e POSTGRES_PASSWORD=evoting -e POSTGRES_DB=evoting_test postgres:16-alpine
TEST_DATABASE_URL=postgres://evoting:evoting@localhost:5433/evoting_test npm test
```

Fără `TEST_DATABASE_URL`, testele serverului sunt sărite, nu picate. Pașii detaliați, cu backend-ul real, trustees și verificarea, sunt în [docs/DOCUMENTATIE.md](docs/DOCUMENTATIE.md#3-pornire).

## Baza de date în Supabase

1. Creezi proiectul pe [supabase.com](https://supabase.com). Parola bazei de date o păstrezi doar la tine, nu o trimiți nimănui.
2. Butonul **Connect** din partea de sus → **Session pooler** → copiezi URI-ul (portul 5432) și înlocuiești `[YOUR-PASSWORD]`.
3. În `apps/backend/.env` (nu se urcă pe GitHub) pui:
   ```
   DATABASE_URL=postgresql://postgres.<ref>:<parola>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   CNP_HMAC_KEY=<openssl rand -hex 32>
   ADMIN_TOKEN=<openssl rand -hex 24>
   ```
4. `npm run build -w @evoting/backend && npm run dev -w @evoting/backend`. La pornire, backend-ul creează singur
   tabelele (migrările din `apps/backend/migrations/`), deci nu trebuie să lipești nimic în SQL Editor. Dacă vrei
   doar tabelele, fără să pornești serverul: `npm run migrate -w @evoting/backend`.

SSL-ul se activează automat pentru orice server care nu e local (`DATABASE_SSL=off` îl oprește). În Docker Compose,
unde baza locală din container nu are SSL, pune `DATABASE_SSL=on` în `.env` când folosești Supabase. Migrarea
`002_rls.sql` pornește Row Level Security pe toate tabelele, ca datele să nu fie accesibile prin API-ul REST
public al Supabase; backend-ul se conectează ca proprietar și nu e afectat.
