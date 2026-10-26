// Generează PKI-ul de test: node dist/src/nfc/test-pki-cli.js [director]
// Apoi pornește serverul cu CSCA_DIR=<director>/csca ca să accepte cipurile de test.

import { resolve } from 'node:path'
import { createTestPki, saveTestPki } from './test-pki.js'

const dir = resolve(process.argv[2] ?? 'pki')
await saveTestPki(await createTestPki(), dir)
console.log(`PKI de test creat în ${dir}`)
console.log(`  CSCA: ${dir}/csca/test-csca.pem  →  CSCA_DIR=${dir}/csca`)
console.log(`  DSC (cheie privată, doar pentru simulator): ${dir}/test-dsc.json`)
