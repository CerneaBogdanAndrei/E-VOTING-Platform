// Bulletin board-ul: registru append-only în care fiecare intrare conține
// hash-ul celei anterioare. Codul de urmărire primit de alegător e hash-ul
// intrării lui, deci depinde de tot istoricul de până la el.

import { ballotHash } from './ballot.js'
import { hashObject } from './hash.js'
import type { Ballot, BoardEntry } from './types.js'

export const GENESIS_HASH = '0'.repeat(64)

/** Prima intrare se leagă de un hash derivat din ID-ul scrutinului, nu de zero, ca board-urile să nu se poată amesteca. */
export const genesisHash = (electionId: string) => hashObject({ v: 1, kind: 'genesis', electionId, prev: GENESIS_HASH })

export interface EntryHashInput {
  electionId: string
  seq: number
  prevHash: string
  ballotHash: string
  receivedAt: string
}

export const computeEntryHash = (e: EntryHashInput) =>
  hashObject({ v: 1, electionId: e.electionId, seq: e.seq, prevHash: e.prevHash, ballotHash: e.ballotHash, receivedAt: e.receivedAt })

/** Construiește intrarea următoare pentru un buletin deja validat. */
export function appendEntry(electionId: string, previous: BoardEntry | undefined, ballot: Ballot, receivedAt: string): BoardEntry {
  const seq = (previous?.seq ?? 0) + 1
  const prevHash = previous?.hash ?? genesisHash(electionId)
  const bh = ballotHash(ballot)
  return {
    seq,
    hash: computeEntryHash({ electionId, seq, prevHash, ballotHash: bh, receivedAt }),
    prevHash,
    ballotHash: bh,
    credentialPubkey: ballot.credentialPubkey,
    ciphertexts: ballot.ciphertexts,
    proofs: ballot.proofs,
    signature: ballot.signature,
    receivedAt,
  }
}

export const entryToBallot = (electionId: string, e: BoardEntry): Ballot => ({
  electionId,
  credentialPubkey: e.credentialPubkey,
  ciphertexts: e.ciphertexts,
  proofs: e.proofs,
  signature: e.signature,
})

export const normalizeTrackingCode = (code: string) => code.toLowerCase().replace(/[^0-9a-f]/g, '')

export type EntryCheck = { ok: true } | { ok: false; reason: string }

/**
 * Verificarea făcută de alegător pe propriul buletin: intrarea găsită după cod
 * conține exact buletinul trimis de telefon, iar hash-ul ei e codul primit.
 */
export function checkOwnEntry(electionId: string, entry: BoardEntry, expected: { trackingCode: string; ballotHash?: string }): EntryCheck {
  const bh = ballotHash(entryToBallot(electionId, entry))
  if (bh !== entry.ballotHash) return { ok: false, reason: 'Conținutul buletinului de pe board nu corespunde hash-ului său' }
  if (expected.ballotHash && bh !== expected.ballotHash) return { ok: false, reason: 'Buletinul de pe board diferă de cel trimis de pe acest telefon' }
  const h = computeEntryHash({ electionId, seq: entry.seq, prevHash: entry.prevHash, ballotHash: bh, receivedAt: entry.receivedAt })
  if (h !== entry.hash || h !== normalizeTrackingCode(expected.trackingCode)) {
    return { ok: false, reason: 'Hash-ul intrării nu corespunde codului de urmărire' }
  }
  return { ok: true }
}
