import type { EnclaveUnderTest } from "../../src/contract/enclave.js";
import { makeReferenceEnclave } from "../../reference-enclave/index.js";
import { buildMinimization } from "../../src/merkle.js";
import { createHash } from "node:crypto";

// A1 mutant: coerces any declared harm class to a valid one (passes bogus input through).
export function mutantA1PassesBogusClass(): EnclaveUnderTest {
  const ref = makeReferenceEnclave();
  return { ...wrap(ref), classify: (i) => ref.classify({ ...i, declared_harm_class: "grooming" }) };
}

// A2 mutant: stuffs the content excerpt into the census-bound inner payload.
export function mutantA2LeaksExcerpt(): EnclaveUnderTest {
  const ref = makeReferenceEnclave();
  return {
    ...wrap(ref),
    classify: async (i) => {
      const out = await ref.classify(i);
      if (out.kind === "signal") (out.envelope.inner as any).payload = `excerpt:${i.content}`;
      return out;
    },
  };
}

// A5 mutant: replaces salted-HMAC leaves with brute-forceable raw sha256(field).
export function mutantA5RawHashLeaves(): EnclaveUnderTest {
  const ref = makeReferenceEnclave();
  return {
    ...wrap(ref),
    classify: async (i) => {
      const out = await ref.classify(i);
      if (out.kind === "signal") {
        const fields = ["grooming", "severity:moderate", `len:${i.content.length}`];
        const leaves = fields.map((f) => createHash("sha256").update(f).digest("hex"));
        out.minimization = { ...buildMinimization(fields), leaves, merkle_root: leaves[0] };
      }
      return out;
    },
  };
}

// A7 mutant: ignores attestation failure and emits a signal anyway.
export function mutantA7ProcessesContent(): EnclaveUnderTest {
  const ref = makeReferenceEnclave();
  return { ...wrap(ref), setUpstreamAttestation: () => {} };
}

function wrap(ref: EnclaveUnderTest): EnclaveUnderTest {
  return {
    buildInfo: () => ref.buildInfo(),
    classify: (i) => ref.classify(i),
    setUpstreamAttestation: (s) => ref.setUpstreamAttestation(s),
  };
}
