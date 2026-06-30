import { describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { signAttestation, signingBytes } from "../src/attestation/sign.js";
import * as crypto from "../src/crypto-adapter.js";

const DOC = {
  attested_by: "did:ocss:test-va", suite_version: "ocss-provider-harness/v0",
  build_hash: "ref-abc", passed_at: "2026-06-30T00:00:00Z",
  assertions_passed: ["a1","a2","a5","a7"], assertions_pending: ["a3","a4","a6"],
  liability_scope_ref: "https://ocss.example/liability#v0", spec: "ocss-provider-harness/v0",
};

describe("signAttestation", () => {
  it("produces an ed25519: sig that verifies over the key_id/sig-stripped canon", () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    const signed = signAttestation(DOC, { pkcs8Pem: pem, key_id: "va-2026-06" });
    expect(signed.sig.startsWith("ed25519:")).toBe(true);
    expect(signed.key_id).toBe("va-2026-06");

    const seed = crypto.seedFromPkcs8Pem(pem);
    const pub = crypto.ed25519PublicFromSeed(seed);
    const sigBytes = crypto.b64urlDecode(signed.sig.slice("ed25519:".length));
    expect(crypto.ed25519Verify(pub, signingBytes(DOC), sigBytes)).toBe(true);
  });
});
