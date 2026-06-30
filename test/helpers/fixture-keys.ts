import { generateKeyPairSync } from "node:crypto";
import * as crypto from "../../src/crypto-adapter.js";

export function makeEd25519(): { pkcs8Pem: string; xB64Url: string } {
  const { privateKey } = generateKeyPairSync("ed25519");
  const pkcs8Pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const seed = crypto.seedFromPkcs8Pem(pkcs8Pem);
  return { pkcs8Pem, xB64Url: crypto.b64urlEncode(crypto.ed25519PublicFromSeed(seed)) };
}
