import { describe, it, expect } from "vitest";
import * as api from "../src/index.js";

describe("public API barrel", () => {
  it("exposes the core entry points", () => {
    for (const name of ["makeReferenceEnclave","runSuite","renderReport","buildAttestation","signAttestation","signingBytes","verifyAttestation","VerifyError","ASSERTIONS","runAssertion"]) {
      expect(api).toHaveProperty(name);
    }
  });
});
