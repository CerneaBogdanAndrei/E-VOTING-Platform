# 4. Codul, explicat linie cu linie

Capitolul are două părți:

- **Partea A: dicționarul.** Fiecare cuvânt și semn care apare în cod (TypeScript, JSX, SQL, Dockerfile, YAML), cu un exemplu din proiect.
- **Partea B: fișierele cheie, rând cu rând.** Cu dicționarul în minte, citim împreună fișierele cele mai importante.

---

# Partea A: dicționarul

## A.1 TypeScript și JavaScript

### Comentarii

| Scriere | Ce înseamnă |
| --- | --- |
| `// text` | Comentariu pe un rând. Calculatorul îl ignoră; e doar pentru oameni. |
| `/** text */` | Comentariu de documentare, pus deasupra unei funcții. Editorul îl arată când treci cu mouse-ul peste funcție. |

### Importuri și exporturi

```ts
import { encrypt, type Ciphertext } from './elgamal.js'
export function encryptBallot(...) { ... }
```

| Cuvânt | Ce înseamnă |
| --- | --- |
| `import { a, b } from 'x'` | Ia funcțiile sau valorile `a` și `b` din fișierul sau pachetul `x`. |
| `import x from 'y'` | Ia „exportul implicit” al lui `y` și îl numește `x`. Exemplu: `import pg from 'pg'`. |
| `import * as x from 'y'` | Ia tot din `y`, sub numele `x`. Exemplu: `import * as pkijs from 'pkijs'`. |
| `import type { T }` / `type T` în import | Ia doar un **tip**, care dispare la compilare. |
| `import 'x'` | Rulează fișierul `x` doar pentru efectul lui. Exemplu: `import 'reflect-metadata'`. |
| `export` | Face o funcție sau o valoare disponibilă altor fișiere. |
| `export default` | Exportul principal al unui fișier. Exemplu: fiecare ecran Expo, `export default function VoteScreen()`. |
| `export * from 'x'` | Re-exportă tot din `x`. Exemplu: `packages/api/src/index.ts`. |
| `'./elgamal.js'` | Calea relativă: `./` = același folder, `../` = folderul părinte. Se scrie `.js`, deși fișierul e `.ts`, pentru că după compilare chiar va fi `.js` (regula modulelor `NodeNext`). |
| `'node:crypto'` | Modul încorporat în Node. |
| `'@evoting/crypto'` | Pachet din monorepo sau din `node_modules`. `@evoting` e „scope-ul”, un fel de prenume comun pachetelor proiectului. |

### Variabile și constante

| Cuvânt | Ce înseamnă | Exemplu |
| --- | --- | --- |
| `const x = …` | O valoare care nu mai poate fi reatribuită. Cea mai folosită. | `const config = loadConfig()` |
| `let x = …` | O variabilă care se poate schimba. | `let a: PointT = ZERO` și apoi `a = a.add(c.a)` |
| `x: Tip` | Spune ce tip are `x`. | `let res: Response` |

### Tipuri de bază

| Tip | Ce e | Exemplu |
| --- | --- | --- |
| `string` | Text | `'Senat 2026'` |
| `number` | Număr obișnuit | `3000` |
| `bigint` | Număr întreg oricât de mare. Se scrie cu `n` la final. Necesar pentru cheile de 252 de biți. | `0n`, `randomness.reduce((acc, r) => acc + r, 0n)` |
| `boolean` | `true` sau `false` | `rateLimit: boolean` |
| `null` | „Nimic”, pus intenționat | `cscaDir: string \| null` |
| `undefined` | „Nedefinit”, valoarea a ceva ce nu a fost setat | `body === undefined` |
| `unknown` | „Nu știu încă ce e”; trebuie verificat înainte de folosire. Serverul primește corpul cererilor ca `unknown`, ca să fie obligat să-l valideze. | `create(@Body() body: unknown)` |
| `T[]` | O listă de `T` | `string[]` |
| `Record<K, V>` | Un obiect cu chei `K` și valori `V` | `Record<string, string>` pentru antete |
| `Promise<T>` | O valoare care va veni mai târziu (vezi `async`) | `Promise<Registration>` |
| `Map<K, V>` | Un dicționar: cheie → valoare, cu `.get`, `.set`, `.delete`, `.has` | `challenges = new Map<string, PendingChallenge>()` |
| `Set<T>` | O mulțime fără duplicate, cu `.add`, `.has` | `eligible: Set<string>` |
| `Uint8Array` | O listă de octeți (numere 0–255): date binare | `dg1: Uint8Array` |

### Tipuri compuse

| Scriere | Ce înseamnă | Exemplu |
| --- | --- | --- |
| `interface Nume { a: T; b?: U }` | Descrie forma unui obiect: ce câmpuri are și de ce tip. `?` = câmp opțional. | `interface Ciphertext { a: Hex; b: Hex }` |
| `type Nume = …` | Un nume dat unui tip. | `type Hex = string` |
| `A \| B` | „A sau B” (uniune). | `{ ok: true } \| { ok: false; reason: string }` |
| `'a' \| 'b'` | Doar aceste texte exacte sunt permise. | `method: 'ocr' \| 'nfc'` |
| `<T>` | **Generic**: un tip-parametru, completat la folosire. | `useAsync<T>(load: () => Promise<T>)` funcționează pentru orice fel de date. |
| `Omit<T, 'x'>` | Tipul `T` fără câmpul `x`. | `Omit<Ballot, 'signature'>` = buletinul nesemnat |
| `Pick<T, 'a' \| 'b'>` | Doar câmpurile `a` și `b` din `T`. | `Pick<BallotReceipt, 'trackingCode' \| 'ballotHash'>` |
| `Partial<T>` | Toate câmpurile din `T` devin opționale. | `Partial<Ciphertext>` |
| `x as T` | „Ai încredere în mine, x e de tipul T.” Folosit după ce ai verificat singur. | `raw.signature as string` |
| `x!` | „x sigur nu e null/undefined aici.” | `env.ADMIN_TOKEN!` (după ce `loadConfig` a verificat că există) |

### Funcții

```ts
function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig { … }
const randomToken = (bytes = 24) => randomBytes(bytes).toString('hex')
```

| Scriere | Ce înseamnă |
| --- | --- |
| `function nume(a: T, b: U): R { … }` | O funcție cu parametrii `a`, `b`, care întoarce un `R`. |
| `(a, b) => expresie` | **Funcție săgeată**: o funcție scurtă, fără nume. Ce e după `=>` e rezultatul. |
| `(a) => { … return x }` | Funcție săgeată cu mai multe rânduri. |
| `param = valoare` | Valoare implicită: dacă nu dai parametrul, se folosește aceasta. |
| `return x` | Iese din funcție și întoarce `x`. |
| `void` | Funcția nu întoarce nimic. |

### Decizii și repetiții

| Scriere | Ce înseamnă | Exemplu |
| --- | --- | --- |
| `if (cond) { … } else { … }` | Dacă `cond` e adevărat, fă primul bloc, altfel pe al doilea. | `if (!session) throw …` |
| `cond ? a : b` | Varianta scurtă: `a` dacă e adevărat, altfel `b`. | `method === 'nfc' ? 'criptografic' : 'optic'` |
| `for (let j = 0; j < n; j++) { … }` | Repetă pentru `j` = 0, 1, …, n−1. `j++` = crește `j` cu 1. | bucla din `encryptBallot` |
| `for (const x of listă) { … }` | Repetă pentru fiecare element din listă. | `for (const c of list) { a = a.add(c.a) }` |
| `break` / `continue` | Ieși din buclă / sari la următorul pas. | `simulateVoters` |

