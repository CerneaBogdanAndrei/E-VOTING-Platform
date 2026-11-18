// @evoting/api: contractul HTTP, clientul, backend-ul simulat, identitatea (CNP, MRZ, DG1),
// pașii alegătorului și formatările comune. Folosit de web, mobil, backend, CLI-uri și teste.
//
//   contract/   tipurile cererilor și răspunsurilor, ApiError, interfața ApiClient
//   client/     clientul HTTP real
//   mock/       backend-ul simulat în memorie, cu criptografie reală
//   identity/   CNP, MRZ (ICAO 9303) și DG1 de pe cipul CEI
//   voter.ts    autentificare, criptare, trimitere, verificarea propriului vot
//   format.ts   etichete și formatări (date, hash-uri, procente, durate)

export * from './contract/index.js'
export { createHttpClient, type HttpClientOptions } from './client/http.js'
export { createMockBackend, type MockTools, type MockOptions } from './mock/index.js'
export { checkCnp, isValidCnp, generateCnp, type CnpCheck } from './identity/cnp.js'
export { parseMrz, normalizeMrzLines, mrzCheckDigit, type MrzData, type MrzCheck, type MrzFormat } from './identity/mrz.js'
export { buildTd1, buildTd2, type MrzInput } from './identity/mrz-build.js'
export { mrzFromDg1, dg1FromMrz, base64ToBytes, bytesToBase64 } from './identity/dg1.js'
export { authenticate, electionParams, prepareBallot, submitBallot, verifyOwnBallot, type VoterCredential, type OwnBallotCheck } from './voter.js'
export * from './format.js'
