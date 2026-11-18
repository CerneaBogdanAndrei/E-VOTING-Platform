# @evoting/web

Panoul comisiei (creare, modificare și ștergere de scrutine, membri cu roluri, token-uri trustees, import eligibili, deschidere/închidere, jurnal de audit) și pagina publică (bulletin board, rezultat, verificare publică în browser, audit Benaloh). React 19 + Vite + React Router.

```bash
npm run dev -w @evoting/web                                  # backend simulat în memorie, http://localhost:5173
VITE_API_URL=http://localhost:3000 npm run dev -w @evoting/web   # backend real (sau pune VITE_API_URL în .env.local)
npm run build -w @evoting/web && npm run lint -w @evoting/web
```

## Structura

| Folder / fișier | Ce conține |
| --- | --- |
| `src/main.tsx`, `src/App.tsx` | Pornirea și lista rutelor. |
| `src/api/` | Alegerea clientului (real sau simulat), `VITE_API_URL`, token-ul comisiei în `sessionStorage`, identitatea autentificată (`useAdmin`, `canEdit`). |
| `src/components/layout/` | `Layout` (bara de sus), `AdminGate` (login-ul comisiei). |
| `src/components/ui/` | Componente mici: `StatusBadge`, `Hash`, `Stat`, `Countdown` („se închide peste…”), `Feedback` (`Loading`, `ErrorBox`, `Message`). |
| `src/pages/Home.tsx`, `About.tsx` | Lista scrutinelor și „Cum funcționează”. |
| `src/pages/commission/` | `CommissionList`, `CommissionNew`, `CommissionEdit`, `ElectionForm` (formularul comun), `CommissionMembers`, `CommissionElection` și bucățile ei în `parts/` (`Steps`, `TrusteeTokens`, `EligibleImport`, `BoardHead`, `AuditLog`, `MockToolsPanel`). |
| `src/pages/election/` | `ElectionPublic` și tab-urile ei în `tabs/` (`BoardTab`, `ResultTab`, `VerificationTab`, `BenalohTab`, `ParametersTab`). |
| `src/lib/` | `format.ts` (re-exportă formatările comune din `@evoting/api`), `useAsync.ts`. |
| `src/styles/` | CSS pe module, importate în ordine de `index.css` (`tokens`, `base`, `layout`, `cards`, `forms`, `feedback`, `tables`, `results`, `verification`, `responsive`). |
| `Dockerfile`, `nginx.conf` | Build-ul cu Vite, servit de nginx. |

Vezi [docs/DOCUMENTATIE.md](../../docs/DOCUMENTATIE.md).