### Operatori

| Operator | Ce înseamnă |
| --- | --- |
| `===`, `!==` | Egal / diferit, strict (și ca tip). În JavaScript se evită `==`. |
| `&&` | ȘI: adevărat doar dacă ambele sunt adevărate. |
| `\|\|` | SAU. Și: `a \|\| b` = `a` dacă există, altfel `b` (`env.PORT \|\| 3000`). |
| `!x` | NU: inversează adevărat/fals. `!eligible.rowCount` = „nu s-a găsit niciun rând”. |
| `a ?? b` | `a`, dacă nu e null/undefined, altfel `b`. `previous?.seq ?? 0` |
| `a?.b` | Accesează `b` doar dacă `a` există; altfel dă `undefined`, fără eroare. |
| `...x` | **Spread**: „desfă” o listă sau un obiect. `{ ...unsigned, signature }` = toate câmpurile lui `unsigned`, plus `signature`. `[...context, String(j)]` = lista `context` cu un element în plus. |
| `` `text ${x}` `` | **Template string**: text în care se inserează valoarea lui `x`. `` `Bearer ${token}` `` |
| `%` | Restul împărțirii. |

### Destructurare

```ts
const { a, b } = encryptPoints(y, m, r)
const [payload, mac] = token.split('.')
const [choice, setChoice] = useState<number>()
```

Scoate direct câmpurile unui obiect (`{ }`) sau elementele unei liste (`[ ]`) în variabile separate.

### Asincron: `async`, `await`, `Promise`

Unele operații durează: o cerere la server, o interogare în baza de date. Programul nu stă blocat cât așteaptă.

- O funcție `async` întoarce mereu un `Promise`, o „promisiune” de rezultat.
- `await x` înseamnă „așteaptă până vine rezultatul lui `x`, apoi continuă”. Se poate folosi doar în funcții `async` (sau la nivelul de sus al unui modul, ca în `main.ts`).
- `.then(f)`, `.catch(f)`, `.finally(f)` sunt varianta veche: „când vine rezultatul, rulează `f`” (folosite în `useAsync`).
- `Promise.all([...])` așteaptă mai multe operații în paralel. `Promise.allSettled` la fel, dar nu se oprește la prima eroare.

```ts
const challenge = await api.authChallenge(electionId, credential.publicKey)
```

= trimite cererea, așteaptă răspunsul, pune-l în `challenge`.

### Erori: `throw`, `try`, `catch`, `finally`

| Scriere | Ce înseamnă |
| --- | --- |
| `throw new Error('mesaj')` | Oprește execuția și „aruncă” o eroare. |
| `try { … } catch (err) { … }` | Încearcă blocul; dacă apare o eroare, sari în `catch`, unde `err` e eroarea. |
| `finally { … }` | Rulează oricum, cu sau fără eroare. Folosit la eliberarea conexiunii la bază. |
| `new ApiError(403, '…')` | Eroarea proiectului, cu cod HTTP. |
| `ForbiddenException`, `ConflictException`, `UnauthorizedException`, `NotFoundException` | Erorile NestJS, transformate automat în 403, 409, 401, 404. |

### Clase

```ts
@Injectable()
export class VotingService {
  private readonly challenges = new Map<string, PendingChallenge>()
  constructor(private readonly db: Database) {}
  async cast(...) { … this.db.transaction(…) … }
}
```

| Cuvânt | Ce înseamnă |
| --- | --- |
| `class Nume { … }` | Un „șablon” pentru obiecte care au date și funcții (numite **metode**). |
| `new Nume(...)` | Creează un obiect din clasă. |
| `constructor(...)` | Funcția care rulează la creare. |
| `this` | Obiectul curent. `this.db` = câmpul `db` al acestui serviciu. |
| `private` | Câmpul se vede doar din interiorul clasei. |
| `readonly` | Câmpul nu mai poate fi schimbat după creare. |
| `constructor(private readonly db: Database) {}` | Scurtătură TypeScript: declară câmpul `db` și îl setează din parametru. NestJS vede tipul `Database` și îi dă automat serviciul potrivit. |
| `implements X` | Clasa promite că are metodele cerute de interfața `X`. `AdminGuard implements CanActivate`. |
| `static` | Metodă a clasei, nu a obiectului. `AppModule.forConfig(config)` |

### Decoratori (`@`)

Un decorator e o funcție pusă **deasupra** unei clase, metode sau parametru, care îi adaugă un comportament. NestJS se bazează pe ei:

| Decorator | Ce face |
| --- | --- |
| `@Injectable()` | Clasa e un serviciu pe care Nest îl poate crea și injecta. |
| `@Controller('elections')` | Clasa primește cererile care încep cu `/elections`. |
| `@Get()`, `@Get(':id/board')` | Metoda răspunde la `GET /elections` sau la `GET /elections/<ceva>/board`. |
| `@Post(...)` | La fel, pentru `POST`. |
| `@Param('id') id: string` | Pune partea `:id` din adresă în parametrul `id`. |
| `@Body() body: unknown` | Pune corpul cererii în `body`. |
| `@Headers('authorization') auth` | Pune antetul `Authorization` în `auth`. |
| `@HttpCode(200)` | Răspunde cu 200 în loc de 201 (implicit pentru POST). |
| `@UseGuards(AdminGuard)` | Rulează `AdminGuard` înainte de metodă. |
| `@Throttle(SENSITIVE)` | Limita strictă de rată pe această rută. |
| `@Inject(CONFIG)` | Injectează valoarea înregistrată sub numele `CONFIG`. |
| `@Module({...})` | Clasa e un modul Nest. |

### Metode des întâlnite pe liste, texte și obiecte

| Metodă | Ce face | Exemplu |
| --- | --- | --- |
| `listă.map(f)` | Lista nouă cu `f` aplicat pe fiecare element. | `points.map(encodeCiphertext)` |
| `listă.filter(f)` | Doar elementele pentru care `f` e adevărat. | `['DATABASE_URL', …].filter((k) => !env[k])` = variabilele lipsă |
| `listă.find(f)` | Primul element pentru care `f` e adevărat. | `e.candidates.find((c) => c.position === choice)` |
| `listă.reduce(f, start)` | Combină toate elementele într-o valoare. | suma `r`-urilor |
| `listă.push(x)` | Adaugă la final. | `randomness.push(r)` |
| `listă.join('; ')` | Lipește elementele într-un text. | mesajele de eroare NestJS |
| `listă.length` | Câte elemente are. | |
| `Array.isArray(x)` | `x` e o listă? | validare |
| `text.split('.')` | Împarte textul după `.`. | token-ul de sesiune |
| `text.replace(a, b)` | Înlocuiește. `baseUrl.replace(/\/+$/, '')` scoate `/` de la final. | |
| `text.trim()`, `.toLowerCase()` | Scoate spațiile de la capete / literă mică. | codul de urmărire |
| `JSON.stringify(x)` / `JSON.parse(t)` | Obiect → text JSON / text JSON → obiect. | |
| `Date.now()` | Ora curentă, în milisecunde de la 1 ianuarie 1970. | expirarea sesiunilor |
| `new Date(x).toISOString()` | Data în formatul standard `2026-11-10T09:02:11.481Z`. | |
| `Number(x)`, `String(x)` | Transformă în număr / text. | `Number(env.PORT \|\| 3000)` |
| `typeof x` | Ce tip are `x` la rulare: `'string'`, `'object'`… | validare |
| `x instanceof C` | `x` e creat din clasa `C`? | `err instanceof ApiError` |

