import { describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import * as crypto from "../src/crypto-adapter.js";

describe("crypto-adapter", () => {
  it("re-exports canon.marshal and produces stable bytes", () => {
    const a = crypto.marshal({ b: 1, a: 2 });
    const b = crypto.marshal({ a: 2, b: 1 });
    expect(Buffer.from(a).toString()).toBe(Buffer.from(b).toString()); // JCS sorts keys
  });

  it("signs and verifies a round trip via @ocss/ts ed25519", () => {
    const seed = new Uint8Array(32).fill(7);
    const pub = crypto.ed25519PublicFromSeed(seed);
    const msg = crypto.marshal({ hello: "world" });
    const sig = crypto.ed25519Sign(seed, msg);
    expect(crypto.ed25519Verify(pub, msg, sig)).toBe(true);
    expect(crypto.ed25519Verify(pub, crypto.marshal({ hello: "x" }), sig)).toBe(false);
  });

  it("derives a 32-byte seed from a PKCS#8 Ed25519 PEM", () => {
    const { privateKey: pem } = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const seed = crypto.seedFromPkcs8Pem(pem as string);
    expect(seed.length).toBe(32);
  });

  it("b64url round-trips", () => {
    const b = new Uint8Array([1, 2, 3, 250]);
    expect([...crypto.b64urlDecode(crypto.b64urlEncode(b))]).toEqual([...b]);
  });
});
