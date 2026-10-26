// PKI de test pentru NFC: un CSCA „de laborator”, un Document Signer emis de el
// și cipuri simulate (DG1 + SOD semnat). Serverul are încredere în acest CSCA doar
// dacă certificatul lui e pus explicit în CSCA_DIR. Nu are nicio legătură cu
// certificatele reale ale statului și nu poate produce documente acceptate în altă parte.

import type { webcrypto as nodeWebcrypto } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as asn1js from 'asn1js'
import * as pkijs from 'pkijs'
import { bytesToBase64, dg1FromMrz } from '@evoting/api'

const webcrypto = globalThis.crypto
pkijs.setEngine('node', new pkijs.CryptoEngine({ name: 'node', crypto: webcrypto }))

type CryptoKey = nodeWebcrypto.CryptoKey

const EC = { name: 'ECDSA', namedCurve: 'P-256' } as const

export interface TestPki {
  cscaCertPem: string
  dscCertDer: Uint8Array
  dscPrivateKey: CryptoKey
}

/** Nume X.500 cu câte un RDN pe atribut (C, O, CN), ca la certificatele reale. */
function name(cn: string) {
  const rdn = (type: string, value: asn1js.BaseBlock) =>
    new asn1js.Set({ value: [new pkijs.AttributeTypeAndValue({ type, value: value as asn1js.PrintableString }).toSchema()] })
  const seq = new asn1js.Sequence({
    value: [
      rdn('2.5.4.6', new asn1js.PrintableString({ value: 'RO' })),
      rdn('2.5.4.10', new asn1js.Utf8String({ value: 'Laborator e-vot (TEST)' })),
      rdn('2.5.4.3', new asn1js.Utf8String({ value: cn })),
    ],
  })
  return new pkijs.RelativeDistinguishedNames({ schema: asn1js.fromBER(seq.toBER()).result })
}

async function makeCert(opts: { subject: string; issuer: string; publicKey: CryptoKey; signingKey: CryptoKey; serial: number; ca: boolean; days: number }) {
  const cert = new pkijs.Certificate()
  cert.version = 2
  cert.serialNumber = new asn1js.Integer({ value: opts.serial })
  cert.subject = name(opts.subject)
  cert.issuer = name(opts.issuer)
  cert.notBefore.value = new Date(Date.now() - 24 * 3600_000)
  cert.notAfter.value = new Date(Date.now() + opts.days * 24 * 3600_000)
  if (opts.ca) {
    const bc = new pkijs.BasicConstraints({ cA: true, pathLenConstraint: 0 })
    cert.extensions = [new pkijs.Extension({ extnID: '2.5.29.19', critical: true, extnValue: bc.toSchema().toBER(false), parsedValue: bc })]
  }
  await cert.subjectPublicKeyInfo.importKey(opts.publicKey)
  await cert.sign(opts.signingKey, 'SHA-256')
  return cert
}

const toPem = (der: ArrayBuffer, label: string) =>
  `-----BEGIN ${label}-----\n${Buffer.from(der).toString('base64').match(/.{1,64}/g)!.join('\n')}\n-----END ${label}-----\n`

export async function createTestPki(): Promise<TestPki> {
  const csca = await webcrypto.subtle.generateKey(EC, true, ['sign', 'verify'])
  const dsc = await webcrypto.subtle.generateKey(EC, true, ['sign', 'verify'])
  const cscaCert = await makeCert({ subject: 'CSCA TEST', issuer: 'CSCA TEST', publicKey: csca.publicKey, signingKey: csca.privateKey, serial: 1, ca: true, days: 3650 })
  const dscCert = await makeCert({ subject: 'Document Signer TEST', issuer: 'CSCA TEST', publicKey: dsc.publicKey, signingKey: csca.privateKey, serial: 2, ca: false, days: 1095 })
  return {
    cscaCertPem: toPem(cscaCert.toSchema().toBER(), 'CERTIFICATE'),
    dscCertDer: new Uint8Array(dscCert.toSchema().toBER()),
    dscPrivateKey: dsc.privateKey,
  }
}

