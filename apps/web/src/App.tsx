import { Link, Route, Routes } from 'react-router'
import { AdminGate } from './components/layout/AdminGate'
import { Layout } from './components/layout/Layout'
import { About } from './pages/About'
import { CommissionEdit } from './pages/commission/CommissionEdit'
import { CommissionElection } from './pages/commission/CommissionElection'
import { CommissionList } from './pages/commission/CommissionList'
import { CommissionMembers } from './pages/commission/CommissionMembers'
import { CommissionNew } from './pages/commission/CommissionNew'
import { ElectionPublic } from './pages/election/ElectionPublic'
import { ProcesVerbal } from './pages/election/ProcesVerbal'
import { Home } from './pages/Home'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="scrutin/:id" element={<ElectionPublic />} />
        <Route path="scrutin/:id/proces-verbal" element={<ProcesVerbal />} />
        <Route
          path="comisie"
          element={
            <AdminGate>
              <CommissionList />
            </AdminGate>
          }
        />
        <Route
          path="comisie/nou"
          element={
            <AdminGate>
              <CommissionNew />
            </AdminGate>
          }
        />
        <Route
          path="comisie/membri"
          element={
            <AdminGate>
              <CommissionMembers />
            </AdminGate>
          }
        />
        <Route
          path="comisie/:id"
          element={
            <AdminGate>
              <CommissionElection />
            </AdminGate>
          }
        />
        <Route
          path="comisie/:id/editare"
          element={
            <AdminGate>
              <CommissionEdit />
            </AdminGate>
          }
        />
        <Route path="despre" element={<About />} />
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
