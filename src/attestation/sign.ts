import type { UnsignedAttestation } from "./build.js";
import { marshal, ed25519Sign, seedFromPkcs8Pem, b64urlEncode } from "../crypto-adapter.js";

export interface SignedAttestation extends UnsignedAttestation {
  key_id: string;
  sig: string;
}

// D-9: sign over canon of the doc with key_id/sig absent.
export function signingBytes(doc: UnsignedAttestation): Uint8Array {
  return marshal(doc);
}

export function signAttestation(doc: UnsignedAttestation, opts: { pkcs8Pem: string; key_id: string }): SignedAttestation {
  const seed = seedFromPkcs8Pem(opts.pkcs8Pem);
  const sig = ed25519Sign(seed, signingBytes(doc));
  return { ...doc, key_id: opts.key_id, sig: "ed25519:" + b64urlEncode(sig) };
}
