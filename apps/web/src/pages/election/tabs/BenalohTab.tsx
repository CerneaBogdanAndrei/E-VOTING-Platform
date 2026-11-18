import { useState } from 'react'
import { auditBallot } from '@evoting/crypto'
import type { Election } from '../../../api'
import { candidateLabel } from '../../../lib/format'

/** Provocarea Benaloh: datele de audit exportate din aplicație se verifică independent în browser. */
export function BenalohTab({ election }: { election: Election }) {
  const [text, setText] = useState('')
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string }>()

  const check = () => {
    try {
      if (!election.publicKey) throw new Error('Scrutinul nu are încă o cheie publică')
      const data = JSON.parse(text)
      if (data.electionId && data.electionId !== election.id) throw new Error('Fișierul de audit aparține altui scrutin')
      const r = auditBallot(
        { electionId: election.id, publicKey: election.publicKey, candidateCount: election.candidates.length },
        data.ciphertexts,
        data.secrets,
      )
      if (r.ok) {
        const c = election.candidates.find((x) => x.position === r.choice)
        setOutcome({ ok: true, text: `Buletinul criptează exact opțiunea declarată: ${c ? candidateLabel(c) : r.choice}. Aplicația a criptat corect.` })
      } else setOutcome({ ok: false, text: `${r.reason}. Aplicația NU a criptat opțiunea aleasă: raportează comisiei.` })
    } catch (err) {
      setOutcome({ ok: false, text: err instanceof Error ? err.message : String(err) })
    }
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
        <div role="alert" className={`alert mt-s ${outcome.ok ? 'alert-ok' : 'alert-bad'}`}>
          {outcome.text}
        </div>
      )}
    </section>
  )
}