### Expresii regulate (regex)

Un șablon de căutare în text, scris între `/ /`:

| Regex | Ce caută |
| --- | --- |
| `/^[0-9a-f]{64,}$/` | De la început (`^`) până la final (`$`), cel puțin 64 (`{64,}`) de caractere din `0–9` sau `a–f`. Adică hex de cel puțin 32 de octeți. Verifică `CNP_HMAC_KEY`. |
| `/^Bearer\s+(\S+)$/i` | `Bearer`, unul sau mai multe spații (`\s+`), apoi un șir fără spații, prins în paranteză. `i` = fără să conteze literele mari. |
| `/\D/g` | Orice caracter care nu e cifră (`\D`), peste tot (`g`). `v.replace(/\D/g, '')` păstrează doar cifrele. |

## A.2 JSX / TSX (React și React Native)

```tsx
{error && <Notice tone="bad" text={error} />}
<Button title="Citește cipul" onPress={read} disabled={can.length !== 6} loading={busy} />
```

| Scriere | Ce înseamnă |
| --- | --- |
| `<Componentă prop="text" alt={expresie} />` | Afișează o componentă. Între ghilimele = text fix; între `{ }` = cod. |
| `<A> … </A>` | Componentă care conține alte componente. |
| `<> … </>` | **Fragment**: grupează elemente fără să adauge ceva vizibil. |
| `{cond && <X />}` | Afișează `X` doar dacă `cond` e adevărat. |
| `{cond ? <A /> : <B />}` | Afișează `A` sau `B`. |
| `{listă.map((x) => <Rând key={x.id} … />)}` | Câte un element pentru fiecare din listă. `key` îl ajută pe React să știe care e care. |
| `onClick={f}` (web), `onPress={f}` (telefon) | Ce funcție rulează la apăsare. |
| `className="badge"` (web) | Clasa CSS (în HTML se numește `class`, dar `class` e cuvânt rezervat în JS). |
| `style={styles.card}` (telefon) | Stilul, definit cu `StyleSheet.create({...})`. |
| `<View>`, `<Text>` (telefon) | Echivalentele lui `<div>` și `<span>`. Pe telefon, textul trebuie pus obligatoriu în `<Text>`. |

Hook-urile React folosite:

| Hook | Ce face |
| --- | --- |
| `useState(inițial)` | Întoarce `[valoare, setValoare]`. Când chemi `setValoare`, componenta se redesenează. |
| `useEffect(f, [deps])` | Rulează `f` după afișare și din nou când se schimbă ceva din `deps`. Ce întoarce `f` rulează la „curățenie”. |
| `useCallback(f, [deps])` | Păstrează aceeași funcție între redesenări. |
| `useRef()` | O „cutie” care ține o valoare fără să redeseneze. Folosit pentru cameră. |
| `useLocalSearchParams()` (Expo Router) | Parametrii din adresa ecranului, de exemplu `id`. |
| `useParams()` (React Router) | La fel, pe site. |
| `useSession(id)` (al proiectului) | Credentialul, înregistrarea și chitanța alegătorului pentru scrutinul `id`. |
| `useAsync(load, deps)` (al proiectului) | Încarcă date și ține `data`, `error`, `loading`, `reload`. |

## A.3 SQL

```sql
CREATE TABLE ballots (
  election_id text NOT NULL REFERENCES elections (id),
  seq integer NOT NULL CHECK (seq >= 1),
  ...
  PRIMARY KEY (election_id, seq),
  UNIQUE (election_id, credential_pubkey)
);
```

| Cuvânt | Ce înseamnă |
| --- | --- |
| `CREATE TABLE nume (…)` | Creează o tabelă cu coloanele dintre paranteze. |
| `text`, `integer`, `bigserial`, `jsonb`, `timestamptz` | Tipuri de coloane: text, număr întreg, număr care crește automat (1, 2, 3…), JSON binar, dată și oră cu fus orar. |
| `NOT NULL` | Coloana trebuie completată. |
| `DEFAULT x` | Valoarea pusă automat dacă nu dai alta. `DEFAULT now()` = ora curentă. |
| `PRIMARY KEY` | Identificatorul unic al rândului. Nu pot exista două rânduri cu aceeași cheie. |
| `UNIQUE (a, b)` | Combinația `a, b` nu se poate repeta. Așa e garantat „un vot per credential”. |
| `REFERENCES t (c)` / `FOREIGN KEY` | Valoarea trebuie să existe în tabela `t`. Nu poți vota fără înregistrare, nici înregistra fără să fii eligibil. |
| `CHECK (cond)` | Condiție verificată la fiecare inserare. `CHECK (status IN ('draft', 'open', 'closed', 'tallied'))` |
| `CREATE INDEX` | Un „cuprins” care face căutările rapide. |
| `CREATE FUNCTION … LANGUAGE plpgsql` | O funcție scrisă în limbajul intern al PostgreSQL. |
| `RAISE EXCEPTION` | Aruncă o eroare din bază. |
| `CREATE TRIGGER … BEFORE UPDATE OR DELETE ON ballots FOR EACH ROW` | Rulează funcția înainte de orice modificare sau ștergere a unui rând din `ballots`. Funcția aruncă eroare, deci operația e interzisă. |
| `ALTER TABLE … ENABLE ROW LEVEL SECURITY` | Pornește RLS (vezi capitolul 2.5). |
| `SELECT col FROM t WHERE cond` | Citește rândurile din `t` care îndeplinesc condiția. `SELECT 1` = „nu-mi trebuie datele, vreau doar să știu dacă există”. |
| `ORDER BY seq DESC LIMIT 1` | Ordonează descrescător după `seq` și ia primul, adică ultima intrare de pe board. |
| `INSERT INTO t (cols) VALUES (…) RETURNING col` | Adaugă un rând și întoarce o coloană din el. |
| `$1, $2` | Parametri: valorile se trimit separat, deci nu pot strica interogarea (protecție împotriva SQL injection). |
| `BEGIN` / `COMMIT` / `ROLLBACK` | Începe o tranzacție / salvează tot / anulează tot. |
| `FOR UPDATE` | Blochează rândurile citite până la `COMMIT`. Alte tranzacții care vor același rând așteaptă la rând. |
| `23505` | Codul de eroare PostgreSQL pentru încălcarea unei constrângeri `UNIQUE`. Serverul îl transformă în mesajul „ai votat deja”. |

## A.4 Dockerfile

