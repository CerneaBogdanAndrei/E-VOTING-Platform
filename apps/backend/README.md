# @evoting/backend

Serverul: NestJS 12 + PostgreSQL 16, SQL scris de mână prin `pg` (fără ORM, ca fiecare interogare să fie vizibilă). Un folder per modul.

## Comenzi

```bash
cp .env.example .env            # completează CNP_HMAC_KEY (openssl rand -hex 32) și ADMIN_TOKEN (openssl rand -hex 24)
npm run build -w @evoting/backend
npm run dev -w @evoting/backend         # aplică migrările și pornește pe :3000
npm run migrate -w @evoting/backend     # doar migrările
npm run test-pki -w @evoting/backend -- pki   # PKI de test pentru cipuri NFC simulate (CSCA_DIR=pki/csca)
TEST_DATABASE_URL=postgres://evoting:evoting@localhost:5433/evoting_test npm test -w @evoting/backend
```

Variabilele de mediu sunt explicate în `.env.example` și în [docs/GHID-COMPLET.md, 10.4](../../docs/GHID-COMPLET.md#104-cu-serverul-real-pe-calculatorul-tău).

## Structura

| Folder | Ce conține |
| --- | --- |
| `migrations/` | `001_init.sql` (primele nouă tabele, trigger-ul append-only pe `ballots`), `002_rls.sql` (Row Level Security), `003_settings_members_challenges.sql` (votul alb, membrii comisiei, provocările de autentificare). |
| `src/config.ts`, `main.ts`, `app.ts`, `app.module.ts` | Configurarea din mediu, pornirea, construirea aplicației Nest (cu `helmet`, CORS, `trust proxy`), lista modulelor. |
| `src/db/` | Pool-ul și tranzacțiile (`database.service.ts`), opțiunile SSL (`pg-options.ts`), migrările (`migrate.ts`, `migrate-cli.ts`). |
| `src/common/` | `security.ts` (token-uri, comparație în timp constant, sesiuni HMAC), `throttle.ts` (limita strictă), `validate.ts`. |
| `src/admin/` | Autentificarea comisiei: `admin.guard.ts` (`AdminGuard` pentru orice membru, `CommissionGuard` pentru rolul `comisie`, `@Admin()`), `admin.controller.ts` (`/admin/check`, `/admin/members`), `members.service.ts`. |
| `src/audit/` | Jurnalul de audit. |
| `src/elections/` | `elections.controller.ts` (toate rutele `/elections`), `elections.repository.ts` (citirile publice, board-ul pe pagini, `lock`, `params`), `elections.service.ts` (acțiunile comisiei: creare, modificare și ștergere în configurare, import, deschidere, închidere), `auto-close.service.ts` (închiderea automată la `closesAt`), `election.rows.ts` (rânduri → obiecte). |
| `src/trustees/` | Token-urile trustees și primirea cheilor Yᵢ cu dovada Schnorr. |
| `src/registration/` | Înregistrarea prin OCR (CNP) sau NFC (DG1 + SOD, Passive Authentication) și re-înregistrarea înainte de vot. |
| `src/auth/` | Provocarea semnată (în tabela `auth_challenges`) și sesiunea alegătorului (`auth.service.ts`), rutele `/auth/*` (`auth.controller.ts`). |
| `src/ballots/` | Primirea buletinului pe board (`cast`), doar în intervalul scrutinului; ora primirii se ia după blocarea board-ului (`boardTime`). |
| `src/tally/` | Decriptările parțiale și publicarea rezultatului. |
| `src/nfc/` | `passive-auth.ts` (verificarea SOD-ului), `passive-auth.service.ts` (certificatele CSCA), `test-pki.ts` (PKI și cipuri de test). |
| `src/system/` | `/health`. |
| `test/` | `election-flow.e2e.test.ts` (16 teste, tot fluxul pe PostgreSQL), `interval.e2e.test.ts` (5: intervalul, orele de pe board, închiderea automată), `commission.e2e.test.ts` (4: membri și roluri, modificare și ștergere, vot alb, scoaterea din lista de eligibili), `rate-limit.e2e.test.ts` (3), `cli.e2e.test.ts` (1: CLI-urile reale, și pe două fire), `pg-options.test.ts` (3, fără bază: SSL-ul conexiunii), `helpers.ts` (golește baza de test!). |

Rutele, tabelele și regulile de stare: [docs/DOCUMENTATIE.md §7](../../docs/DOCUMENTATIE.md#7-backend-ul-tabele-rute-reguli) și [docs/GHID-COMPLET.md, Părțile 6–7](../../docs/GHID-COMPLET.md#partea-6-baza-de-date-cele-unsprezece-tabele).
