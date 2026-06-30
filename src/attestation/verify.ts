import type { SignedAttestation } from "./sign.js";
import { signingBytes } from "./sign.js";
import { ed25519Verify, b64urlDecode } from "../crypto-adapter.js";

export class VerifyError extends Error {
  constructor(public code: string, message: string) { super(`${code}: ${message}`); this.name = "VerifyError"; }
}

interface RawEntry {
  did: string; role?: string; status?: string; valid_through?: string;
  jwks?: { signing_keys?: { x: string; kid: string }[] };
}

export function verifyAttestation(
  att: SignedAttestation,
  trustList: { document: string; sig: string; key_id: string },
  rootKeyXB64Url: string,
  now: () => number = () => Date.now(),
): { ok: true } {
  // Gate 0: liability scope MUST be present (spec §8).
  if (!att.liability_scope_ref || att.liability_scope_ref.length === 0) {
    throw new VerifyError("missing_liability_scope", "attestation has no liability_scope_ref");
  }

  // Verify the Trust List is root-signed, then read its entries.
  const tlBytes = new TextEncoder().encode(trustList.document);
  const tlSig = b64urlDecode(trustList.sig.replace(/^ed25519:/, ""));
  if (!ed25519Verify(b64urlDecode(rootKeyXB64Url), tlBytes, tlSig)) {
    throw new VerifyError("bad_signature", "trust list root signature invalid");
  }
  const entries: RawEntry[] = JSON.parse(trustList.document).entries ?? [];

  const signer = entries.find((e) => e.did === att.attested_by && e.role === "verifying-agency");
  if (!signer) throw new VerifyError("not_verifying_agency", `no verifying-agency entry for ${att.attested_by}`);
  if (signer.status !== "active") throw new VerifyError("not_verifying_agency", "signer entry not active");
  if (signer.valid_through && now() > Date.parse(signer.valid_through)) {
    throw new VerifyError("not_verifying_agency", "signer entry expired (TTL)");
  }

  // Conflict of interest: same DID must not also hold a classifier-accredited entry.
  if (entries.some((e) => e.did === att.attested_by && e.role === "classifier-accredited")) {
    throw new VerifyError("conflict_of_interest", "signer also holds a classifier-accredited entry");
  }

  // Verify the attestation signature with the signer's published key.
  const key = signer.jwks?.signing_keys?.find((k) => k.kid === att.key_id);
  if (!key) throw new VerifyError("unknown_signer", `key_id ${att.key_id} not on signer entry`);
  const sigBytes = b64urlDecode(att.sig.replace(/^ed25519:/, ""));
  const { key_id, sig, ...unsigned } = att;
  if (!ed25519Verify(b64urlDecode(key.x), signingBytes(unsigned), sigBytes)) {
    throw new VerifyError("bad_signature", "attestation signature invalid");
  }
  return { ok: true };
}
