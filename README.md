# Vot electronic verificabil

Sistem de vot online în care fiecare alegător își poate verifica votul, iar oricine poate verifica rezultatul, fără ca vreun vot individual să fie decriptat. Este proiectul de licență pentru UDJG (ACIEE); scenariul principal sunt alegerile studențești.

- **Criptografie:** ElGamal exponențial pe ristretto255, dovezi zero-knowledge Chaum-Pedersen (0/1 și suma = 1), numărare homomorfă, decriptare n-din-n de către trustees, bulletin board cu lanț de hash-uri.
- **Identitate:** înregistrare cu buletinul, prin OCR pe zona MRZ sau prin NFC pe CEI, cu Passive Authentication. Serverul păstrează doar `HMAC(k, CNP)`.
- **Verificare:** cod de urmărire pentru fiecare alegător, provocarea Benaloh și un verificator public (în browser și CLI) care reface toate dovezile.

**Documentația completă, pas cu pas: [DOCUMENTATIE.md](DOCUMENTATIE.md). Explicația fiecărui fișier și a tot ce s-a construit: [EXPLICATIE.md](EXPLICATIE.md).**

## Structura

| Folder | Ce conține |
| --- | --- |
| `packages/crypto` | toată criptografia, folosită de toate componentele |
| `packages/api` | contractul HTTP, clientul, backend-ul simulat, CNP, MRZ |
| `apps/backend` | NestJS + PostgreSQL |
| `apps/web` | panoul comisiei și pagina publică (React) |
| `apps/mobile` | aplicația alegătorului (Expo / React Native, module Kotlin NFC și OCR) |
| `tools/trustee`, `tools/verifier`, `tools/simulator` | CLI-urile: trustee, verificatorul public, alegeri simulate |
| `demos/attacks` | demonstrațiile de atac |

## Pornire rapidă

```bash
npm install && npm run build
npm test                                   # teste unitare + end-to-end (PostgreSQL)

npm run dev -w @evoting/web                # site-ul, cu backend simulat: http://localhost:5173
cd apps/mobile && npm install && npx expo start   # aplicația mobilă (Expo Go)

cp .env.example .env && docker compose up --build # tot sistemul: web :8080, API :3000
```

Pașii detaliați, cu backend-ul real, trustees și verificarea, sunt în [DOCUMENTATIE.md](DOCUMENTATIE.md#3-pornire).

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

SSL-ul se activează automat pentru orice server care nu e local (`DATABASE_SSL=off` îl oprește). Migrarea
`002_rls.sql` pornește Row Level Security pe toate tabelele, ca datele să nu fie accesibile prin API-ul REST
public al Supabase; backend-ul se conectează ca proprietar și nu e afectat.
