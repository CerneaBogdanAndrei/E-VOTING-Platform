// Unelte pentru demonstrație, active doar cu DEMO_MODE=true. Țin locul
// alegătorilor și al trustees, ca un scrutin să poată fi parcurs în câteva
// minute la prezentare. Cheile secrete ale trustees simulați stau aici, în
// memoria serverului: exact ce sistemul real NU face. Nu se folosesc în producție.

import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { encryptBallot, generateCnp, generateCredential, generateTrusteeKey, partialDecrypt, signBallot, signMessage, authMessage, type TrusteeKey } from '@evoting/crypto'
import { electionParams, type Election } from '@evoting/api'
import { AuthService } from '../auth/auth.service.js'
import { BallotsService } from '../ballots/ballots.service.js'
import { AuditService } from '../common/audit.service.js'
import { ElectionsService } from '../elections/elections.service.js'
import { PassiveAuthService } from '../nfc/passive-auth.service.js'
import { RegistrationService } from '../registration/registration.service.js'
import { TallyService } from '../tally/tally.service.js'

@Injectable()
export class DemoService {
  /** CNP-uri fictive generate pentru fiecare scrutin (doar în demo). */
  private cnps = new Map<string, string[]>()
  private handedOut = new Map<string, number>()
  private simulatedKeys = new Map<string, TrusteeKey>()

  constructor(
    @Inject(ElectionsService) private readonly elections: ElectionsService,
    @Inject(RegistrationService) private readonly registration: RegistrationService,
    @Inject(BallotsService) private readonly ballots: BallotsService,
    @Inject(TallyService) private readonly tally: TallyService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PassiveAuthService) private readonly passiveAuth: PassiveAuthService,
  ) {}

  async generateEligible(id: string, count: number) {
    const cnps = Array.from({ length: count }, () => generateCnp())
    const r = await this.elections.importEligible(id, cnps.join('\n'))
    const list = this.cnps.get(id) ?? []
    list.push(...cnps)
    this.cnps.set(id, list)
    return { cnps, imported: r.imported }
  }

  /** Următorul CNP de test încă nefolosit. */
  sampleCnp(id: string): { cnp: string | null } {
    const list = this.cnps.get(id) ?? []
    const i = this.handedOut.get(id) ?? 0
    if (i >= list.length) return { cnp: null }
    this.handedOut.set(id, i + 1)
    return { cnp: list[i] }
  }

  async nfcDocument(id: string) {
    const { cnp } = this.sampleCnp(id)
    if (!cnp) throw new NotFoundException('Nu mai există CNP-uri de test (generează eligibili din panoul comisiei)')
    const doc = await this.passiveAuth.demoDocument(cnp)
    return doc ? { ...doc, cnp } : null
  }

  async trusteeKeys(id: string): Promise<Election> {
    const e = await this.elections.get(id)
    if (e.status !== 'draft') throw new ConflictException('Cheile se generează doar în configurare')
    for (const t of e.trustees.filter((t) => !t.publicKeyShare)) {
      const key = generateTrusteeKey(id, t.id)
      this.simulatedKeys.set(`${id}/${t.id}`, key)
      const { code } = await this.elections.trusteeInvite(id, t.id)
      await this.elections.submitTrusteeKey(id, code, { trusteeId: t.id, publicKeyShare: key.publicKeyShare, proof: key.proof })
    }
    await this.audit.log(id, 'demo', 'chei de trustee simulate (cheile secrete stau pe server: doar pentru demo)', {})
    return this.elections.get(id)
  }

  async voters(id: string, count: number) {
    const e = await this.elections.get(id)
    if (e.status !== 'open') throw new ConflictException('Scrutinul nu este deschis')
    const params = electionParams(e)
    let voted = 0
    for (let i = 0; i < count; i++) {
      const { cnp } = this.sampleCnp(id)
      if (!cnp) break
      const cred = generateCredential()
      try {
        await this.registration.registerOcr(id, cnp, cred.publicKey)
      } catch {
        continue // CNP deja înregistrat din aplicație
      }
      const { nonce } = await this.auth.challenge(id, cred.publicKey)
      const { token } = this.auth.verify(id, cred.publicKey, nonce, signMessage(cred.secretKey, authMessage(id, nonce)))
      // Preferințe ușor inegale, ca rezultatul să nu iasă la egalitate.
      const weights = params.candidates.map((_, j) => params.candidates.length - j + 1)
      const choices = pickWeighted(weights, params.minSelections, params.maxSelections)
      const enc = encryptBallot(params, cred.publicKey, choices)
      await this.ballots.cast(id, token, signBallot(enc.body, cred.secretKey))
      voted++
    }
    return { voted }
  }

  async runTally(id: string): Promise<Election> {
    const state = await this.tally.state(id)
    if (state.status !== 'closed' || !state.aggregate) throw new ConflictException('Numărarea începe după închiderea votului')
    const e = await this.elections.get(id)
    const missing = e.trustees.filter((t) => !t.partialDecryptionSubmitted && !this.simulatedKeys.has(`${id}/${t.id}`))
    if (missing.length) {
      throw new ConflictException(`Cheile lui ${missing.map((t) => t.name).join(', ')} nu sunt simulate: decriptarea se face cu CLI-ul de trustee`)
    }
    for (const t of e.trustees.filter((t) => !t.partialDecryptionSubmitted)) {
      const key = this.simulatedKeys.get(`${id}/${t.id}`)!
      const { code } = await this.elections.trusteeInvite(id, t.id)
      await this.tally.submitPartial(id, code, partialDecrypt(key, state.aggregate))
    }
    return this.elections.get(id)
  }
}

function pickWeighted(weights: number[], min: number, max: number): number[] {
  const k = Math.max(min, Math.min(max, 1 + Math.floor(Math.random() * max)))
  const pool = weights.map((w, i) => ({ w, i }))
  const out: number[] = []
  while (out.length < k && pool.length) {
    let r = Math.random() * pool.reduce((s, p) => s + p.w, 0)
    const idx = pool.findIndex((p) => (r -= p.w) < 0)
    out.push(pool.splice(idx < 0 ? pool.length - 1 : idx, 1)[0].i)
  }
  return out
}
