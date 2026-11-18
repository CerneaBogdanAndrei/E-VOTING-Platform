// Ajutoare pentru teste: aplicația întreagă la o adresă dată (cu rutele reale) și scrutinele
// backend-ului simulat, căutate după stare.

import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import App from '../src/App'
import { api, type Election, type ElectionStatus } from '../src/api'

/** Pornește site-ul la `path`, ca și cum utilizatorul l-ar fi deschis în browser. */
export function renderAt(path: string, state?: unknown) {
  const user = userEvent.setup()
  const view = render(
    <MemoryRouter initialEntries={[state === undefined ? path : { pathname: path, state }]}>
      <App />
    </MemoryRouter>,
  )
  return { user, ...view }
}

/** Primul scrutin de demonstrație în starea cerută (unul deschis, unul în configurare, unul numărat). */
export async function demoElection(status: ElectionStatus): Promise<Election> {
  const found = (await api.listElections()).find((e) => e.status === status)
  if (!found) throw new Error(`niciun scrutin de demonstrație în starea ${status}`)
  return found
}
