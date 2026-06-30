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

## Where parental-control apps and enforced platforms fit

Two real-world actor classes sit on either side of every probe you write, and naming them sharpens
what the enclave-under-test actually *is* and what scenarios it has to survive.

**The parental-control app (PCA) is the verified enclave.** On openchildsafety.com — the neutral
public OCSS standard site — the "**parental-control app**" is the parent-chosen client. In OCSS terms
a PCA is a **TPSSP** mapping to the **Verifier/Receiver** role: it holds the EC P-256 payload private
key and is the *sole* party that can decrypt a sealed inner `JWE:`. The `EnclaveUnderTest` you already
own is, concretely, a PCA enclave. Vendors differ by `ocss_role`, and that range is exactly the
scenario space your probes must cover: **Qustodio** (device-side enforcement runner), **Bark**
(monitoring/alert source + light enforcement), **BrightCanary** (monitoring/alert *only* — the
narrowest, an iOS keyboard extension), **Aura** (enforcement runner + monitoring source — the
broadest; its identity/financial axis is out of OCSS scope), **Qoria/Linewize** (institutional
district authority that routes safeguarding alerts to a Designated Safeguarding Lead). A PCA is
**not** the intermediary (that is Phosra's census/relay), **not** the Issuer (Apple/mDL), **not** the
Gatekeeper (the platforms). Caveat to honor: there is **no `enforcement_agent_role` on the Trust List
yet** — the #1 P0 gap — so a PCA is today an *untagged* consumer of enforcement profiles. Your probes
assert enclave *behavior*; they cannot yet assert a role tag on the PCA the way `verify` asserts one
on a verifying-agency.

**Platforms (Roblox, Netflix, Snapchat) are signal sources and enforcement *targets*, never
enforcement *surfaces*.** The five normative surfaces stay **DNS · MDM · Router · OS · App**; a
platform is never one of them. A platform is a **Gatekeeper** and/or an **expose-only**
distribution-lane participant — it exposes native state (age APIs, household hierarchies) and does not
call OCSS endpoints. Controls reach a platform through the **App** surface: Phosra's Router compiles
the parent's policy into a signed `EnvelopeEnforcementProfile`, the surface polls
`GET /api/v1/enforcement-profiles/{endpoint_id}` (documented on docs.phosra.com — Phosra's Mintlify
developer portal for its *commercial OCSS implementation*, "Phosra implements OCSS; it does not own
it" — not an OCSS endpoint of its own and not a design catalog), and the Gatekeeper enforces the
compiled `allow|warn|block` locally: **decision parity, never mechanism or UI parity**. For *your* purposes the load-bearing platform behavior is the **EMIT
lane**: a platform may originate a session-scoped `abuse_signal` (§10.6, the Snapchat / `loopline`
shape) or an age signal (§10.4, the Roblox / `blockfort` shape), **sealed to the PCA's key** — which
is exactly an A3/A6 input. Streaming platforms (`marquee` / `hearthdeck`, the Netflix shape) are
`expose-only` and rarely emit.

**What this means for the harness:** every probe below is fed in **two shapes** — a *PCA-shaped*
scenario (the enclave is the consent recipient / monitoring party / advocate router) **and** a
*platform-emitter* scenario (a Gatekeeper EMITs a sealed signal the enclave must handle). The mutant
and reference behavior cover both shapes. You stay a verifier of *decisions on the wire*, not of any
platform's UI.

---

## A3 — Sealed-to-consent-recipient only

**Wait for:** OCSS's consent-recipient binding format (the consent record extended to name the
recipient DID + sealing key); Phosra's enclave sealing to it.

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

**PCA + platform lens:**
- *PCA (the consent-recipient seat):* the enclave under test *is* the consent recipient. A
  `harm_context` / `abuse_signal` must seal to the **PCA's payload key only** — never the router or
  census (the router-blind invariant; the census forwards ciphertext verbatim and MUST-NEVER decrypt
  in transit). Shape the A3 fixture as a real PCA recipient — a **Bark**- or **Aura**-style provider
  with its own DID + P-256 key — and ride the seal on the `consent_attestation` (§8.3.2), whose
  `app_ref` scopes standing to exactly one platform. OCSS still has to name the recipient DID +
  sealing key in the consent record explicitly; until it does, the probe pins the binding the spec
  will codify.
- *Platform emitter:* add a second pass where a Gatekeeper EMITs (the §10.6 Snapchat / `loopline`
  shape) — it must seal to the **named TPSSP's key, not the relay**. Same assertion, different origin.
- *Mutant variants:* keep `mutantA3SealsToCensus`; add a platform variant that seals to the EMIT-lane
  relay (the Gatekeeper's own key) instead of the PCA. Both must **fail**.

**Done when:** A3 passes vs the reference enclave and fails vs the mutant; `runSuite` reports 5 of 7.

---

## A4 — Parent-sole-control + visible `monitoring_active`

**Wait for:** OCSS's capability-document schema (the *runtime* capability doc, not the static
manifest); Phosra's capability endpoint.

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

**PCA + platform lens:**
- *PCA (the monitoring party):* A4 is OCSS's answer to the covert-monitoring risk **intrinsic to
  every PCA** — here the enclave under test *is* the watcher. The runtime capability document must
  carry `monitoring_active=true`, mark it **visible to the child**, and set `control_holder` to the
  authority-holder DID with **authority-holder-only** toggle control (the parent, or in an
  institutional deployment the institution / DSL — not always a home parent). Shape fixtures across the range:
  **BrightCanary** (monitor-*only*, an iOS keyboard extension — the case where covert capture is most
  tempting and visibility matters most), **Bark** / **Aura** (monitoring sources that also enforce).
  The static §5.3 `CapabilityManifests` are the analog OCSS has today; the *runtime* capability doc
  A4 needs does not exist yet, so the probe defines its shape.
- *Platform:* the indicator lands on the **App** surface — the platform or the on-device PCA must
  surface it; a platform that monitors silently fails the same way a covert PCA does.
- *Mutant:* keep `mutantA4HidesMonitoring`; a BrightCanary-style "capture-but-don't-disclose" enclave
  (monitoring on, `monitoring_active` hidden) is the natural shape to encode.

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

**PCA + platform lens:**
- *PCA (guardian-is-abuser):* the sharpest PCA case. Normally **every** alert goes to the parent;
  when the guardian *is* the implicated party the signal MUST seal to an **independent advocate, not
  the parent**. The institutional archetype is **Qoria/Linewize**, which already routes safeguarding
  alerts to a **Designated Safeguarding Lead** rather than the household — model the advocate
  recipient on that **for the home-guardian case**. But cover the edge: when the institution / DSL is
  *itself* the implicated authority-holder, the advocate must be **independent of the institution**,
  so the fixture set includes both an institution-as-advocate and an institution-as-abuser shape.
  Who qualifies as an advocate is **OCSS + advocacy-partner governed, never
  Phosra-owned**; the probe encodes the *routing*, not the eligibility.
- *No-veto:* the abuse-at-home emit rides a **no-veto** clause — the implicated authority-holder
  cannot suppress it. That is a probe angle you own: add a mutant where the implicated party
  vetoes/suppresses the abuse-at-home signal (drops it, or swallows it instead of routing) — it must
  **fail**.
- *Platform (platform-agnostic):* drive the abuse-at-home case from multiple emitters — Snapchat /
  `loopline`, Roblox / `blockfort`, a messaging platform — because they **share one `AbuseSignal`
  envelope**, so the routing branch is platform-agnostic. Proving the same advocate-seal across
  emitters is the point.
- *Mutant:* `mutantA6RoutesToParent` is the most safety-critical mutant in the suite, and the
  guardian-is-abuser fixture is where a false pass becomes a **real-world safety failure** — keep it
  airtight across every emitter shape.

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

**PCA + platform lens:**
- The **conflict-of-interest** gate is what stops Phosra from being the verifying-agency for its
  **own provider partners** — including the PCA vendors (an **Aura** or a **Bark** enclave) it builds
  the census and `@phosra/link` enclave for. This is the CA model openchildsafety.com names: the
  steward cannot certify its own partners. A `verifying-agency` MUST NOT also hold
  `classifier-accredited` status, on a 7-day TTL.
- Forward dependency: because there is **no `enforcement_agent_role` yet**, the live Trust List cannot
  today role-tag the PCAs whose enclaves you verify — `verify` reads `role` for the verifying-agency
  entry only. When OCSS lands that role, the same `verifyDocument` + `Resolver` path extends to it
  with no new crypto.

**Independence (not a code task, but yours to honor):** this app is the **tooling**; the
**verifying-agency entity that runs it must be a party Phosra does not control** — and, for the same
reason, not the PCA vendor verifying its own enclave. When you wire the live path, the operator
identity + key belong to that independent verifier, not Phosra and not the provider under test — that
is the whole reason the attestation is worth anything.

**Done when:** `ocss-harness verify` validates a real attestation against the live census Trust List,
all five gates, no fixtures.

---

## Sequencing for the verification app

1. **Live-registry `verify`** — do this first *when Phosra ships the census role*; it makes the four
   *already-passing* assertions produce attestations that verify against the real registry. Biggest
   value, and it's mostly re-exposing `@ocss/ts` you already vendor.
2. **A3**, then **A4** — each is one probe + one mutant + one reference behavior + a registry flip,
   following the exact A1/A2/A5/A7 pattern already in the repo — now each carries the **PCA-recipient
   and platform-emitter fixtures** from the framing section (Bark/Aura recipient for A3; the
   BrightCanary covert-monitoring shape for A4).
3. **A6 last** — gated on OCSS's advocacy governance; build it carefully, model the advocate on the
   Qoria/Linewize Designated-Safeguarding-Lead route for the home-guardian case (and an
   institution-independent advocate when the institution itself is implicated), and make the
   routes-to-parent and no-veto/suppression mutants airtight across every emitter shape (a false pass
   is a safety failure, not just a bug).

**Reminder:** none of these are infrastructure you operate — they are probes against infrastructure
OCSS specs and Phosra (or other vendors) build. PCAs are the enclaves you verify and platforms are
the emitters you feed; the harness stays a verifier, not a builder.
