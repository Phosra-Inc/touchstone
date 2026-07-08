import type { EnclaveUnderTest } from "./contract/enclave.js";
import type { PlatformOAuthUnderTest } from "./contract/platform-oauth.js";
import { runAssertion, type ProbeResult, type Probe } from "./probe.js";
import { ASSERTIONS } from "./assertions/registry.js";
import { a1ClosedEnum } from "./assertions/a1-closed-enum.js";
import { a2ContentFree } from "./assertions/a2-content-free.js";
import { a5Minimization } from "./assertions/a5-minimization.js";
import { a7AttestationSuspend } from "./assertions/a7-attestation-suspend.js";
import { a8ProfilesChildOnly, type PlatformProbe } from "./assertions/a8-profiles-child-only.js";

const PROBES: Record<string, Probe> = {
  a1: a1ClosedEnum, a2: a2ContentFree, a5: a5Minimization, a7: a7AttestationSuspend,
};

const PLATFORM_PROBES: Record<string, PlatformProbe> = {
  a8: a8ProfilesChildOnly,
};

export interface SuiteTargets {
  /** The platform-hosted OAuth surface (EXT-04 §3.3.1) the platform-oauth
   *  assertions (a8) drive. Absent = those assertions report `pending`
   *  ("no platform OAuth target configured"), never a silent pass. */
  platform?: PlatformOAuthUnderTest;
}

export async function runSuite(e: EnclaveUnderTest, targets: SuiteTargets = {}): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  for (const meta of ASSERTIONS) {
    if (meta.status === "pending") {
      results.push({ assertion_id: meta.id, verdict: "pending", detail: meta.pendingReason ?? "pending" });
      continue;
    }
    if (meta.surface === "platform-oauth") {
      if (!targets.platform) {
        results.push({
          assertion_id: meta.id,
          verdict: "pending",
          detail: "no platform OAuth target configured (--platform-oauth <config.json>); this assertion probes the platform's profiles leg",
        });
        continue;
      }
      results.push(await runAssertion(meta.id, PLATFORM_PROBES[meta.id], targets.platform));
      continue;
    }
    results.push(await runAssertion(meta.id, PROBES[meta.id], e));
  }
  return results;
}
