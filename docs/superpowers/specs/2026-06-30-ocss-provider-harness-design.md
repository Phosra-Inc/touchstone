# OCSS Provider Harness — Design

**Date:** 2026-06-30
**Status:** Approved design, pending implementation plan
**Repo:** `~/builds/ocss-provider-harness` (standalone — outside the Phosra monorepo)
**Package:** `@ocss/provider-harness` · CLI bin `ocss-harness`

---

## 1. Summary

An independent **OCSS conformance harness**: a TypeScript library + CLI that a
**verifying-agency** (the reference one is named **Touchstone**, `did:ocss:touchstone`) runs
against a classifier provider's enclave to attest the enclave
behaves as the OCSS standard requires. It defines the provider-conformance **contract**,
ships a correct **reference enclave**, executes the **behavioral assertions** A1/A2/A5/A7
(the four passable today), declares A3/A4/A6 as `pending`, and assembles a
`conformance_attestation` document that a verifying-agency signs with its own Ed25519 key
and that anyone can verify against the OCSS Trust List.

This implements the **OCSS Verifying-Agency** responsibilities (the role spec this design
is built from): evaluate the enclave against the conformance suite (resp. #1), produce the
signed attestation (#2), check the signer holds a valid `verifying-agency` Trust-List entry
(#3), support the 7-day TTL renewal model (#4), and retain evidence for after-the-fact audit
(#8).

### Independence is the design's organizing principle

Per the spec's **WebPKI / Certificate-Authority model**, a verifying-agency's attestation is
only meaningful if it is signed by a party Phosra does **not** control. Phosra **cannot serve
as the verifying-agency for its own provider partners**. So this harness is built as **its own
entity**:

- its **own top-level folder / git repo**, outside the Phosra monorepo;
- its **own package identity** and **own verifying-agency Ed25519 key**;
- its **own attestation output**, verifiable independently against the Trust List.

Phosra and its provider partners are **consumers**: they implement provider enclaves that get
verified *by* this harness. `docs.phosra.com` and `openchildsafety.com` *link to / reference*
it; they do not own it.

**Naming note (deliberate deviation from the role spec).** The role spec names the suite
`@phosra/provider-harness`. Because the verifier must be independent of Phosra, this design
publishes it as the OCSS-neutral **`@ocss/provider-harness`**. The npm scope is the only change;
the suite, assertions, and attestation grammar are unchanged. This tension is called out so the
choice is explicit rather than silent.

---

## 2. Scope

### In scope (this build)

- The provider-conformance **contract** (`EnclaveUnderTest`).
- A correct **reference enclave** implementing the contract.
- The four passable **assertions** as discriminating probes: **A1, A2, A5, A7**.
- A3/A4/A6 declared in the registry as `pending` with machine-readable reasons (not executed).
- The **CLI** `ocss-harness` with `run` / `attest` / `sign` / `verify`.
- The `conformance_attestation` **build / sign / verify** lifecycle, reusing `@ocss/ts` crypto.
- A human-readable **markdown report**.
- **TDD** test suite: every green probe proven to pass against the reference enclave **and**
  fail against a deliberately-broken ("mutant") enclave.

### Out of scope (explicit, follow-on)

- Implementing A3/A4/A6 probes (blocked on consent infra, a capability endpoint, and the
  advocate lane — none built yet).
- Surfacing the harness on `docs.phosra.com` / `openchildsafety.com` (a thin follow-on once the
  signed artifact exists).
- A verifying-agency review **console/dashboard** UI.
- Wiring the harness to the live sandbox sims as enclaves-under-test (a clean follow-on enabled
  by the contract; the reference enclave is the day-one target).
- Adding a `verifying-agency` **role/key to the Go census** `identity.go` (governance step;
  the harness signs with a VA key it owns, and `verify` checks the Trust List as published).

---

## 3. The conformance suite (assertions)

The suite is a set of **behavioral assertions**, not a paperwork review. Today the suite passes
**4 of 7**; A3/A4/A6 depend on infrastructure not yet built, so an honest attestation is scoped
to the four passing assertions with `assertions_pending: ["a3","a4","a6"]`.

| ID | Assertion | Probe (what the harness does → asserts) | Status |
|---|---|---|---|
| **A1** | Closed-enum fail-closed | `classify` with an **out-of-enum `harm_class`** (not in `vocab.HarmClass`) → assert `kind:"rejected"` and **no signal emitted**. | green |
| **A2** | Content-free signal lane | `classify` sensitive content → inspect the **census/router-bound envelope**; assert it carries only content-free fields (harm_class, severity, tier_label, family_hash) and **no plaintext and no JWE the census could open** (router stays content-blind). | green |
| **A5** | Minimization attestation wired | Assert `minimization` is **salted-HMAC Merkle leaves**: recompute the Merkle root from the leaves and assert equality; assert leaves are HMAC'd (high-entropy), not brute-forceable raw hashes. | green |
| **A7** | Attestation-fail → suspend | `setUpstreamAttestation("invalid")` then `classify` → assert `kind:"suspended"`, **no content read, no signal** (fail-closed *before* content). | green |
| **A3** | Sealed-to-consent-recipient only | — | `pending` (needs consent infra) |
| **A4** | Parent-sole-control + visible `monitoring_active` | — | `pending` (needs capability endpoint) |
| **A6** | Abuse-at-home → independent-advocate routing | — | `pending` (advocate lane not built) |

### The anti-theater bar

A probe that cannot fail is worthless. **Every green assertion ships with two tests:** the
reference enclave makes it `pass`, and at least one **mutant enclave** makes it `fail`. Mutant
examples, one per assertion:

- **A1 mutant:** passes the bogus harm class through / coerces it to a valid one.
- **A2 mutant:** stuffs the content excerpt into the inner payload bound for the census.
- **A5 mutant:** emits raw `sha256(field)` leaves (brute-forceable) or a root that doesn't recompute.
- **A7 mutant:** reads content / emits a degraded signal after the attestation failure.

---

## 4. The contract — `EnclaveUnderTest`

The minimal interface a provider enclave must expose to be probed. The reference enclave
implements it correctly; real providers implement it to be verified.

```ts
interface EnclaveUnderTest {
  buildInfo(): { build_hash: string; suite_version: string };
  classify(input: ClassifyInput): Promise<ClassifyOutput>;
  setUpstreamAttestation(state: UpstreamAttestation | "invalid" | "expired"): void; // drives A7
}

type ClassifyInput = {
  content: string;               // test content the enclave classifies
  declared_harm_class?: string;  // A1: harness injects an out-of-enum class here
  recipient_did?: string;        // A2: the consent recipient / census audience context
};

type ClassifyOutput =
  | { kind: "signal";    envelope: Envelope; minimization: MinimizationAttestation }
  | { kind: "rejected";  code: string; reason: string }   // fail-closed (A1)
  | { kind: "suspended"; reason: string };                // fail-closed before content (A7)

interface MinimizationAttestation {
  merkle_root: string;        // hex
  leaves: string[];           // each = HMAC(salt, canonical(field)) — salted, high-entropy
  salt_commitment: string;    // commitment to the salt (salt itself never emitted)
  alg: "hmac-sha256+merkle";
}
```

`Envelope` (`{ outer, inner }`), `seal`/`open`, `validate`, and `signSender`/`verifySender`
come from `@ocss/ts`, so the reference enclave emits **real** OCSS envelopes and the probes
verify them with the same spec-tested code the rest of OCSS uses.

---

## 5. Attestation lifecycle

### CLI flow

```
ocss-harness run    --enclave <ref> --suite-version v0 --build-hash <h>   # probe → ProbeResults → report
ocss-harness attest …                                                      # + assemble UNSIGNED attestation JSON
ocss-harness sign   --key <va-ed25519.pem> --attested-by <did> att.json    # VA signs (deliberate, separate)
ocss-harness verify --trust-list <url|file> signed-att.json                # sig + signer + TTL + COI gates
```

`sign` is **deliberately separate** from `run`/`attest` — signing is the verifying-agency's
act, not an automatic harness output. This respects the **liability boundary**: the attestation
certifies behavioral conformance *at test time*, against a *declared suite version*, under a
*specific build hash* — nothing about production behavior, downstream harm, or completeness of
the suite.

### Document shape

Follows the role spec's field table, the codebase's **D-9 signing grammar** (`key_id`/`sig`
ride *outside* the signed bytes), and the spec requirement that the **liability scope be
referenced inside the document itself**:

```json
{
  "attested_by": "did:ocss:<va>",
  "suite_version": "ocss-provider-harness/v0",
  "build_hash": "<enclave build>",
  "passed_at": "2026-06-30T00:00:00Z",
  "assertions_passed":  ["a1","a2","a5","a7"],
  "assertions_pending": ["a3","a4","a6"],
  "liability_scope_ref": "<written-scope URL/ref, REQUIRED inside the doc>",
  "spec": "ocss-provider-harness/v0",
  "key_id": "<va key id>",          // outside signed bytes (D-9)
  "sig": "ed25519:<...>"            // over canon({all fields except key_id,sig})
}
```

### `verify` gates (all four, reusing `@ocss/ts` `verifyDocument` + `Resolver`)

1. **Signature valid** over the canonical bytes.
2. **Signer authority:** the `attested_by` DID holds a `role: "verifying-agency"` Trust-List
   entry that was valid at `passed_at` (signing time).
3. **TTL:** the entry's 7-day TTL has not expired (the spec's revocation mechanism — passive
   expiry; no CRL).
4. **Conflict-of-interest:** the signer does **not** also hold a `classifier-accredited` entry
   (a verifier may not accredit a service it operates).

### Evidence retention

Each probe yields `ProbeResult = { assertion_id, verdict: pass|fail|error, detail, evidence }`,
persisted alongside the attestation so it can be audited after the fact (resp. #8). A failed or
errored probe is **itself a recorded result, never silence** (mirrors the census §8.3.4
"a failed/skipped run is a signed entry" principle).

---

## 6. Architecture & repo layout

```
~/builds/ocss-provider-harness/                its own git repo
├── package.json              @ocss/provider-harness · bin ocss-harness · dep @ocss/ts via vendor tarball
├── tsconfig.json  vitest.config.ts  README.md
├── vendor/ocss-ts-0.0.0.tgz  npm-pack of packages/ocss-ts (spec-tested crypto, no re-impl)
├── scripts/refresh-ocss-ts.sh  re-pack from the monorepo (documented drift control)
├── src/
│   ├── crypto-adapter.ts     the ONLY importer of @ocss/ts (single seam: canon, ed25519Sign,
│   │                         verifyDocument, Resolver, seal/open, envelope sign/verify, vocab)
│   ├── contract/enclave.ts   EnclaveUnderTest + ClassifyInput/Output + MinimizationAttestation
│   ├── assertions/
│   │   ├── registry.ts       A1..A7 catalog: id, title, status(passable|pending), pending reason
│   │   ├── a1-closed-enum.ts
│   │   ├── a2-content-free.ts
│   │   ├── a5-minimization.ts
│   │   └── a7-attestation-suspend.ts
│   ├── probe.ts              ProbeResult type + runAssertion(enclave, assertion)
│   ├── suite.ts              runSuite(enclave, opts) → ProbeResult[]
│   ├── attestation/
│   │   ├── build.ts          ProbeResult[] → unsigned conformance_attestation
│   │   ├── sign.ts           sign(doc, vaKey) — D-9 grammar via crypto-adapter
│   │   └── verify.ts         verify(signedDoc, trustList) — the 4 gates
│   ├── report.ts             markdown report from ProbeResult[]
│   └── cli.ts                ocss-harness entrypoint (run|attest|sign|verify)
├── reference-enclave/index.ts   correct EnclaveUnderTest (makes A1/A2/A5/A7 pass)
└── test/
    ├── a1.test.ts … a7.test.ts   reference-passes + mutant-fails per green assertion
    ├── attestation.test.ts        build→sign→verify round-trip; tampered→reject; expired-TTL→reject;
    │                              non-VA-signer→reject; COI→reject
    ├── pending.test.ts            A3/A4/A6 surface as pending, excluded from assertions_passed
    └── mutants/                   deliberately-broken enclaves
```

### Design rules

- **Each assertion is a pure** `(enclave) => Promise<ProbeResult>` — independently testable, no
  shared state, holds in one mental frame.
- **`crypto-adapter.ts` is the lone seam** to `@ocss/ts`. A version bump or a future full
  vendoring touches exactly one file.
- **`@ocss/ts` is consumed as a `vendor/*.tgz`** (`npm pack` of `packages/ocss-ts`), not
  source-copied — the repo stays standalone *and* reuses the exact, golden-vector-pinned crypto.
  `scripts/refresh-ocss-ts.sh` re-packs it when the monorepo crypto changes (drift is explicit
  and controlled, never silent).
- **Fail-closed everywhere:** if a probe cannot determine `pass`, the verdict is not `pass`.

---

## 7. Testing strategy (TDD)

- vitest, red → green → refactor per assertion.
- **Per green assertion:** (1) reference enclave → `pass`; (2) ≥1 mutant enclave → `fail`. This
  proves the probe **discriminates** — the anti-theater bar.
- **Attestation:** build→sign→verify round-trip passes; tampered signature → rejected; signer
  not a valid `verifying-agency` entry → rejected; TTL expired → rejected; signer also
  `classifier-accredited` (COI) → rejected.
- **Pending:** A3/A4/A6 surface as `pending` with reasons and are excluded from
  `assertions_passed`.
- **Done bar:** `npm run typecheck && npm test` green.

---

## 8. Liability boundary (carried into the artifact)

The attestation certifies **behavioral conformance at test time**, against a **declared suite
version**, under a **specific build hash**. It does **not** warrant continued production behavior,
absence of downstream harm, or that the suite covers every failure mode. This scope MUST be
explicit, in writing, and referenced inside the `conformance_attestation` via
`liability_scope_ref` — `verify` treats a missing `liability_scope_ref` as a malformed document.

---

## 9. Open items for the implementation plan

- Confirm the exact closed `HarmClass` set exported by `@ocss/ts` `vocab` and pick the A1
  out-of-enum probe value.
- Confirm whether `@ocss/ts` exposes a Merkle/HMAC helper; if not, implement a minimal
  `merkle.ts` inside the harness (salted-HMAC leaves → root) and unit-test it directly.
- Decide the `verifying-agency` Trust-List entry shape used by `verify` (the role/field the
  resolver keys on) and whether a fixture Trust List is bundled for tests.
- Confirm `packages/ocss-ts` packs cleanly with only its `jose` runtime dependency (it should —
  `private:true` does not block `npm pack`; `files:["dist"]` ships the built output).
