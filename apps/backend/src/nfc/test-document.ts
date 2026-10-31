// Generator de documente de test pentru Passive Authentication: un CSCA fictiv,
// un certificat Document Signer emis de el și un „cip” (DG1 + SOD) pentru un CNP.
// Folosit în teste și în modul demo. Un document real e semnat de CSCA-ul
// României, pe care serverul îl primește prin CSCA_DIR.

import { createHash, webcrypto } from 'node:crypto'
import * as asn1js from 'asn1js'
import * as pkijs from 'pkijs'
import { buildTd1, checkCnp } from '@evoting/crypto'
import { HASH_OIDS, OID_LDS_SECURITY_OBJECT } from './passive-auth.js'

const subtle = webcrypto.subtle as unknown as SubtleCrypto
const ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const

export interface TestAuthority {
  csca: pkijs.Certificate
  cscaPem: string
  ds: pkijs.Certificate
  dsKey: CryptoKey
}

function name(cn: string): pkijs.RelativeDistinguishedNames {
  return new pkijs.RelativeDistinguishedNames({
    typesAndValues: [
      new pkijs.AttributeTypeAndValue({ type: '2.5.4.6', value: new asn1js.PrintableString({ value: 'RO' }) }),
      new pkijs.AttributeTypeAndValue({ type: '2.5.4.3', value: new asn1js.Utf8String({ value: cn }) }),
    ],
  })
}

async function makeCert(subject: string, issuer: string, publicKey: CryptoKey, signingKey: CryptoKey, serial: number, ca: boolean) {
  const cert = new pkijs.Certificate()
  cert.version = 2
  cert.serialNumber = new asn1js.Integer({ value: serial })
  cert.subject = name(subject)
  cert.issuer = name(issuer)
  cert.notBefore.value = new Date(Date.now() - 86_400_000)
  cert.notAfter.value = new Date(Date.now() + 5 * 365 * 86_400_000)
  cert.extensions = [
    new pkijs.Extension({
      extnID: '2.5.29.19',
      critical: true,
      extnValue: new pkijs.BasicConstraints({ cA: ca }).toSchema().toBER(false),
    }),
  ]
  await cert.subjectPublicKeyInfo.importKey(publicKey)
  await cert.sign(signingKey, 'SHA-256')
  return cert
}

const pem = (cert: pkijs.Certificate) =>
  `-----BEGIN CERTIFICATE-----\n${Buffer.from(cert.toSchema().toBER(false)).toString('base64').replace(/(.{64})/g, '$1\n')}\n-----END CERTIFICATE-----\n`

export async function createTestAuthority(label = 'CSCA de test (NU e al statului)'): Promise<TestAuthority> {
  const cscaKeys = (await subtle.generateKey(ALG, true, ['sign', 'verify'])) as CryptoKeyPair
  const dsKeys = (await subtle.generateKey(ALG, true, ['sign', 'verify'])) as CryptoKeyPair
  const csca = await makeCert(label, label, cscaKeys.publicKey, cscaKeys.privateKey, 1, true)
  const ds = await makeCert('Document Signer de test', label, dsKeys.publicKey, cscaKeys.privateKey, 2, false)
  return { csca, cscaPem: pem(csca), ds, dsKey: dsKeys.privateKey }
}

/** DG1 = 61 L { 5F1F L MRZ } */
export function encodeDg1(mrz: string): Uint8Array {
  const inner = new asn1js.Primitive({ idBlock: { tagClass: 2, tagNumber: 0x1f }, valueHex: new TextEncoder().encode(mrz).buffer as ArrayBuffer })
  const outer = new asn1js.Constructed({ idBlock: { tagClass: 2, tagNumber: 1 }, value: [inner] })
  return new Uint8Array(outer.toBER(false))
}

/** Creează DG1 și SOD pentru un CNP, semnate de autoritatea dată. Opțional, DG1 se modifică după semnare (atac). */
export async function createTestDocument(authority: TestAuthority, cnp: string, opts: { tamperAfterSigning?: boolean } = {}) {
  const check = checkCnp(cnp)
  if (!check.ok) throw new Error('CNP invalid pentru documentul de test')
  const mrz = buildTd1({
    documentNumber: `RX${cnp.slice(-6)}`,
    birthDate: cnp.slice(1, 7),
    sex: check.sex,
    expiryDate: '351231',
    surname: 'TEST',
    givenNames: 'ALEGATOR',
    cnp,
  }).join('')
  const dg1 = encodeDg1(mrz)
  const dg1Hash = createHash('sha256').update(dg1).digest()

  const lds = new asn1js.Sequence({
    value: [
      new asn1js.Integer({ value: 0 }),
      new asn1js.Sequence({ value: [new asn1js.ObjectIdentifier({ value: HASH_OIDS.sha256 })] }),
      new asn1js.Sequence({
        value: [new asn1js.Sequence({ value: [new asn1js.Integer({ value: 1 }), new asn1js.OctetString({ valueHex: dg1Hash.buffer.slice(dg1Hash.byteOffset, dg1Hash.byteOffset + dg1Hash.byteLength) as ArrayBuffer })] })],
      }),
    ],
  })
  const signedData = new pkijs.SignedData({
    version: 3,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({
      eContentType: OID_LDS_SECURITY_OBJECT,
      eContent: new asn1js.OctetString({ valueHex: lds.toBER(false) }),
    }),
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({ issuer: authority.ds.issuer, serialNumber: authority.ds.serialNumber }),
      }),
    ],
    certificates: [authority.ds],
  })
  await signedData.sign(authority.dsKey, 0, 'SHA-256')
  const contentInfo = new pkijs.ContentInfo({ contentType: pkijs.ContentInfo.SIGNED_DATA, content: signedData.toSchema(true) })
  const sod = new asn1js.Constructed({ idBlock: { tagClass: 2, tagNumber: 23 }, value: [contentInfo.toSchema()] })

  let dg1Out = dg1
  if (opts.tamperAfterSigning) {
    // Atacatorul înlocuiește CNP-ul din MRZ cu altul, dar nu poate re-semna SOD-ul.
    const other = cnp.slice(0, 12) === '500000000000' ? cnp : cnp.replace(/\d{3}(\d)$/, (_m, c) => `${'123'}${c}`)
    dg1Out = encodeDg1(mrz.replace(cnp, other))
  }
  return {
    dg1: Buffer.from(dg1Out).toString('base64'),
    sod: Buffer.from(sod.toBER(false)).toString('base64'),
    mrz,
  }
}
