import { NavLink, Outlet } from 'react-router'
import { apiMode } from '../api'

export function Layout() {
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
            <NavLink to="/comisie">Comisie</NavLink>
            <NavLink to="/despre">Cum funcționează</NavLink>
          </nav>
          <div className="mode" title={apiMode.kind === 'http' ? apiMode.url : 'Datele se pierd la reîncărcarea paginii'}>
            {apiMode.kind === 'mock' ? 'Backend simulat' : `API: ${apiMode.url}`}
            <span className="mode-sep">· ElGamal pe ristretto255</span>
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
