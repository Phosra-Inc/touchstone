import { describe, it, expect } from "vitest";
import { buildAttestation } from "../src/attestation/build.js";
import { runSuite } from "../src/suite.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";

const META = {
  attested_by: "did:ocss:test-va",
  suite_version: "ocss-provider-harness/v0",
  build_hash: "ref-abc",
  passed_at: "2026-06-30T00:00:00Z",
  liability_scope_ref: "https://ocss.example/liability#v0",
};

describe("buildAttestation", () => {
  it("records passed and pending ids from reference results", async () => {
    const att = buildAttestation(await runSuite(makeReferenceEnclave()), META);
    expect(att.assertions_passed).toEqual(["a1","a2","a5","a7"]);
    expect(att.assertions_pending).toEqual(["a3","a4","a6","a8"]);
    expect(att.spec).toBe("ocss-provider-harness/v0");
    expect(att.attested_by).toBe("did:ocss:test-va");
  });
  it("throws if an executed assertion failed", async () => {
    const results = await runSuite(makeReferenceEnclave());
    results[0] = { assertion_id: "a1", verdict: "fail", detail: "x" };
    expect(() => buildAttestation(results, META)).toThrow(/failed/i);
  });
});
