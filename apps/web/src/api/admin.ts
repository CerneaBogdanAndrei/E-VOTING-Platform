// Token-ul comisiei, ținut doar în sessionStorage (se pierde la închiderea tab-ului).

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