/** Scrie certificatul CSCA în `<dir>/csca/` (de pus în CSCA_DIR) și cheia DSC în `<dir>/test-dsc.json`. */
export async function saveTestPki(pki: TestPki, dir: string) {
  await mkdir(join(dir, 'csca'), { recursive: true })
  await writeFile(join(dir, 'csca', 'test-csca.pem'), pki.cscaCertPem)
  const pkcs8 = await webcrypto.subtle.exportKey('pkcs8', pki.dscPrivateKey)
  await writeFile(
    join(dir, 'test-dsc.json'),
    JSON.stringify({ cscaCertPem: pki.cscaCertPem, dscCertDer: Buffer.from(pki.dscCertDer).toString('base64'), dscPrivateKeyPkcs8: Buffer.from(pkcs8).toString('base64') }, null, 2),
    { mode: 0o600 },
  )
}

export async function loadTestPki(dir: string): Promise<TestPki> {
  const data = JSON.parse(await readFile(join(dir, 'test-dsc.json'), 'utf8'))
  return {
    cscaCertPem: data.cscaCertPem,
    dscCertDer: new Uint8Array(Buffer.from(data.dscCertDer, 'base64')),
    dscPrivateKey: await webcrypto.subtle.importKey('pkcs8', Buffer.from(data.dscPrivateKeyPkcs8, 'base64'), EC, false, ['sign']),
  }
}

function wrapSod(contentInfo: ArrayBuffer): Uint8Array {
  const body = new Uint8Array(contentInfo)
  const n = body.length
  const len = n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : [0x82, n >> 8, n & 0xff]
  return new Uint8Array([0x77, ...len, ...body])
}

/** SOD semnat de DSC-ul de test pentru grupurile de date date (număr → conținut). */
export async function issueSod(pki: TestPki, dataGroups: Record<number, Uint8Array>): Promise<Uint8Array> {
  const groups: asn1js.Sequence[] = []
  for (const [num, content] of Object.entries(dataGroups)) {
    const hash = await webcrypto.subtle.digest('SHA-256', content as Uint8Array<ArrayBuffer>)
    groups.push(new asn1js.Sequence({ value: [new asn1js.Integer({ value: Number(num) }), new asn1js.OctetString({ valueHex: hash })] }))
  }
  const lds = new asn1js.Sequence({
    value: [
      new asn1js.Integer({ value: 0 }),
      new asn1js.Sequence({ value: [new asn1js.ObjectIdentifier({ value: '2.16.840.1.101.3.4.2.1' })] }),
      new asn1js.Sequence({ value: groups }),
    ],
  })
  const content = lds.toBER()
  const parsed = asn1js.fromBER(pki.dscCertDer.slice().buffer)
  const dsc = new pkijs.Certificate({ schema: parsed.result })
  const signedData = new pkijs.SignedData({
    version: 3,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: '2.23.136.1.1.1', eContent: new asn1js.OctetString({ valueHex: content }) }),
    signerInfos: [new pkijs.SignerInfo({ version: 1, sid: new pkijs.IssuerAndSerialNumber({ issuer: dsc.issuer, serialNumber: dsc.serialNumber }) })],
    certificates: [dsc],
  })
  const digest = await webcrypto.subtle.digest('SHA-256', content)
  signedData.signerInfos[0].signedAttrs = new pkijs.SignedAndUnsignedAttributes({
    type: 0,
    attributes: [
      new pkijs.Attribute({ type: '1.2.840.113549.1.9.3', values: [new asn1js.ObjectIdentifier({ value: '2.23.136.1.1.1' })] }),
      new pkijs.Attribute({ type: '1.2.840.113549.1.9.4', values: [new asn1js.OctetString({ valueHex: digest })] }),
    ],
  })
  await signedData.sign(pki.dscPrivateKey, 0, 'SHA-256')
  const ci = new pkijs.ContentInfo({ contentType: '1.2.840.113549.1.7.2', content: signedData.toSchema(true) })
  return wrapSod(ci.toSchema().toBER())
}

/** Un cip CEI simulat: DG1 cu MRZ-ul dat și SOD-ul semnat, ambele în base64, ca în cererea aplicației. */
export async function createTestChip(pki: TestPki, mrz: string): Promise<{ dg1: string; sod: string }> {
  const dg1 = dg1FromMrz(mrz)
  // DG2 (poza) nu se citește în aplicație; aici există doar ca SOD-ul să arate ca unul real
  const dg2 = new Uint8Array(64).fill(0x75)
  const sod = await issueSod(pki, { 1: dg1, 2: dg2 })
  return { dg1: bytesToBase64(dg1), sod: bytesToBase64(sod) }
}
