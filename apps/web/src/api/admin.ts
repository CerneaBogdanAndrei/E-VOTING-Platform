// Sesiunea comisiei: token-ul stă doar în sessionStorage (se pierde la închiderea tab-ului),
// iar identitatea (nume, rol) e pusă de AdminGate într-un context React.

import { createContext, useContext } from 'react'
import type { AdminIdentity } from '@evoting/api'

const KEY = 'evoting.adminToken'

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setAdminToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(KEY, token)
    else sessionStorage.removeItem(KEY)
  } catch {
    // stocare indisponibilă: token-ul rămâne doar pentru cererea curentă
  }
}

export function logoutAdmin() {
  setAdminToken(null)
  location.reload()
}

export const AdminContext = createContext<AdminIdentity | null>(null)

/** Cine e autentificat în panoul comisiei. Disponibil doar sub AdminGate. */
export function useAdmin(): AdminIdentity {
  const admin = useContext(AdminContext)
  if (!admin) throw new Error('useAdmin în afara AdminGate')
  return admin
}

/** Observatorii doar citesc; butoanele care schimbă ceva se afișează doar pentru rolul comisie. */
export const canEdit = (admin: AdminIdentity) => admin.role === 'comisie'
