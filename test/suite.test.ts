import { describe, it, expect } from "vitest";
import { runSuite } from "../src/suite.js";
import { renderReport } from "../src/report.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";
import { makeReferencePlatformOAuth } from "./helpers/platform-oauth-fixtures.js";

describe("suite", () => {
  it("runs 4 passing + 4 pending against the reference enclave (a8 pending: no platform target)", async () => {
    const results = await runSuite(makeReferenceEnclave());
    expect(results.map((r) => r.assertion_id)).toEqual(["a1","a2","a3","a4","a5","a6","a7","a8"]);
    expect(results.filter((r) => r.verdict === "pass").map((r) => r.assertion_id).sort()).toEqual(["a1","a2","a5","a7"]);
    expect(results.filter((r) => r.verdict === "pending").map((r) => r.assertion_id).sort()).toEqual(["a3","a4","a6","a8"]);
    expect(results.find((r) => r.assertion_id === "a8")?.detail).toMatch(/no platform OAuth target/i);
  });
  it("runs a8 green when a conformant platform OAuth target is configured", async () => {
    const results = await runSuite(makeReferenceEnclave(), { platform: makeReferencePlatformOAuth() });
    expect(results.filter((r) => r.verdict === "pass").map((r) => r.assertion_id).sort()).toEqual(["a1","a2","a5","a7","a8"]);
    expect(results.filter((r) => r.verdict === "pending").map((r) => r.assertion_id).sort()).toEqual(["a3","a4","a6"]);
  });
  it("renders a markdown report naming every assertion", async () => {
    const e = makeReferenceEnclave();
    const md = renderReport(await runSuite(e), e.buildInfo());
    for (const id of ["a1","a2","a3","a4","a5","a6","a7","a8"]) expect(md.toLowerCase()).toContain(id);
    expect(md).toContain("PASS");
  });
});
