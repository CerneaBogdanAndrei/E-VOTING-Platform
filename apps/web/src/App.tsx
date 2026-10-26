import { Link, Route, Routes } from 'react-router'
import { AdminGate } from './components/AdminGate'
import { Layout } from './components/Layout'
import { About } from './pages/About'
import { Commission } from './pages/Commission'
import { CommissionElection } from './pages/CommissionElection'
import { CommissionNew } from './pages/CommissionNew'
import { ElectionPublic } from './pages/ElectionPublic'
import { Home } from './pages/Home'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="scrutin/:id" element={<ElectionPublic />} />
        <Route path="comisie" element={<AdminGate><Commission /></AdminGate>} />
        <Route path="comisie/nou" element={<AdminGate><CommissionNew /></AdminGate>} />
        <Route path="comisie/:id" element={<AdminGate><CommissionElection /></AdminGate>} />
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
