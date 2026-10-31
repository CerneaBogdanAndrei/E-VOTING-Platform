# Vot electronic verificabil end-to-end

Lucrare de licență (UDJG). Alegătorul se înregistrează cu buletinul (OCR sau NFC), votează criptat din aplicația
mobilă și își poate verifica votul pe bulletin board-ul public. Rezultatul îl poate verifica oricine, fără să aibă
încredere în server.

- ElGamal exponențial pe ristretto255 (`@noble/curves`), dovezi disjunctive CDS, Chaum–Pedersen, Fiat–Shamir legat de scrutin și credential
- n trustees, fiecare cu cheia lui; niciunul nu poate decripta singur
- numărare homomorfă (se decriptează doar suma, niciodată un buletin), logaritm discret prin BSGS
- audit Benaloh („cast or audit”), CNP stocat doar ca HMAC, bulletin board înlănțuit prin hash-uri

## Structura

| Director | Ce conține |
| --- | --- |
| `packages/crypto` | Toată criptografia: ElGamal, dovezi ZK, buletine, numărare, board, verificator, CNP, MRZ (37 de teste) |
| `packages/api` | Tipurile API-ului și clientul HTTP, folosite de web, mobile și CLI-uri |
| `apps/backend` | NestJS: înregistrare OCR/NFC (Passive Authentication), autentificare, board, numărare (33 de teste e2e) |
| `apps/web` | React + Vite: panoul comisiei și pagina publică a scrutinului (cu verificator în browser) |
| `apps/mobile` | Expo (React Native): aplicația alegătorului |
| `tools/trustee` | CLI-ul trustee-ului: `keygen`, `decrypt`, `status` |
| `tools/verifier` | Verificatorul public independent |
| `demos` | Simularea unui scrutin complet și cele 5 demonstrații de atac |
| `macheta-evoting` | Macheta inițială, păstrată ca referință |

## Instalare

Ai nevoie de Node.js 22.12 sau mai nou.

```bash
npm install
npm run build          # crypto, api, backend și cele două CLI-uri
```

## Pornire

```bash
cp apps/backend/.env.example apps/backend/.env   # apoi completezi (vezi mai jos)
npm run dev:backend                              # http://localhost:3000
npm run dev:web                                  # http://localhost:5173, parola comisiei = ADMIN_PASSWORD
cd apps/mobile && npm install && npx expo start  # Expo Go pe telefon, sau „w” pentru browser
```

Pe telefon, aplicația mobilă trebuie să știe IP-ul calculatorului: `EXPO_PUBLIC_API_URL=http://192.168.x.x:3000`
în `apps/mobile/.env.local`. Pentru web, `VITE_API_URL` în `apps/web/.env.local` (implicit `http://localhost:3000`).

Cu `DEMO_MODE=true`, panoul comisiei are unelte care simulează trustees și alegători, iar aplicația mobilă are un
document NFC de test. Nu se folosește în producție.

Fără `DATABASE_URL`, backend-ul ține datele în memorie (se pierd la repornire, sau le salvezi cu `DATA_FILE`).

## Baza de date în Supabase

1. Creezi proiectul pe [supabase.com](https://supabase.com). Parola bazei de date o păstrezi doar la tine.
2. **SQL Editor → New query**, lipești tot conținutul din [`apps/backend/db/schema.sql`](apps/backend/db/schema.sql)
   și apeși **Run**. Se creează cele 9 tabele, trigger-ul care face board-ul append-only și RLS (care blochează
   accesul prin API-ul public Supabase; backend-ul se conectează direct, ca proprietar).
3. Butonul **Connect** din partea de sus → **Session pooler** → copiezi URI-ul (portul 5432).
4. În `apps/backend/.env` (nu se urcă pe GitHub):
   ```
   DATABASE_URL=postgresql://postgres.<ref>:<parola>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   CNP_HMAC_KEY=<64 de caractere hex>
   ADMIN_PASSWORD=<parola comisiei>
   ```
   Cheia HMAC o generezi cu `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` și n-o pierzi:
   fără ea, CNP-urile din bază nu mai pot fi comparate.
5. `npm run dev:backend`. În log apare că stocarea e PostgreSQL.

Pasul 2 se poate face și din terminal, după ce ai pus `DATABASE_URL`: `npm run db:migrate -w @evoting/backend`.
SSL-ul e pornit automat pentru orice server care nu e `localhost` (`DATABASE_SSL=off` îl oprește).

## Scrutin complet, din linia de comandă

```bash
npm run demo                                             # simulare cap-coadă prin HTTP, cu CLI-urile reale
npm run trustee -- keygen  --election ID --trustee t1 --code COD
npm run trustee -- decrypt --election ID --trustee t1 --code COD
npm run verify  -- --election ID [--anchor HASH] [--save registru.json]
npm run verify  -- --file registru.json
```

Codurile trustees le generează comisia din panoul web. Cheia secretă rămâne în
`<scrutin>.<trustee>.trustee-key.json` (permisiuni 600). Înainte de decriptare, CLI-ul verifică board-ul și
recalculează agregatul: dacă serverul cere altceva decât suma buletinelor, refuză.

## Teste și demonstrații de atac

```bash
npm test                                                  # crypto + e2e backend
TEST_DATABASE_URL=postgres://... npm test -w @evoting/backend   # aceleași teste e2e pe PostgreSQL
npm run attack:cnp -w @evoting/demos           # SHA-256 pe CNP se sparge în secunde, HMAC nu
npm run attack:deterministic -w @evoting/demos # criptare deterministă vs. aleatoare
npm run attack:bsgs -w @evoting/demos          # BSGS merge pe sumă, nu pe cheia privată
npm run attack:api -w @evoting/demos           # brute force pe API, oprit de rate limiting
npm run attack:tamper -w @evoting/demos        # modificarea board-ului e prinsă de verificator
```

## Docker (opțional)

`docker compose up --build` pornește PostgreSQL, backend-ul (port 3000) și panoul web (port 8080).
