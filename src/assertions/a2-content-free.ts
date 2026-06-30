import type { Probe, ProbeResult } from "../probe.js";

const SECRET = "the-quick-brown-fox-secret-9f2a";
const ALLOWED_INNER_KEYS = new Set(["receiver", "envelope_type", "harm_class", "tier_label", "family_hash"]);

export const a2ContentFree: Probe = async (e): Promise<ProbeResult> => {
  const out = await e.classify({ content: SECRET, recipient_did: "did:ocss:parent" });
  if (out.kind !== "signal") {
    return { assertion_id: "a2", verdict: "fail", detail: `expected a signal, got kind=${out.kind}`, evidence: out };
  }
  const inner = out.envelope.inner as unknown as Record<string, unknown>;
  const serialized = JSON.stringify(out.envelope);

  // (1) no census-openable payload field; (2) no unexpected (content-bearing) inner keys;
  // (3) the raw secret content must not appear anywhere in the census-bound envelope.
  if ("payload" in inner && inner.payload != null) {
    return { assertion_id: "a2", verdict: "fail", detail: "inner carries a payload the census could open", evidence: inner };
  }
  const extraneous = Object.keys(inner).filter((k) => !ALLOWED_INNER_KEYS.has(k));
  if (extraneous.length) {
    return { assertion_id: "a2", verdict: "fail", detail: `inner has non-content-free keys: ${extraneous.join(",")}` };
  }
  if (serialized.includes(SECRET)) {
    return { assertion_id: "a2", verdict: "fail", detail: "raw content leaked into the census-bound envelope" };
  }
  return { assertion_id: "a2", verdict: "pass", detail: "census-bound envelope is content-free" };
};
