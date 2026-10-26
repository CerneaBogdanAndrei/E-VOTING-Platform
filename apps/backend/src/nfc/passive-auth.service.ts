import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { X509Certificate } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CONFIG, type AppConfig } from '../config.js'
import { verifyPassiveAuth, type PassiveAuthResult } from './passive-auth.js'

/** Încarcă certificatele CSCA (PEM sau DER) din directorul configurat. */
export async function loadTrustStore(dir: string): Promise<X509Certificate[]> {
  const certs: X509Certificate[] = []
  for (const file of await readdir(dir)) {
    if (!/\.(pem|crt|cer|der)$/i.test(file)) continue
    const data = await readFile(join(dir, file))
    const text = data.toString('latin1')
    const pems = text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)
    if (pems) for (const pem of pems) certs.push(new X509Certificate(pem))
    else certs.push(new X509Certificate(data))
  }
  return certs
}

@Injectable()
export class PassiveAuthService implements OnModuleInit {
  private readonly logger = new Logger('PassiveAuth')
  private trustStore: X509Certificate[] = []

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  async onModuleInit() {
    if (!this.config.cscaDir) {
      this.logger.warn('CSCA_DIR nu e setat: înregistrarea prin NFC va fi refuzată')
      return
    }
    try {
      this.trustStore = await loadTrustStore(this.config.cscaDir)
      this.logger.log(`${this.trustStore.length} certificate CSCA încărcate din ${this.config.cscaDir}`)
    } catch (err) {
      this.logger.warn(`Nu am putut citi ${this.config.cscaDir}: ${(err as Error).message}`)
    }
  }

  async verify(dg1: Uint8Array, sod: Uint8Array): Promise<PassiveAuthResult> {
    return verifyPassiveAuth(dg1, sod, this.trustStore)
  }
}
