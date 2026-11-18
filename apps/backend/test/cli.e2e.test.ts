// CLI-urile reale (tools/trustee, tools/verifier) rulate ca procese separate contra
// serverului de test: keygen, decrypt (cu verificarea board-ului) și verificarea publică.

import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { prepareBallot, submitBallot } from '@evoting/api'
import { generateCredential } from '@evoting/crypto'
import { databaseAvailable, electionInput, resetDatabase, startServer, type TestServer } from './helpers.js'

const run = promisify(execFile)
const root = fileURLToPath(new URL('../../../../', import.meta.url))
const TRUSTEE = join(root, 'tools/trustee/dist/cli.js')
const VERIFIER = join(root, 'tools/verifier/dist/cli.js')

const available = (await databaseAvailable()) && existsSync(TRUSTEE) && existsSync(VERIFIER)
if (!existsSync(TRUSTEE)) console.log('# CLI-urile nu sunt construite (npm run build -w @evoting/trustee -w @evoting/verifier): testele CLI sunt sărite')

/** Rulează un CLI; întoarce stdout și codul de ieșire (fără să arunce la cod ≠ 0). */
async function cli(script: string, args: string[], cwd: string, env: Record<string, string> = {}) {
  try {
    const { stdout } = await run(process.execPath, [script, ...args], { cwd, env: { ...process.env, ...env } })
    return { code: 0, stdout }
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string }
    return { code: e.code ?? 1, stdout: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

describe('backend: CLI-urile trustee și verificator contra serverului real', { skip: !available }, () => {
  let s: TestServer
  let dir: string
  before(async () => {
    await resetDatabase()
    s = await startServer()
    dir = await mkdtemp(join(tmpdir(), 'evoting-cli-'))
  })
  after(async () => {
    await s?.close()
  })

  it('keygen → vot → decrypt → verify, cu fișierele de cheie pe disc', { timeout: 120_000 }, async () => {
    const { election, trusteeTokens } = await s.api.createElection(electionInput())
    const api = ['--api', s.url, '--election', election.id]

    // primul trustee își criptează fișierul de cheie cu o parolă, al doilea nu
    const PASSWORD = 'parola-trustee-1'
    for (const [i, t] of trusteeTokens.entries()) {
      const extra = i === 0 ? ['--password', PASSWORD] : []
      const r = await cli(TRUSTEE, ['keygen', ...api, '--trustee', t.trusteeId, '--token', t.token, ...extra], dir)
      assert.equal(r.code, 0, r.stdout)
      const file = JSON.parse(await readFile(join(dir, `${t.trusteeId}.trustee-key.json`), 'utf8'))
      assert.equal(file.trusteeId, t.trusteeId)
      if (i === 0) {
        assert.equal(file.secretKey, undefined)
        assert.equal(file.encrypted.cipher, 'aes-256-gcm')
      } else assert.ok(file.secretKey)
      // a doua rulare nu suprascrie cheia
      assert.notEqual((await cli(TRUSTEE, ['keygen', ...api, '--trustee', t.trusteeId, '--token', t.token], dir)).code, 0)
    }
    const status = await cli(TRUSTEE, ['status', ...api], dir)
    assert.equal(status.code, 0)
    assert.match(status.stdout, /cheie ✓/)

    await s.api.importEligible(election.id, '5040312170018\n6050101400015')
    const opened = await s.api.openElection(election.id)
    for (const [i, cnp] of ['5040312170018', '6050101400015'].entries()) {
      const v = generateCredential()
      await s.api.registerOcr(election.id, { cnp, credentialPubkey: v.publicKey })
      await submitBallot(s.api, opened, v, prepareBallot(opened, v, i))
    }

    // decriptarea refuză înainte de închidere
    const early = await cli(TRUSTEE, ['decrypt', '--key', `${trusteeTokens[0].trusteeId}.trustee-key.json`, '--token', trusteeTokens[0].token], dir)
    assert.notEqual(early.code, 0)
    await s.api.closeElection(election.id)
    // fișierul criptat: fără parolă sau cu parolă greșită, decriptarea nu pornește
    const noPass = await cli(TRUSTEE, ['decrypt', '--key', `${trusteeTokens[0].trusteeId}.trustee-key.json`, '--token', trusteeTokens[0].token], dir)
    assert.notEqual(noPass.code, 0)
    assert.match(noPass.stdout, /criptat/)
    const wrongPass = await cli(TRUSTEE, ['decrypt', '--key', `${trusteeTokens[0].trusteeId}.trustee-key.json`, '--token', trusteeTokens[0].token], dir, {
      TRUSTEE_KEY_PASSWORD: 'gresit',
    })
    assert.notEqual(wrongPass.code, 0)
    for (const [i, t] of trusteeTokens.entries()) {
      const r = await cli(
        TRUSTEE,
        ['decrypt', '--key', `${t.trusteeId}.trustee-key.json`, '--token', t.token],
        dir,
        i === 0 ? { TRUSTEE_KEY_PASSWORD: PASSWORD } : {},
      )
      assert.equal(r.code, 0, r.stdout)
    }
    assert.equal((await s.api.getElection(election.id)).status, 'tallied')

    const verify = await cli(VERIFIER, [...api, '--save', 'arhiva.json'], dir)
    assert.equal(verify.code, 0, verify.stdout)
    assert.match(verify.stdout, /REZULTATUL ESTE VERIFICAT/)
    const offline = await cli(VERIFIER, ['--bundle', 'arhiva.json', '--json'], dir)
    assert.equal(offline.code, 0)
    const report = JSON.parse(offline.stdout)
    assert.equal(report.ok, true)
    assert.equal(report.ballots, 2)
    assert.equal(report.threads, 1)
    // aceeași verificare pe două fire (worker_threads): același raport
    const parallel = await cli(VERIFIER, ['--bundle', 'arhiva.json', '--json', '--workers', '2'], dir)
    assert.equal(parallel.code, 0, parallel.stdout)
    const parallelReport = JSON.parse(parallel.stdout)
    assert.equal(parallelReport.threads, 2)
    assert.deepEqual(parallelReport.steps, report.steps)
    assert.notEqual((await cli(VERIFIER, ['--bundle', 'arhiva.json', '--workers', 'zero'], dir)).code, 0)
    // un fișier de audit Benaloh incomplet: codul 2 („nu se poate verifica”), nu 1 („aplicația a trișat”)
    await writeFile(join(dir, 'audit-incomplet.json'), JSON.stringify({ electionId: election.id, secrets: { choice: 0 } }))
    const audit = await cli(VERIFIER, ['audit-ballot', ...api, '--file', 'audit-incomplet.json'], dir)
    assert.equal(audit.code, 2, audit.stdout)
    assert.match(audit.stdout, /Datele de audit sunt incomplete/)
    // hash publicat independent greșit → codul 1
    const bad = await cli(VERIFIER, [...api, '--head', `1:${'0'.repeat(64)}`], dir)
    assert.equal(bad.code, 1)
  })
})
