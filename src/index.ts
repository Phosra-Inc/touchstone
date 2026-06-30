// Public API of @ocss/provider-harness.
export type { EnclaveUnderTest, ClassifyInput, ClassifyOutput, MinimizationAttestation, UpstreamAttestation, Envelope } from "./contract/enclave.js";
export { ASSERTIONS, type AssertionMeta } from "./assertions/registry.js";
export { makeReferenceEnclave } from "../reference-enclave/index.js";
export { runSuite } from "./suite.js";
export { renderReport } from "./report.js";
export type { ProbeResult, Probe } from "./probe.js";
export { runAssertion } from "./probe.js";
export { buildAttestation, type UnsignedAttestation, type AttestationMeta } from "./attestation/build.js";
export { signAttestation, signingBytes, type SignedAttestation } from "./attestation/sign.js";
export { verifyAttestation, VerifyError } from "./attestation/verify.js";
