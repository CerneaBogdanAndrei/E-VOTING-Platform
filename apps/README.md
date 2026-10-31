# Frontend – vot electronic verificabil

Două aplicații, separate de backend, care vorbesc cu el doar prin HTTP:

| Aplicație | Tehnologie | Pentru cine |
| --- | --- | --- |
| `web/` | React + Vite | Comisia (creare scrutin, import eligibili, deschidere/închidere) și pagina publică (bulletin board, rezultat) |
| `mobile/` | React Native + Expo (Expo Router) | Alegătorul (înregistrare OCR/NFC, vot, cod de urmărire, verificare) |

## Pornire

```bash
cd web && npm install && npm run dev          # http://localhost:5173
cd mobile && npm install && npx expo start    # scanezi QR-ul cu Expo Go, sau apeși „w” pentru browser
```

## Backend simulat sau real

Fără nicio configurare, ambele aplicații folosesc un backend simulat în memorie (`src/api/mock.ts`), cu trei scrutine
de test. Are aceleași reguli ca API-ul real (eligibilitate, vot dublu, buletin invalid, lanț de hash-uri) și se
resetează la reîncărcare. Panoul comisiei are și „Unelte de test” care țin locul trustees și al alegătorilor.

Când backend-ul NestJS rulează, setezi URL-ul și aplicațiile trec pe API-ul real:

- web: `VITE_API_URL=http://localhost:3000` în `web/.env.local`
- mobile: `EXPO_PUBLIC_API_URL=http://<IP-ul calculatorului>:3000` în `mobile/.env.local` (pe telefon, nu `localhost`)

## Stratul API comun

`web/src/api` e sursa de adevăr: `types.ts` (contractul cu backend-ul), `http.ts`, `mock.ts`, `cnp.ts`, `ballot.ts`.
După o modificare acolo, rulează `node sync-api.mjs` ca să le copiezi în `mobile/src/api`. Doar `platform.ts` și
`config.ts` diferă între aplicații.

`ballot.ts` e un placeholder: nu criptează nimic. Se înlocuiește cu biblioteca de criptografie (ElGamal pe
ristretto255 și dovezi Chaum-Pedersen) când e gata.
