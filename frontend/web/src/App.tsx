import { Link, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
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
        <Route path="comisie" element={<Commission />} />
        <Route path="comisie/nou" element={<CommissionNew />} />
        <Route path="comisie/:id" element={<CommissionElection />} />
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
