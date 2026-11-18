import { useState } from 'react'
import { auditBallot, type BallotSecrets, type Ciphertext } from '@evoting/crypto'
import type { Election } from '../../../api'
import { candidateLabel } from '../../../lib/format'

/** Provocarea Benaloh: datele de audit exportate din aplicație se verifică independent în browser. */
export function BenalohTab({ election }: { election: Election }) {
  const [text, setText] = useState('')
  const [outcome, setOutcome] = useState<{ kind: 'ok' | 'bad' | 'warn'; text: string }>()

  const check = () => {
    if (!election.publicKey) return setOutcome({ kind: 'warn', text: 'Scrutinul nu are încă o cheie publică.' })
    let data: { electionId?: string; ciphertexts?: unknown; secrets?: unknown }
    try {
      data = JSON.parse(text)
    } catch {
      return setOutcome({ kind: 'warn', text: 'Textul lipit nu e JSON valid. Copiază din nou datele de audit exportate din aplicație, complet.' })
    }
    if (data?.electionId && data.electionId !== election.id) return setOutcome({ kind: 'warn', text: 'Datele de audit aparțin altui scrutin.' })
    const r = auditBallot(
      { electionId: election.id, publicKey: election.publicKey, candidateCount: election.candidates.length },
      data?.ciphertexts as Ciphertext[],
      data?.secrets as BallotSecrets,
    )
    if (r.ok) {
      const c = election.candidates.find((x) => x.position === r.choice)
      setOutcome({ kind: 'ok', text: `Buletinul criptează exact opțiunea declarată: ${c ? candidateLabel(c) : r.choice}. Aplicația a criptat corect.` })
    } else if (r.malformed) {
      // fișier greșit sau tăiat: nu se poate verifica, dar nu e o dovadă împotriva aplicației
      setOutcome({ kind: 'warn', text: `${r.reason}. Verifică dacă ai copiat tot textul exportat de aplicație pentru acest scrutin.` })
    } else setOutcome({ kind: 'bad', text: `${r.reason}. Aplicația NU a criptat opțiunea aleasă: raportează comisiei.` })
  }

  return (
    <section className="section">
      <p className="hint">
        Provocarea Benaloh: înainte de trimitere, aplicația poate dezvălui numerele aleatoare r ale unui buletin. Lipește aici datele de audit exportate din
        aplicație; browserul recriptează opțiunea declarată și compară. Un buletin auditat nu se mai trimite: aplicația îl recriptează cu r noi, deci secretul
        votului rămâne.
      </p>
      <textarea
        className="input mono"
        rows={8}
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        placeholder='{"electionId": "...", "ciphertexts": [...], "secrets": {"choice": 1, "randomness": [...]}}'
        spellCheck={false}
      />
      <div className="row gap-s mt-s">
        <button type="button" className="btn btn-primary" onClick={check} disabled={!text.trim()}>
          Verifică buletinul auditat
        </button>
      </div>
      {outcome && (
        <div role="alert" className={`alert mt-s alert-${outcome.kind}`}>
          {outcome.text}
        </div>
      )}
    </section>
  )
}
