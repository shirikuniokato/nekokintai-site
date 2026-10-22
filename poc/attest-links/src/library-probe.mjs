import { Buffer } from 'node:buffer'
import { verifyIosAttestation, verifyIosAssertion } from './verification.mjs'

export default {
  async fetch(request) {
    const fixture = await request.json()
    try {
      const policy = { bundleId: 'io.uebelacker.AppAttestExample', appIdPrefix: 'V8H6LQ9448' }
      if (fixture.assertion) {
        return Response.json(verifyIosAssertion({ ...fixture, assertion: Buffer.from(fixture.assertion, 'base64'), signCount: 0 }, policy))
      }
      const result = verifyIosAttestation({
        attestation: Buffer.from(fixture.attestation, 'base64'),
        challenge: Buffer.from(fixture.challenge, 'base64'),
        keyId: fixture.keyId,
      }, policy, Date.parse('2024-02-05T00:00:00Z'))
      return Response.json(result.evidence)
    } catch (error) {
      return Response.json({ error: error.message }, { status: 422 })
    }
  },
}
