import { Link, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { RequireAdmin } from './components/RequireAdmin'
import { AuditPage } from './pages/AuditPage'
import { Commission } from './pages/Commission'
import { CommissionElection } from './pages/CommissionElection'
import { CommissionNew } from './pages/CommissionNew'
import { ElectionPublic } from './pages/ElectionPublic'
import { Home } from './pages/Home'
import { Report } from './pages/Report'

export default function App() {
  return (
    <Routes>
      <Route path="scrutin/:id/proces-verbal" element={<Report />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="scrutin/:id" element={<ElectionPublic />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="comisie" element={<RequireAdmin><Commission /></RequireAdmin>} />
        <Route path="comisie/nou" element={<RequireAdmin><CommissionNew /></RequireAdmin>} />
        <Route path="comisie/:id" element={<RequireAdmin><CommissionElection /></RequireAdmin>} />
        <Route
          path="*"
          element={
            <div className="state">
              Pagina nu există. <Link to="/">Înapoi la scrutine</Link>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
