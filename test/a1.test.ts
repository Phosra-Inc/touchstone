import { describe, it, expect } from "vitest";
import { a1ClosedEnum } from "../src/assertions/a1-closed-enum.js";
import { runAssertion } from "../src/probe.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";
import { mutantA1PassesBogusClass } from "./helpers/mutants.js";

describe("A1 closed-enum fail-closed", () => {
  it("passes against the reference enclave", async () => {
    const r = await runAssertion("a1", a1ClosedEnum, makeReferenceEnclave());
    expect(r.verdict).toBe("pass");
  });
  it("fails against a mutant that passes the bogus class through", async () => {
    const r = await runAssertion("a1", a1ClosedEnum, mutantA1PassesBogusClass());
    expect(r.verdict).toBe("fail");
  });
});
