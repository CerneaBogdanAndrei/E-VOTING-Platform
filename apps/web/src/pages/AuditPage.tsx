import { useState } from 'react'
import { verifyAudit, type AuditResult, type BenalohAudit } from '@evoting/crypto'

/**
 * Verificatorul independent al provocării Benaloh. Aplicația mobilă afișează
 * auditul unui buletin (opțiunile și valorile aleatoare r); aici, pe alt
 * dispozitiv, oricine recalculează criptotextele și vede dacă aplicația a
 * criptat ce a spus.
 */
export function AuditPage() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<AuditResult & { audit: BenalohAudit }>()
  const [error, setError] = useState<string>()

  const check = () => {
    setError(undefined)
    setResult(undefined)
    try {
      const audit = JSON.parse(text) as BenalohAudit
      setResult({ ...verifyAudit(audit), audit })
    } catch {
      setError('Textul nu e un audit valid (JSON copiat din aplicație).')
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Verifică un buletin auditat</h1>
          <p className="lead">
            Provocarea Benaloh: înainte de vot, aplicația îți poate arăta cum a criptat buletinul. Lipește aici auditul, pe un alt dispozitiv decât
            telefonul, ca să confirmi că aplicația a criptat exact opțiunea aleasă.
          </p>
        </div>
      </div>
      <div className="card">
        <textarea className="input mono" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder='{"electionId": "...", "ciphertexts": [...], "plaintexts": [...], "randomness": [...]}' spellCheck={false} />
        <div className="row gap-s mt-s">
          <button type="button" className="btn btn-primary" onClick={check} disabled={!text.trim()}>
            Verifică
          </button>
        </div>
        {error && <div role="alert" className="alert alert-bad mt-s">{error}</div>}
        {result && (
          <div role="alert" className={`alert mt-s ${result.ok ? 'alert-ok' : 'alert-bad'}`}>
            {result.ok ? (
              <span>
                Criptarea corespunde. Buletinul auditat conținea: <strong>{result.selected.length ? result.selected.join(', ') : 'nicio opțiune (vot alb)'}</strong>. Un
                buletin auditat nu se mai trimite: aplicația îl recriptează cu valori noi.
              </span>
            ) : (
              <span>
                <strong>Aplicația NU a criptat ce a declarat.</strong> {result.problems.join('; ')}. Nu folosi această aplicație și anunță comisia.
              </span>
            )}
          </div>
        )}
      </div>
      <p className="hint mt">
        Auditul dezvăluie opțiunea, deci buletinul auditat nu mai e secret și se aruncă. Pentru că aplicația nu știe dinainte dacă vei cere auditul,
        o aplicație care ar cripta altceva ar fi prinsă cu probabilitate mare.
      </p>
    </>
  )
}
