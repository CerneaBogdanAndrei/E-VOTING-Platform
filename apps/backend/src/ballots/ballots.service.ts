// Primirea buletinelor și bulletin board-ul public.

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { makeEntry, verifyBallot, type Ballot, type BoardEntry } from '@evoting/crypto'
import type { BallotReceipt, BoardHead } from '@evoting/api'
import { AuthService } from '../auth/auth.service.js'
import { nowIso } from '../common/time.js'
import { ElectionsService } from '../elections/elections.service.js'
import { STORAGE, UniqueViolation, type Storage } from '../storage/storage.js'

@Injectable()
export class BallotsService {
  constructor(
    @Inject(STORAGE) private readonly storage: Storage,
    @Inject(ElectionsService) private readonly elections: ElectionsService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  /**
   * Verificările din plan (pasul 6 al votului): scrutinul e deschis, credentialul e
   * înregistrat și n-a mai votat, semnătura și dovezile sunt valide. Abia apoi
   * buletinul intră pe board.
   */
  async cast(electionId: string, token: string | undefined, ballot: Ballot): Promise<BallotReceipt> {
    if (ballot.electionId !== electionId) throw new BadRequestException('Buletinul aparține altui scrutin')
    this.auth.requireVoter(token, electionId, ballot.credentialPubkey)
    // Dovezile se verifică în afara lacătului (sunt partea scumpă), apoi starea se reverifică sub lacăt.
    const params = await this.elections.params(electionId)
    const check = verifyBallot(params, ballot)
    if (!check.ok) throw new BadRequestException(`Buletin respins: ${check.problems.join('; ')}`)

    const entry = await this.storage.exclusive(`election:${electionId}`, async () => {
      const e = await this.elections.row(electionId)
      if (e.status !== 'open') throw new ConflictException('Scrutinul nu este deschis')
      if (!(await this.storage.registrations.findByCredential(electionId, ballot.credentialPubkey))) {
        throw new ForbiddenException('Credential neînregistrat la acest scrutin')
      }
      if (await this.storage.ballots.hasCredential(electionId, ballot.credentialPubkey)) throw new ConflictException('Acest credential a votat deja')
      const clean: Ballot = {
        electionId: ballot.electionId,
        credentialPubkey: ballot.credentialPubkey,
        ciphertexts: ballot.ciphertexts.map(({ a, b }) => ({ a, b })),
        proofs: {
          selections: ballot.proofs.selections.map(({ c, z }) => ({ c, z })),
          count: { c: ballot.proofs.count.c, z: ballot.proofs.count.z },
        },
        signature: ballot.signature,
      }
      try {
        return await this.storage.ballots.append(electionId, (last) => makeEntry(electionId, last, clean, nowIso()))
      } catch (err) {
        if (err instanceof UniqueViolation) throw new ConflictException('Acest credential a votat deja')
        throw err
      }
    })
    if (token) this.auth.endVoterSession(token)
    return { seq: entry.seq, trackingCode: entry.trackingCode, entryHash: entry.hash, receivedAt: entry.receivedAt }
  }

  async board(electionId: string): Promise<BoardEntry[]> {
    await this.elections.row(electionId)
    return this.storage.ballots.list(electionId)
  }

  async head(electionId: string): Promise<BoardHead> {
    const e = await this.elections.get(electionId)
    return e.boardHead
  }

  async find(electionId: string, code: string): Promise<BoardEntry> {
    await this.elections.row(electionId)
    const needle = code.trim().toLowerCase()
    if (!/^[0-9a-f]{64}$/.test(needle)) throw new BadRequestException('Codul de urmărire are 64 de caractere hex')
    const entry = await this.storage.ballots.findByCode(electionId, needle)
    if (!entry) throw new NotFoundException('Niciun buletin cu acest cod de urmărire')
    return entry
  }
}
