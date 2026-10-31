// Passive Authentication (ICAO 9303, partea 11) pentru cartea electronică de identitate.
//
// Cipul conține grupuri de date (DG1 = MRZ, DG2 = poza, …) și SOD-ul (Document
// Security Object): o structură CMS SignedData semnată de statul emitent, care
// conține hash-ul fiecărui grup de date. Verificarea:
//   1. SOD-ul e semnat de certificatul Document Signer (DS) inclus în el;
//   2. certificatul DS e emis de un certificat CSCA de încredere (al României);
//   3. hash-ul DG1 primit = hash-ul DG1 din SOD.
// Dacă toate trec, datele din DG1 (deci CNP-ul) sunt cele scrise de stat pe cip.
// Nu dovedește că cipul nu e clonat: pentru asta există Chip Authentication.

import { createHash, webcrypto } from 'node:crypto'
import * as asn1js from 'asn1js'
import * as pkijs from 'pkijs'
import { parseMrz } from '@evoting/crypto'

pkijs.setEngine('node', new pkijs.CryptoEngine({ name: 'node', crypto: webcrypto as unknown as Crypto }))

export const OID_LDS_SECURITY_OBJECT = '2.23.136.1.1.1'

const HASHES: Record<string, string> = {
  '1.3.14.3.2.26': 'sha1',
  '2.16.840.1.101.3.4.2.4': 'sha224',
  '2.16.840.1.101.3.4.2.1': 'sha256',
  '2.16.840.1.101.3.4.2.2': 'sha384',
  '2.16.840.1.101.3.4.2.3': 'sha512',
}
export const HASH_OIDS = Object.fromEntries(Object.entries(HASHES).map(([oid, name]) => [name, oid]))

export class PassiveAuthError extends Error {}

export interface VerifiedDocument {
  cnp: string
  mrz: string[]
  documentNumber: string
  /** Subiectul certificatului Document Signer. */
  signer: string
}

const toArrayBuffer = (b: Uint8Array): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer

function parseBer(bytes: Uint8Array, what: string): asn1js.AsnType {
  const parsed = asn1js.fromBER(toArrayBuffer(bytes))
  if (parsed.offset === -1) throw new PassiveAuthError(`${what}: structură ASN.1 invalidă`)
  return parsed.result
}

/** DG1 = [APPLICATION 1] { [APPLICATION 31] MRZ }. Întoarce textul MRZ. */
export function mrzFromDg1(dg1: Uint8Array): string {
  const outer = parseBer(dg1, 'DG1') as asn1js.Constructed
  if (outer.idBlock.tagClass !== 2 || outer.idBlock.tagNumber !== 1) throw new PassiveAuthError('DG1: tag-ul exterior nu e 0x61')
  const inner = outer.valueBlock.value?.[0]
  if (!inner || inner.idBlock.tagClass !== 2 || inner.idBlock.tagNumber !== 0x1f) throw new PassiveAuthError('DG1: lipsește câmpul MRZ (0x5F1F)')
  const raw = (inner as asn1js.Primitive).valueBlock.valueHexView
  return new TextDecoder('latin1').decode(raw)
}

/** SOD = [APPLICATION 23] { ContentInfo(SignedData) }. Acceptă și ContentInfo fără învelișul 0x77. */
export function signedDataFromSod(sod: Uint8Array): pkijs.SignedData {
  let node = parseBer(sod, 'SOD')
  if (node.idBlock.tagClass === 2 && node.idBlock.tagNumber === 23) {
    node = (node as asn1js.Constructed).valueBlock.value[0]
  }
  const info = new pkijs.ContentInfo({ schema: node })
  if (info.contentType !== pkijs.ContentInfo.SIGNED_DATA) throw new PassiveAuthError('SOD: conținutul nu e SignedData')
  return new pkijs.SignedData({ schema: info.content })
}

