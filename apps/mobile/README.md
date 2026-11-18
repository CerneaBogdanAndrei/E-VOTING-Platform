# @evoting/mobile

Aplicația alegătorului: înregistrare cu buletinul (OCR pe MRZ sau NFC pe CEI), vot criptat pe telefon, provocarea Benaloh, verificarea votului pe board. Expo SDK 57 + React Native 0.86 + Expo Router, cu două module native Kotlin.

```bash
cd apps/mobile && npm install          # instalare separată de restul monorepo-ului (vezi package.json)
npx expo start                         # Expo Go sau web; fără EXPO_PUBLIC_API_URL folosește backend-ul simulat
npx expo run:android                   # development build cu NFC și OCR (cere Android SDK)
npx tsc --noEmit                       # verificarea tipurilor
```

Pe telefon, `EXPO_PUBLIC_API_URL` trebuie să fie IP-ul calculatorului din rețea (`http://192.168.1.20:3000`), nu `localhost`. APK-ul se construiește pe GitHub (`.github/workflows/android-apk.yml`).

## Structura

| Folder / fișier | Ce conține |
| --- | --- |
| `app.json`, `metro.config.js`, `plugins/` | Configurarea Expo, Metro (urmărește și `packages/`), pluginul de împachetare Android. |
| `src/app/` | Ecranele (Expo Router): `index.tsx` (lista scrutinelor), `scrutin/[id]/` (`index`, `inregistrare`, `ocr`, `nfc`, `vot`, `confirmare`, `verifica`), `_layout.tsx`. |
| `src/components/ui/` | O componentă per fișier: `Screen`, `Card`, `Button`, `Tag`, `Notice`, `Field`, `Typography`, `ModeBanner`, `Loading`. |
| `src/components/election/` | `VoterSteps`, `PrimaryAction`, `CandidateList`, `ResultCard`, `IntervalNote` („votul se închide peste…”). |
| `src/components/identity/` | `MrzSummary`, `ModeTabs`, `KeyValueRow`. |
| `src/components/vote/` | `CandidateOption`, `BallotReview`, `BenalohAudit`. |
| `src/lib/` | `polyfills.ts` (numere aleatoare pe Hermes), `session.tsx` (credential, înregistrare, chitanță în SecureStore), `native.ts` (modulele native, opționale), `theme.ts`, `format.ts` (din `@evoting/api`), `useAsync.ts`. |
| `src/api/` | Alegerea clientului (real sau simulat). |
| `modules/evoting-nfc/` | Kotlin + JMRTD: PACE cu CAN, citirea DG1 și SOD. |
| `modules/evoting-ocr/` | Kotlin + ML Kit: textul din fotografia MRZ-ului. |

Fluxul alegătorului, pas cu pas: [docs/DOCUMENTATIE.md §4](../../docs/DOCUMENTATIE.md#4-un-scrutin-complet-pas-cu-pas).
