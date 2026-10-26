// Passive Authentication (ICAO 9303, partea 11): SOD-ul de pe cip e un CMS
// SignedData care conține hash-urile grupurilor de date (LDSSecurityObject),
// semnat de un Document Signer (DSC), care la rândul lui e semnat de CSCA-ul
// statului emitent. Dacă semnăturile și hash-ul DG1 se potrivesc, datele din DG1
// sunt cele scrise de stat pe cip.
//
// Structurile se parsează cu asn1js/pkijs, iar semnăturile se verifică prin
// node:crypto (OpenSSL), care suportă și curbele brainpool folosite de multe
// documente europene, spre deosebire de WebCrypto.

import { createHash, constants, verify as cryptoVerify, X509Certificate, type KeyObject } from 'node:crypto'
import * as asn1js from 'asn1js'
import * as pkijs from 'pkijs'

const OID = {
  signedData: '1.2.840.113549.1.7.2',
  ldsSecurityObject: '2.23.136.1.1.1',
  contentType: '1.2.840.113549.1.9.3',
  messageDigest: '1.2.840.113549.1.9.4',
  rsaEncryption: '1.2.840.113549.1.1.1',
  rsaPss: '1.2.840.113549.1.1.10',
}

const HASHES: Record<string, string> = {
  '1.3.14.3.2.26': 'sha1',
  '2.16.840.1.101.3.4.2.4': 'sha224',
  '2.16.840.1.101.3.4.2.1': 'sha256',
  '2.16.840.1.101.3.4.2.2': 'sha384',
  '2.16.840.1.101.3.4.2.3': 'sha512',
}

/** Algoritmii de semnătură: hash-ul folosit și familia (ECDSA sau RSA PKCS#1 v1.5). */
const SIGNATURES: Record<string, { hash?: string; kind: 'ecdsa' | 'rsa' }> = {
  '1.2.840.10045.4.1': { hash: 'sha1', kind: 'ecdsa' },
  '1.2.840.10045.4.3.1': { hash: 'sha224', kind: 'ecdsa' },
  '1.2.840.10045.4.3.2': { hash: 'sha256', kind: 'ecdsa' },
  '1.2.840.10045.4.3.3': { hash: 'sha384', kind: 'ecdsa' },
  '1.2.840.10045.4.3.4': { hash: 'sha512', kind: 'ecdsa' },
  '1.2.840.113549.1.1.5': { hash: 'sha1', kind: 'rsa' },
  '1.2.840.113549.1.1.14': { hash: 'sha224', kind: 'rsa' },
  '1.2.840.113549.1.1.11': { hash: 'sha256', kind: 'rsa' },
  '1.2.840.113549.1.1.12': { hash: 'sha384', kind: 'rsa' },
  '1.2.840.113549.1.1.13': { hash: 'sha512', kind: 'rsa' },
  [OID.rsaEncryption]: { kind: 'rsa' },
}

export type PassiveAuthResult =
  | { ok: true; signer: string; issuer: string; hashAlgorithm: string; dataGroups: number[] }
  | { ok: false; reason: string }

const fail = (reason: string): PassiveAuthResult => ({ ok: false, reason })
const toBuffer = (ab: ArrayBuffer | ArrayBufferView) =>
  ArrayBuffer.isView(ab) ? Buffer.from(ab.buffer, ab.byteOffset, ab.byteLength) : Buffer.from(ab)

/** EF.SOD începe cu eticheta aplicației 23 (0x77) în jurul ContentInfo-ului CMS. */
export function unwrapSod(sod: Uint8Array): Uint8Array {
  if (sod[0] !== 0x77) return sod
  let at = 1
  let len = sod[at++]
  if (len & 0x80) {
    const n = len & 0x7f
    len = 0
    for (let i = 0; i < n; i++) len = (len << 8) | sod[at++]
  }
  return sod.subarray(at, at + len)
}

function octetStringBytes(os: asn1js.OctetString): Buffer {
  // OctetString-ul poate fi construit din bucăți (BER); getValue le concatenează
  return toBuffer(os.getValue())
}

interface LdsSecurityObject {
  hashAlgorithm: string
  hashes: Map<number, Buffer>
}

function parseLdsSecurityObject(der: Buffer): LdsSecurityObject {
  const parsed = asn1js.fromBER(der)
  if (parsed.offset === -1) throw new Error('LDSSecurityObject nu e ASN.1 valid')
  const seq = parsed.result as asn1js.Sequence
  const [, algId, groups] = seq.valueBlock.value as [asn1js.Integer, asn1js.Sequence, asn1js.Sequence]
  const oid = (algId.valueBlock.value[0] as asn1js.ObjectIdentifier).valueBlock.toString()
  const hashAlgorithm = HASHES[oid]
  if (!hashAlgorithm) throw new Error(`algoritm de hash necunoscut în LDSSecurityObject (${oid})`)
  const hashes = new Map<number, Buffer>()
  for (const g of groups.valueBlock.value as asn1js.Sequence[]) {
    const [num, value] = g.valueBlock.value as [asn1js.Integer, asn1js.OctetString]
    hashes.set(num.valueBlock.valueDec, octetStringBytes(value))
  }
  return { hashAlgorithm, hashes }
}

function attribute(signer: pkijs.SignerInfo, oid: string): asn1js.BaseBlock | undefined {
  return signer.signedAttrs?.attributes.find((a) => a.type === oid)?.values[0] as asn1js.BaseBlock | undefined
}

