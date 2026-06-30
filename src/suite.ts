import type { EnclaveUnderTest } from "./contract/enclave.js";
import { runAssertion, type ProbeResult, type Probe } from "./probe.js";
import { ASSERTIONS } from "./assertions/registry.js";
import { a1ClosedEnum } from "./assertions/a1-closed-enum.js";
import { a2ContentFree } from "./assertions/a2-content-free.js";
import { a5Minimization } from "./assertions/a5-minimization.js";
import { a7AttestationSuspend } from "./assertions/a7-attestation-suspend.js";

const PROBES: Record<string, Probe> = {
  a1: a1ClosedEnum, a2: a2ContentFree, a5: a5Minimization, a7: a7AttestationSuspend,
};

export async function runSuite(e: EnclaveUnderTest): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  for (const meta of ASSERTIONS) {
    if (meta.status === "pending") {
      results.push({ assertion_id: meta.id, verdict: "pending", detail: meta.pendingReason ?? "pending" });
      continue;
    }
    results.push(await runAssertion(meta.id, PROBES[meta.id], e));
  }
  return results;
}
