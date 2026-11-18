// Implementarea ApiClient peste starea din memorie: fiecare metodă corespunde
// unei rute a serverului real și aplică aceleași reguli (mock/rules.ts).

import { authMessage, genesisHash, normalizeTrackingCode, verifySignature } from '@evoting/crypto'
import { ApiError, type ApiClient, type CommissionMember } from '../contract/index.js'
import { base64ToBytes, mrzFromDg1 } from '../identity/dg1.js'
import { parseMrz } from '../identity/mrz.js'
import { ROOT_ADMIN } from './contract-helpers.js'
import { clone, randomToken } from './random.js'
import {
  cast,
  close,
  deleteElection,
  importCsv,
  removeCsv,
  openElection,
  register,
  submitKey,
  submitPartial,
  trusteeForToken,
  updateElection,
  validateInterval,
} from './rules.js'
import type { MockContext } from './state.js'

/** `run` așteaptă datele de demonstrație și simulează latența rețelei. */
export type Run = <T>(fn: () => T | Promise<T>) => Promise<T>

export function createMockClient(ctx: MockContext, run: Run): ApiClient {
  const head = (id: string) => {
    const last = ctx.get(id).board.at(-1)
    return last ? { seq: last.seq, hash: last.hash } : { seq: 0, hash: genesisHash(id) }
  }
  const publicRegistrations = (id: string) => [...ctx.get(id).registrations.values()].map(({ electionId: _e, replacedPrevious: _r, ...r }) => r)
  const publicMember = ({ token: _t, ...m }: CommissionMember & { token: string }) => m

  return {
    // ───────────── public ─────────────
    listElections: () => run(() => [...ctx.store.values()].map(ctx.snapshot)),
    getElection: (id) => run(() => ctx.snapshot(ctx.get(id))),
    getBoard: (id) => run(() => clone(ctx.get(id).board)),
    getBoardPage: (id, page, size) =>
      run(() => {
        const board = ctx.get(id).board
        const newestFirst = [...board].reverse()
        const start = Math.max(0, page - 1) * size
        return clone({ entries: newestFirst.slice(start, start + size), total: board.length, page, size })
      }),
    findBallot: (id, code) =>
      run(() => {
        const needle = normalizeTrackingCode(code)
        const entry = ctx.get(id).board.find((b) => b.hash === needle)
        if (!entry) throw new ApiError(404, 'Niciun buletin cu acest cod de urmărire')
        return clone(entry)
      }),
    getBoardHead: (id) => run(() => head(id)),
    getRegistrations: (id) => run(() => clone(publicRegistrations(id))),
    getTally: (id) =>
      run(() => {
        const s = ctx.get(id)
        return clone({ aggregate: s.aggregate, partials: [...s.partials.values()] })
      }),
    getResult: (id) =>
      run(() => {
        const s = ctx.get(id)
        if (!s.result) throw new ApiError(404, 'Rezultatul nu a fost publicat încă')
        return clone(s.result)
      }),
    getAuditBundle: (id) =>
      run(() => {
        const s = ctx.get(id)
        return clone({
          election: ctx.snapshot(s),
          registrations: publicRegistrations(id),
          board: s.board,
          tally: { aggregate: s.aggregate, partials: [...s.partials.values()] },
          result: s.result,
          head: head(id),
        })
      }),

    // ───────────── comisia ─────────────
    createElection: (input) =>
      run(() => {
        if (!input.title.trim()) throw new ApiError(400, 'Titlul este obligatoriu')
        if (input.candidates.length < 2) throw new ApiError(400, 'Sunt necesari cel puțin doi candidați')
        if (input.trustees.length < 1) throw new ApiError(400, 'Este necesar cel puțin un trustee')
        validateInterval(input.opensAt, input.closesAt)
        const { state, tokens } = ctx.newState(input)
        ctx.store.set(state.data.id, state)
        ctx.log(state, 'comisie', 'election.create', { title: input.title })
        return { election: ctx.snapshot(state), trusteeTokens: tokens }
      }),
    updateElection: (id, input) =>
      run(() => {
        const s = ctx.get(id)
        updateElection(ctx, s, input)
        return ctx.snapshot(s)
      }),
    deleteElection: (id) => run(() => deleteElection(ctx, ctx.get(id))),
    importEligible: (id, csv) => run(() => importCsv(ctx, ctx.get(id), csv)),
    removeEligible: (id, csv) => run(() => removeCsv(ctx, ctx.get(id), csv)),
    openElection: (id) =>
      run(() => {
        const s = ctx.get(id)
        openElection(ctx, s)
        return ctx.snapshot(s)
      }),
    closeElection: (id) =>
      run(() => {
        const s = ctx.get(id)
        if (s.data.status !== 'open') throw new ApiError(409, 'Scrutinul nu este deschis')
        close(s)
        ctx.log(s, 'comisie', 'election.close', { ballots: s.board.length })
        return ctx.snapshot(s)
      }),
    getAuditLog: (id) => run(() => clone(ctx.get(id).audit)),
    checkAdmin: () => run(() => ({ ...ROOT_ADMIN })),
    listMembers: () => run(() => [...ctx.members.values()].map(publicMember)),
    createMember: (input) =>
      run(() => {
        if (!input.name.trim()) throw new ApiError(400, 'Numele este obligatoriu')
        if (input.role !== 'comisie' && input.role !== 'observator') throw new ApiError(400, 'Rolul e „comisie” sau „observator”')
        const member = {
          id: `m-${randomToken().slice(0, 6)}`,
          name: input.name.trim(),
          role: input.role,
          token: randomToken(),
          createdAt: new Date().toISOString(),
          revokedAt: null,
        }
        ctx.members.set(member.id, member)
        return { ...member }
      }),
    revokeMember: (id) =>
      run(() => {
        const m = ctx.members.get(id)
        if (!m) throw new ApiError(404, 'Membrul nu există')
        m.revokedAt = new Date().toISOString()
      }),

    // ───────────── trustees ─────────────
    submitTrusteeKey: (id, token, key) =>
      run(() => {
        const s = ctx.get(id)
        const t = trusteeForToken(s, token)
        if (key.trusteeId !== t.id) throw new ApiError(403, 'Token-ul aparține altui trustee')
        submitKey(ctx, s, t.id, key.publicKeyShare, key.proof)
        return ctx.snapshot(s)
      }),
    submitPartialDecryption: (id, token, partial) =>
      run(() => {
        const s = ctx.get(id)
        const t = trusteeForToken(s, token)
        submitPartial(ctx, s, t.id, partial)
        return ctx.snapshot(s)
      }),

    // ───────────── alegătorul ─────────────
    registerOcr: (id, input) => run(() => register(ctx, ctx.get(id), input.cnp, input.credentialPubkey, 'ocr')),
    registerNfc: (id, input) =>
      run(() => {
        // Passive Authentication nu se face în simulator: SOD-ul se verifică doar pe serverul real.
        let mrz
        try {
          mrz = parseMrz(mrzFromDg1(base64ToBytes(input.dg1)))
        } catch (err) {
          throw new ApiError(400, err instanceof Error ? err.message : 'DG1 invalid')
        }
        if (!mrz?.valid || !mrz.cnp) throw new ApiError(400, 'DG1 nu conține un MRZ valid cu CNP')
        return register(ctx, ctx.get(id), mrz.cnp, input.credentialPubkey, 'nfc')
      }),
    authChallenge: (id, credentialPubkey) =>
      run(() => {
        const s = ctx.get(id)
        if (!s.registrations.has(credentialPubkey)) throw new ApiError(403, 'Credential neînregistrat la acest scrutin')
        const challengeId = randomToken()
        const nonce = randomToken()
        const expiresAt = Date.now() + 120_000
        ctx.challenges.set(challengeId, { electionId: id, credentialPubkey, nonce, expiresAt })
        return { challengeId, nonce, expiresAt: new Date(expiresAt).toISOString() }
      }),
    authVerify: (challengeId, signature) =>
      run(() => {
        const c = ctx.challenges.get(challengeId)
        ctx.challenges.delete(challengeId)
        if (!c || c.expiresAt < Date.now()) throw new ApiError(401, 'Provocare expirată sau necunoscută')
        if (!verifySignature(c.credentialPubkey, authMessage(c.electionId, c.credentialPubkey, c.nonce), signature)) {
          throw new ApiError(401, 'Semnătura provocării nu e validă')
        }
        const token = randomToken()
        const expiresAt = Date.now() + 10 * 60_000
        ctx.sessions.set(token, { electionId: c.electionId, credentialPubkey: c.credentialPubkey, expiresAt })
        return { token, expiresAt: new Date(expiresAt).toISOString() }
      }),
    castBallot: (id, ballot, sessionToken) =>
      run(() => {
        const session = ctx.sessions.get(sessionToken)
        if (!session || session.expiresAt < Date.now()) throw new ApiError(401, 'Sesiune expirată; autentifică-te din nou')
        if (session.electionId !== id || session.credentialPubkey !== ballot.credentialPubkey) {
          throw new ApiError(403, 'Sesiunea aparține altui credential')
        }
        const entry = cast(ctx, ctx.get(id), ballot)
        ctx.sessions.delete(sessionToken)
        return { seq: entry.seq, trackingCode: entry.hash, ballotHash: entry.ballotHash, receivedAt: entry.receivedAt }
      }),
  }
}
