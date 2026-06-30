import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { marshal as inlinedMarshal } from "../src/crypto/canon.js";
import { ed25519Sign as inlinedSign } from "../src/crypto/ed25519.js";
import { HarmClass as inlinedHarm } from "../src/crypto/vocab.js";
import { marshal as upstreamMarshal } from "@ocss/ts/canon";
import { ed25519Sign as upstreamSign } from "@ocss/ts";
import * as upstreamVocab from "@ocss/ts/vocab";

const CASES: unknown[] = [
  { age_band: "13_15", enabled: true, rule_category: "screen_time_report" },
  { b: 1, a: 2, nested: { z: [1, 2, 3], y: "x" } },
  { unicode: "😀！déjà", empty: "", arr: [] },
  { n: 9007199254740991, neg: -42, zero: 0 },
  "plain string", 0, true, null, [1, "two", { three: 3 }],
];

describe("parity: inlined crypto === vendored @ocss/ts", () => {
  it("marshal produces byte-identical output", () => {
    for (const c of CASES) {
      expect(Buffer.from(inlinedMarshal(c)).toString("hex"))
        .toBe(Buffer.from(upstreamMarshal(c)).toString("hex"));
    }
  });
  it("marshal matches the D-13 canon golden vector", () => {
    const obj = { age_band: "13_15", enabled: true, rule_category: "screen_time_report" };
    const digest = createHash("sha256").update(Buffer.from(inlinedMarshal(obj))).digest("hex");
    expect(digest).toBe("78b2ec890e18b5c4455c59ac1d11092985fb04910d1cc5bafbab586d7a0a27c0");
  });
  it("ed25519Sign produces identical signatures", () => {
    const seed = new Uint8Array(32).fill(9);
    const msg = inlinedMarshal({ hello: "world" });
    expect(Buffer.from(inlinedSign(seed, msg)).toString("hex"))
      .toBe(Buffer.from(upstreamSign(seed, msg)).toString("hex"));
  });
  it("HarmClass values match upstream", () => {
    expect(Object.values(inlinedHarm).sort())
      .toEqual(Object.values(upstreamVocab.HarmClass).sort());
  });
});
