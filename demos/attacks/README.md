# demos/attacks: demonstrațiile de atac

Toate rulează pe sistemul propriu, cu CNP-uri fictive valide ca format. Rezultatele obținute sunt în [docs/DOCUMENTATIE.md §9](../../docs/DOCUMENTATIE.md#9-demonstrațiile-de-atac).

```bash
npm run build -w @evoting/attacks
npm run cnp -w @evoting/attacks            # 1. SHA-256 vs HMAC pe CNP (src/cnp-dictionary.ts)
npm run deterministic -w @evoting/attacks  # 2. ghicirea votului: RSA „de manual” vs ElGamal (src/deterministic-encryption.ts)
npm run bsgs -w @evoting/attacks           # 3. baby-step giant-step vs căutarea cheii (src/bsgs-vs-key.ts)
node demos/attacks/dist/api-bruteforce.js --api http://localhost:3000             # 4. cu RATE_LIMIT=on (src/api-bruteforce.ts)
DATABASE_URL=... node demos/attacks/dist/tamper-board.js --election <ID> --seq 42 # 5. board modificat în bază (src/tamper-board.ts)
```

Demonstrațiile 4 și 5 au nevoie de backend-ul real pornit; a cincea modifică un buletin direct în PostgreSQL și îl restaurează la final.
