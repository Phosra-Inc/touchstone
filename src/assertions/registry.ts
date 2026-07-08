// The suite version names the ASSERTION SET an attestation was earned against.
// Bumped v0 -> v1 when a8 (profiles-child-only) entered the suite: an
// attestation citing v0 predates a8 and never covers it — the enforcement
// lever CR-14 asked for. Bump again whenever the assertion set changes.
export const SUITE_VERSION = "ocss-provider-harness/v1";

export interface AssertionMeta {
  id: string;
  title: string;
  status: "passable" | "pending";
  pendingReason?: string;
  /** Which target surface the probe drives. Absent = the provider enclave
   *  (the default target); "platform-oauth" = the platform's hosted OAuth
   *  surface (EXT-04 §3.3.1), configured separately via --platform-oauth. */
  surface?: "enclave" | "platform-oauth";
}

export const ASSERTIONS: AssertionMeta[] = [
  { id: "a1", title: "Closed-enum fail-closed", status: "passable" },
  { id: "a2", title: "Content-free signal lane", status: "passable" },
  { id: "a3", title: "Sealed-to-consent-recipient only", status: "pending", pendingReason: "needs consent infra" },
  { id: "a4", title: "Parent-sole-control + visible monitoring_active", status: "pending", pendingReason: "needs capability endpoint" },
  { id: "a5", title: "Minimization attestation wired", status: "passable" },
  { id: "a6", title: "Abuse-at-home -> independent-advocate routing", status: "pending", pendingReason: "advocate lane not built" },
  { id: "a7", title: "Attestation-fail -> suspend", status: "passable" },
  { id: "a8", title: "Profiles endpoint: child profiles only, [] when none", status: "passable", surface: "platform-oauth" },
];
