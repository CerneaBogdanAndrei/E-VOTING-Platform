// Paginile publice, pe backend-ul simulat: lista scrutinelor, căutarea pe board, auditul Benaloh,
// verificatorul public și procesul-verbal.

import { cleanup, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { encryptBallot, generateCredential } from '@evoting/crypto'
import { api, electionParams } from '../src/api'
import { demoElection, renderAt } from './render'

describe('pagina de start', () => {
  it('arată scrutinele de demonstrație, cu starea fiecăruia', async () => {
    renderAt('/')
    expect(await screen.findByText('Vot deschis')).toBeTruthy()
    expect(screen.getByText('În configurare')).toBeTruthy()
    expect(screen.getByText('Rezultat publicat')).toBeTruthy()
  })
})

describe('board-ul public', () => {
  it('după o căutare reușită, editarea câmpului NU produce o alarmă falsă de „conținut modificat”', async () => {
    const e = await demoElection('tallied')
    const code = (await api.getBoardPage(e.id, 1, 1)).entries[0].hash
    const { user } = renderAt(`/scrutin/${e.id}`)
    const input = await screen.findByPlaceholderText('Cod de urmărire (64 de caractere hex)')
    await user.type(input, code)
    await user.click(screen.getByRole('button', { name: 'Caută' }))
    const ok = await screen.findByText(/Hash-ul recalculat în browser corespunde codului/)
    expect(ok.className).toContain('alert-ok')
    // bug-ul reparat: o tastă în plus schimba mesajul verde într-o acuzație de manipulare
    await user.type(input, '{Backspace}{Backspace}')
    expect(screen.queryByText(/conținutul a fost modificat/)).toBeNull()
    expect(screen.getByText(/Hash-ul recalculat în browser corespunde codului/)).toBeTruthy()
  })

  it('un cod inexistent e raportat ca negăsit', async () => {
    const e = await demoElection('tallied')
    const { user } = renderAt(`/scrutin/${e.id}`)
    await user.type(await screen.findByPlaceholderText('Cod de urmărire (64 de caractere hex)'), 'ab'.repeat(32))
    await user.click(screen.getByRole('button', { name: 'Caută' }))
    expect(await screen.findByText('Niciun buletin cu acest cod de urmărire')).toBeTruthy()
  })
})

describe('auditul Benaloh', () => {
  /** Lipește textul în câmp (fără să-l tasteze caracter cu caracter) și apasă butonul. */
  async function check(electionId: string, text: string) {
    const { user } = renderAt(`/scrutin/${electionId}`)
    await user.click(await screen.findByRole('tab', { name: 'Audit buletin' }))
    const area = screen.getByPlaceholderText(/electionId/)
    await user.click(area)
    await user.paste(text)
    await user.click(screen.getByRole('button', { name: 'Verifică buletinul auditat' }))
    return screen.findByRole('alert')
  }

  it('date corecte → verde; opțiune declarată greșit → roșu; date incomplete sau JSON greșit → galben, fără acuzație', async () => {
    const e = await demoElection('open')
    const cred = generateCredential()
    const { ballot, secrets } = encryptBallot(electionParams(e), 1, cred.secretKey, cred.publicKey)
    const data = { electionId: e.id, ciphertexts: ballot.ciphertexts, secrets }

    const good = await check(e.id, JSON.stringify(data))
    expect(good.className).toContain('alert-ok')
    expect(good.textContent).toContain('Aplicația a criptat corect')

    cleanup()
    const lie = await check(e.id, JSON.stringify({ ...data, secrets: { ...secrets, choice: 0 } }))
    expect(lie.className).toContain('alert-bad')
    expect(lie.textContent).toContain('NU a criptat')

    for (const text of [JSON.stringify({ electionId: e.id, secrets: { choice: 0 } }), '{"ciphertexts": [']) {
      cleanup()
      const partial = await check(e.id, text)
      expect(partial.className).toContain('alert-warn')
      expect(partial.textContent).not.toContain('NU a criptat')
    }
  })
})

describe('verificatorul public', () => {
  it('pe scrutinul numărat, toți cei șase pași trec (pe un fir: jsdom nu are Web Workers)', async () => {
    const e = await demoElection('tallied')
    const { user } = renderAt(`/scrutin/${e.id}`)
    await user.click(await screen.findByRole('tab', { name: 'Verificare publică' }))
    await user.click(screen.getByRole('button', { name: 'Verifică tot' }))
    const alert = await screen.findByText(/Toate verificările trec/)
    expect(alert.textContent).toContain('pe un fir')
    expect(document.querySelectorAll('.report-ok')).toHaveLength(6)
  })

  it('un hash publicat independent greșit face verificarea să pice exact la lanț', async () => {
    const e = await demoElection('tallied')
    const { user } = renderAt(`/scrutin/${e.id}`)
    await user.click(await screen.findByRole('tab', { name: 'Verificare publică' }))
    await user.type(screen.getByPlaceholderText(/SEQ:HASH/), `1:${'0'.repeat(64)}`)
    await user.click(screen.getByRole('button', { name: 'Verifică tot' }))
    expect(await screen.findByText(/Verificarea a picat/)).toBeTruthy()
    const failed = document.querySelector('.report-fail')!
    expect(within(failed as HTMLElement).getByText(/istoria a fost rescrisă/)).toBeTruthy()
  })
})

describe('procesul-verbal', () => {
  it('conține participarea, rezultatul și hash-ul board-ului; verificarea se poate rula din pagină', async () => {
    const e = await demoElection('tallied')
    const head = await api.getBoardHead(e.id)
    const result = await api.getResult(e.id)
    const { user } = renderAt(`/scrutin/${e.id}/proces-verbal`)
    expect(await screen.findByText('Proces-verbal al scrutinului electronic')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(e.title)
    expect(screen.getByText(`${head.seq}:${head.hash}`)).toBeTruthy()
    expect(screen.getByText(String(result.totalBallots), { selector: 'th' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Rulează verificarea publică' }))
    expect(await screen.findByText(/Toate verificările trec \(6 pași trecuți din 6/)).toBeTruthy()
  })
})
