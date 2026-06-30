import { describe, it, expect } from "vitest";
import { a7AttestationSuspend } from "../src/assertions/a7-attestation-suspend.js";
import { runAssertion } from "../src/probe.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";
import { mutantA7ProcessesContent } from "./helpers/mutants.js";

describe("A7 attestation-fail -> suspend", () => {
  it("passes against the reference enclave", async () => {
    const r = await runAssertion("a7", a7AttestationSuspend, makeReferenceEnclave());
    expect(r.verdict).toBe("pass");
  });
  it("fails against a mutant that processes content despite attestation failure", async () => {
    const r = await runAssertion("a7", a7AttestationSuspend, mutantA7ProcessesContent());
    expect(r.verdict).toBe("fail");
  });
});
