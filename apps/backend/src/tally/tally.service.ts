// Numărarea: trustees trimit decriptări parțiale (verificate), serverul le combină
// și publică rezultatul cu toate dovezile.

import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { combineDecryptions, verifyPartialDecryption, type ElectionRecord, type PartialDecryption } from '@evoting/crypto'
import type { ElectionResult, TallyState } from '@evoting/api'
import { AuditService } from '../common/audit.service.js'
import { nowIso } from '../common/time.js'
import { ElectionsService } from '../elections/elections.service.js'
import { STORAGE, UniqueViolation, type Storage } from '../storage/storage.js'

@Injectable()
export class TallyService {
  constructor(
    @Inject(STORAGE) private readonly storage: Storage,
    @Inject(ElectionsService) private readonly elections: ElectionsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async state(electionId: string): Promise<TallyState> {
    const e = await this.elections.row(electionId)
    const partials = await this.storage.partialDecryptions.list(electionId)
    return {
      status: e.status,
      aggregate: e.aggregate,
      ballotCount: e.tallyBallotCount ?? (await this.storage.ballots.count(electionId)),
      submitted: partials.map((p) => p.trusteeId),
    }
  }

  async submitPartial(electionId: string, code: string | undefined, partial: PartialDecryption): Promise<TallyState> {
    await this.storage.exclusive(`election:${electionId}`, async () => {
      const e = await this.elections.row(electionId)
      const t = await this.elections.requireTrustee(electionId, partial.trusteeId, code)
      if (e.status !== 'closed' || !e.aggregate) throw new ConflictException('Decriptarea parțială se trimite după închiderea votului')
      const params = await this.elections.params(electionId)
      const problems = verifyPartialDecryption(electionId, { id: t.id, name: t.name, publicKeyShare: t.publicKeyShare! }, e.aggregate, partial, params.candidates)
      if (problems.length) throw new BadRequestException(`Decriptare parțială respinsă: ${problems.join('; ')}`)
      const clean: PartialDecryption = { trusteeId: t.id, shares: partial.shares.map(({ d, proof }) => ({ d, proof: { c: proof.c, z: proof.z } })) }
      try {
        await this.storage.partialDecryptions.insert({ electionId, trusteeId: t.id, partial: clean, submittedAt: nowIso() })
      } catch (err) {
        if (err instanceof UniqueViolation) throw new ConflictException('Trustee-ul și-a trimis deja decriptarea parțială')
        throw err
      }
      await this.audit.log(electionId, `trustee ${t.name}`, 'decriptare parțială trimisă', { trustee: t.id })
      await this.maybePublish(electionId)
    })
    return this.state(electionId)
  }

  /** Când toți trustees au trimis, se combină decriptările și se află totalurile prin baby-step giant-step. */
  private async maybePublish(electionId: string) {
    const e = await this.elections.row(electionId)
    const trustees = await this.storage.trustees.listByElection(electionId)
    const partials = await this.storage.partialDecryptions.list(electionId)
    if (partials.length < trustees.length || !e.aggregate) return
    const ordered = trustees.map((t) => partials.find((p) => p.trusteeId === t.id)!.partial)
    const ballots = e.tallyBallotCount ?? 0
    const counts = combineDecryptions(e.aggregate, ordered, ballots * e.maxSelections)
    if (counts.some((c) => c === null)) {
      // Nu ar trebui să se întâmple: toate decriptările au fost verificate.
      await this.audit.log(electionId, 'server', 'eroare la combinarea decriptărilor', {})
      throw new ConflictException('Totalurile nu au putut fi aflate din decriptările parțiale')
    }
    const publishedAt = nowIso()
    await this.storage.results.insert({ electionId, counts: counts as number[], publishedAt })
    await this.storage.elections.update(electionId, { status: 'tallied' })
    await this.audit.log(electionId, 'server', 'rezultat publicat', { counts })
  }

  async result(electionId: string): Promise<ElectionResult> {
    await this.elections.row(electionId)
    const r = await this.storage.results.find(electionId)
    if (!r) throw new NotFoundException('Rezultatul nu a fost publicat încă')
    const [candidates, eligible, e] = await Promise.all([
      this.storage.elections.candidates(electionId),
      this.storage.eligibleVoters.count(electionId),
      this.elections.row(electionId),
    ])
    const totalBallots = e.tallyBallotCount ?? 0
    const quorum = Math.floor(eligible / 3) + 1
    return {
      electionId,
      counts: candidates.map((c) => ({ candidateId: c.id, votes: r.counts[c.position] })),
      totalBallots,
      eligible,
      quorum,
      quorumReached: totalBallots >= quorum,
      publishedAt: r.publishedAt,
    }
  }

  /** Tot ce e public despre scrutin, în formatul citit de verificator. */
  async record(electionId: string): Promise<ElectionRecord> {
    const e = await this.elections.row(electionId)
    const params = await this.elections.params(electionId)
    const [registrations, board, partials, result] = await Promise.all([
      this.storage.registrations.credentials(electionId),
      this.storage.ballots.list(electionId),
      this.storage.partialDecryptions.list(electionId),
      this.storage.results.find(electionId),
    ])
    return {
      version: 1,
      title: e.title,
      status: e.status,
      params,
      registrations,
      board,
      tally:
        result && e.aggregate
          ? { ballotCount: e.tallyBallotCount ?? board.length, aggregate: e.aggregate, partials: partials.map((p) => p.partial), counts: result.counts }
          : null,
    }
  }
}
