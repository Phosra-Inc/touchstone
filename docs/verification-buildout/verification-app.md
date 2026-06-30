# The verification app (`@openchildsafety/provider-harness`) — what to build

**Your role in the verification process:** this app is **the conformance harness and the
verifying-agency's tooling** — the independent checker. Crucially, **you do not build the
infrastructure; you build the probes that test it.** A3, A4, A6 each become a new assertion the
moment OCSS defines the interface and Phosra (or any implementer) ships it. A1, A2, A5, A7 are
already done and shipping; everything below is *additive* to the existing harness
(`src/assertions/`, `src/probe.ts`, `reference-enclave/`, `src/attestation/`).

> **OCSS defines the format → Phosra builds it → you add the probe + a mutant + a reference-enclave
> behavior → an independent verifying-agency runs you and signs the attestation.**

Each probe follows the harness's established pattern (the **anti-theater bar**): a pure
`(enclave) => ProbeResult`, proven to **pass** against the reference enclave **and fail** against a
deliberately-broken mutant. You also own the `EnclaveUnderTest` contract that providers code to — so
extending that contract is your call, to be ratified into OCSS as the provider-conformance interface.

---

## A3 — Sealed-to-consent-recipient only

**Wait for:** OCSS's consent-recipient binding format; Phosra's enclave sealing to it.

**What the harness builds:**
1. **Contract extension** (`src/contract/enclave.ts`): add a consent path — e.g.
   `classify(input)` gains a `consent_recipient?: { did: string; key: JWK }`, and a `"signal"`
   output may carry a `sealed_payload` (the `JWE:` string). Today the reference enclave deliberately
   emits **no** payload (A2 content-free); A3 introduces the *consented* case where a payload IS
   sealed — to the recipient only.
2. **The A3 probe** (`src/assertions/a3-sealed-consent.ts`): feed content + a consent recipient,
   take the emitted sealed payload, and use `@ocss/ts` `open`/`seal` (already available via the
   crypto seam) to assert: it **opens with the consent recipient's key** (pass); it **does NOT open**
   as the census/router or with a non-recipient key (pass); and no plaintext rides the census lane.
3. **Reference enclave** (`reference-enclave/`): implement correct A3 — seal the payload to the
   provided consent recipient via `seal`.
4. **Mutant** (`test/helpers/mutants.ts`): `mutantA3SealsToCensus` (or to a wrong key) → the probe
   must **fail** it. Plus the reference-passes test.
5. **Registry** (`src/assertions/registry.ts`): flip A3 `pending → passable`.

**Done when:** A3 passes vs the reference enclave and fails vs the mutant; `runSuite` reports 5 of 7.

---

## A4 — Parent-sole-control + visible `monitoring_active`

**Wait for:** OCSS's capability-document schema; Phosra's capability endpoint.

**What the harness builds:**
1. **Contract extension:** add `capabilities(): CapabilityDoc` to `EnclaveUnderTest` (returning
   `{ monitoring_active, monitoring_visible, control_holder }`), matching the OCSS schema.
2. **The A4 probe** (`src/assertions/a4-capability.ts`): assert the capability document declares
   `monitoring_active` **and** that it is marked visible, and that `control_holder` is the authority
   holder (sole control). If OCSS makes the doc signed, verify the signature via the crypto seam.
3. **Reference enclave:** return a conformant capability doc.
4. **Mutant:** `mutantA4HidesMonitoring` (monitoring on but `monitoring_active` absent/false, or a
   non-parent control holder) → probe **fails**.
5. **Registry:** A4 `pending → passable`.

**Done when:** A4 discriminates (reference passes, mutant fails); suite reports 6 of 7.

---

## A6 — Abuse-at-home → independent-advocate routing

**Wait for:** OCSS's advocate-lane recipient type + routing rule (governance-gated); Phosra's routing
implementation.

**What the harness builds:**
1. **Contract / scenario extension:** drive an abuse-at-home case — the enclave is given an
   abuse-at-home signal and an advocate recipient (DID + key), and the `"signal"` output must seal
   to the advocate.
2. **The A6 probe** (`src/assertions/a6-advocate-routing.ts`): assert the emitted signal seals to
   the **advocate** recipient (opens with the advocate key) and **not** to the authority holder
   (parent) — the safety-critical check.
3. **Reference enclave:** route abuse-at-home to the advocate.
4. **Mutant:** `mutantA6RoutesToParent` → probe **fails** (this mutant is the most important to get
   right — a false pass here is a real-world safety failure).
5. **Registry:** A6 `pending → passable`.

**Done when:** A6 discriminates; suite reports **7 of 7** — full conformance coverage.

---

## Live-registry binding — make `verify` check the *real* Trust List

This is the harness's own most important non-assertion task, and it depends only on Phosra adding
the role (OCSS defining it). Today `src/attestation/verify.ts` checks attestations against a
**fixture** Trust-List shape (`{document, sig, key_id}` with a `role` field on entries) minted by
`test/helpers/fixture-trustlist.ts`.

**What the harness builds:**
1. **Consume the live `@ocss/ts` Trust List.** Once the census serves role-tagged entries, switch
   `verify` to fetch `/.well-known/ocss/trust-list`, validate it with `@ocss/ts` `verifyDocument` +
   `Resolver` (these exist in `@ocss/ts`; re-expose them through the crypto seam — they were dropped
   in the publish inline as unused), and read `role` off the resolved entry.
2. **Keep all five gates** against the real wire form: signature · signer holds a valid
   `verifying-agency` entry at `passed_at` · 7-day TTL · conflict-of-interest · liability-scope
   present. The fixture path stays for offline tests; the live path is the new default for the CLI
   `verify --trust-list <census-url>`.
3. **A reconciliation/parity test** asserting the harness reads the real `SignedDocument`/`Entry`
   identically to `@ocss/ts`, so the harness can't drift from the census.

**Independence (not a code task, but yours to honor):** this app is the **tooling**; the
**verifying-agency entity that runs it must be a party Phosra does not control.** When you wire the
live path, the operator identity + key belong to that independent verifier, not Phosra — that is the
whole reason the attestation is worth anything.

**Done when:** `ocss-harness verify` validates a real attestation against the live census Trust List,
all five gates, no fixtures.

---

## Sequencing for the verification app

1. **Live-registry `verify`** — do this first *when Phosra ships the census role*; it makes the four
   *already-passing* assertions produce attestations that verify against the real registry. Biggest
   value, and it's mostly re-exposing `@ocss/ts` you already vendor.
2. **A3**, then **A4** — each is one probe + one mutant + one reference behavior + a registry flip,
   following the exact A1/A2/A5/A7 pattern already in the repo.
3. **A6 last** — gated on OCSS's advocacy governance; build it carefully, and make the
   routes-to-parent mutant airtight (a false pass is a safety failure, not just a bug).

**Reminder:** none of these are infrastructure you operate — they are probes against infrastructure
OCSS specs and Phosra (or other vendors) build. The harness stays a verifier, not a builder.
