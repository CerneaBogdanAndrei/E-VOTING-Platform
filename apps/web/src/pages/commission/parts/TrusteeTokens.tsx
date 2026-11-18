import { apiMode, type Election, type TrusteeToken } from '../../../api'
import { keygenCommand, tokensFile } from '../../../lib/trusteeTokens'

/**
 * Comenzile trustees, afișate după crearea scrutinului. Serverul păstrează doar hash-ul token-urilor, deci
 * pagina le ține în acest tab (și după reîncărcare) până când comisia confirmă că le-a transmis.
 */
export function TrusteeTokens({ election, tokens, onDone }: { election: Election; tokens: TrusteeToken[]; onDone: () => void }) {
  const base = apiMode.kind === 'http' ? apiMode.url : 'http://localhost:3000'

  const download = () => {
    const url = URL.createObjectURL(new Blob([tokensFile(base, election.id, election.title, tokens)], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${election.id}-tokenuri-trustees.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card card-warn">
      <h3>Token-urile trustees: singura copie</h3>
      <p className="hint">
        Serverul păstrează doar hash-ul lor și nu le mai poate arăta. Trimite fiecărui trustee comanda lui, pe un canal separat; același token îi trebuie și la
        decriptare. Trustee-ul își generează cheia local; cheia secretă nu ajunge niciodată pe server. Token-urile rămân afișate în acest tab, și după
        reîncărcare, până apeși „Am transmis token-urile”.
        {apiMode.kind === 'mock' && ' Cu backend-ul simulat, folosește „Simulează cheile trustees” de mai jos.'}
      </p>
      {tokens.map((t) => (
        <div key={t.trusteeId} className="cmd">
          <strong>{t.name}</strong>
          <code className="mono">{keygenCommand(base, election.id, t)}</code>
        </div>
      ))}
      <div className="row gap-s mt-s">
        <button type="button" className="btn" onClick={download}>
          Descarcă comenzile (.txt)
        </button>
        <button type="button" className="btn btn-primary" onClick={onDone}>
          Am transmis token-urile, ascunde-le
        </button>
      </div>
    </div>
  )
}
