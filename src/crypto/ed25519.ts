// Extracted from @ocss/ts src/crypto.ts: ed25519Sign + DER prefixes (merged with
// ed25519Verify/ed25519PublicFromSeed). Kept byte-identical via test/parity.test.ts.
// Re-sync via scripts/refresh-ocss-ts.sh; never hand-edit.
import { createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify } from "node:crypto";

const ED25519_SPKI_PREFIX = Uint8Array.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);
const ED25519_PKCS8_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04,
  0x22, 0x04, 0x20,
]);

export function ed25519Sign(seed: Uint8Array, msg: Uint8Array): Uint8Array {
  if (seed.length !== 32) {
    throw new RangeError(`ed25519Sign: seed must be 32 bytes, got ${seed.length}`);
  }
  const pkcs8 = new Uint8Array(ED25519_PKCS8_PREFIX.length + 32);
  pkcs8.set(ED25519_PKCS8_PREFIX, 0);
  pkcs8.set(seed, ED25519_PKCS8_PREFIX.length);
  const keyObj = createPrivateKey({ key: Buffer.from(pkcs8), format: "der", type: "pkcs8" });
  return Uint8Array.from(nodeSign(null, Buffer.from(msg), keyObj));
}

export function ed25519Verify(pub: Uint8Array, msg: Uint8Array, sig: Uint8Array): boolean {
  if (pub.length !== 32) return false;
  const spki = new Uint8Array(ED25519_SPKI_PREFIX.length + 32);
  spki.set(ED25519_SPKI_PREFIX, 0);
  spki.set(pub, ED25519_SPKI_PREFIX.length);
  let keyObj;
  try {
    keyObj = createPublicKey({ key: Buffer.from(spki), format: "der", type: "spki" });
  } catch {
    return false;
  }
  try {
    return nodeVerify(null, Buffer.from(msg), keyObj, Buffer.from(sig));
  } catch {
    return false;
  }
}

export function ed25519PublicFromSeed(seed: Uint8Array): Uint8Array {
  if (seed.length !== 32) throw new RangeError(`ed25519PublicFromSeed: seed must be 32 bytes, got ${seed.length}`);
  const pkcs8 = new Uint8Array(ED25519_PKCS8_PREFIX.length + 32);
  pkcs8.set(ED25519_PKCS8_PREFIX, 0);
  pkcs8.set(seed, ED25519_PKCS8_PREFIX.length);
  const priv = createPrivateKey({ key: Buffer.from(pkcs8), format: "der", type: "pkcs8" });
  const spki = createPublicKey(priv).export({ format: "der", type: "spki" }) as Buffer;
  return Uint8Array.from(spki.subarray(12));
}
