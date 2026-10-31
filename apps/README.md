# Aplicațiile

| Aplicație | Tehnologie | Pentru cine |
| --- | --- | --- |
| `backend/` | NestJS | API-ul: înregistrare, autentificare, bulletin board, numărare |
| `web/` | React + Vite | Comisia (scrutine, eligibili, trustees, deschidere/închidere) și pagina publică |
| `mobile/` | Expo (Expo Router) | Alegătorul: înregistrare OCR/NFC, vot criptat, audit Benaloh, verificare |

Web și mobile folosesc backend-ul real prin `@evoting/api` și criptografia din `@evoting/crypto`.
Pornirea, configurarea și pașii pentru Supabase sunt în [README-ul principal](../README.md).

Aplicația mobilă e un proiect Expo separat (nu face parte din workspace-urile npm): rulează `npm run build`
în rădăcină înainte de `npm install` în `apps/mobile`, ca pachetele locale să fie compilate.
