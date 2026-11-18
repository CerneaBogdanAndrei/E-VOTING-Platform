// Primirea buletinului: sesiunea alegătorului, intervalul scrutinului, verificarea semnăturii
// și a dovezilor, apoi adăugarea pe bulletin board, serializată prin blocarea rândului scrutinului.

import { ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { BallotReceipt } from '@evoting/api'
import { appendEntry, verifyBallot, type Ballot, type BoardEntry } from '@evoting/crypto'
import { verifySession } from '../common/security.js'
import { bad, obj } from '../common/validate.js'
import { CONFIG, type AppConfig } from '../config.js'
import { Database, isUniqueViolation } from '../db/database.service.js'
import { ElectionsRepository } from '../elections/elections.repository.js'

/** Votul se primește doar în intervalul scrutinului, capetele incluse. */
function checkInterval(at: Date, opensAt: Date, closesAt: Date) {
  if (at < opensAt) throw new ConflictException('Votul nu a început încă')
  if (at > closesAt) throw new ConflictException('Votul s-a încheiat')
}

/**
 * Ora intrării noi: ceasul serverului, dar niciodată mai devreme decât intrarea anterioară.
 * Cu mai multe instanțe, ceasurile lor pot diferi cu câteva milisecunde; ordinea de pe board
 * rămâne cea care contează, iar orele rămân crescătoare.
 */
export function boardTime(now: Date, previous: Pick<BoardEntry, 'receivedAt'> | undefined): Date {
  const last = previous ? Date.parse(previous.receivedAt) : NaN
  return Number.isNaN(last) || now.getTime() >= last ? now : new Date(last)
}

@Injectable()
export class BallotsService {
  constructor(
    private readonly db: Database,
    private readonly elections: ElectionsRepository,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async cast(electionId: string, sessionToken: string | null, body: unknown): Promise<BallotReceipt> {
    const session = sessionToken ? verifySession(this.config.sessionSecret, sessionToken) : null
    if (!session) throw new UnauthorizedException('Sesiune lipsă sau expirată; autentifică-te din nou')
    // buletinul se reconstruiește doar din câmpurile cunoscute; forma lor o verifică verifyBallot
    const raw = obj(body, 'buletinul')
    const ballot: Ballot = {
      electionId: raw.electionId as string,
      credentialPubkey: raw.credentialPubkey as string,
      ciphertexts: raw.ciphertexts as Ballot['ciphertexts'],
      proofs: raw.proofs as Ballot['proofs'],
      signature: raw.signature as string,
    }
    if (session.electionId !== electionId || ballot.electionId !== electionId) throw new ForbiddenException('Sesiunea sau buletinul aparțin altui scrutin')
    if (session.credentialPubkey !== ballot.credentialPubkey) throw new ForbiddenException('Sesiunea aparține altui credential')

    // dovezile se verifică înainte de tranzacție: durează câteva zeci de ms și nu țin board-ul blocat
    const params = await this.elections.params(electionId)
    if (params.status !== 'open') throw new ConflictException('Scrutinul nu este deschis')
    checkInterval(new Date(), params.opensAt, params.closesAt)
    const check = verifyBallot(params, ballot)
    if (!check.ok) throw bad(`Buletin respins: ${check.reason}`)

    try {
      const entry = await this.db.transaction(async (client) => {
        const e = await this.elections.lock(client, electionId)
        if (e.status !== 'open') throw new ConflictException('Scrutinul nu este deschis')
        const reg = await client.query('SELECT 1 FROM registrations WHERE election_id = $1 AND credential_pubkey = $2', [electionId, ballot.credentialPubkey])
        if (!reg.rowCount) throw new ForbiddenException('Credential neînregistrat la acest scrutin')
        const voted = await client.query('SELECT 1 FROM ballots WHERE election_id = $1 AND credential_pubkey = $2', [electionId, ballot.credentialPubkey])
        if (voted.rowCount) throw new ConflictException('Acest credential a votat deja')
        const previous = await this.elections.lastEntry(client, electionId)
        // Ora se ia abia acum, cu rândul scrutinului blocat: intrările primesc ore în ordinea lor
        // de pe board, cum cere verificatorul. Luată înainte de blocare, două voturi simultane
        // ar putea intra în ordine inversă orelor lor.
        const receivedAt = boardTime(new Date(), previous)
        checkInterval(receivedAt, e.opens_at, e.closes_at)
        const next = appendEntry(electionId, previous, ballot, receivedAt.toISOString())
        await client.query(
          `INSERT INTO ballots (election_id, seq, credential_pubkey, ciphertexts, proofs, signature, ballot_hash, prev_hash, hash, received_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            electionId,
            next.seq,
            next.credentialPubkey,
            JSON.stringify(next.ciphertexts),
            JSON.stringify(next.proofs),
            next.signature,
            next.ballotHash,
            next.prevHash,
            next.hash,
            next.receivedAt,
          ],
        )
        return next
      })
      return { seq: entry.seq, trackingCode: entry.hash, ballotHash: entry.ballotHash, receivedAt: entry.receivedAt }
    } catch (err) {
      // cursa a două voturi simultane cu același credential: constrângerea UNIQUE o oprește pe a doua
      if (isUniqueViolation(err, 'ballots_election_id_credential_pubkey_key')) throw new ConflictException('Acest credential a votat deja')
      throw err
    }
  }
}
