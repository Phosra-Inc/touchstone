import type { EnclaveUnderTest } from "./contract/enclave.js";

export interface ProbeResult {
  assertion_id: string;
  verdict: "pass" | "fail" | "error" | "pending";
  detail: string;
  evidence?: unknown;
}
export type Probe = (e: EnclaveUnderTest) => Promise<ProbeResult>;

export async function runAssertion(id: string, probe: Probe, e: EnclaveUnderTest): Promise<ProbeResult> {
  try {
    return await probe(e);
  } catch (err) {
    return { assertion_id: id, verdict: "error", detail: `probe threw: ${(err as Error).message}` };
  }
}
