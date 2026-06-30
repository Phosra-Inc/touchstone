import type { ProbeResult } from "../probe.js";

export interface UnsignedAttestation {
  attested_by: string;
  suite_version: string;
  build_hash: string;
  passed_at: string;
  assertions_passed: string[];
  assertions_pending: string[];
  liability_scope_ref: string;
  spec: string;
}

export interface AttestationMeta {
  attested_by: string;
  suite_version: string;
  build_hash: string;
  passed_at: string;
  liability_scope_ref: string;
}

export function buildAttestation(results: ProbeResult[], meta: AttestationMeta): UnsignedAttestation {
  const failed = results.filter((r) => r.verdict === "fail" || r.verdict === "error");
  if (failed.length) {
    throw new Error(`cannot attest: ${failed.map((f) => f.assertion_id).join(",")} failed`);
  }
  return {
    attested_by: meta.attested_by,
    suite_version: meta.suite_version,
    build_hash: meta.build_hash,
    passed_at: meta.passed_at,
    assertions_passed: results.filter((r) => r.verdict === "pass").map((r) => r.assertion_id),
    assertions_pending: results.filter((r) => r.verdict === "pending").map((r) => r.assertion_id),
    liability_scope_ref: meta.liability_scope_ref,
    spec: "ocss-provider-harness/v0",
  };
}
