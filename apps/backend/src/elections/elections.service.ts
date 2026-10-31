// Ciclul de viață al scrutinului: configurare → vot → numărare → rezultat.

import { randomBytes } from 'node:crypto'
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import {
  checkCnp,
  cnpFingerprint,
  combinePublicKeys,
  computeAggregate,
  constantTimeEqual,
  GENESIS_HASH,
  sha256Hex,
  verifyTrusteeKey,
  type ElectionParams,
} from '@evoting/crypto'
import type { CreateElectionInput, Election, EligibleImportResult, TrusteeInvite, TrusteeKeySubmission } from '@evoting/api'
import { CONFIG, type AppConfig } from '../config.js'
import { AuditService } from '../common/audit.service.js'
import { nowIso } from '../common/time.js'
import { STORAGE, type CandidateRow, type ElectionRow, type Storage, type TrusteeRow } from '../storage/storage.js'

@Injectable()
export class ElectionsService {
  constructor(
    @Inject(STORAGE) private readonly storage: Storage,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async row(id: string): Promise<ElectionRow> {
    const e = await this.storage.elections.findById(id)
    if (!e) throw new NotFoundException('Scrutinul nu există')
    return e
  }

  /** Vederea publică a scrutinului, cu statistici. */
  async get(id: string): Promise<Election> {
    return this.view(await this.row(id))
  }

  async list(): Promise<Election[]> {
    return Promise.all((await this.storage.elections.list()).map((e) => this.view(e)))
  }

  private async view(e: ElectionRow): Promise<Election> {
    const [candidates, trustees, eligible, regs, ballots, last, partials] = await Promise.all([
      this.storage.elections.candidates(e.id),
      this.storage.trustees.listByElection(e.id),
      this.storage.eligibleVoters.count(e.id),
      this.storage.registrations.count(e.id),
      this.storage.ballots.count(e.id),
      this.storage.ballots.last(e.id),
      this.storage.partialDecryptions.list(e.id),
    ])
    const submitted = new Set(partials.map((p) => p.trusteeId))
    return {
      id: e.id,
      title: e.title,
      status: e.status,
      opensAt: e.opensAt,
      closesAt: e.closesAt,
      minSelections: e.minSelections,
      maxSelections: e.maxSelections,
      publicKey: e.publicKey,
      candidates: candidates.map(({ id, name, description, position }) => ({ id, name, description, position })),
      trustees: trustees.map((t) => ({
        id: t.id,
        name: t.name,
        publicKeyShare: t.publicKeyShare,
        keyProof: t.keyProof,
        partialDecryptionSubmitted: submitted.has(t.id),
      })),
      stats: { eligible, registered: regs.total, registeredNfc: regs.nfc, ballots },
      boardHead: { seq: last?.seq ?? 0, hash: last?.hash ?? GENESIS_HASH },
      createdAt: e.createdAt,
    }
  }

  /** Parametrii criptografici (doar după ce toate cheile au fost primite). */
  async params(id: string): Promise<ElectionParams> {
    const e = await this.row(id)
    if (!e.publicKey) throw new ConflictException('Scrutinul nu are încă cheia publică: lipsesc cheile trustees')
    const [candidates, trustees] = await Promise.all([this.storage.elections.candidates(id), this.storage.trustees.listByElection(id)])
    return {
      electionId: e.id,
      candidates: candidates.map((c) => c.name),
      minSelections: e.minSelections,
      maxSelections: e.maxSelections,
      publicKey: e.publicKey,
      trustees: trustees.map((t) => ({ id: t.id, name: t.name, publicKeyShare: t.publicKeyShare!, proof: t.keyProof! })),
    }
  }

  async create(input: CreateElectionInput): Promise<Election> {
    if (!(new Date(input.closesAt) > new Date(input.opensAt))) throw new BadRequestException('Închiderea trebuie să fie după deschidere')
    const n = input.candidates.length
    const maxSelections = input.maxSelections ?? 1
    const minSelections = input.minSelections ?? Math.min(1, maxSelections)
    if (maxSelections > n) throw new BadRequestException(`Se pot bifa cel mult ${n} opțiuni (câți candidați există)`)
    if (minSelections > maxSelections) throw new BadRequestException('Numărul minim de opțiuni depășește maximul')

    const id = `${slug(input.title)}-${randomBytes(2).toString('hex')}`
    const row: ElectionRow = {
      id,
      title: input.title.trim(),
      status: 'draft',
      opensAt: new Date(input.opensAt).toISOString(),
      closesAt: new Date(input.closesAt).toISOString(),
      minSelections,
      maxSelections,
      publicKey: null,
      aggregate: null,
      tallyBallotCount: null,
      createdAt: nowIso(),
    }
    const candidates: CandidateRow[] = input.candidates.map((c, i) => ({
      id: `${id}-c${i + 1}`,
      electionId: id,
      name: c.name.trim(),
      description: c.description.trim(),
      position: i,
    }))
    const trustees: TrusteeRow[] = input.trustees.map((t, i) => ({
      id: `t${i + 1}`,
      electionId: id,
      name: t.name.trim(),
      publicKeyShare: null,
      keyProof: null,
      inviteCodeHash: null,
    }))
    await this.storage.elections.insert(row, candidates, trustees)
    await this.audit.log(id, 'comisie', 'scrutin creat', { title: row.title, candidates: candidates.map((c) => c.name), trustees: trustees.map((t) => t.name), minSelections, maxSelections })
    return this.get(id)
  }

  /**
   * Importă lista eligibililor (CSV cu un CNP pe linie, prima coloană). Serverul
   * calculează HMAC-ul fiecărui CNP și păstrează doar amprenta; valorile în clar
   * nu se scriu nicăieri (nici în jurnal).
   */
  async importEligible(id: string, csv: string): Promise<EligibleImportResult> {
    return this.storage.exclusive(`election:${id}`, async () => {
      const e = await this.row(id)
      if (e.status !== 'draft') throw new ConflictException('Lista se poate importa doar înainte de deschiderea votului')
      const invalid: { line: number; value: string }[] = []
      const hmacs: string[] = []
      for (const [i, raw] of String(csv ?? '').split(/\r?\n/).entries()) {
        const value = raw.split(/[,;\t]/)[0].trim().replace(/^"|"$/g, '')
        if (!value || (i === 0 && /^cnp$/i.test(value))) continue
        if (!checkCnp(value).ok) {
          // Linia invalidă se raportează mascat, ca răspunsul să nu ecouiască CNP-uri.
          invalid.push({ line: i + 1, value: value.length > 4 ? value.slice(0, 2) + '…' + value.slice(-2) : value })
          continue
        }
        hmacs.push(cnpFingerprint(this.config.cnpHmacKey, value))
      }
      const { inserted, duplicates } = await this.storage.eligibleVoters.addMany(id, hmacs)
      await this.audit.log(id, 'comisie', 'listă eligibili importată', { imported: inserted, duplicates, invalid: invalid.length })
      return { imported: inserted, duplicates, invalid }
    })
  }

  /** Generează (sau regenerează) codul de acces al unui trustee pentru CLI. Se stochează doar hash-ul. */
  async trusteeInvite(id: string, trusteeId: string): Promise<TrusteeInvite> {
    await this.row(id)
    const t = await this.storage.trustees.findById(id, trusteeId)
    if (!t) throw new NotFoundException('Trustee necunoscut')
    const code = randomBytes(16).toString('hex')
    await this.storage.trustees.update(id, trusteeId, { inviteCodeHash: sha256Hex(code) })
    await this.audit.log(id, 'comisie', 'cod de acces trustee generat', { trustee: t.name })
    return { trusteeId, code }
  }

  /** Autentifică un trustee după codul de acces din antetul X-Trustee-Code. */
  async requireTrustee(id: string, trusteeId: string, code: string | undefined): Promise<TrusteeRow> {
    const t = await this.storage.trustees.findById(id, trusteeId)
    if (!t) throw new NotFoundException('Trustee necunoscut')
    if (!code || !t.inviteCodeHash || !constantTimeEqual(sha256Hex(code), t.inviteCodeHash)) {
      throw new ForbiddenException('Cod de acces trustee invalid (îl generează comisia din panou)')
    }
    return t
  }

  /** Trustee-ul își trimite Yᵢ cu dovada că știe xᵢ. Când toate cheile sunt primite, se publică Y. */
  async submitTrusteeKey(id: string, code: string | undefined, input: TrusteeKeySubmission): Promise<Election> {
    return this.storage.exclusive(`election:${id}`, async () => {
      const e = await this.row(id)
      const t = await this.requireTrustee(id, input.trusteeId, code)
      if (e.status !== 'draft') throw new ConflictException('Cheile se trimit doar în etapa de configurare')
      if (t.publicKeyShare) throw new ConflictException('Trustee-ul și-a trimis deja cheia')
      if (!verifyTrusteeKey(id, t.id, input.publicKeyShare, input.proof)) {
        throw new BadRequestException('Dovada că trustee-ul își cunoaște cheia nu se verifică')
      }
      await this.storage.trustees.update(id, t.id, { publicKeyShare: input.publicKeyShare, keyProof: input.proof })
      await this.audit.log(id, `trustee ${t.name}`, 'cheie publică trimisă', { trustee: t.id, publicKeyShare: input.publicKeyShare })
      await this.updatePublicKey(id)
      return this.get(id)
    })
  }

  /** Y = ΣYᵢ, calculat doar când toți trustees au trimis cheia. */
  async updatePublicKey(id: string) {
    const trustees = await this.storage.trustees.listByElection(id)
    if (trustees.every((t) => t.publicKeyShare)) {
      const publicKey = combinePublicKeys(trustees.map((t) => t.publicKeyShare!))
      await this.storage.elections.update(id, { publicKey })
      await this.audit.log(id, 'server', 'cheia scrutinului publicată', { publicKey })
    }
  }

  async open(id: string): Promise<Election> {
    return this.storage.exclusive(`election:${id}`, async () => {
      const e = await this.row(id)
      if (e.status !== 'draft') throw new ConflictException('Scrutinul nu este în configurare')
      const missing = (await this.storage.trustees.listByElection(id)).filter((t) => !t.publicKeyShare)
      if (missing.length) throw new ConflictException(`Lipsesc cheile de la: ${missing.map((t) => t.name).join(', ')}`)
      if ((await this.storage.eligibleVoters.count(id)) === 0) throw new ConflictException('Lista alegătorilor eligibili este goală')
      await this.storage.elections.update(id, { status: 'open' })
      await this.audit.log(id, 'comisie', 'vot deschis', {})
      return this.get(id)
    })
  }

  /**
   * Închide votul și calculează agregatul homomorf, publicat pentru trustees.
   * Se rulează sub același lacăt ca adăugarea buletinelor (vezi BallotsService),
   * deci niciun buletin nu intră după calculul agregatului.
   */
  async close(id: string): Promise<Election> {
    return this.storage.exclusive(`election:${id}`, async () => {
      const e = await this.row(id)
      if (e.status !== 'open') throw new ConflictException('Scrutinul nu este deschis')
      const candidates = await this.storage.elections.candidates(id)
      const board = await this.storage.ballots.list(id)
      const aggregate = computeAggregate(candidates.length, board.map((b) => b.ballot))
      const last = board.at(-1)
      await this.storage.elections.update(id, { status: 'closed', aggregate, tallyBallotCount: board.length })
      await this.audit.log(id, 'comisie', 'vot închis', { ballots: board.length, boardHead: last?.hash ?? GENESIS_HASH })
      return this.get(id)
    })
  }
}

function slug(title: string): string {
  const s = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return s || 'scrutin'
}
