import { describe, it, expect } from "vitest";
import { runSuite } from "../src/suite.js";
import { buildAttestation } from "../src/attestation/build.js";
import { signAttestation } from "../src/attestation/sign.js";
import { verifyAttestation } from "../src/attestation/verify.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";
import { makeEd25519 } from "./helpers/fixture-keys.js";
import { mintTrustList, type FixtureEntry } from "./helpers/fixture-trustlist.js";

describe("end-to-end", () => {
  it("run -> attest -> sign -> verify is green for the reference enclave", () => {
    const root = makeEd25519(); const va = makeEd25519();
    return runSuite(makeReferenceEnclave()).then((results) => {
      const unsigned = buildAttestation(results, {
        attested_by: "did:ocss:va", suite_version: "ocss-provider-harness/v0",
        build_hash: "ref-abc", passed_at: "2026-06-30T00:00:00Z",
        liability_scope_ref: "https://ocss.example/liability#v0",
      });
      const signed = signAttestation(unsigned, { pkcs8Pem: va.pkcs8Pem, key_id: "va-k" });
      const entry: FixtureEntry = { entity: "VA", did: "did:ocss:va", role: "verifying-agency",
        tier: "accredited", status: "active", valid_through: "2026-07-06T00:00:00Z",
        jwks: { signing_keys: [{ kty: "OKP", crv: "Ed25519", x: va.xB64Url, kid: "va-k" }] } };
      const tl = mintTrustList([entry], root.pkcs8Pem);
      expect(verifyAttestation(signed, tl, root.xB64Url, () => Date.parse("2026-07-01T00:00:00Z"))).toEqual({ ok: true });
    });
  });
});
