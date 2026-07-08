// Public API of @ocss/provider-harness.
export type { EnclaveUnderTest, ClassifyInput, ClassifyOutput, MinimizationAttestation, UpstreamAttestation, Envelope } from "./contract/enclave.js";
export type { PlatformOAuthUnderTest, PlatformOAuthConfig, OAuthTestAccount, OAuthTestAccountName } from "./contract/platform-oauth.js";
export { ASSERTIONS, SUITE_VERSION, type AssertionMeta } from "./assertions/registry.js";
export { makeReferenceEnclave } from "../reference-enclave/index.js";
export { makeLiveEnclave, normalizeEnclaveUrl, type LiveEnclaveOptions } from "./live-enclave.js";
export { makeLivePlatformOAuth, validatePlatformOAuthConfig, type LivePlatformOAuthOptions } from "./live-platform-oauth.js";
export { runSuite, type SuiteTargets } from "./suite.js";
export { renderReport } from "./report.js";
export type { ProbeResult, Probe } from "./probe.js";
export { a8ProfilesChildOnly, type PlatformProbe } from "./assertions/a8-profiles-child-only.js";
export { runAssertion } from "./probe.js";
export { buildAttestation, type UnsignedAttestation, type AttestationMeta } from "./attestation/build.js";
export { signAttestation, signingBytes, type SignedAttestation } from "./attestation/sign.js";
export { verifyAttestation, VerifyError } from "./attestation/verify.js";
