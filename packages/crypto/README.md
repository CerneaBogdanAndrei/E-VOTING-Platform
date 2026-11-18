# @evoting/crypto

Toată criptografia sistemului, scrisă o singură dată și folosită de server, telefon, site, CLI-ul de trustee și verificator. O dovadă generată pe telefon e verificată de exact același cod pe server și la audit. Depinde doar de `@noble/curves` și `@noble/hashes` (JavaScript pur, deci rulează la fel în Node, browser și Hermes).

Teoria și formulele: [docs/DOCUMENTATIE.md §5](../../docs/DOCUMENTATIE.md#5-ce-se-întâmplă-în-interior-criptografia).

## Fișiere

| Fișier | Ce face |
| --- | --- |
| `src/encoding.ts` | Hex, UTF-8 și JSON canonic (chei sortate), ca același obiect să dea mereu același hash. |
| `src/group.ts` | Grupul ristretto255: ordinul q, generatorul G, scalari aleatori, codificări stricte, înmulțiri în timp constant (`mulSecret`) sau rapide (`mulPublic`). |
| `src/hash.ts` | SHA-256, HMAC-SHA256, `cnpHmac`, `hashToScalar` (provocarea Fiat-Shamir, cu lungimea fiecărei părți în față). |
| `src/types.ts` | Formatele JSON publice: `Ciphertext`, dovezi, `Ballot`, `BoardEntry`, `TrusteePublicKey`, `PartialDecryption`. |
| `src/elgamal.ts` | ElGamal exponențial: `encrypt`, `addCiphertexts` (proprietatea homomorfă), `preparePublicKey` (tabele precalculate). |
| `src/proofs.ts` | Dovezile zero-knowledge: Schnorr (cheia trustee-ului), Chaum-Pedersen (suma = 1, decriptarea parțială), disjunctivă 0/1. |
| `src/credential.ts` | Credentialul alegătorului: chei Ed25519, semnare, verificare, mesajul de autentificare. |
| `src/ballot.ts` | `encryptBallot`, `verifyBallot`, `auditBallot` (provocarea Benaloh), hash-urile buletinului. |
| `src/board.ts` | Bulletin board-ul: hash-ul genesis, hash-ul intrării, `appendEntry`, `checkOwnEntry` (verificarea propriului vot). |
| `src/trustee.ts` | `generateTrusteeKey`, `combinePublicKeys` (Y = ΣYᵢ), `partialDecrypt`, `verifyPartialDecryption`. |
| `src/tally.ts` | `computeAggregate` (și pe o bucată din board), `sumAggregates`, `babyStepGiantStep`, `combinePartialDecryptions`. |
| `src/verify.ts` | `verifyElection`: verificatorul public, cu cei șase pași (inclusiv orele primirii: crescătoare și în intervalul scrutinului) și locul exact al fiecărei erori; partea scumpă o face un `BallotWork` (opțiunea `work`). |
| `src/parallel.ts` | Verificarea în paralel, fără nimic specific platformei: `sequentialWork` (implicit), `createParallelWork` (bazinul de lucrători, bucăți, ordinea rezultatelor), `handleWorkRequest` (ce face un fir). |
| `src/node/` | `@evoting/crypto/node`: `createNodeWork` (bazin de `worker_threads`), `defaultThreads`; compilat separat (`tsconfig.node.json`), ca restul să nu depindă de Node. |
| `src/index.ts` | Exporturile publice. |

## Teste

`npm test -w @evoting/crypto` rulează 54 de teste, câte un fișier pe temă: `encoding`, `elgamal`, `ballot`, `trustee`, `verifier`, `parallel` (verificarea pe `worker_threads` reale, intrările malformate, auditul Benaloh incomplet, cheile de ordin mic). `test/helpers.ts` are `simulateElection` (un scrutin complet fără server) și `forgeBallot` (buletine trișate).
