# OCSS — what the standard must define for provider-enclave verification

**Your role in the verification process:** OCSS is the **contract author and governance body**.
Nothing downstream can be built or tested until OCSS has *defined the interface and the rule*.
The dependency chain for every item below is:

> **OCSS defines the format + the normative rule + a golden test vector → Phosra (and other
> implementers) build to it → the harness adds the conformance probe → an independent
> verifying-agency runs the harness and signs the attestation.**

So your deliverables are **specs, wire formats, governance, and golden vectors** — not running
code. The harness already passes A1, A2, A5, A7 against these; the three below (A3, A4, A6) plus
the verifying-agency role are blocked on you first.

---

## A3 — Sealed-to-consent-recipient only

**What the assertion means:** an enclave handling consented content seals the sealed payload to
the **consent recipient's** key and to *no other party* — the router/census stays content-blind.

**What OCSS must define:**
1. **A consent-recipient binding format.** Extend the existing `consent_attestation` (§8.3.2) so a
   consent record names the recipient **DID** *and* the recipient's **sealing public key** (an EC
   P-256 JWK, same family as the published payload keys). This is the key the enclave must seal to.
2. **The normative MUST:** "An enclave emitting a consented sealed payload MUST seal it to the
   consent recipient's published key, MUST NOT seal it to the router/census or any non-recipient,
   and MUST keep the census lane content-free." Add it to the §4 MUST/MUST-NEVER contract.
3. **The A3 conformance assertion text** (the behavioral check, in the suite catalog).
4. **A golden vector:** a sample consent record + a correctly-sealed envelope, so the harness and
   implementers agree byte-for-byte.

**Hand-off:** Phosra builds the consent-capture → recipient-key flow and the enclave's sealing
behavior; the harness adds a probe that opens the sealed payload with the recipient key (success)
and proves it is *not* openable as the census or with a non-recipient key (failure).

**Done when:** the format + MUST + assertion + vector are published in the frozen companion bundle.

---

## A4 — Parent-sole-control + visible `monitoring_active`

**What the assertion means:** monitoring is **visibly indicated** to the monitored child (no covert
monitoring) and is **solely controllable by the authority holder** (the parent/guardian).

**What OCSS must define:**
1. **A runtime capability surface.** Extend the §5.3 capability manifests into a signed,
   enclave-exposed capability document (e.g. a well-known `device-capability` assertion) carrying
   at minimum `monitoring_active` (bool, and a flag that it is surfaced to the user) and
   `control_holder` (the authority-holder DID; the sole-control party).
2. **The normative MUST:** "Monitoring MUST surface a visible `monitoring_active` indicator to the
   monitored party and MUST be solely controllable by the authority holder; silent or
   third-party-controllable monitoring is non-conformant."
3. **The A4 assertion text + a golden capability-document vector.**

**Hand-off:** Phosra builds the endpoint (exposes the indicator, surfaces it in-product, enforces
sole control); the harness probes the capability document for `monitoring_active` + sole-control.

**Done when:** the capability-document schema + MUST + assertion + vector are published.

---

## A6 — Abuse-at-home → independent-advocate routing  *(your heaviest item — it is governance, not protocol)*

**What the assertion means:** when abuse is detected **at home** — i.e. the implicated party may be
the authority holder themselves — the signal routes to an **independent advocate**, never back to
the parent.

**What OCSS must define — and this is mostly policy/governance, with advocacy partners:**
1. **An independent-advocate recipient type** on the Trust List — a new **vetted role/tier** for
   advocate organizations (child-safety NGOs, ombuds, statutory advocates), with a DID + sealing
   key, distinct from provider/router roles.
2. **The routing rule:** the condition under which a signal MUST route to the advocate lane rather
   than the authority holder (e.g. `harm_class ∈ {abuse-at-home set}` **and** the implicated party
   is the authority holder), and that it seals to the advocate, not the parent.
3. **The governance, with the coalition + child-safety advocates:** *who qualifies* as an
   independent advocate and how they are vetted/admitted; the **legal/jurisdictional** interplay
   (mandatory-reporting, cross-border); oversight, appeal, and abuse-of-the-lane safeguards. This is
   a neutral-trust decision that **must not be a single vendor's call** — it is the reason this lane
   is OCSS-owned and not Phosra-owned.
4. **The A6 assertion text + a golden vector** (an abuse-at-home signal → advocate-sealed envelope).

**Hand-off:** Phosra builds the routing implementation once the lane + recipients exist; the harness
probes that an abuse-at-home signal seals to the advocate recipient and *not* the parent.

**Done when:** the advocate-lane registry format, the routing rule, the vetting/governance policy,
the assertion, and the vector are ratified — the governance, not just the schema.

---

## Verifying-agency role + the live Trust-List binding  *(what makes the whole attestation real)*

Today the harness `verify` checks attestations against a **fixture** Trust-List shape because the
census has no `verifying-agency` role. To make attestations bind to the *live* registry:

**What OCSS must define:**
1. **The `verifying-agency` role** in the Trust-List spec — a `role` field (or role-tagged entry)
   on §11.9 entries, alongside `classifier-accredited`.
2. **The census compiler rule:** "no `classifier-accredited` provider entry is admitted unless its
   embedded `conformance_attestation` was signed by a party holding a valid `verifying-agency` entry
   at signing time," plus the **7-day TTL** renewal mechanism and the **conflict-of-interest** bar
   (a verifying-agency MUST NOT also hold a `classifier-accredited` entry).
3. **The independence governance:** the rule (already in the role spec) that the standard's steward
   (Phosra) **cannot be the verifying-agency for its own provider partners** — and the process for
   admitting genuinely independent verifying-agencies.

**Hand-off:** Phosra implements the role + enforcement in the census; the harness aligns its
`verify` to the real `SignedDocument`/`Entry` wire form; an **independent** party operates the
verifying-agency using the harness.

**Done when:** the role + enforcement + independence process are in the spec and the census serves
role-tagged entries.

---

## Sequencing for OCSS

A1/A2/A5/A7 are already conformant against existing OCSS surfaces. To unlock the rest, OCSS is the
**critical path** — recommended order by leverage and difficulty:

1. **Verifying-agency role** (small spec change; unlocks *real* attestations for the four passing
   assertions immediately — highest leverage, lowest effort).
2. **A3 consent-recipient binding** (extends an existing lane; moderate).
3. **A4 capability surface** (extends existing manifests; moderate).
4. **A6 advocate lane** (largest; start the **governance/advocacy** track early — it gates the
   schema, and it is the one piece that needs partners, not just protocol).
