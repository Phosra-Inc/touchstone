// The ONLY module permitted to import from @ocss/ts. Everything else imports crypto from here.
import * as nodeCrypto from "node:crypto";
import { marshal } from "@ocss/ts/canon";
import * as vocabNs from "@ocss/ts/vocab";
import { ed25519Sign } from "@ocss/ts";
import { verifyDocument, fromVerifiedDocument, Resolver } from "@ocss/ts";
import type { TrustListDocument, SignedDocument, Entry } from "@ocss/ts";

export { marshal, ed25519Sign, verifyDocument, fromVerifiedDocument, Resolver };
export const vocab = vocabNs;
export type { TrustListDocument, SignedDocument, Entry };

export function b64urlEncode(b: Uint8Array): string {
  return Buffer.from(b).toString("base64url");
}
export function b64urlDecode(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

// ed25519Verify and ed25519PublicFromSeed are implemented locally: @ocss/ts/src/crypto.ts
// exports both, but @ocss/ts/src/index.ts does NOT re-export them at the top level.
// The logic mirrors @ocss/ts/src/crypto.ts byte-for-byte (PKCS#8 DER approach).
const ED25519_SPKI_PREFIX = Uint8Array.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

const ED25519_PKCS8_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04,
  0x22, 0x04, 0x20,
]);

export function ed25519Verify(pub: Uint8Array, msg: Uint8Array, sig: Uint8Array): boolean {
  if (pub.length !== 32) return false;
  const spki = new Uint8Array(ED25519_SPKI_PREFIX.length + 32);
  spki.set(ED25519_SPKI_PREFIX, 0);
  spki.set(pub, ED25519_SPKI_PREFIX.length);
  let keyObj;
  try {
    keyObj = nodeCrypto.createPublicKey({ key: Buffer.from(spki), format: "der", type: "spki" });
  } catch {
    return false;
  }
  try {
    return nodeCrypto.verify(null, Buffer.from(msg), keyObj, Buffer.from(sig));
  } catch {
    return false;
  }
}

// PKCS#8 Ed25519 PEM -> raw 32-byte seed (the private scalar `d` of the OKP JWK).
export function seedFromPkcs8Pem(pem: string): Uint8Array {
  const jwk = nodeCrypto.createPrivateKey(pem).export({ format: "jwk" }) as { d?: string };
  if (!jwk.d) throw new Error("not an Ed25519 PKCS#8 private key");
  return b64urlDecode(jwk.d);
}

// Raw 32-byte seed -> 32-byte public key.
// Uses the PKCS#8 DER route (mirrors @ocss/ts/src/crypto.ts ed25519PublicFromSeed)
// because Node's createPrivateKey({format:"jwk"}) requires the `x` field for OKP
// keys, which is unknown at seed-derivation time.
export function ed25519PublicFromSeed(seed: Uint8Array): Uint8Array {
  const pkcs8 = new Uint8Array(ED25519_PKCS8_PREFIX.length + 32);
  pkcs8.set(ED25519_PKCS8_PREFIX, 0);
  pkcs8.set(seed, ED25519_PKCS8_PREFIX.length);
  const priv = nodeCrypto.createPrivateKey({ key: Buffer.from(pkcs8), format: "der", type: "pkcs8" });
  const spki = nodeCrypto.createPublicKey(priv).export({ format: "der", type: "spki" }) as Buffer;
  // SPKI = 12-byte header + 32-byte raw public key.
  return Uint8Array.from(spki.subarray(12));
}
