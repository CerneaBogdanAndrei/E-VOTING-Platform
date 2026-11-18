// Panoul comisiei, pe backend-ul simulat (unde nu e nevoie de token): închiderea cu confirmare,
// token-urile trustees care nu se pierd, scoaterea din lista de eligibili și scrutinul „doar NFC”.

import { cleanup, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { generateCredential } from '@evoting/crypto'
import { ApiError, api, mockTools, prepareBallot, submitBallot, type Election } from '../src/api'
import { renderAt } from './render'

const HOUR = 3600_000

/** Un scrutin nou, cu cheile trustees simulate, eligibilii dați și votul deschis. */
async function openElection(title: string, cnps: string[]): Promise<Election> {
  const { election } = await api.createElection({
    title,
    opensAt: new Date(Date.now() - HOUR).toISOString(),
    closesAt: new Date(Date.now() + 24 * HOUR).toISOString(),
    candidates: [
      { name: 'Ana', description: '' },
      { name: 'Bogdan', description: '' },
    ],
    trustees: [{ name: 'T1' }],
  })
  await mockTools!.simulateTrusteeKeys(election.id)
  await api.importEligible(election.id, cnps.join('\n'))
  return api.openElection(election.id)
}

/** Completează formularul „Scrutin nou” cu un titlu și doi candidați. */
async function fillNewElection(user: ReturnType<typeof renderAt>['user'], title: string) {
  await user.type(await screen.findByPlaceholderText(/Reprezentanți studenți/), title)
  const [first, second] = screen.getAllByPlaceholderText('Nume')
  await user.type(first, 'Ana')
  await user.type(second, 'Bogdan')
}

describe('panoul comisiei', () => {
  it('„Închide votul” cere confirmare: „Nu” lasă votul deschis, „Da” îl închide', async () => {
    const e = await openElection('Închidere cu confirmare', ['5040312170018'])
    const { user } = renderAt(`/comisie/${e.id}`)
    await user.click(await screen.findByRole('button', { name: 'Închide votul' }))
    expect(screen.getByText(/Închiderea e definitivă/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Nu' }))
    expect((await api.getElection(e.id)).status).toBe('open')

    await user.click(screen.getByRole('button', { name: 'Închide votul' }))
    await user.click(screen.getByRole('button', { name: 'Da, închide votul acum' }))
    expect(await screen.findByText(/Votul este închis/)).toBeTruthy()
    expect((await api.getElection(e.id)).status).toBe('closed')
  })

  it('token-urile trustees rămân după „Modifică” și după reîncărcare, până la „Am transmis”', async () => {
    const { user } = renderAt('/comisie/nou')
    await fillNewElection(user, 'Token-uri păstrate')
    await user.click(screen.getByRole('button', { name: 'Creează scrutinul' }))
    expect(await screen.findByText('Token-urile trustees: singura copie')).toBeTruthy()
    expect(document.querySelectorAll('.card-warn .cmd')).toHaveLength(3)
    const id = (await api.listElections()).find((x) => x.title === 'Token-uri păstrate')!.id

    // „Modifică”, apoi „Renunță”: înainte, token-urile se pierdeau aici
    await user.click(screen.getByRole('link', { name: 'Modifică' }))
    await user.click(await screen.findByRole('link', { name: 'Renunță' }))
    expect(await screen.findByText('Token-urile trustees: singura copie')).toBeTruthy()

    // „reîncărcarea”: aplicația pornită din nou, la aceeași adresă, fără starea navigării
    cleanup()
    const again = renderAt(`/comisie/${id}`)
    expect(await screen.findByText('Token-urile trustees: singura copie')).toBeTruthy()
    expect(document.querySelector('.card-warn code')!.textContent).toContain('--encrypt')

    await again.user.click(screen.getByRole('button', { name: /Am transmis token-urile/ }))
    expect(screen.queryByText('Token-urile trustees: singura copie')).toBeNull()
    expect(sessionStorage.getItem(`evoting.trusteeTokens.${id}`)).toBeNull()
  })

  it('„Scoate” din lista de eligibili: confirmare, apoi scoși, păstrați (au votat), absenți, invalide', async () => {
    const e = await openElection('Scoatere din listă', ['5040312170018', '6050101400015', '1960101400011'])
    const voter = generateCredential()
    await api.registerOcr(e.id, { cnp: '5040312170018', credentialPubkey: voter.publicKey })
    await api.registerOcr(e.id, { cnp: '6050101400015', credentialPubkey: generateCredential().publicKey })
    await submitBallot(api, e, voter, prepareBallot(e, voter, 0))

    const { user } = renderAt(`/comisie/${e.id}`)
    await user.click(await screen.findByRole('button', { name: 'Scoate' }))
    await user.click(screen.getByLabelText('CNP-urile de scos'))
    await user.paste(['5040312170018', '6050101400015', '2900101400014', '123'].join('\n'))
    await user.click(screen.getByRole('button', { name: 'Scoate din listă' }))
    // prima apăsare doar cere confirmarea
    expect((await api.getElection(e.id)).stats.eligible).toBe(3)
    await user.click(screen.getByRole('button', { name: 'Da, scoate-i din listă' }))
    const outcome = await screen.findByText(/Scoși: 1/)
    expect(outcome.textContent).toContain('cu înregistrarea ștearsă: 1')
    expect(outcome.textContent).toContain('nu erau în listă: 1')
    expect(outcome.textContent).toContain('păstrați pentru că au votat deja: 1')
    expect(outcome.textContent).toContain('invalide: 1 (linia 4)')
    expect((await api.getElection(e.id)).stats).toEqual({ eligible: 2, registered: 1, ballots: 1 })
  })

  it('scrutin „doar NFC”: bifa din formular ajunge la scrutin, OCR-ul e refuzat, setarea e publică', async () => {
    const { user } = renderAt('/comisie/nou')
    await fillNewElection(user, 'Doar NFC')
    await user.click(screen.getByLabelText(/Doar cu cartea electronică/))
    await user.click(screen.getByRole('button', { name: 'Creează scrutinul' }))
    expect(await screen.findByText(/doar cu cartea electronică \(NFC\), scanarea optică e refuzată/)).toBeTruthy()
    const e = (await api.listElections()).find((x) => x.title === 'Doar NFC')!
    expect(e.requireNfc).toBe(true)

    await mockTools!.simulateTrusteeKeys(e.id)
    await api.importEligible(e.id, '5040312170018')
    const refused = await api.registerOcr(e.id, { cnp: '5040312170018', credentialPubkey: generateCredential().publicKey }).catch((err: unknown) => err)
    expect(refused).toBeInstanceOf(ApiError)
    expect((refused as ApiError).status).toBe(403)

    cleanup()
    const pub = renderAt(`/scrutin/${e.id}`)
    await pub.user.click(await screen.findByRole('tab', { name: 'Parametri publici' }))
    expect(screen.getByText(/Doar cu cartea electronică \(NFC\)/)).toBeTruthy()
  })
})
