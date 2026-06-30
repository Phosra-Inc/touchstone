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

(The neutral contract lives at **openchildsafety.com** — "Build child-safety protections once.
Enforce them everywhere." Phosra's *implementation* of it — SDKs, billing, the census — is
documented separately at the **docs.phosra.com** developer portal, which is explicit that
"Phosra implements OCSS; it does not own it." Keep the line between the two: everything in this
guide is OCSS's own work, not Phosra's.)

---

## Where parental-control apps and enforced platforms fit

Two actor classes sit on either side of the enclave you are writing this contract for, and every
item below reads differently depending on which one you have in mind. They are not yet first-class
on the wire — naming them is part of the work.

**Parental-control apps (PCAs) are the verified enclave.** In OCSS terms a **parental-control
app** is the **Verifier/Receiver** — the parent-chosen safety provider (`did:ocss:app`) that holds
the EC P-256 payload private key and is the *sole* party that can decrypt a sealed inner `JWE:`.
(Sammy's-Law calls the same actor a TPSSP.) Real vendors map onto that seat with very different
reach, and the differences are exactly what your formats have to be able to express:

- **Qustodio** — device-side **enforcement runner**.
- **Bark** — **monitoring/alert source** + light enforcement (and the reason `harm_class` is too
  small; see the verifying-agency section).
- **BrightCanary** — **monitoring/alert only, no enforcement**; an iOS keyboard extension, the
  narrowest reach and the sharpest covert-monitoring case (see A4).
- **Aura** — enforcement runner **and** monitoring source; its identity/financial axis is simply
  out of OCSS scope, which makes it the broadest.
- **Qoria / Linewize** — institutional **district authority + safeguarding**, routing to a
  Designated Safeguarding Lead rather than to a parent (this changes A6's recipient set).

A PCA is **not** the intermediary (that is Phosra), **not** the Issuer (Apple / mDL), and **not**
the Gatekeeper (the platforms). When you write the receiver-facing wire forms below, the PCA is the
party at the receiving end.

**Platforms (Roblox / Netflix / Snapchat) are enforcement *targets* and signal *sources* — never
one of the five surfaces.** The five normative enforcement surfaces stay **DNS · MDM · Router · OS
· App**; a platform is never one of them. A platform is a **Gatekeeper** and/or a distribution-lane
participant that exposes native state (age APIs, household hierarchies) and *does not call OCSS
endpoints itself*. Controls reach a platform through the **App** surface: the Router compiles the
parent's policy into a signed `EnvelopeEnforcementProfile`, the surface polls
`GET /api/v1/enforcement-profiles/{endpoint_id}`, and the Gatekeeper enforces the compiled
`allow | warn | block` decision — **decision parity, never mechanism or UI parity**. The sandbox
archetypes name the shapes you must keep coherent: `blockfort` (Roblox / gaming-UGC, role
`gatekeeper`), `marquee` / `hearthdeck` (Netflix / streaming, role `expose-only`), and `loopline`
(social, the EMIT-lane receiver model).

So the end-to-end story your formats have to carry, in the standard's own six stages
(**Encode · Seal · Route · Verify · Enforce · Record**): a parent sets a rule → the **PCA**
*encodes* it as a typed OCSS category and *seals* consent (A3) → the PCA exposes a visible
`monitoring_active` (A4) → the Router compiles it into a signed profile that *routes* to the
endpoint → the **platform** (App surface) *verifies* and *enforces* it, and may itself **EMIT** a
session-scoped `abuse_signal` (§10.6, Snapchat shape) or originate an age signal (§10.4, Roblox
shape) sealed to the PCA's key → and if that signal is *abuse-at-home and the implicated party is
the authority-holder*, it must route to an independent advocate, not the parent (A6). One caveat to
keep honest: **no `enforcement_agent_role` exists on the Trust List yet** — it is the #1 P0 gap — so
today PCAs are *untagged* consumers of enforcement profiles and untagged sources of alerts. The
items below are where you close that.

---

## A3 — Sealed-to-consent-recipient only

**What the assertion means:** an enclave handling consented content seals the sealed payload to
the **consent recipient's** key and to *no other party* — the router/census stays content-blind.
For a PCA the consent recipient *is* that PCA; for a platform emitter the recipient is the named
TPSSP the platform seals to, never the relay it travels through.

**What OCSS must define:**
1. **A consent-recipient binding format.** Extend the existing `consent_attestation` (§8.3.2) so a
   consent record names the recipient **DID** *and* the recipient's **sealing public key** (an EC
   P-256 JWK, same family as the published payload keys). This is the key the enclave must seal to.
   When Bark or Aura is the parent's chosen provider, the record names *that* provider's DID + key —
   which is exactly why this extends the existing attestation rather than inventing a new lane. The
   record's `app_ref` must scope standing to **exactly one platform**, so a consent captured for
   Roblox cannot be replayed as standing on Netflix.
2. **The normative MUST:** "An enclave emitting a consented sealed payload MUST seal it to the
   consent recipient's published key, MUST NOT seal it to the router/census or any non-recipient,
   and MUST keep the census lane content-free." Add it to the §4 MUST/MUST-NEVER contract — this is
   the **router-blind** invariant; the census forwards ciphertext verbatim and **MUST-NEVER decrypt
   in transit**.
3. **The A3 conformance assertion text** (the behavioral check, in the suite catalog).
4. **A golden vector — two shapes.** A PCA-shaped sample: a consent record + a correctly-sealed
   envelope sealed to the PCA's payload key. And an EMIT-lane variant: a platform-originated
   §10.6 `abuse_signal` (Snapchat) or §10.4 age signal (Roblox) sealed to the *named TPSSP's* key,
   not the relay. Both so the harness and implementers agree byte-for-byte.

**Parental-control-app + platform angle.** The PCA occupies the consent-recipient seat: a
`harm_context` / `abuse_signal` must seal to the **PCA's payload key only** — never the router and
never the census. On the platform side, when a platform emits in the EMIT lane it seals to the
named TPSSP's key, so the platform never becomes a recipient; the relay stays a content-blind
intermediary. **The failure modes your vector must pin:** sealing to the router/census fails A3,
sealing to any non-recipient key fails A3, and a consent whose `app_ref` does not match the
emitting platform fails A3.

**Hand-off:** Phosra builds the consent-capture → recipient-key flow and the enclave's sealing
behavior; the harness adds a probe that opens the sealed payload with the recipient (PCA) key
(success) and proves it is *not* openable as the census or with a non-recipient key (failure) —
fed both a PCA-shaped consent envelope and a platform EMIT-lane signal.

**Done when:** the format + MUST + assertion + both vectors are published in the frozen companion
bundle.

---

## A4 — Parent-sole-control + visible `monitoring_active`

**What the assertion means:** monitoring is **visibly indicated** to the monitored child (no covert
monitoring) and is **solely controllable by the authority holder** (the parent/guardian). The PCA
*is* the monitoring party here, so A4 is OCSS's structural answer to the covert-monitoring risk
that is intrinsic to every PCA.

**What OCSS must define:**
1. **A runtime capability surface.** Extend the §5.3 capability manifests into a signed,
   enclave-exposed capability document (e.g. a well-known `device-capability` assertion) carrying
   at minimum `monitoring_active` (bool, and a flag that it is surfaced to the user) and
   `control_holder` (the authority-holder DID; the sole-control party). The static §5.3
   `CapabilityManifests` are the *analog* — but A4 needs a **runtime capability document that does
   not yet exist**, so this is a new wire form, not a rename of the manifest.
2. **The normative MUST:** "Monitoring MUST surface a visible `monitoring_active` indicator to the
   monitored party and MUST be solely controllable by the authority holder; silent or
   third-party-controllable monitoring is non-conformant."
3. **The A4 assertion text + a golden capability-document vector.**

**Parental-control-app + platform angle.** Because the PCA is the monitor, the runtime capability
document must carry `monitoring_active = true`, surface it **visibly to the child**, and set
`control_holder` to the authority-holder DID — and only the **authority-holder** may toggle it (a
home parent, or in an institutional deployment the institution / Designated Safeguarding Lead — not
always a home parent, and never a third party). **BrightCanary**
is the sharpest case to design against: monitoring-only, no enforcement, running as an iOS keyboard
extension where the temptation to be invisible is highest — A4 is the rule that says it cannot be.
On a platform the indicator lands on the **App** surface: the platform (or the on-device PCA acting
on its behalf) must surface `monitoring_active`; the platform never silently observes on the PCA's
behalf.

**Hand-off:** Phosra builds the endpoint (exposes the indicator, surfaces it in-product, enforces
sole control); the harness probes the runtime capability document for `monitoring_active` +
sole-control, against both a PCA enclave and a platform App-surface endpoint.

**Done when:** the capability-document schema + MUST + assertion + vector are published.

---

## A6 — Abuse-at-home → independent-advocate routing  *(your heaviest item — it is governance, not protocol)*

**What the assertion means:** when abuse is detected **at home** — i.e. the implicated party may be
the authority holder themselves — the signal routes to an **independent advocate**, never back to
the parent. This is the sharpest PCA case in the whole suite: the default for every PCA is that
alerts go to the parent, and A6 is the one branch where that default must invert.

**What OCSS must define — and this is mostly policy/governance, with advocacy partners:**
1. **An independent-advocate recipient type** on the Trust List — a new **vetted role/tier** for
   advocate organizations (child-safety NGOs, ombuds, statutory advocates), with a DID + sealing
   key, distinct from provider/router roles. The tier must admit **both** the NGO/ombuds shape and
   the institutional shape — **Qoria / Linewize** routes to a **Designated Safeguarding Lead**, a
   statutory role that is not a parent and not an NGO, and the registry has to hold it. But pin the
   edge case: the DSL is the institutional advocate **only when a home guardian is the implicated
   party**; when the institution / DSL is *itself* the implicated authority-holder, the lane must
   escape to an advocate **independent of the institution** — A6 never routes a signal back into the
   authority chain it is fleeing.
2. **The routing rule:** the condition under which a signal MUST route to the advocate lane rather
   than the authority holder (e.g. `harm_class ∈ {abuse-at-home set}` **and** the implicated party
   is the authority holder), and that it seals to the advocate, not the parent.
3. **The governance, with the coalition + child-safety advocates:** *who qualifies* as an
   independent advocate and how they are vetted/admitted; the **legal/jurisdictional** interplay
   (mandatory-reporting, cross-border); oversight, appeal, and abuse-of-the-lane safeguards. This is
   a neutral-trust decision that **must not be a single vendor's call** — it is the reason this lane
   is OCSS-owned and not Phosra-owned, the same CA-model logic as the verifying-agency: the steward
   cannot certify its own partners.
4. **The A6 assertion text + a golden vector** (an abuse-at-home signal → advocate-sealed envelope).

**Parental-control-app + platform angle.** The platform side is the *easy* half precisely because of
the envelope: Snapchat (§10.6 `abuse_signal`), Roblox, and messaging all emit one shared
`AbuseSignal` form, so the abuse-at-home routing branch is **platform-agnostic** — you write the
rule once and it holds across every emitter, with a no-veto clause so the implicated party cannot
suppress it. The PCA side is where the governance bites: normally every alert seals to the parent,
but when the guardian *is* the implicated party the signal MUST seal to the advocate instead. The
harness's **routes-to-parent mutant is the most safety-critical probe in the suite** — a false pass
here is a real-world safety failure — so the golden vector must make the
advocate-sealed-not-parent-sealed distinction unambiguous.

**Hand-off:** Phosra builds the routing implementation once the lane + recipients exist; the harness
probes that an abuse-at-home signal seals to the advocate recipient and *not* the parent, and that
the routes-to-parent mutant fails closed.

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

**Why this matters for PCAs and platforms.** The role is also what finally lets the Trust List
*distinguish the PCAs*. Until it lands — and until its sibling `enforcement_agent_role` lands — the
PCAs sit on the list as **untagged consumers**: nothing on the wire says Qustodio is an enforcement
runner, Bark is a monitor with light enforcement, and BrightCanary monitors only. That missing
`enforcement_agent_role` is the **#1 P0 gap** feeding A3/A4/A6, and it belongs in the same
governance pass as this role. Two adjacent format gaps ride alongside and are worth surfacing now:
`harm_class` is a **7-value closed set** today while Bark alerts on **19+** real-world categories,
and the `AbuseSignal` needs to be a **content-free `harm_context_carrier`** so the census can route
it without ever seeing the harm. None of these block the VA role itself, but they are the
receiver-facing surfaces a real PCA needs the moment the role makes its attestation bind — and in
the meantime, in the standard's own "we publish our zeros" idiom, the honest status is that the
registry is empty and untagged.

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
   assertions immediately — highest leverage, lowest effort). Land the **`enforcement_agent_role`**
   tag in the same pass: it is the #1 P0 gap and it is what makes the PCAs (Qustodio / Bark /
   BrightCanary / Aura / Qoria) legible on the Trust List at all.
2. **A3 consent-recipient binding** (extends an existing lane; moderate). The PCA is the recipient
   seat; the platform EMIT-lane vector rides the same format.
3. **A4 capability surface** (extends existing manifests; moderate). New runtime document; the
   covert-monitoring risk is intrinsic to every PCA, so design against the narrowest one
   (BrightCanary).
4. **A6 advocate lane** (largest; start the **governance/advocacy** track early — it gates the
   schema, and it is the one piece that needs partners, not just protocol). The platform side is
   already uniform (one shared `AbuseSignal`); the advocate-vetting and the abuse-at-home routing
   rule are the long poles, and the routes-to-parent case is the most safety-critical in the suite.

The parental-control-app + platform lens does not reorder this list — it sharpens *why* each rung
matters and adds the load-bearing format gaps (`enforcement_agent_role`, a wider `harm_class`, the
content-free `AbuseSignal`) that should ride alongside rather than wait for a later pass.
