# Phosra — what to build for provider-enclave verification

**Your role in the verification process:** Phosra is **the reference implementer and the census
operator** — you build the running pieces an enclave needs to *pass* the suite, and you operate the
census/Trust List that admits accredited providers. You are one implementer among (eventually) many;
the contract you build to is OCSS's, and the party that *checks* you is an independent
verifying-agency running the harness.

> **OCSS defines the format → you build it in the census + the enclave/SDK → the harness probes it
> → an independent verifying-agency signs the attestation.**

For each item below, the **OCSS prerequisite** is named first (you can prototype against a draft,
but the wire form is OCSS's to freeze), then **your build**, then how the **harness** will verify
it. A1, A2, A5, A7 already pass against what you've shipped — these three (A3, A4, A6) plus the
census role are what remain. What's new in this revision is *who* the enclave and the targets
actually are — **parental-control apps** and the **platforms** they govern — woven through each
item; the next section pins down where they sit before the per-assertion builds.

---

## Where parental-control apps and enforced platforms fit

The "enclave" you build for and the "signal source" you relay are not abstractions — they have
names, and naming them tells you exactly *whose key to seal to* and *where a control lands*.
openchildsafety.com's promise — *"Build child-safety protections once. Enforce them everywhere"* —
only holds if your enclave and gatekeeper code treat these two actor classes correctly.

**Parental-control apps (PCAs) are the verified enclave.** A parental-control app is the
parent-chosen safety provider — `did:ocss:app` on openchildsafety.com — and in OCSS role terms it
is a **TPSSP** (the Sammy's-Law term) sitting in the **Verifier/Receiver** seat. It holds the EC
P-256 payload **private** key and is the *sole* party that can decrypt a sealed inner `JWE:`. That
single fact is what A3, A4 and A6 are about. A PCA is **not** the intermediary (that's you, Phosra),
**not** the credential Issuer (Apple/mDL), and **not** the Gatekeeper (the platform). Concretely,
the enclaves you build `@phosra/link` for span a capability range:

- **Qustodio** — device-side enforcement runner.
- **Bark** — monitoring/alert source plus light enforcement.
- **BrightCanary** — monitoring/alert *only*, no enforcement (an iOS keyboard extension — the
  narrowest, and the purest A4 case).
- **Aura** — enforcement runner + monitoring source (broadest; its identity/financial axis is out of
  OCSS scope).
- **Qoria/Linewize** — institutional district authority + safeguarding, where the alert routes to a
  **Designated Safeguarding Lead**, not a home parent.

A wrinkle you operate around: **there is no formal Trust-List `enforcement_agent_role` yet** — it is
the #1 P0 gap — so today these PCAs are *untagged* consumers of your enforcement profiles and
*untagged* sources of alerts. (More under the census section.)

**Platforms (Roblox, Netflix, Snapchat) are targets and signal sources — never one of the five
surfaces.** The five normative enforcement surfaces are **DNS · MDM · Router · OS · App**; a platform
is none of them. A platform is a **Gatekeeper** and/or a **distribution-lane participant** that
exposes native state (age APIs, household hierarchies) and **does not call OCSS endpoints**. Controls
reach a platform through the **App** surface: your Router compiles the parent's policy into a signed
`EnvelopeEnforcementProfile`, the surface polls `GET /api/v1/enforcement-profiles/{endpoint_id}`, and
the Gatekeeper enforces the compiled `allow|warn|block` — **decision parity, never mechanism or UI
parity.** The harness's sandbox archetypes name the shapes you build `@phosra/gatekeeper` against:
`blockfort` (Roblox / gaming-UGC, role `gatekeeper`), `marquee` and `hearthdeck` (Netflix /
streaming, role `expose-only`), and `loopline` (social, the EMIT-lane receiver model).

**The end-to-end flow you sit in the middle of:** a parent sets a rule → the **PCA** encodes it as a
typed OCSS category and seals consent (**A3**) via a `consent_attestation` whose **`app_ref`** scopes
standing to *exactly one* platform → the PCA exposes a visible `monitoring_active` (**A4**) → your
Router compiles the policy into a signed enforcement profile → the **platform** (App surface)
enforces it, and may also **EMIT** a session-scoped `abuse_signal` (the §10.6 Snapchat shape) or
originate an age signal (the §10.4 Roblox shape) sealed to the PCA's key under a **no-veto** clause →
if that signal is **abuse-at-home and the implicated party is the authority-holder**, it must route
to an **independent advocate, not the parent** (**A6**). Mapped to openchildsafety.com's six stages —
**Encode · Seal · Route · Verify · Enforce · Record** — the PCA does Encode and Seal, *you* do Route,
the **platform (App surface) Verifies the signed profile and Enforces** it, and your census does
Record. (The *verifying-agency* is the separate dependency chain above — OCSS→Phosra→harness→VA —
not a stage in this runtime rule lifecycle; don't conflate the two "verify"s.)

You build two of the moving parts in this chain — the PCA enclave SDK (`@phosra/link`) and the
platform integration (`@phosra/gatekeeper`: the one enforcement-profile compiler and the EMIT-lane
relay, run as a strictly **content-blind** intermediary). Both ship documented on **docs.phosra.com**,
your Mintlify developer portal for Phosra's commercial OCSS implementation — *"Phosra implements
OCSS; it does not own it"* — which is a different thing from the neutral standard site
**openchildsafety.com**. Everything below is those two builds, per assertion.

---

## A3 — Sealed-to-consent-recipient only

**OCSS prerequisite:** the consent-recipient binding format (consent record naming recipient DID +
EC P-256 sealing key) and the seal-only-to-recipient MUST.

**What Phosra builds:**
1. **Consent → recipient-key binding.** When a parent/guardian consents, capture or register the
   **recipient's sealing public key** and emit a consent record/attestation that binds it. You
   already have the `consent_attestation` lane (§8.3.2) and the router-blind `harm_context` lane
   (§3A.3) — extend so a consent record carries the recipient key the enclave must seal to. **The
   recipient is a PCA** (the TPSSP / `did:ocss:app`): you bind *its* published P-256 sealing key, and
   you carry the `consent_attestation`'s **`app_ref`** so standing is scoped to *one* platform — a
   Bark consent for Snapchat must not grant Bark standing over a parent's Roblox traffic.
2. **Enclave/SDK sealing behavior.** In `@phosra/link` (the PCA enclave path), seal the payload to
   the **consent recipient's** key via `envelope.seal` (P-256) — i.e. to the PCA, never the router's
   payload key, never the census. This is the **router-blind** invariant openchildsafety.com states
   as *"MUST-NEVER decrypt in transit"*: the census forwards ciphertext verbatim. Keep the
   census/router lane content-free (you already enforce this for A2/§3A.3).
3. **Same rule on the platform EMIT lane.** When a platform emits (the §10.6 `abuse_signal`, the
   §10.4 age signal), your `@phosra/gatekeeper` relay seals to the **named TPSSP's** key — the PCA the
   `app_ref` points at — not to the relay and not to the platform. You are the intermediary here; you
   must be able to *move* the envelope without being able to *open* it.
4. **Surface the seal target** through the enclave's conformance interface (the contract the harness
   drives) so the recipient it sealed to is observable for verification.

**How the harness checks you:** it opens the sealed payload with the consent recipient's key
(must succeed) and proves it is *not* openable as the census or with a non-recipient key (must
fail). If your enclave seals to the router or the wrong key — or to the wrong PCA across an `app_ref`
boundary — A3 fails.

**Done when:** a consented signal from your SDK seals only to the consent-recipient PCA, end-to-end,
whether it originated in the app or arrived over a platform EMIT.

---

## A4 — Parent-sole-control + visible `monitoring_active`

**OCSS prerequisite:** the runtime capability-document schema (carrying `monitoring_active` +
`control_holder`) and the visible-indicator / sole-control MUST. This document does **not** exist
yet — the §5.3 `CapabilityManifests` are static Trust-List declarations; A4 needs the live,
per-device form.

**What Phosra builds:**
1. **A capability endpoint.** Have the enclave/device expose the signed OCSS capability document
   with `monitoring_active` (true while monitoring, and a flag that it is surfaced) and
   `control_holder` set to the authority-holder DID. This extends your §5.3 capability manifests
   from a static Trust-List declaration into a live, per-device surface. **A4 is OCSS's answer to the
   covert-monitoring risk intrinsic to every PCA** — the PCA *is* the monitoring party, so the bit
   lives in your `@phosra/link` enclave.
2. **Actually surface the indicator** in the product UI to the monitored child — covert monitoring
   is non-conformant, so the bit must be true *and* visible. This is sharpest for the monitoring-only
   enclaves: **BrightCanary** (an iOS keyboard extension that only watches) and **Bark** have no
   enforcement to point at, so the visible indicator *is* the conformance surface. For
   platform-enforced controls the indicator lands on the **App** surface — your `@phosra/gatekeeper`
   integration must make sure the platform or the on-device PCA renders it; the Gatekeeper enforces
   decisions, it does not get to hide that monitoring is on.
3. **Enforce sole control** — only the authority holder can toggle monitoring; reject changes from
   any other party. `control_holder` is the authority-holder DID, which is *not* always a home
   parent: for **Qoria/Linewize** in a district deployment the authority-holder is the institution /
   Designated Safeguarding Lead, so resolve `control_holder` to the right party rather than assuming
   "parent."

**How the harness checks you:** it reads the capability document and asserts `monitoring_active`
is present + marked visible and that control is the authority holder alone. Hiding monitoring (or
allowing third-party control) fails A4.

**Done when:** your device/enclave serves a conformant capability document and the indicator is
genuinely visible + authority-holder-only.

---

## A6 — Abuse-at-home → independent-advocate routing

**OCSS prerequisite (heavy — governance-led):** the independent-advocate recipient type on the
Trust List, the vetting/governance of who qualifies, and the routing rule. **You should not define
who the advocates are** — that is OCSS + advocacy partners. You implement the routing once they do.

**What Phosra builds:**
1. **Advocate-lane recipient resolution.** Resolve the advocate recipient (DID + sealing key) from
   the Trust List's advocate entries, the same way you resolve other recipients.
2. **The routing decision.** When the OCSS rule fires (abuse-at-home and the implicated party is the
   authority holder), route the sealed signal to the **advocate** recipient instead of the parent,
   sealing to the advocate's key. **This is the sharpest PCA case:** normally every alert a PCA
   raises goes *to the parent* — that is the whole product — but when the guardian *is* the
   implicated party, the signal MUST seal to the independent advocate, and the **no-veto** clause
   means the implicated authority-holder cannot suppress it. This extends your existing
   envelope/routing logic — a new branch keyed on the rule, not a new transport.
3. **One branch, every platform.** Because every emitting platform — Snapchat (§10.6), Roblox
   (§10.4), messaging — shares a single `AbuseSignal` envelope, your routing branch is
   **platform-agnostic**: you key it on the rule, not on which Gatekeeper emitted. A Snapchat EMIT
   and a Roblox age signal flow through the identical advocate branch in
   `@phosra/gatekeeper`/`@phosra/link`.
4. **Honor the policy guardrails** OCSS sets (jurisdiction, mandatory-reporting interplay) in the
   routing path. For institutional **Qoria/Linewize** the *routine* alert target is a Designated
   Safeguarding Lead — but abuse-at-home routing still goes to the *independent* advocate, never back
   into the implicated authority chain.

**How the harness checks you:** it feeds an abuse-at-home signal + an advocate recipient and asserts
the signal seals to the **advocate**, not the parent. Routing to the parent fails A6 — and the
harness's `routes-to-parent` mutant is the most safety-critical one in the whole suite, because a
false pass here is a real-world safety failure, not just a bug. Get this branch airtight.

**Done when:** an abuse-at-home signal from your stack — app-originated or platform-emitted — routes
(sealed) to the advocate lane.

---

## Census: the `verifying-agency` role + enforcement  *(your operator hat)*

This is the piece that turns the harness's attestations from *fixture-verified* into
*live-registry-verified*. It is squarely Phosra's, as the census operator.

**OCSS prerequisite:** the `verifying-agency` role + the compiler enforcement rule + the
independence governance.

**What Phosra builds (in the census):**
1. **Add the role.** Add `verifying-agency` (and `classifier-accredited`) as a recognized role on
   Trust-List entries — today `internal/ocss/identity` has root/steward/router/runner/editor/
   district/agent and the `Entry` type has **no `role` field**; add it. (`classifier-accredited`
   maps to the **Accredited** tier in openchildsafety.com's `Listed → Accredited → Steward` ladder;
   you, Phosra, are the **Steward**.)
2. **Compiler enforcement.** In the census/trust-list compiler, **reject** any
   `classifier-accredited` provider entry whose embedded `conformance_attestation` was *not* signed
   by a party holding a valid `verifying-agency` entry at signing time; enforce the **7-day TTL**
   (non-renewal ⇒ expiry) and the **conflict-of-interest** bar (a verifying-agency entry may not
   coexist with a `classifier-accredited` entry for the same DID).
3. **Mint + serve the entry.** Mint the `verifying-agency` Trust-List entry **for an independent
   party** (per the spec, *not* Phosra itself for its own providers) and serve it on
   `/.well-known/ocss/trust-list` with the `role` tag.

**The PCA-shaped gap to leave room for.** The same `role` field is where PCAs eventually get tagged.
There is **no `enforcement_agent_role` yet** — the #1 P0 gap — so Qustodio, Bark, Aura and the rest
are currently *untagged* consumers of your enforcement profiles and *untagged* sources of alerts;
in the "we publish our zeros" spirit, the census today *cannot* say "this DID is an enforcement
agent" or distinguish an enforcement runner (Qustodio/Aura) from a monitor-only source
(BrightCanary). When OCSS defines it, it lands in the same `role` slot you are adding now — so design
the field to carry more than `verifying-agency`/`classifier-accredited`. Two further OCSS-owned gaps
you'll *consume* once defined: a closed **`harm_class`** vocabulary (7 values today vs Bark's 19+
alert categories) and a content-free **`AbuseSignal`** (`harm_context_carrier`) so an alert can route
without you ever touching its content — the router-blind rule applied to the alert lane.

**How the harness checks you:** the harness's `verify` will resolve the signer's `verifying-agency`
entry from the live list, check the signature, the TTL, and the conflict-of-interest bar. Once you
serve role-tagged entries in the real wire form, the harness aligns to it (it currently uses a
fixture shape with the same `role` field).

**Critical, from the spec:** Phosra **stands up the census role and mints the entry, but must not
operate the verifying-agency for its own provider partners.** A party Phosra does not control has to
hold and exercise it, or the attestation is meaningless — *the CA model, where the steward cannot
certify its own partners* (the browser trusts Let's Encrypt, not the website). The same independence
logic will apply to whoever holds the future `enforcement_agent_role`: you operate the census, you
do not get to self-certify the PCAs that run on it.

**Done when:** the census serves a role-tagged `verifying-agency` entry and refuses accredited
providers lacking a valid VA-signed attestation.

---

## Sequencing for Phosra

1. **Census `verifying-agency` role + enforcement** — highest leverage: it makes the four
   *already-passing* assertions produce *live-verifiable* attestations. Smallest change, biggest
   unlock. (Pair with designating an independent VA, and shape the new `role` field to also accept
   the future `enforcement_agent_role` that will tag the PCAs.)
2. **A3 consent sealing** — extends lanes you already run; this is where the PCA-as-consent-recipient
   and the `app_ref` platform-scoping land, in `@phosra/link` and the `@phosra/gatekeeper` EMIT relay.
3. **A4 capability endpoint** — extends your capability manifests into the live runtime document; the
   visible `monitoring_active` indicator is the conformance surface for the monitoring-only PCAs
   (BrightCanary/Bark).
4. **A6 advocate routing** — build *after* OCSS + advocacy partners define the lane; it is the
   most policy-bound, so don't get ahead of the governance. The one branch serves every emitting
   platform (Snapchat/Roblox/messaging), and the `routes-to-parent` mutant must be airtight.
