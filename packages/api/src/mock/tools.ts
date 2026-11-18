// Uneltele de test ale backend-ului simulat: țin locul CLI-ului de trustee și al
// alegătorilor, ca site-ul și aplicația să poată fi demonstrate fără server.

import { generateCredential } from '@evoting/crypto'
import { ApiError, type ApiClient, type Election } from '../contract/index.js'
import { isValidCnp } from '../identity/cnp.js'
import { buildTd1, buildTd2 } from '../identity/mrz-build.js'
import { authenticate, prepareBallot } from '../voter.js'
import type { Run } from './client.js'
import { pickWeighted } from './random.js'
import { freshCnp, simulateKeys, simulateTallyNow } from './rules.js'
import type { MockContext } from './state.js'

export interface MockTools {
  /** Un CNP eligibil, încă neînregistrat, sau null. */
  sampleCnp(electionId: string): Promise<string | null>
  /** MRZ-ul unui buletin de test pentru un CNP eligibil neînregistrat. */
  sampleMrz(electionId: string, format: 'TD1' | 'TD2'): Promise<string | null>
  /** Trustees fără cheie își generează și trimit Yᵢ (în locul CLI-ului). */
  simulateTrusteeKeys(electionId: string): Promise<Election>
  /** Înregistrează și votează n alegători aleatori, cu buletine criptate reale. Întoarce câți au votat. */
  simulateVoters(electionId: string, n: number): Promise<number>
  /** Trustees trimit decriptările parțiale, iar rezultatul se publică. */
  simulateTally(electionId: string): Promise<Election>
  /**
   * Adaugă un CNP real (citit de pe buletinul tău) în lista de eligibili, ca să poți
   * vota cu propriul document pe backend-ul simulat. Pe serverul real lista se importă de comisie.
   */
  addEligibleCnp(electionId: string, cnp: string): Promise<void>
}

export function createMockTools(ctx: MockContext, client: ApiClient, run: Run): MockTools {
  return {
    sampleCnp: (id) => run(() => freshCnp(ctx, ctx.get(id))),
    sampleMrz: (id, format) =>
      run(() => {
        const cnp = freshCnp(ctx, ctx.get(id))
        if (!cnp) return null
        const input = {
          surname: 'Popescu',
          givenNames: 'Andrei',
          documentNumber: format === 'TD1' ? 'GL123456' : 'GL654321',
          cnp,
          sex: (Number(cnp[0]) % 2 ? 'M' : 'F') as 'M' | 'F',
          expiry: '310428',
        }
        return format === 'TD1' ? buildTd1(input) : buildTd2(input)
      }),
    simulateTrusteeKeys: (id) =>
      run(() => {
        const s = ctx.get(id)
        if (s.data.status !== 'draft') throw new ApiError(409, 'Cheile se generează doar în configurare')
        simulateKeys(ctx, s)
        return ctx.snapshot(s)
      }),
    simulateVoters: (id, n) =>
      run(async () => {
        const s = ctx.get(id)
        if (s.data.status !== 'open') throw new ApiError(409, 'Scrutinul nu este deschis')
        let done = 0
        for (const cnp of [...s.testCnps]) {
          if (done >= n) break
          if (s.registeredHmacs.has(ctx.hmac(cnp))) continue
          // același drum ca aplicația: înregistrare, autentificare, criptare, trimitere
          const cred = generateCredential()
          await client.registerOcr(id, { cnp, credentialPubkey: cred.publicKey })
          const election = ctx.snapshot(s)
          const { ballot } = prepareBallot(
            election,
            cred,
            pickWeighted(
              ctx.rand,
              election.candidates.map(() => 1),
            ),
          )
          const token = await authenticate(client, id, cred)
          await client.castBallot(id, ballot, token)
          done++
        }
        return done
      }),
    simulateTally: (id) =>
      run(() => {
        const s = ctx.get(id)
        if (s.data.status !== 'closed') throw new ApiError(409, 'Numărarea începe după închiderea votului')
        simulateTallyNow(ctx, s)
        return ctx.snapshot(s)
      }),
    addEligibleCnp: (id, cnp) =>
      run(() => {
        const s = ctx.get(id)
        if (s.data.status !== 'draft' && s.data.status !== 'open') throw new ApiError(409, 'Înregistrarea s-a închis pentru acest scrutin')
        if (!isValidCnp(cnp)) throw new ApiError(400, 'CNP invalid')
        // doar HMAC-ul; nu intră în testCnps, ca simularea alegătorilor să nu-l folosească
        if (!s.eligible.has(ctx.hmac(cnp))) {
          s.eligible.add(ctx.hmac(cnp))
          ctx.log(s, 'comisie', 'eligible.import', { imported: 1, duplicates: 0, invalid: 0 })
        }
      }),
  }
}
