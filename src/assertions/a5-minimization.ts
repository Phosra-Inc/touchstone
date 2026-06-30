import { createHash } from "node:crypto";
import type { Probe, ProbeResult } from "../probe.js";
import { merkleRoot } from "../merkle.js";

// A leaf that is a raw sha256 of a low-entropy guessable field is brute-forceable.
// Salted-HMAC leaves are not: enumerate a small dictionary and confirm no leaf matches a raw hash.
const DICTIONARY = ["grooming", "self_harm", "severity:moderate", "severity:high", "len:0", "len:1"];

export const a5Minimization: Probe = async (e): Promise<ProbeResult> => {
  const out = await e.classify({ content: "worrying message", recipient_did: "did:ocss:parent" });
  if (out.kind !== "signal") {
    return { assertion_id: "a5", verdict: "fail", detail: `expected a signal, got kind=${out.kind}` };
  }
  const m = out.minimization;
  if (m?.alg !== "hmac-sha256+merkle" || !Array.isArray(m.leaves) || m.leaves.length === 0) {
    return { assertion_id: "a5", verdict: "fail", detail: "missing/malformed minimization attestation", evidence: m };
  }
  if (merkleRoot(m.leaves) !== m.merkle_root) {
    return { assertion_id: "a5", verdict: "fail", detail: "merkle root does not recompute from leaves" };
  }
  const rawHashes = new Set(DICTIONARY.map((d) => createHash("sha256").update(d).digest("hex")));
  if (m.leaves.some((leaf) => rawHashes.has(leaf))) {
    return { assertion_id: "a5", verdict: "fail", detail: "leaf is a brute-forceable raw hash, not salted-HMAC" };
  }
  if (!/^[0-9a-f]{64}$/.test(m.salt_commitment)) {
    return { assertion_id: "a5", verdict: "fail", detail: "missing salt commitment" };
  }
  return { assertion_id: "a5", verdict: "pass", detail: "minimization root recomputes; leaves are salted-HMAC" };
};
