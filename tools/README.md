# tools/: programele în linia de comandă

Toate se construiesc cu `npm run build` de la rădăcină și se rulează cu `npx` sau direct cu `node tools/<nume>/dist/cli.js`.

## `trustee/` – `evoting-trustee`

Programul trustee-ului. Cheia secretă xᵢ rămâne pe calculatorul lui, într-un fișier cu permisiuni 600, opțional criptat cu o parolă (`--encrypt` sau `--password`; scrypt + AES-256-GCM).

```bash
npx evoting-trustee keygen  --api http://localhost:3000 --election <ID> --trustee <ID>-t1 --token <TOKEN> [--encrypt]
npx evoting-trustee decrypt --key <ID>-t1.trustee-key.json --token <TOKEN> [--password <PAROLA>]   # sau TRUSTEE_KEY_PASSWORD
npx evoting-trustee status  --api http://localhost:3000 --election <ID>
```

`src/cli.ts` citește argumentele; comenzile sunt în `src/commands/` (`keygen.ts`, `decrypt.ts`, `status.ts`); `src/key-file.ts` scrie și citește fișierul de cheie (și îl criptează); `src/password.ts` cere parola. `decrypt` verifică singur board-ul și agregatul înainte să trimită decriptarea parțială.

## `verifier/` – `evoting-verify`

Verificatorul public: reface cheile, lanțul de hash-uri, semnăturile, dovezile ZK, agregatul și decriptarea. Codul de ieșire e 0 doar dacă trec toate.

```bash
npx evoting-verify --api http://localhost:3000 --election <ID> [--head SEQ:HASH] [--save arhiva.json] [--json]
npx evoting-verify --bundle arhiva.json [--workers N]     # N fire; implicit toate nucleele, 1 = un singur fir
npx evoting-verify audit-ballot --election <ID> --file audit.json
```

`src/commands/verify.ts` și `src/commands/audit-ballot.ts`.

## `simulator/` – `evoting-simulate`

Alegeri complete cu alegători sintetici contra backend-ului real, cu metrici de performanță. Backend-ul trebuie pornit cu `RATE_LIMIT=off`.

```bash
npx evoting-simulate --admin-token <TOKEN> --voters 1000 [--nfc 0.2 --pki apps/backend/pki] [--report raport.json]
```

`src/cli.ts` rulează cele opt etape; `src/lib/` are `metrics.ts`, `pool.ts`, `synthetic.ts`, `output.ts`. Rapoartele măsurate sunt în `docs/evaluare/`.
