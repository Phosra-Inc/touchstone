import { describe, it, expect } from "vitest";
import { a2ContentFree } from "../src/assertions/a2-content-free.js";
import { runAssertion } from "../src/probe.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";
import { mutantA2LeaksExcerpt } from "./helpers/mutants.js";

describe("A2 content-free signal lane", () => {
  it("passes against the reference enclave", async () => {
    const r = await runAssertion("a2", a2ContentFree, makeReferenceEnclave());
    expect(r.verdict).toBe("pass");
  });
  it("fails against a mutant that leaks the excerpt into the census-bound payload", async () => {
    const r = await runAssertion("a2", a2ContentFree, mutantA2LeaksExcerpt());
    expect(r.verdict).toBe("fail");
  });
});
