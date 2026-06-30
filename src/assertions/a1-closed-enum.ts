import type { Probe, ProbeResult } from "../probe.js";

const BOGUS = "ocss_harness_out_of_enum_zzz";

export const a1ClosedEnum: Probe = async (e): Promise<ProbeResult> => {
  const out = await e.classify({ content: "any", declared_harm_class: BOGUS });
  if (out.kind === "rejected") {
    return { assertion_id: "a1", verdict: "pass", detail: `out-of-enum harm class rejected: ${out.code}` };
  }
  return {
    assertion_id: "a1",
    verdict: "fail",
    detail: `expected rejection of out-of-enum harm class, got kind=${out.kind}`,
    evidence: out,
  };
};
