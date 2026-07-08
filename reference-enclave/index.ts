import type { EnclaveUnderTest, ClassifyInput, ClassifyOutput, UpstreamAttestation } from "../src/contract/enclave.js";
import { buildMinimization } from "../src/merkle.js";
import { SUITE_VERSION } from "../src/assertions/registry.js";
import { vocab } from "../src/crypto-adapter.js";
import { createHash } from "node:crypto";

const BUILD_HASH = "ref-" + createHash("sha256").update("ocss-reference-enclave-v0").digest("hex").slice(0, 16);

class ReferenceEnclave implements EnclaveUnderTest {
  private attestationValid = true;

  buildInfo() {
    return { build_hash: BUILD_HASH, suite_version: SUITE_VERSION };
  }

  setUpstreamAttestation(state: UpstreamAttestation | "invalid" | "expired"): void {
    this.attestationValid = state === "expired" || state === "invalid" ? false : (state as UpstreamAttestation).valid;
  }

  async classify(input: ClassifyInput): Promise<ClassifyOutput> {
    // A7: fail-closed BEFORE touching content.
    if (!this.attestationValid) return { kind: "suspended", reason: "upstream attestation invalid" };

    // A1: closed-enum fail-closed.
    const harm = input.declared_harm_class ?? classifyContent(input.content);
    if (!(Object.values(vocab.HarmClass) as string[]).includes(harm)) {
      return { kind: "rejected", code: "harm_class_out_of_enum", reason: `unknown harm_class: ${harm}` };
    }

    // A2: census-bound inner is content-free (NO payload). A5: minimization over content-derived fields.
    const minimization = buildMinimization([harm, "severity:moderate", `len:${input.content.length}`]);
    const envelope = {
      outer: {
        ocss_version: "4",
        intermediary_audience: "did:ocss:phosra-router",
        issued_at: new Date(0).toISOString(),
        nonce: "ref-nonce",
        resource: "ocss-provider-harness/v0",
        sender_signature: "ed25519:reference",
      },
      inner: {
        receiver: "did:ocss:phosra-router",
        envelope_type: vocab.EnvelopeType.AbuseSignal,
        harm_class: harm,
        tier_label: vocab.TierLabel.Vendor,
        family_hash: createHash("sha256").update("family:" + (input.recipient_did ?? "anon")).digest("hex"),
      },
    } as any;
    return { kind: "signal", envelope, minimization };
  }
}

function classifyContent(content: string): string {
  return /\bself harm\b/i.test(content) ? vocab.HarmClass.SelfHarm : vocab.HarmClass.Grooming;
}

export function makeReferenceEnclave(): EnclaveUnderTest {
  return new ReferenceEnclave();
}