| Instrucțiune | Ce face |
| --- | --- |
| `FROM node:22-alpine AS build` | Pornește de la imaginea Node 22 pe Alpine Linux și numește etapa `build`. |
| `WORKDIR /repo` | Folderul de lucru din container (îl creează dacă nu există). |
| `COPY . .` | Copiază tot proiectul (minus ce e în `.dockerignore`) în folderul de lucru. |
| `COPY --from=build a b` | Copiază `a` din etapa `build` în `b`, în etapa curentă. |
| `RUN comandă` | Rulează o comandă la construirea imaginii. `&&` = „și apoi, dacă a mers”; `\` = continuă pe rândul următor. |
| `ARG X=valoare` / `ENV X=$X` | Argument dat la build / variabilă de mediu în container. |
| `EXPOSE 3000` | Documentează portul pe care ascultă containerul. |
| `USER node` | Rulează ca utilizatorul obișnuit `node`, nu ca administrator (`root`), pentru siguranță. |
| `ENTRYPOINT [...]` | Programul pornit mereu la start. |
| `CMD [...]` | Comanda implicită, dată ca argumente lui `ENTRYPOINT`. |

## A.5 YAML (`docker-compose.yml`, `.github/workflows/*.yml`)

YAML e un format de configurare în care **indentarea** (spațiile de la începutul rândului) arată ce aparține de ce.

| Scriere | Ce înseamnă |
| --- | --- |
| `cheie: valoare` | O setare. |
| `cheie:` urmat de rânduri indentate | Un grup de setări. |
| `- element` | Un element dintr-o listă. |
| `# text` | Comentariu. |
| `${VAR}` | Valoarea variabilei `VAR` din `.env`. |
| `${VAR:-implicit}` | `VAR`, sau `implicit` dacă lipsește. |
| `${VAR:?mesaj}` | `VAR`, sau oprește-te cu eroarea `mesaj` dacă lipsește. |
| `>-` | Text pe mai multe rânduri, lipit într-unul singur. |
| `on: push` (workflow) | Când rulează workflow-ul. |
| `jobs:` / `steps:` | Lucrările și pașii lor. |
| `uses: actions/checkout@v4` | Folosește o acțiune gata făcută (aici: descarcă codul). |
| `run: npm test` | Rulează o comandă. |
| `services: postgres:` | Pornește un container ajutător (o bază de test) pe durata job-ului. |

## A.6 `tsconfig.json`

Setările compilatorului TypeScript. `tsconfig.base.json` le ține pe cele comune:

| Setare | Ce înseamnă |
| --- | --- |
| `"target": "ES2022"` | Ce versiune de JavaScript produce. |
| `"module": "NodeNext"` | Folosește modulele moderne (`import`/`export`) ca Node. |
| `"strict": true` | Toate verificările stricte de tipuri. |
| `"declaration": true` | Produce și fișiere `.d.ts` cu tipurile, ca alte pachete să le poată folosi. |
| `"sourceMap": true` | Erorile arată rândul din `.ts`, nu din `.js` compilat. |
| `"noUnusedLocals"`, `"noUnusedParameters"` | Eroare pentru variabile și parametri nefolosiți. |
| `"skipLibCheck": true` | Nu verifica tipurile bibliotecilor din `node_modules` (mai rapid). |

---

# Partea B: fișierele cheie, rând cu rând

## B.1 Pornirea serverului: `apps/backend/src/main.ts`

```ts
import { createApp } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const app = await createApp(config)
await app.listen(config.port, '0.0.0.0')
console.log(`Backend-ul ascultă pe http://localhost:${config.port}`)
```

1. Ia funcția `createApp` din `app.ts` și `loadConfig` din `config.ts`.
2. Citește configurarea din variabilele de mediu (din `.env`).
3. Construiește aplicația Nest. `await` așteaptă până e gata (inclusiv migrările bazei).
4. Pornește ascultarea pe port. `'0.0.0.0'` = acceptă conexiuni de pe orice interfață de rețea, nu doar de pe calculatorul local. E necesar în Docker.
5. Scrie în consolă că a pornit.

Comanda `npm run dev` rulează `node --env-file-if-exists=.env dist/src/main.js`: Node citește întâi `.env` și pune valorile în `process.env`.

## B.2 Configurarea: `apps/backend/src/config.ts`

```ts
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const missing = ['DATABASE_URL', 'CNP_HMAC_KEY', 'ADMIN_TOKEN'].filter((k) => !env[k])
  if (missing.length) throw new Error(`Lipsesc variabilele de mediu: ${missing.join(', ')} (vezi .env.example)`)
```

- `env` e obiectul cu variabilele de mediu (`process.env` dacă nu dai altul; testele dau altul).
- Din lista celor trei variabile obligatorii, păstrează doar pe cele care lipsesc (`!env[k]`).
- Dacă lipsește vreuna, **refuză să pornească**, cu mesaj clar. Un server de vot fără cheia HMAC n-ar trebui să pornească „pe jumătate”.

```ts
  const cnpHmacKey = env.CNP_HMAC_KEY!.toLowerCase()
  if (!/^[0-9a-f]{64,}$/.test(cnpHmacKey)) throw new Error('CNP_HMAC_KEY trebuie să aibă cel puțin 32 de octeți, în hex …')
  if (env.ADMIN_TOKEN!.length < 16) throw new Error('ADMIN_TOKEN trebuie să aibă cel puțin 16 caractere')
```

- Cheia HMAC trebuie să fie hex de cel puțin 64 de caractere (32 de octeți). O cheie scurtă ar putea fi ghicită.
- Token-ul comisiei trebuie să aibă cel puțin 16 caractere.

```ts
  return {
    databaseUrl: env.DATABASE_URL!,
    cnpHmacKey,
    adminToken: env.ADMIN_TOKEN!,
    sessionSecret: env.SESSION_SECRET || randomBytes(32).toString('hex'),
    cscaDir: env.CSCA_DIR || null,
    port: Number(env.PORT || 3000),
    corsOrigins: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((s) => s.trim()) : true,
    rateLimit: env.RATE_LIMIT !== 'off',
    sensitiveLimit: Number(env.SENSITIVE_RATE_LIMIT || 30),
  }
```

- `sessionSecret`: dacă nu e dat, se generează unul aleator la fiecare pornire. Consecință: la repornire, sesiunile de 10 minute deschise expiră. E acceptabil.
- `cscaDir`: folderul cu certificatele de încredere pentru NFC, sau `null`.
- `port`: 3000 dacă nu e dat.
- `corsOrigins`: lista originilor permise, sau `true` (toate).
- `rateLimit`: pornit, cu excepția cazului `RATE_LIMIT=off` (doar pentru simulări).

## B.3 Construirea aplicației: `apps/backend/src/app.ts`

```ts
import 'reflect-metadata'
```
Trebuie importat primul, ca decoratorii Nest să funcționeze.

```ts
export async function createApp(config: AppConfig, { logger = true }: { logger?: boolean } = {}) {
  await migrate(config.databaseUrl, logger ? (m) => console.log(m) : undefined)
```
Înainte de orice, aplică migrările bazei (creează tabelele, dacă lipsesc). Testele trimit `logger: false`, ca să nu umple ecranul.

```ts
  setSensitiveLimit(config.sensitiveLimit)
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forConfig(config), {
    logger: logger ? ['log', 'warn', 'error'] : false,
    bodyParser: false,
  })
```
Setează limita strictă de rată și creează aplicația Nest din modulul principal. Body parser-ul implicit e oprit, pentru că urmează să fie configurat manual.

```ts
  app.useBodyParser('json', { limit: '2mb' })
  app.useBodyParser('text', { type: ['text/csv', 'text/plain'], limit: '20mb' })
```
Acceptă JSON de până la 2 MB (un buletin are câțiva KB) și text/CSV de până la 20 MB (lista de eligibili poate avea zeci de mii de rânduri).

```ts
  app.enableCors({ origin: config.corsOrigins })
  app.enableShutdownHooks()
  return app
}
```
Activează CORS și „cârligele de oprire”: la `Ctrl+C` sau la oprirea containerului, Nest închide frumos conexiunile la bază (`onApplicationShutdown` din `Database`).

## B.4 Modulul principal: `apps/backend/src/app.module.ts`

```ts
@Module({})
export class AppModule {
  static forConfig(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit: 600 }],
          skipIf: () => !config.rateLimit,
        }),
      ],
```

- E un **modul dinamic**: primește configurarea ca parametru, deci testele pot porni serverul cu altă configurare.
- Limita generală: 600 de cereri (`limit`) în 60.000 ms (`ttl`, adică un minut). `60_000` e doar un mod mai lizibil de a scrie 60000.
- `skipIf`: sare peste limitare dacă `RATE_LIMIT=off`.

```ts
      controllers: [ElectionsController, AuthController, SystemController],
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        Database, AuditService, AdminGuard, ElectionsService, VotingService, TallyService, PassiveAuthService,
      ],
```

- `controllers`: clasele care primesc cereri.
- `providers`: serviciile pe care Nest le creează și le injectează.
- `{ provide: CONFIG, useValue: config }`: înregistrează obiectul de configurare sub numele `CONFIG`, ca serviciile să-l primească cu `@Inject(CONFIG)`.
- `{ provide: APP_GUARD, useClass: ThrottlerGuard }`: aplică limitarea de rată pe **toate** rutele.

## B.5 Securitatea: `apps/backend/src/common/security.ts`

```ts
export const randomToken = (bytes = 24) => randomBytes(bytes).toString('hex')
```
Generează `bytes` octeți aleatori, siguri criptografic, și îi scrie în hex. 24 de octeți = 48 de caractere. Imposibil de ghicit.

```ts
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb) && a.length === b.length
}
```
Compară două texte **în timp constant**. O comparație obișnuită (`a === b`) se oprește la prima literă diferită, deci un atacator care măsoară timpul de răspuns ar putea afla token-ul literă cu literă. Aici ambele texte sunt întâi transformate în SHA-256 (aceeași lungime), apoi comparate cu `timingSafeEqual`, care durează mereu la fel.

```ts
export function bearer(header: string | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '')
  return m ? m[1] : null
}
```
Din antetul `Authorization: Bearer abc123` scoate `abc123`. Dacă antetul lipsește sau are altă formă, întoarce `null`.

```ts
export function signSession(secret: string, session: VoterSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  const mac = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${mac}`
}
```
Creează token-ul de sesiune al alegătorului:

1. transformă datele sesiunii (scrutinul, credentialul, expirarea) în JSON, apoi în **base64url** (base64 fără caracterele care strică adresele web);
2. calculează HMAC-ul lor cu `SESSION_SECRET`;
3. lipește cele două cu un punct.

Cine nu știe `SESSION_SECRET` nu poate crea un token valid și nici nu poate modifica unul existent (de exemplu, să-și prelungească expirarea), pentru că HMAC-ul n-ar mai bate.

```ts
export function verifySession(secret: string, token: string): VoterSession | null {
  const [payload, mac] = token.split('.')
  if (!payload || !mac) return null
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  if (!safeEqual(mac, expected)) return null
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as VoterSession
    return session.expiresAt > Date.now() ? session : null
  } catch {
    return null
  }
}
```
Operația inversă: desparte la punct, recalculează HMAC-ul, îl compară în timp constant, decodează datele și verifică expirarea. Orice problemă → `null` (sesiune invalidă).

## B.6 Paznicul comisiei: `apps/backend/src/common/admin.guard.ts`

```ts
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>()
    const token = bearer(req.headers.authorization)
    if (!token || !safeEqual(token, this.config.adminToken)) {
      throw new UnauthorizedException('Token de comisie lipsă sau greșit')
    }
    return true
  }
}
```

1. Primește configurarea prin injectare.
2. `canActivate` rulează înaintea fiecărei rute marcate cu `@UseGuards(AdminGuard)`.
3. Ia cererea HTTP, scoate token-ul din antet și îl compară în timp constant cu `ADMIN_TOKEN`.
4. Dacă nu se potrivește, aruncă 401. Altfel, `true` = cererea poate continua.

## B.7 Rutele: `apps/backend/src/elections/elections.controller.ts`

```ts
@Controller('elections')
export class ElectionsController {
  constructor(
    private readonly elections: ElectionsService,
    private readonly voting: VotingService,
    private readonly tally: TallyService,
    private readonly audit: AuditService,
  ) {}
```
Toate rutele încep cu `/elections`. Nest îi dă automat cele patru servicii.

```ts
  @Get(':id/board')
  board(@Param('id') id: string) {
    return this.elections.board(id)
  }
```
`GET /elections/abc/board` → `id = 'abc'` → cere board-ul de la serviciu. Ce se întoarce devine JSON. Dacă serviciul întoarce un `Promise`, Nest așteaptă singur.

```ts
  @Post(':id/open')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  open(@Param('id') id: string) {
    return this.elections.open(id)
  }
```
`POST /elections/abc/open`: întâi `AdminGuard`, apoi deschiderea. Răspunde 200.

```ts
  @Post(':id/ballots')
  castBallot(@Param('id') id: string, @Headers('authorization') auth: string | undefined, @Body() body: unknown) {
    return this.voting.cast(id, bearer(auth), body)
  }
```
Votul: ia ID-ul din adresă, token-ul de sesiune din antet și buletinul din corp, apoi le dă serviciului de vot.

Controller-ul e intenționat „subțire”: nu conține logică, doar leagă rutele de servicii și pune protecțiile.

## B.8 Baza de date: `apps/backend/src/db/database.service.ts`

```ts
constructor(@Inject(CONFIG) config: AppConfig) {
  this.pool = new pg.Pool({ ...pgOptions(config.databaseUrl), max: 20 })
}
```
Creează un pool de până la 20 de conexiuni. `pgOptions` adaugă SSL pentru serverele care nu sunt locale (Supabase).

```ts
async transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await this.pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    client.release()
  }
}
```

Cel mai important ajutor din server. Primește o funcție `fn` și o rulează într-o tranzacție:

1. împrumută o conexiune din pool;
2. `BEGIN`: de aici, tot ce se face e „provizoriu”;
3. rulează `fn`, care face interogările;
4. dacă a mers, `COMMIT`: totul devine definitiv;
5. dacă a apărut orice eroare, `ROLLBACK`: totul se anulează, ca și cum nu s-ar fi întâmplat nimic. `.catch(() => undefined)` ignoră o eventuală eroare chiar la `ROLLBACK`, ca să nu o ascundă pe cea originală;
6. `finally`: oricum s-ar termina, conexiunea se întoarce în pool.

```ts
export const isUniqueViolation = (err: unknown, constraint?: string) =>
  (err as { code?: string })?.code === '23505' && (!constraint || (err as { constraint?: string }).constraint === constraint)
```
Recunoaște eroarea „există deja” (codul 23505) și, opțional, ce constrângere anume a picat. Așa serverul poate spune „ai votat deja” în loc de o eroare tehnică.

## B.9 Votul: `VotingService.cast` (`apps/backend/src/voting/voting.service.ts`)

```ts
async cast(electionId: string, sessionToken: string | null, body: unknown): Promise<BallotReceipt> {
  const session = sessionToken ? verifySession(this.config.sessionSecret, sessionToken) : null
  if (!session) throw new UnauthorizedException('Sesiune lipsă sau expirată; autentifică-te din nou')
```
Fără sesiune validă → 401.

```ts
  const raw = obj(body, 'buletinul')
  const ballot: Ballot = {
    electionId: raw.electionId as string,
    credentialPubkey: raw.credentialPubkey as string,
    ciphertexts: raw.ciphertexts as Ballot['ciphertexts'],
    proofs: raw.proofs as Ballot['proofs'],
    signature: raw.signature as string,
  }
```
`obj` verifică dacă corpul e un obiect. Apoi buletinul se **reconstruiește doar din câmpurile cunoscute**. Orice câmp în plus trimis de un atacator e ignorat.

```ts
  if (session.electionId !== electionId || ballot.electionId !== electionId) throw new ForbiddenException('…')
  if (session.credentialPubkey !== ballot.credentialPubkey) throw new ForbiddenException('Sesiunea aparține altui credential')
```
Sesiunea, adresa și buletinul trebuie să fie pentru același scrutin și același credential. Nu poți folosi sesiunea ta ca să trimiți buletinul altcuiva.

```ts
  const params = await this.elections.params(electionId)
  if (params.status !== 'open') throw new ConflictException('Scrutinul nu este deschis')
  const check = verifyBallot(params, ballot)
  if (!check.ok) throw bad(`Buletin respins: ${check.reason}`)
```
Verificarea criptografică: semnătura Ed25519 și toate dovezile ZK. Se face **înainte** de tranzacție, pentru că durează ~25 ms, iar tranzacția blochează board-ul.

```ts
  const entry = await this.db.transaction(async (client) => {
    const e = await this.elections.lock(client, electionId)
```
Începe tranzacția și blochează rândul scrutinului (`SELECT … FOR UPDATE`). Dacă două voturi vin simultan, al doilea așteaptă până termină primul. Altfel, ambele ar putea citi aceeași „ultimă intrare” și ar încerca amândouă să devină #42.

```ts
    if (e.status !== 'open') throw new ConflictException('Scrutinul nu este deschis')
    const reg = await client.query('SELECT 1 FROM registrations WHERE election_id = $1 AND credential_pubkey = $2', [electionId, ballot.credentialPubkey])
    if (!reg.rowCount) throw new ForbiddenException('Credential neînregistrat la acest scrutin')
    const voted = await client.query('SELECT 1 FROM ballots WHERE election_id = $1 AND credential_pubkey = $2', [electionId, ballot.credentialPubkey])
    if (voted.rowCount) throw new ConflictException('Acest credential a votat deja')
```
Verificările se repetă **în interiorul** tranzacției (starea s-ar fi putut schimba între timp). `rowCount` = câte rânduri a găsit.

```ts
    const last = await client.query('SELECT * FROM ballots WHERE election_id = $1 ORDER BY seq DESC LIMIT 1', [electionId])
    const previous: BoardEntry | undefined = last.rows[0] ? toEntry(last.rows[0]) : undefined
    const next = appendEntry(electionId, previous, ballot, new Date().toISOString())
```
Ia ultima intrare (sau nimic, dacă e primul vot) și construiește intrarea următoare, legată de ea prin hash.

```ts
    await client.query(`INSERT INTO ballots (…) VALUES ($1, …, $10)`, [electionId, next.seq, …, next.receivedAt])
    return next
  })
  return { seq: entry.seq, trackingCode: entry.hash, ballotHash: entry.ballotHash, receivedAt: entry.receivedAt }
```
Inserează intrarea, face `COMMIT` (prin `transaction`) și întoarce chitanța. `trackingCode` e hash-ul intrării.

```ts
} catch (err) {
  if (isUniqueViolation(err, 'ballots_election_id_credential_pubkey_key')) throw new ConflictException('Acest credential a votat deja')
```
Plasă de siguranță: dacă, totuși, două voturi ale aceluiași credential au trecut de verificări în același timp, constrângerea `UNIQUE` din bază îl oprește pe al doilea, iar serverul răspunde 409.

## B.10 Criptarea: `packages/crypto/src/elgamal.ts`

```ts
const prepared = new Map<string, PointT>()

export function preparePublicKey(hex: string): PointT {
  let y = prepared.get(hex)
  if (!y) {
    y = pointFromHex(hex, 'cheia publică').precompute(8)
    if (prepared.size > 64) prepared.clear()
    prepared.set(hex, y)
  }
  return y
}
```
Transformă cheia publică din hex în punct și **precalculează** un tabel cu multiplii ei (`precompute(8)`), ca înmulțirile repetate (câte una la fiecare criptare) să fie mai rapide. Rezultatul se ține într-un **cache** (`Map`): a doua oară nu se mai calculează. Dacă cache-ul trece de 64 de chei, se golește, ca să nu crească la nesfârșit.

```ts
export function encryptPoints(y: PointT, m: number | bigint, r: bigint): CiphertextPoints {
  return { a: mulSecret(G, r), b: encodeSmall(m).add(mulSecret(y, r)) }
}
```
Formula ElGamal: `A = r·G`, `B = m·G + r·Y`. `mulSecret` face înmulțirea în timp constant, pentru că `r` e secret.

```ts
export function encrypt(publicKey: string, m: number | bigint, r: bigint = randomNonZeroScalar()): Ciphertext {
  const { a, b } = encryptPoints(preparePublicKey(publicKey), m, r)
  return { a: pointToHex(a), b: pointToHex(b) }
}
```
Varianta comodă: primește cheia în hex, alege un `r` aleator dacă nu e dat și întoarce criptotextul în hex.

```ts
export function addCiphertexts(list: readonly CiphertextPoints[]): CiphertextPoints {
  let a: PointT = ZERO
  let b: PointT = ZERO
  for (const c of list) {
    a = a.add(c.a)
    b = b.add(c.b)
  }
  return { a, b }
}
```
**Numărarea homomorfă**: pornește de la zero și adună componentele tuturor criptotextelor. Rezultatul criptează suma voturilor.

```ts
export function decryptToPoint(secret: bigint, ct: CiphertextPoints): PointT {
  return ct.b.subtract(mulSecret(ct.a, secret))
}
```
`B − x·A = m·G`. Folosită doar în teste, pentru că în sistemul real nimeni nu are cheia completă `x`.

## B.11 Buletinul: `encryptBallot` (`packages/crypto/src/ballot.ts`)

```ts
export function encryptBallot(params: ElectionParams, choice: number, credentialSecretKey: string, credentialPubkey: string): EncryptedBallot {
  const n = params.candidateCount
  if (!Number.isInteger(choice) || choice < 0 || choice >= n) throw new Error('Opțiune în afara listei de candidați')
```
Verifică dacă opțiunea e un candidat existent (de la 0 la n−1).

```ts
  const y = preparePublicKey(params.publicKey)
  const context = ballotContext(params, credentialPubkey)
```
Pregătește cheia scrutinului și **contextul Fiat-Shamir**: ID-ul scrutinului, cheia, numărul de candidați și credentialul. Intră în hash-ul fiecărei dovezi, deci dovezile nu pot fi mutate în alt scrutin sau la alt alegător.

```ts
  for (let j = 0; j < n; j++) {
    const m = j === choice ? 1 : 0
    const r = randomNonZeroScalar()
    const ct = encryptPoints(y, m, r)
    randomness.push(r)
    points.push(ct)
    choices.push(proveZeroOne([...context, String(j)], y, ct.a, ct.b, m, r))
  }
```
Pentru fiecare candidat `j`:

- `m` = 1 dacă e cel ales, altfel 0;
- `r` = un număr aleator nou;
- criptează `m`;
- reține `r` (pentru Benaloh) și criptotextul;
- face dovada 0/1, cu poziția `j` adăugată în context.

```ts
  const sum = addCiphertexts(points)
  const rSum = modQ(randomness.reduce((acc, r) => acc + r, 0n))
  const proofs: BallotProofs = {
    choices,
    sum: proveEqualLogs(DOMAIN.sum, context, y, sum.a, sum.b.subtract(G), rSum),
  }
```
Adună toate criptotextele. Suma criptează 1, cu numărul aleator `R = Σrⱼ`. Dacă scazi `G` (adică 1·G) din `B`, rămâne o criptare a lui 0, iar dovada Chaum-Pedersen arată exact asta: `A = R·G` și `B − G = R·Y` au același `R`.

```ts
  const unsigned = { electionId: params.electionId, credentialPubkey, ciphertexts: points.map(encodeCiphertext), proofs }
  const signature = signMessage(credentialSecretKey, ballotSignatureMessage(ballotDigest(unsigned)))
  return {
    ballot: { ...unsigned, signature },
    secrets: { choice, randomness: randomness.map(scalarToHex) },
  }
}
```
Pune laolaltă buletinul nesemnat, calculează rezumatul lui (SHA-256 peste JSON-ul canonic), îl semnează cu cheia de credential și întoarce două lucruri: buletinul de trimis și secretele, care rămân pe telefon doar pentru auditul Benaloh.

## B.12 Registrul: `appendEntry` (`packages/crypto/src/board.ts`)

```ts
export const genesisHash = (electionId: string) => hashObject({ v: 1, kind: 'genesis', electionId, prev: GENESIS_HASH })
```
Prima intrare a unui scrutin se leagă de un hash derivat din ID-ul scrutinului (`GENESIS_HASH` = 64 de zerouri). Astfel, intrări din două scrutine diferite nu pot fi amestecate.

```ts
export function appendEntry(electionId: string, previous: BoardEntry | undefined, ballot: Ballot, receivedAt: string): BoardEntry {
  const seq = (previous?.seq ?? 0) + 1
  const prevHash = previous?.hash ?? genesisHash(electionId)
  const bh = ballotHash(ballot)
  return {
    seq,
    hash: computeEntryHash({ electionId, seq, prevHash, ballotHash: bh, receivedAt }),
    prevHash, ballotHash: bh, …
  }
}
```

- `seq`: poziția, cu 1 mai mare decât a celei anterioare (sau 1, dacă e prima).
- `prevHash`: hash-ul intrării anterioare (sau genesis).
- `bh`: hash-ul buletinului semnat.
- `hash`: hash-ul intrării = SHA-256 peste {scrutin, poziție, hash anterior, hash buletin, oră}. Acesta e codul de urmărire.

Dacă cineva schimbă orice în intrarea #10, hash-ul ei se schimbă, deci `prevHash` din #11 nu mai bate. Ca să ascundă modificarea, ar trebui să recalculeze toate intrările de după, iar atunci codurile de urmărire primite deja de alegători nu s-ar mai potrivi.

## B.13 Pașii alegătorului: `packages/api/src/voter.ts`

```ts
export async function authenticate(api: ApiClient, electionId: string, credential: VoterCredential): Promise<string> {
  const challenge = await api.authChallenge(electionId, credential.publicKey)
  const signature = signMessage(credential.secretKey, authMessage(electionId, credential.publicKey, challenge.nonce))
  const session = await api.authVerify(challenge.challengeId, signature)
  return session.token
}
```
1. Cere provocarea de la server.
2. Semnează textul exact (scrutin + credential + nonce) cu cheia secretă, pe telefon.
3. Trimite semnătura și primește token-ul de sesiune.

```ts
export async function submitBallot(api, election, credential, prepared): Promise<BallotReceipt> {
  const token = await authenticate(api, election.id, credential)
  return api.castBallot(election.id, prepared.ballot, token)
}
```
Autentificare, apoi trimiterea buletinului deja criptat.

```ts
export async function verifyOwnBallot(api, electionId, receipt): Promise<OwnBallotCheck> {
  let entry
  try {
    entry = await api.findBallot(electionId, receipt.trackingCode)
  } catch (err) {
    if ((err as { status?: number }).status === 404) return { status: 'missing' }
    throw err
  }
  const check = checkOwnEntry(electionId, entry, receipt)
  return check.ok ? { status: 'ok', seq: entry.seq } : { status: 'modified', reason: check.reason }
}
```
Caută intrarea după cod. Dacă nu există → „lipsește”. Dacă există, recalculează local hash-urile și le compară cu chitanța → „ok” sau „modificat”, cu motivul.

Fișierul e folosit identic de telefon, de simulator și de teste.

## B.14 Site-ul: `apps/web/src/main.tsx` și `App.tsx`

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```
- `index.html` are un singur `<div id="root">`. React desenează toată aplicația în el.
- `StrictMode`: verificări suplimentare în timpul dezvoltării.
- `BrowserRouter`: activează navigarea după adresă.

```tsx
<Routes>
  <Route element={<Layout />}>
    <Route index element={<Home />} />
    <Route path="scrutin/:id" element={<ElectionPublic />} />
    <Route path="comisie" element={<AdminGate><Commission /></AdminGate>} />
    …
    <Route path="*" element={<div className="state">Pagina nu există. …</div>} />
  </Route>
</Routes>
```
- Toate paginile sunt în interiorul `Layout` (bara de sus).
- `index` = pagina principală, `/`.
- Paginile comisiei sunt „îmbrăcate” în `AdminGate`, care cere token-ul înainte să le arate.
- `*` = orice altă adresă → „Pagina nu există”.

## B.15 Încărcarea datelor: `useAsync` (`apps/web/src/lib/useAsync.ts`)

```ts
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<Error>()
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
```
Patru stări: datele, eroarea, dacă se încarcă și un contor pentru reîncărcare.

```ts
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load()
      .then((value) => { if (cancelled) return; setData(value); setError(undefined) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err : new Error(String(err))) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [...deps, tick])
```
- Rulează `load()` la afișare și ori de câte ori se schimbă `deps` sau `tick`.
- Pune rezultatul în `data` sau eroarea în `error`.
- `cancelled`: dacă utilizatorul a plecat de pe pagină sau datele s-au schimbat între timp, rezultatul vechi e ignorat. Altfel, un răspuns întârziat ar putea suprascrie unul mai nou.

```ts
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}
```
`reload()` crește contorul, ceea ce declanșează din nou efectul.

Folosire într-o pagină:

```ts
const election = useAsync(() => api.getElection(id), [id])
if (election.error) return <Notice tone="bad" text={election.error.message} />
if (!election.data) return <Loading />
```

## B.16 Ecranul de vot: `apps/mobile/src/app/scrutin/[id]/vot.tsx`

```ts
const { id } = useLocalSearchParams<{ id: string }>()
const election = useAsync(() => api.getElection(id), [id])
const { session, update } = useSession(id)
const [choice, setChoice] = useState<number>()
const [prepared, setPrepared] = useState<{ ballot: EncryptedBallot; ms: number }>()
```
- `id` vine din adresa ecranului (`/scrutin/<id>/vot`).
- Încarcă scrutinul de la server.
- Ia sesiunea alegătorului (credentialul și înregistrarea) din SecureStore.
- `choice`: candidatul selectat. `prepared`: buletinul criptat și cât a durat criptarea.

```ts
if (!registration || !credential) { … „Trebuie să te înregistrezi…” … }
```
Fără înregistrare sau fără cheia de credential pe telefon, nu poți vota.

```ts
const encrypt = (position: number) => {
  const t = Date.now()
  const ballot = prepareBallot(e, credential, position)
  setPrepared({ ballot, ms: Date.now() - t })
}
```
Criptează **pe telefon** și măsoară timpul (afișat pe ecran).

```ts
const confirm = () => {
  …
  setBusy(true)
  setTimeout(() => { try { encrypt(choice) } … finally { setBusy(false) } }, 30)
}
```
`setTimeout(…, 30)` amână calculul cu 30 ms, ca ecranul să apuce să afișeze „se lucrează” înainte ca procesorul să fie ocupat cu criptarea.

```ts
const submit = async () => {
  …
  const receipt = await submitBallot(api, e, credential, prepared.ballot)
  update({ receipt })
  router.replace({ pathname: '/scrutin/[id]/confirmare', params: { id } })
}
```
Trimite buletinul (autentificare + `POST /ballots`), salvează chitanța în sesiune și trece la ecranul de confirmare, cu codul de urmărire.

```ts
if (audit) return <BenalohAudit … onDone={() => {
  setAudit(undefined)
  if (choice !== undefined) encrypt(choice)
}} />
```
Dacă alegătorul a cerut auditul Benaloh, se afișează ecranul de audit. La final, buletinul auditat se aruncă și votul se **recriptează** cu numere aleatoare noi.

## B.17 Schema bazei: `apps/backend/migrations/001_init.sql` (extras)

```sql
CREATE TABLE registrations (
  id                 bigserial PRIMARY KEY,
  election_id        text NOT NULL,
  cnp_hmac           text NOT NULL,
  credential_pubkey  text NOT NULL,
  method             text NOT NULL CHECK (method IN ('ocr', 'nfc')),
  trust_level        text NOT NULL CHECK (trust_level IN ('optic', 'criptografic')),
  registered_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (election_id, cnp_hmac),
  UNIQUE (election_id, credential_pubkey),
  FOREIGN KEY (election_id, cnp_hmac) REFERENCES eligible_voters (election_id, cnp_hmac)
);
```
- Fiecare înregistrare are un număr unic, crescător.
- `cnp_hmac`: amprenta CNP-ului, **nu** CNP-ul.
- `method` și `trust_level` pot avea doar valorile din listă.
- `UNIQUE (election_id, cnp_hmac)`: o persoană se înregistrează o singură dată per scrutin.
- `UNIQUE (election_id, credential_pubkey)`: un credential aparține unei singure persoane.
- `FOREIGN KEY … REFERENCES eligible_voters`: nu te poți înregistra dacă nu ești pe lista de eligibili, nici măcar ocolind serverul.

```sql
CREATE FUNCTION ballots_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'bulletin board-ul este append-only: % interzis', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ballots_append_only
  BEFORE UPDATE OR DELETE ON ballots
  FOR EACH ROW EXECUTE FUNCTION ballots_append_only();
```
- Funcția aruncă mereu eroare; `%` e înlocuit cu `TG_OP` (`UPDATE` sau `DELETE`).
- Trigger-ul o cheamă înainte de orice modificare sau ștergere de pe board, deci ele sunt imposibile. Testul „board-ul e append-only” încearcă exact asta și se așteaptă la eroare.

## B.18 Imaginea serverului: `apps/backend/Dockerfile`

```dockerfile
FROM node:22-alpine AS build
WORKDIR /repo
COPY . .
RUN npm ci -w @evoting/crypto -w @evoting/api -w @evoting/backend --include-workspace-root \
 && npm run build -w @evoting/crypto -w @evoting/api -w @evoting/backend \
 && npm prune --omit=dev -w @evoting/crypto -w @evoting/api -w @evoting/backend
```
**Etapa 1 (build):** Node 22 pe Alpine; copiază tot proiectul; instalează doar ce trebuie pentru criptografie, API și server (`-w` = workspace); le compilează; apoi șterge bibliotecile de dezvoltare (`prune --omit=dev`), cum ar fi TypeScript.

```dockerfile
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/crypto/dist /repo/packages/crypto/dist
…
COPY --from=build /repo/apps/backend/migrations /repo/apps/backend/migrations
```
**Etapa 2 (finală):** pornește de la o imagine curată și copiază din etapa 1 doar bibliotecile de rulare, codul compilat (`dist`) și migrările. Codul sursă TypeScript nu ajunge în imaginea finală.

```dockerfile
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN mkdir -p /pki && chown node:node /pki
WORKDIR /repo/apps/backend
EXPOSE 3000
USER node
ENTRYPOINT ["/bin/sh", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
```
- Copiază scriptul de pornire.
- Creează folderul `/pki` pentru certificatele de test și îl dă utilizatorului `node`.
- Rulează ca `node`, nu ca `root`.
- La pornire: scriptul, apoi `node dist/src/main.js`.

## B.19 Scriptul de pornire: `apps/backend/docker-entrypoint.sh`

```sh
#!/bin/sh
set -e
if [ "$GENERATE_TEST_PKI" = "true" ] && [ -n "$PKI_DIR" ] && [ ! -f "$PKI_DIR/test-dsc.json" ]; then
  node dist/src/nfc/test-pki-cli.js "$PKI_DIR"
fi
exec "$@"
```
- `#!/bin/sh`: rulează cu shell-ul Linux.
- `set -e`: oprește-te la prima eroare.
- Dacă `GENERATE_TEST_PKI=true`, `PKI_DIR` e setat (`-n` = nu e gol) și certificatele de test nu există încă (`! -f` = fișierul nu există), le generează.
- `exec "$@"`: înlocuiește scriptul cu comanda primită (`node dist/src/main.js`).

Acesta e scriptul care pica pe Windows din cauza capetelor de rând `\r\n`; `.gitattributes` îl ține acum cu `\n`.

## B.20 Site-ul în Docker: `apps/web/nginx.conf`

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  location / {
    try_files $uri /index.html;
  }
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```
- Ascultă pe portul 80 din container.
- Fișierele site-ului sunt în `/usr/share/nginx/html`.
- Pentru orice adresă, caută fișierul; dacă nu există (de exemplu `/scrutin/abc`), trimite `index.html`, iar React Router afișează pagina.
- Fișierele din `/assets/` au în nume un hash al conținutului (de exemplu `index-a1b2c3.js`), deci browserul le poate păstra un an: dacă se schimbă, se schimbă și numele.

## B.21 Tot sistemul: `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: evoting
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-evoting}
      POSTGRES_DB: evoting
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U evoting -d evoting"]
```
Baza locală: imaginea oficială PostgreSQL 16, utilizatorul, parola și baza, datele într-un volum (supraviețuiesc repornirii) și verificarea sănătății cu `pg_isready`.

```yaml
  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: ${DATABASE_URL:-postgres://evoting:${POSTGRES_PASSWORD:-evoting}@db:5432/evoting}
      CNP_HMAC_KEY: ${CNP_HMAC_KEY:?setează CNP_HMAC_KEY în .env …}
      ADMIN_TOKEN: ${ADMIN_TOKEN:?setează ADMIN_TOKEN în .env}
      …
    ports:
      - "3000:3000"
```
- Imaginea se construiește din `apps/backend/Dockerfile`, cu tot proiectul ca context.
- Pornește doar după ce baza e sănătoasă.
- `DATABASE_URL`: din `.env` (Supabase, în cazul tău); dacă lipsește, baza locală `db`. În rețeaua Docker, containerele se găsesc după numele serviciului, deci `db:5432`.
- `CNP_HMAC_KEY` și `ADMIN_TOKEN` sunt obligatorii (`:?`): fără ele, `docker compose` refuză să pornească.
- Portul 3000 din container e expus pe portul 3000 al calculatorului.

```yaml
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        VITE_API_URL: ${PUBLIC_API_URL:-http://localhost:3000}
    ports:
      - "8080:80"
```
Site-ul: construit cu adresa API-ului „văzută din browser” (`localhost:3000`, nu `backend:3000`, pentru că browserul rulează pe calculatorul tău, nu în rețeaua Docker) și expus pe portul 8080.
