import { NavLink, Outlet } from 'react-router'
import { apiUrl, serverInfo, type ServerInfo } from '../api'
import { useAsync } from '../lib/useAsync'

export function Layout() {
  const info = useAsync<ServerInfo>(() => serverInfo(), [])
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <span className="brand-mark" aria-hidden>
              <svg viewBox="0 0 32 32" width="22" height="22">
                <rect width="32" height="32" rx="8" fill="currentColor" />
                <path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Vot verificabil
          </NavLink>
          <nav className="nav">
            <NavLink to="/" end>
              Scrutine
            </NavLink>
            <NavLink to="/audit">Verifică un buletin</NavLink>
            <NavLink to="/comisie">Comisie</NavLink>
          </nav>
          <div className="mode" title={apiUrl}>
            {info.error ? <span className="mode-bad">backend indisponibil</span> : info.data ? `API: ${apiUrl}` : 'se conectează…'}
            {info.data?.demoMode && <span className="mode-sep">· mod demo</span>}
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
