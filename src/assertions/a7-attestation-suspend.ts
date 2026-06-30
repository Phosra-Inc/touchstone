import type { Probe, ProbeResult } from "../probe.js";

export const a7AttestationSuspend: Probe = async (e): Promise<ProbeResult> => {
  e.setUpstreamAttestation("invalid");
  const out = await e.classify({ content: "sensitive content that must not be processed" });
  if (out.kind === "suspended") {
    return { assertion_id: "a7", verdict: "pass", detail: "enclave suspended before processing content" };
  }
  return {
    assertion_id: "a7",
    verdict: "fail",
    detail: `expected suspension on attestation failure, got kind=${out.kind}`,
    evidence: out,
  };
};
