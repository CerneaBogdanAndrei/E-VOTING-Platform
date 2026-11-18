import { apiMode, type Election, type TrusteeToken } from '../../../api'

/** Comenzile trustees, afișate o singură dată după crearea scrutinului. Serverul păstrează doar hash-ul token-urilor. */
export function TrusteeTokens({ election, tokens }: { election: Election; tokens: TrusteeToken[] }) {
  const base = apiMode.kind === 'http' ? apiMode.url : 'http://localhost:3000'
  return (
    <div className="card card-warn">
      <h3>Token-urile trustees: afișate o singură dată</h3>
      <p className="hint">
        Serverul păstrează doar hash-ul lor. Trimite fiecărui trustee comanda lui, pe un canal separat. Trustee-ul își generează cheia local; cheia secretă nu
        ajunge niciodată pe server.
        {apiMode.kind === 'mock' && ' Cu backend-ul simulat, folosește „Simulează cheile trustees” de mai jos.'}
      </p>
      {tokens.map((t) => (
        <div key={t.trusteeId} className="cmd">
          <strong>{t.name}</strong>
          <code className="mono">
            npx evoting-trustee keygen --api {base} --election {election.id} --trustee {t.trusteeId} --token {t.token}
          </code>
        </div>
      ))}
    </div>
  )
}
