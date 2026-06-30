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
census role are what remain.

---

## A3 — Sealed-to-consent-recipient only

**OCSS prerequisite:** the consent-recipient binding format (consent record naming recipient DID +
EC P-256 sealing key) and the seal-only-to-recipient MUST.

**What Phosra builds:**
1. **Consent → recipient-key binding.** When a parent/guardian consents, capture or register the
   **recipient's sealing public key** and emit a consent record/attestation that binds it. You
   already have the `consent_attestation` lane (§8.3.2) and the router-blind `harm_context` lane
   (§3A.3) — extend so a consent record carries the recipient key the enclave must seal to.
2. **Enclave/SDK sealing behavior.** In the provider SDK / enclave path, seal the sealed payload to
   the **consent recipient's** key via `envelope.seal` (P-256) — not the router's payload key, not
   the census. Keep the census/router lane content-free (you already enforce this for A2/§3A.3).
3. **Surface the seal target** through the enclave's conformance interface (the contract the harness
   drives) so the recipient it sealed to is observable for verification.

**How the harness checks you:** it opens the sealed payload with the consent recipient's key
(must succeed) and proves it is *not* openable as the census or with a non-recipient key (must
fail). If your enclave seals to the router or the wrong key, A3 fails.

**Done when:** a consented signal from your SDK seals only to the consent recipient, end-to-end.

---

## A4 — Parent-sole-control + visible `monitoring_active`

**OCSS prerequisite:** the runtime capability-document schema (carrying `monitoring_active` +
`control_holder`) and the visible-indicator / sole-control MUST.

**What Phosra builds:**
1. **A capability endpoint.** Have the enclave/device expose the signed OCSS capability document
   with `monitoring_active` (true while monitoring, and a flag that it is surfaced) and
   `control_holder` set to the authority-holder DID. This extends your §5.3 capability manifests
   from a static Trust-List declaration into a live, per-device surface.
2. **Actually surface the indicator** in the product UI to the monitored child — covert monitoring
   is non-conformant, so the bit must be true *and* visible.
3. **Enforce sole control** — only the authority holder can toggle monitoring; reject changes from
   any other party.

**How the harness checks you:** it reads the capability document and asserts `monitoring_active`
is present + marked visible and that control is the authority holder alone. Hiding monitoring (or
allowing third-party control) fails A4.

**Done when:** your device/enclave serves a conformant capability document and the indicator is
genuinely visible + parent-only.

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
   sealing to the advocate's key. This extends your existing envelope/routing logic — a new branch
   keyed on the rule, not a new transport.
3. **Honor the policy guardrails** OCSS sets (jurisdiction, mandatory-reporting interplay) in the
   routing path.

**How the harness checks you:** it feeds an abuse-at-home signal + an advocate recipient and asserts
the signal seals to the **advocate**, not the parent. Routing to the parent fails A6.

**Done when:** an abuse-at-home signal from your stack routes (sealed) to the advocate lane.

---

## Census: the `verifying-agency` role + enforcement  *(your operator hat)*

This is the piece that turns the harness's attestations from *fixture-verified* into
*live-registry-verified*. It is squarely Phosra's, as the census operator.

**OCSS prerequisite:** the `verifying-agency` role + the compiler enforcement rule + the
independence governance.

**What Phosra builds (in the census):**
1. **Add the role.** Add `verifying-agency` (and `classifier-accredited`) as a recognized role on
   Trust-List entries — today `internal/ocss/identity` has root/steward/router/runner/editor/
   district/agent and the `Entry` type has **no `role` field**; add it.
2. **Compiler enforcement.** In the census/trust-list compiler, **reject** any
   `classifier-accredited` provider entry whose embedded `conformance_attestation` was *not* signed
   by a party holding a valid `verifying-agency` entry at signing time; enforce the **7-day TTL**
   (non-renewal ⇒ expiry) and the **conflict-of-interest** bar (a verifying-agency entry may not
   coexist with a `classifier-accredited` entry for the same DID).
3. **Mint + serve the entry.** Mint the `verifying-agency` Trust-List entry **for an independent
   party** (per the spec, *not* Phosra itself for its own providers) and serve it on
   `/.well-known/ocss/trust-list` with the `role` tag.

**How the harness checks you:** the harness's `verify` will resolve the signer's `verifying-agency`
entry from the live list, check the signature, the TTL, and the conflict-of-interest bar. Once you
serve role-tagged entries in the real wire form, the harness aligns to it (it currently uses a
fixture shape with the same `role` field).

**Critical, from the spec:** Phosra **stands up the census role and mints the entry, but must not
operate the verifying-agency for its own provider partners.** A party Phosra does not control has to
hold and exercise it, or the attestation is meaningless (the CA model: the browser trusts Let's
Encrypt, not the website).

**Done when:** the census serves a role-tagged `verifying-agency` entry and refuses accredited
providers lacking a valid VA-signed attestation.

---

## Sequencing for Phosra

1. **Census `verifying-agency` role + enforcement** — highest leverage: it makes the four
   *already-passing* assertions produce *live-verifiable* attestations. Smallest change, biggest
   unlock. (Pair with designating an independent VA.)
2. **A3 consent sealing** — extends lanes you already run.
3. **A4 capability endpoint** — extends your capability manifests.
4. **A6 advocate routing** — build *after* OCSS + advocacy partners define the lane; it is the
   most policy-bound, so don't get ahead of the governance.
