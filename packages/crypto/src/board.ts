// Bulletin board-ul: registru append-only, înlănțuit prin hash-uri.
// Fiecare intrare conține hash-ul celei anterioare, deci modificarea, ștergerea
// sau reordonarea unei intrări schimbă toate hash-urile de după ea.

import { ballotHash, type Ballot } from './ballot.js'
import { hashParts } from './hash.js'

export const GENESIS_HASH = '0'.repeat(64)

export interface BoardEntry {
  /** Poziția pe board, de la 1. */
  seq: number
  prevHash: string
  /** Hash-ul intrării (leagă seq, prevHash, codul de urmărire și momentul primirii). */
  hash: string
  /** Codul de urmărire = hash-ul buletinului; alegătorul îl primește în aplicație. */
  trackingCode: string
  receivedAt: string
  ballot: Ballot
}

export function entryHash(electionId: string, e: Pick<BoardEntry, 'seq' | 'prevHash' | 'trackingCode' | 'receivedAt'>): string {
  return hashParts('evoting/v1/entry', electionId, e.seq, e.prevHash, e.trackingCode, e.receivedAt)
}

/** Construiește următoarea intrare (folosit de server la adăugare). */
export function makeEntry(electionId: string, prev: Pick<BoardEntry, 'seq' | 'hash'> | null, ballot: Ballot, receivedAt: string): BoardEntry {
  const seq = (prev?.seq ?? 0) + 1
  const prevHash = prev?.hash ?? GENESIS_HASH
  const trackingCode = ballotHash(ballot)
  return { seq, prevHash, trackingCode, receivedAt, ballot, hash: entryHash(electionId, { seq, prevHash, trackingCode, receivedAt }) }
}

export interface ChainCheck {
  ok: boolean
  problems: string[]
  /** Hash-ul ultimei intrări (capul lanțului), de comparat cu cel publicat independent. */
  head: string
}

export function verifyChain(electionId: string, entries: BoardEntry[]): ChainCheck {
  const problems: string[] = []
  let prev = GENESIS_HASH
  entries.forEach((e, i) => {
    const where = `Buletinul #${e.seq}`
    if (e.seq !== i + 1) problems.push(`${where}: poziția nu corespunde ordinii din lanț (se aștepta #${i + 1})`)
    if (e.prevHash !== prev) problems.push(`${where}: legătura cu intrarea anterioară e ruptă (hash anterior greșit)`)
    let code: string | null = null
    try {
      code = ballotHash(e.ballot)
    } catch {
      code = null
    }
    if (code !== e.trackingCode) {
      problems.push(`${where}: conținutul a fost modificat; hash-ul recalculat (${code ? code.slice(0, 12) + '…' : 'imposibil'}) ≠ codul de urmărire (${String(e.trackingCode).slice(0, 12)}…)`)
    }
    if (entryHash(electionId, e) !== e.hash) problems.push(`${where}: hash-ul intrării nu corespunde datelor ei`)
    prev = e.hash
  })
  return { ok: problems.length === 0, problems, head: prev }
}
