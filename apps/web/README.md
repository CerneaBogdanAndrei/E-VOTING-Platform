# apps/web

Panoul comisiei (creare scrutin, token-uri trustees, import eligibili, deschidere/închidere, jurnal de audit) și pagina publică (bulletin board, rezultat, verificare publică în browser, audit Benaloh).

```bash
npm run dev -w @evoting/web     # backend simulat în memorie
VITE_API_URL=http://localhost:3000 npm run dev -w @evoting/web   # backend real
```

Vezi [DOCUMENTATIE.md](../../DOCUMENTATIE.md).