function verifyCmsSignature(signer: pkijs.SignerInfo, key: KeyObject, data: Buffer): boolean {
  const sigOid = signer.signatureAlgorithm.algorithmId
  const signature = toBuffer(signer.signature.valueBlock.valueHexView)
  if (sigOid === OID.rsaPss) {
    const params = pkijs.RSASSAPSSParams.fromBER(toBuffer(signer.signatureAlgorithm.algorithmParams.toBER()))
    const hash = HASHES[params.hashAlgorithm.algorithmId] ?? 'sha1'
    return cryptoVerify(hash, data, { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: params.saltLength }, signature)
  }
  const alg = SIGNATURES[sigOid]
  if (!alg) throw new Error(`algoritm de semnătură nesuportat (${sigOid})`)
  const hash = alg.hash ?? HASHES[signer.digestAlgorithm.algorithmId]
  if (!hash) throw new Error('algoritmul de hash al semnăturii lipsește')
  return alg.kind === 'ecdsa' ? cryptoVerify(hash, data, { key, dsaEncoding: 'der' }, signature) : cryptoVerify(hash, data, key, signature)
}

function withinValidity(cert: X509Certificate, now: Date) {
  return new Date(cert.validFrom) <= now && now <= new Date(cert.validTo)
}

export function verifyPassiveAuth(dg1: Uint8Array, sod: Uint8Array, trustStore: X509Certificate[], now = new Date()): PassiveAuthResult {
  try {
    const parsed = asn1js.fromBER(toBuffer(unwrapSod(sod)))
    if (parsed.offset === -1) return fail('SOD-ul nu e ASN.1 valid')
    const contentInfo = new pkijs.ContentInfo({ schema: parsed.result })
    if (contentInfo.contentType !== OID.signedData) return fail('SOD-ul nu conține un CMS SignedData')
    const signedData = new pkijs.SignedData({ schema: contentInfo.content })
    if (signedData.encapContentInfo.eContentType !== OID.ldsSecurityObject) return fail('conținutul semnat nu e un LDSSecurityObject')
    const eContent = signedData.encapContentInfo.eContent
    if (!eContent) return fail('LDSSecurityObject lipsește')
    const content = octetStringBytes(eContent)
    const lds = parseLdsSecurityObject(content)

    // 1. hash-ul DG1 din SOD = hash-ul DG1 primit
    const expected = lds.hashes.get(1)
    if (!expected) return fail('SOD-ul nu conține hash-ul DG1')
    if (!createHash(lds.hashAlgorithm).update(dg1).digest().equals(expected)) return fail('hash-ul DG1 nu corespunde celui semnat în SOD (date modificate)')

    // 2. semnătura Document Signer-ului peste atributele semnate
    if (signedData.signerInfos.length !== 1) return fail('SOD-ul trebuie să aibă exact un semnatar')
    const signer = signedData.signerInfos[0]
    if (!signer.signedAttrs) return fail('lipsesc atributele semnate')
    const digestAlg = HASHES[signer.digestAlgorithm.algorithmId]
    if (!digestAlg) return fail('algoritmul de rezumat al semnatarului e necunoscut')
    const md = attribute(signer, OID.messageDigest) as asn1js.OctetString | undefined
    if (!md || !createHash(digestAlg).update(content).digest().equals(toBuffer(md.valueBlock.valueHexView))) {
      return fail('atributul messageDigest nu corespunde conținutului semnat')
    }
    const ct = attribute(signer, OID.contentType) as asn1js.ObjectIdentifier | undefined
    if (!ct || ct.valueBlock.toString() !== OID.ldsSecurityObject) return fail('atributul contentType lipsește sau e greșit')

    const certs = (signedData.certificates ?? []).filter((c): c is pkijs.Certificate => c instanceof pkijs.Certificate)
    let dscPki: pkijs.Certificate | undefined
    if (signer.sid instanceof pkijs.IssuerAndSerialNumber) {
      const sid = signer.sid
      dscPki = certs.find((c) => c.serialNumber.isEqual(sid.serialNumber) && c.issuer.isEqual(sid.issuer))
    } else {
      dscPki = certs[0]
    }
    if (!dscPki) return fail('certificatul Document Signer lipsește din SOD')
    const dsc = new X509Certificate(toBuffer(dscPki.toSchema().toBER()))

    // atributele semnate se semnează codificate ca SET (eticheta 0x31), nu ca [0] IMPLICIT
    const signedAttrs = Buffer.from(toBuffer(signer.signedAttrs.encodedValue))
    signedAttrs[0] = 0x31
    if (!verifyCmsSignature(signer, dsc.publicKey, signedAttrs)) {
      return fail('semnătura Document Signer-ului peste SOD nu e validă')
    }

    // 3. DSC-ul e emis și semnat de un CSCA de încredere
    if (trustStore.length === 0) return fail('niciun certificat CSCA de încredere nu e configurat pe server')
    const csca = trustStore.find((c) => dsc.checkIssued(c) && dsc.verify(c.publicKey))
    if (!csca) return fail('certificatul Document Signer nu e emis de un CSCA de încredere')
    if (!withinValidity(csca, now)) return fail('certificatul CSCA e în afara perioadei de valabilitate')
    if (!withinValidity(dsc, now)) return fail('certificatul Document Signer e în afara perioadei de valabilitate')

    return { ok: true, signer: dsc.subject, issuer: csca.subject, hashAlgorithm: lds.hashAlgorithm, dataGroups: [...lds.hashes.keys()].sort((a, b) => a - b) }
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err))
  }
}
