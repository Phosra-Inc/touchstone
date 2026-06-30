import * as crypto from "../../src/crypto-adapter.js";

export interface FixtureEntry {
  entity: string; did: string; role?: string; tier: string;
  status: "active" | "suspended" | "revoked"; valid_through: string;
  jwks: { signing_keys: { kty: "OKP"; crv: "Ed25519"; x: string; kid: string }[] };
}

// Minimal root-signed Trust List matching the @ocss/ts SignedDocument wire form.
// Adjust field names to trustlist/types.ts as needed (see implementer note).
export function mintTrustList(entries: FixtureEntry[], rootPkcs8Pem: string, issuedAt = "2026-06-30T00:00:00Z") {
  const document = { ocss_version: "4", type: "issue", issued_at: issuedAt, entries };
  const bytes = crypto.marshal(document);
  const seed = crypto.seedFromPkcs8Pem(rootPkcs8Pem);
  const sig = "ed25519:" + crypto.b64urlEncode(crypto.ed25519Sign(seed, bytes));
  return { document: Buffer.from(bytes).toString("utf8"), key_id: "root-fixture", alg: "ed25519", sig } as any;
}
