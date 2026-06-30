// Extracted from @ocss/ts src/vocab.ts (subset: HarmClass, EnvelopeType, TierLabel) —
// kept identical via test/parity.test.ts. Re-sync via scripts/refresh-ocss-ts.sh.

// §4.4 — content enum (closed).
export const HarmClass = {
  Grooming: "grooming",
  SelfHarm: "self_harm",
  SuicidalIdeation: "suicidal_ideation",
  SexualExploitation: "sexual_exploitation",
  Bullying: "bullying",
  CompanionDependency: "companion_dependency",
  AIMediatedGrooming: "ai_mediated_grooming",
} as const;
export type HarmClass = (typeof HarmClass)[keyof typeof HarmClass];

// §4.2.2 — registry vs vendor judgment label.
export const TierLabel = { Registry: "registry", Vendor: "vendor" } as const;
export type TierLabel = (typeof TierLabel)[keyof typeof TierLabel];

// §4.2.2 — typed payload class.
export const EnvelopeType = {
  AgeAssertion: "age_assertion",
  ConsentAttestation: "consent_attestation",
  ConsentWithdrawn: "consent_withdrawn",
  AbuseSignal: "abuse_signal",
  EnforcementProfile: "enforcement_profile",
  Directive: "directive",
  AuditAttestation: "audit_attestation",
} as const;
export type EnvelopeType = (typeof EnvelopeType)[keyof typeof EnvelopeType];
