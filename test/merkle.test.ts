import { describe, it, expect } from "vitest";
import { saltedLeaf, merkleRoot, buildMinimization } from "../src/merkle.js";

describe("merkle", () => {
  it("salted leaves are HMAC (differ across salts for the same field)", () => {
    const a = saltedLeaf(new Uint8Array(32).fill(1), "f");
    const b = saltedLeaf(new Uint8Array(32).fill(2), "f");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("merkleRoot is deterministic and order-sensitive", () => {
    const leaves = ["aa".repeat(32), "bb".repeat(32), "cc".repeat(32)];
    expect(merkleRoot(leaves)).toBe(merkleRoot([...leaves]));
    expect(merkleRoot(leaves)).not.toBe(merkleRoot([leaves[1], leaves[0], leaves[2]]));
  });
  it("single leaf root equals that leaf", () => {
    expect(merkleRoot(["ab".repeat(32)])).toBe("ab".repeat(32));
  });
  it("buildMinimization produces a recomputable root", () => {
    const m = buildMinimization(["a", "b", "c"]);
    expect(m.alg).toBe("hmac-sha256+merkle");
    expect(merkleRoot(m.leaves)).toBe(m.merkle_root);
    expect(m.salt_commitment).toMatch(/^[0-9a-f]{64}$/);
  });
});
