import { describe, it, expect } from "vitest";
import { signAttestation } from "../src/attestation/sign.js";
import { verifyAttestation } from "../src/attestation/verify.js";
import { makeEd25519 } from "./helpers/fixture-keys.js";
import { mintTrustList, type FixtureEntry } from "./helpers/fixture-trustlist.js";

const BASE = {
  attested_by: "did:ocss:va", suite_version: "ocss-provider-harness/v0", build_hash: "ref-abc",
  passed_at: "2026-06-30T00:00:00Z", assertions_passed: ["a1","a2","a5","a7"],
  assertions_pending: ["a3","a4","a6"], liability_scope_ref: "https://x/liability#v0", spec: "ocss-provider-harness/v0",
};

function vaEntry(did: string, kid: string, x: string, role = "verifying-agency"): FixtureEntry {
  return { entity: "VA", did, role, tier: "accredited", status: "active",
    valid_through: "2026-07-06T00:00:00Z", jwks: { signing_keys: [{ kty: "OKP", crv: "Ed25519", x, kid }] } };
}

describe("verifyAttestation", () => {
  it("accepts a valid VA-signed attestation", () => {
    const root = makeEd25519(); const va = makeEd25519();
    const att = signAttestation(BASE, { pkcs8Pem: va.pkcs8Pem, key_id: "va-k" });
    const tl = mintTrustList([vaEntry("did:ocss:va", "va-k", va.xB64Url)], root.pkcs8Pem);
    expect(verifyAttestation(att, tl, root.xB64Url, () => Date.parse("2026-07-01T00:00:00Z"))).toEqual({ ok: true });
  });
  it("rejects a tampered signature", () => {
    const root = makeEd25519(); const va = makeEd25519();
    const att = signAttestation(BASE, { pkcs8Pem: va.pkcs8Pem, key_id: "va-k" });
    att.build_hash = "tampered";
    const tl = mintTrustList([vaEntry("did:ocss:va", "va-k", va.xB64Url)], root.pkcs8Pem);
    expect(() => verifyAttestation(att, tl, root.xB64Url, () => Date.parse("2026-07-01T00:00:00Z"))).toThrow(/bad_signature/);
  });
  it("rejects a signer that is not a verifying-agency", () => {
    const root = makeEd25519(); const va = makeEd25519();
    const att = signAttestation(BASE, { pkcs8Pem: va.pkcs8Pem, key_id: "va-k" });
    const tl = mintTrustList([vaEntry("did:ocss:va", "va-k", va.xB64Url, "classifier-accredited")], root.pkcs8Pem);
    expect(() => verifyAttestation(att, tl, root.xB64Url, () => Date.parse("2026-07-01T00:00:00Z"))).toThrow(/not_verifying_agency/);
  });
  it("rejects a conflicted signer (also classifier-accredited)", () => {
    const root = makeEd25519(); const va = makeEd25519();
    const att = signAttestation(BASE, { pkcs8Pem: va.pkcs8Pem, key_id: "va-k" });
    const tl = mintTrustList([
      vaEntry("did:ocss:va", "va-k", va.xB64Url),
      { entity: "VA", did: "did:ocss:va", role: "classifier-accredited", tier: "accredited", status: "active",
        valid_through: "2026-07-06T00:00:00Z", jwks: { signing_keys: [{ kty: "OKP", crv: "Ed25519", x: va.xB64Url, kid: "va-k" }] } },
    ], root.pkcs8Pem);
    expect(() => verifyAttestation(att, tl, root.xB64Url, () => Date.parse("2026-07-01T00:00:00Z"))).toThrow(/conflict_of_interest/);
  });
  it("rejects a missing liability scope", () => {
    const root = makeEd25519(); const va = makeEd25519();
    const att = signAttestation({ ...BASE, liability_scope_ref: "" }, { pkcs8Pem: va.pkcs8Pem, key_id: "va-k" });
    const tl = mintTrustList([vaEntry("did:ocss:va", "va-k", va.xB64Url)], root.pkcs8Pem);
    expect(() => verifyAttestation(att, tl, root.xB64Url, () => Date.parse("2026-07-01T00:00:00Z"))).toThrow(/missing_liability_scope/);
  });
});
