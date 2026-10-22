import { Buffer } from 'node:buffer'
import { createHash, X509Certificate } from 'node:crypto'
import cbor from 'cbor'
import { verifyAttestation, verifyAssertion } from 'node-app-attest'

export const digest = (value) => createHash('sha256').update(value).digest('hex')

function requireValue(condition, code) {
  if (!condition) throw new Error(code)
}

export function decodeSingle(bytes) {
  const values = cbor.decodeAllSync(bytes, { max_depth: 16 })
  requireValue(values.length === 1, 'cbor_items')
  return values[0]
}

function checkCertificates(chain, now) {
  requireValue(Array.isArray(chain) && chain.length === 2 && chain.every(Buffer.isBuffer), 'certificate_chain')
  const [leaf, intermediate] = chain.map((value) => new X509Certificate(value))
  requireValue(!leaf.ca && intermediate.ca, 'certificate_order')
  requireValue(leaf.issuer === intermediate.subject, 'certificate_issuer')
  for (const certificate of [leaf, intermediate]) {
    requireValue(Date.parse(certificate.validFrom) <= now && now <= Date.parse(certificate.validTo), 'certificate_expired')
    requireValue(certificate.publicKey.asymmetricKeyType === 'ec', 'certificate_key_type')
  }
  requireValue(leaf.publicKey.asymmetricKeyDetails?.namedCurve === 'prime256v1', 'leaf_curve')
  requireValue(intermediate.publicKey.asymmetricKeyDetails?.namedCurve === 'secp384r1', 'intermediate_curve')
  return leaf
}

function readAttestationData(data, keyId) {
  requireValue(Buffer.isBuffer(data) && data.length >= 87, 'auth_data')
  requireValue(data[32] === 0x40, 'unsupported_attestation_flags')
  requireValue(data.readUInt32BE(33) === 0, 'initial_counter')
  requireValue(data.readUInt16BE(53) === 32, 'credential_length')
  requireValue(data.subarray(55, 87).toString('base64') === keyId, 'credential_id')
  const key = decodeSingle(data.subarray(87))
  requireValue(key instanceof Map && key.get(1) === 2 && key.get(3) === -7 && key.get(-1) === 1, 'credential_algorithm')
  requireValue(Buffer.isBuffer(key.get(-2)) && key.get(-2).length === 32
    && Buffer.isBuffer(key.get(-3)) && key.get(-3).length === 32, 'credential_point')
  return { aaguid: data.subarray(37, 53).toString('utf8'), counter: 0,
    flags: data[32], authenticatorExtensionsPresent: false }
}

export function verifyIosAttestation(input, policy, now = Date.now()) {
  const object = decodeSingle(input.attestation)
  requireValue(object?.fmt === 'apple-appattest' && object.attStmt, 'attestation_format')
  checkCertificates(object.attStmt.x5c, now)
  const evidence = readAttestationData(object.authData, input.keyId)
  // 未知の環境・拡張を通して成功したようにはしない。PoCの実測を受けて対応を決める。
  requireValue(evidence.aaguid === 'appattestdevelop', 'unexpected_aaguid')
  const result = verifyAttestation({ ...input, bundleIdentifier: policy.bundleId,
    teamIdentifier: policy.appIdPrefix, allowDevelopmentEnvironment: true })
  requireValue(result.environment === 'development', 'unexpected_environment')
  return { publicKey: result.publicKey, evidence }
}

export function verifyIosAssertion(input, policy) {
  requireValue(Number.isInteger(input.signCount) && input.signCount >= 0 && input.signCount < 0x7fffffff, 'stored_counter')
  const object = decodeSingle(input.assertion)
  const data = object?.authenticatorData
  requireValue(Buffer.isBuffer(data) && data.length === 37 && [0, 0x40].includes(data[32]), 'assertion_auth_data')
  requireValue(Buffer.isBuffer(object.signature) && object.signature.length >= 64 && object.signature.length <= 80, 'assertion_signature')
  const counter = data.readUInt32BE(33)
  requireValue(counter > input.signCount && counter <= 0x7fffffff, 'assertion_counter')
  const result = verifyAssertion({ ...input, bundleIdentifier: policy.bundleId, teamIdentifier: policy.appIdPrefix })
  requireValue(result.signCount === counter, 'counter_mismatch')
  return { counter }
}
