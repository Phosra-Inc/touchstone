// The single crypto seam. Everything else imports crypto from here.
// After the publish inline, this re-exports the local ./crypto/* copies (no @ocss/ts at runtime).
import * as nodeCrypto from "node:crypto";
import { marshal } from "./crypto/canon.js";
import * as vocabNs from "./crypto/vocab.js";
import { ed25519Sign, ed25519Verify, ed25519PublicFromSeed } from "./crypto/ed25519.js";
import type { Envelope } from "./crypto/envelope-types.js";

export { marshal, ed25519Sign, ed25519Verify, ed25519PublicFromSeed };
export const vocab = vocabNs;
export type { Envelope };

export function b64urlEncode(b: Uint8Array): string {
  return Buffer.from(b).toString("base64url");
}
export function b64urlDecode(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

// PKCS#8 Ed25519 PEM -> raw 32-byte seed (the private scalar `d` of the OKP JWK).
export function seedFromPkcs8Pem(pem: string): Uint8Array {
  const jwk = nodeCrypto.createPrivateKey(pem).export({ format: "jwk" }) as { d?: string };
  if (!jwk.d) throw new Error("not an Ed25519 PKCS#8 private key");
  return b64urlDecode(jwk.d);
}
