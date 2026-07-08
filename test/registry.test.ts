import { describe, it, expect } from "vitest";
import { ASSERTIONS, SUITE_VERSION } from "../src/assertions/registry.js";

describe("assertion registry", () => {
  it("has 8 assertions a1..a8", () => {
    expect(ASSERTIONS.map((a) => a.id)).toEqual(["a1","a2","a3","a4","a5","a6","a7","a8"]);
  });
  it("marks a1 a2 a5 a7 a8 passable and a3 a4 a6 pending with reasons", () => {
    const passable = ASSERTIONS.filter((a) => a.status === "passable").map((a) => a.id);
    const pending = ASSERTIONS.filter((a) => a.status === "pending");
    expect(passable.sort()).toEqual(["a1","a2","a5","a7","a8"]);
    expect(pending.map((a) => a.id).sort()).toEqual(["a3","a4","a6"]);
    for (const p of pending) expect(p.pendingReason && p.pendingReason.length).toBeGreaterThan(0);
  });
  it("marks a8 as a platform-oauth-surface assertion; the rest target the enclave", () => {
    for (const a of ASSERTIONS) {
      if (a.id === "a8") expect(a.surface).toBe("platform-oauth");
      else expect(a.surface ?? "enclave").toBe("enclave");
    }
  });
  it("names suite v1 (a8 entered the assertion set)", () => {
    expect(SUITE_VERSION).toBe("ocss-provider-harness/v1");
  });
});
