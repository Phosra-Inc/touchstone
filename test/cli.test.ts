import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

function cli(args: string[], input?: string): { out: string; code: number } {
  try {
    const out = execFileSync("npx", ["tsx", "src/cli.ts", ...args], { input, encoding: "utf8" });
    return { out, code: 0 };
  } catch (e: any) {
    return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status ?? 1 };
  }
}

describe("cli", () => {
  it("run --enclave ref prints a report and exits 0", () => {
    const r = cli(["run", "--enclave", "ref"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("OCSS conformance report");
    expect(r.out.toUpperCase()).toContain("PASS");
  }, 30000);

  it("attest --enclave ref emits attestation JSON with passed/pending", () => {
    const r = cli(["attest", "--enclave", "ref", "--attested-by", "did:ocss:va",
      "--liability-scope-ref", "https://x/liability#v0", "--passed-at", "2026-06-30T00:00:00Z"]);
    const att = JSON.parse(r.out);
    expect(att.assertions_passed).toEqual(["a1","a2","a5","a7"]);
    expect(att.assertions_pending).toEqual(["a3","a4","a6"]);
  }, 30000);
});
