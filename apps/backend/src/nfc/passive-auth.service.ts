import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import type * as pkijs from 'pkijs'
import { CONFIG, type AppConfig } from '../config.js'
import { loadCertificate, passiveAuthenticate, PassiveAuthError, type VerifiedDocument } from './passive-auth.js'
import { createTestAuthority, createTestDocument, type TestAuthority } from './test-document.js'

@Injectable()
export class PassiveAuthService implements OnModuleInit {
  private readonly log = new Logger('PassiveAuth')
  private trusted: pkijs.Certificate[] = []
  /** Doar în modul demo: o autoritate fictivă, ca citirea NFC să poată fi simulată cap-coadă. */
  private demoAuthority: TestAuthority | null = null

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  async onModuleInit() {
    if (this.config.cscaDir) {
      for (const file of readdirSync(this.config.cscaDir)) {
        if (!/\.(pem|crt|cer|der)$/i.test(file)) continue
        try {
          this.trusted.push(loadCertificate(readFileSync(join(this.config.cscaDir, file))))
        } catch (err) {
          this.log.warn(`Certificatul ${file} nu a putut fi încărcat: ${(err as Error).message}`)
        }
      }
      this.log.log(`${this.trusted.length} certificate CSCA încărcate din ${this.config.cscaDir}`)
    }
    if (this.config.demoMode) {
      this.demoAuthority = await createTestAuthority()
      this.trusted.push(this.demoAuthority.csca)
      this.log.warn('Modul demo: serverul are încredere și într-un CSCA de test generat la pornire.')
    }
  }

  get enabled() {
    return this.trusted.length > 0
  }

  /** Adaugă un CSCA de încredere (folosit de teste). */
  trust(cert: pkijs.Certificate) {
    this.trusted.push(cert)
  }

  async verify(dg1Base64: string, sodBase64: string): Promise<VerifiedDocument> {
    if (!this.enabled) throw new ForbiddenException('Înregistrarea prin NFC nu e configurată pe server (lipsesc certificatele CSCA)')
    const dg1 = Buffer.from(dg1Base64, 'base64')
    const sod = Buffer.from(sodBase64, 'base64')
    if (!dg1.length || !sod.length) throw new BadRequestException('DG1 și SOD sunt obligatorii (base64)')
    try {
      return await passiveAuthenticate(dg1, sod, this.trusted)
    } catch (err) {
      if (err instanceof PassiveAuthError) throw new BadRequestException(`Passive Authentication a eșuat: ${err.message}`)
      throw new BadRequestException(`Passive Authentication a eșuat: SOD în format greșit`)
    }
  }

  /** Doar în modul demo: „cipul” unui buletin de test pentru un CNP. */
  async demoDocument(cnp: string) {
    if (!this.demoAuthority) return null
    return createTestDocument(this.demoAuthority, cnp)
  }
}
