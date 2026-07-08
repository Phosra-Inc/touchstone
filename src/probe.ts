import type { EnclaveUnderTest } from "./contract/enclave.js";

export interface ProbeResult {
  assertion_id: string;
  verdict: "pass" | "fail" | "error" | "pending";
  detail: string;
  evidence?: unknown;
}
export type Probe = (e: EnclaveUnderTest) => Promise<ProbeResult>;

/** Generic over the target so enclave probes (Probe) and platform-oauth
 *  probes (PlatformProbe) share the same throw->error containment. */
export async function runAssertion<T>(
  id: string,
  probe: (target: T) => Promise<ProbeResult>,
  target: T,
): Promise<ProbeResult> {
  try {
    return await probe(target);
  } catch (err) {
    return { assertion_id: id, verdict: "error", detail: `probe threw: ${(err as Error).message}` };
  }
}