/** LDSSecurityObject ::= SEQUENCE { version, hashAlgorithm, dataGroupHashValues SEQUENCE OF { dgNumber, hash } } */
export function parseLdsSecurityObject(der: ArrayBuffer): { hashAlgorithm: string; hashes: Map<number, Uint8Array> } {
  const seq = parseBer(new Uint8Array(der), 'LDSSecurityObject') as asn1js.Sequence
  const [, algId, values] = seq.valueBlock.value as asn1js.Sequence[]
  const oid = (algId.valueBlock.value[0] as asn1js.ObjectIdentifier).valueBlock.toString()
  const hashAlgorithm = HASHES[oid]
  if (!hashAlgorithm) throw new PassiveAuthError(`SOD: algoritm de hash necunoscut (${oid})`)
  const hashes = new Map<number, Uint8Array>()
  for (const item of values.valueBlock.value as asn1js.Sequence[]) {
    const [num, hash] = item.valueBlock.value
    hashes.set((num as asn1js.Integer).valueBlock.valueDec, new Uint8Array((hash as asn1js.OctetString).valueBlock.valueHexView))
  }
  return { hashAlgorithm, hashes }
}

/** Încarcă un certificat din PEM sau DER. */
export function loadCertificate(data: Uint8Array | string): pkijs.Certificate {
  let der: Uint8Array
  const text = typeof data === 'string' ? data : new TextDecoder().decode(data)
  if (text.includes('-----BEGIN CERTIFICATE-----')) {
    der = Buffer.from(text.replace(/-----(BEGIN|END) CERTIFICATE-----|\s+/g, ''), 'base64')
  } else {
    der = typeof data === 'string' ? Buffer.from(data, 'base64') : data
  }
  return new pkijs.Certificate({ schema: parseBer(der, 'certificat') })
}

const subjectOf = (cert: pkijs.Certificate) =>
  cert.subject.typesAndValues.map((tv) => `${({ '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.10': 'O' } as Record<string, string>)[tv.type] ?? tv.type}=${tv.value.valueBlock.value}`).join(', ')

export async function passiveAuthenticate(dg1: Uint8Array, sod: Uint8Array, trustedCsca: pkijs.Certificate[]): Promise<VerifiedDocument> {
  if (trustedCsca.length === 0) throw new PassiveAuthError('Serverul nu are niciun certificat CSCA configurat (CSCA_DIR)')
  const signedData = signedDataFromSod(sod)
  if (signedData.encapContentInfo.eContentType !== OID_LDS_SECURITY_OBJECT) throw new PassiveAuthError('SOD: conținutul semnat nu e un LDSSecurityObject')
  const eContent = signedData.encapContentInfo.eContent
  if (!eContent) throw new PassiveAuthError('SOD: lipsește conținutul semnat')

  // 1 + 2: semnătura SOD cu certificatul DS și lanțul DS → CSCA.
  let verified: boolean
  try {
    const result = await signedData.verify({ signer: 0, checkChain: true, trustedCerts: trustedCsca, extendedMode: true })
    verified = typeof result === 'boolean' ? result : result.signatureVerified === true
  } catch (err) {
    const msg = (err as { message?: string })?.message ?? String(err)
    throw new PassiveAuthError(`Semnătura SOD sau lanțul de certificate nu se verifică (${msg})`)
  }
  if (!verified) throw new PassiveAuthError('Semnătura SOD nu se verifică')

  // 3: hash-ul DG1.
  const lds = parseLdsSecurityObject(eContent.getValue())
  const expected = lds.hashes.get(1)
  if (!expected) throw new PassiveAuthError('SOD: lipsește hash-ul DG1')
  const actual = createHash(lds.hashAlgorithm).update(dg1).digest()
  if (!Buffer.from(expected).equals(actual)) throw new PassiveAuthError('Hash-ul DG1 nu corespunde celui semnat în SOD: datele au fost modificate')

  const mrz = mrzFromDg1(dg1)
  const parsed = parseMrz(mrz)
  if (!parsed) throw new PassiveAuthError('DG1: MRZ în format necunoscut')
  if (!parsed.cnp) throw new PassiveAuthError('DG1: CNP-ul nu a putut fi extras din MRZ')
  const ds = signedData.certificates?.find((c): c is pkijs.Certificate => c instanceof pkijs.Certificate)
  return { cnp: parsed.cnp, mrz: parsed.lines, documentNumber: parsed.documentNumber, signer: ds ? subjectOf(ds) : 'necunoscut' }
}
