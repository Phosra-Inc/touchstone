# conformance.html — "Provider-enclave attestation" subsection — Design

**Date:** 2026-06-30
**Status:** Approved design, pending implementation plan
**Sub-project:** 2 of 3 (Publish ✅ → **docs surface** → openchildsafety.com verify widget)
**Spec home:** this repo (`~/builds/ocss-provider-harness/docs/`). **Implementation target:** the phosra monorepo — `apps/ocss-review/public/conformance.html` (served at openchildsafety.com).

---

## 1. Summary

Add a new, clearly-labeled subsection to the existing **§3 "The conformance test suite"** of
`conformance.html` on openchildsafety.com that makes the **verifying-agency / provider-enclave
attestation layer** concrete: the **A1–A7** assertion table, the now-published
**`@openchildsafety/provider-harness`** as the runnable harness (npm + GitHub), and a **real,
verified sample `conformance_attestation`**. It is a pure-HTML addition that reuses the page's
existing design-system classes — no CSS change, no new page.

---

## 2. Why a distinct subsection (the framing that drives this design)

`conformance.html` §3 already describes a conformance suite — but it is the **OCSS Rules
conformance suite**: per-category, capability-based deterministic assertions (e.g. `TIER-001`:
does your implementation evaluate `ai_chatbot_tier_gate` and emit the cited statute?), run by a
CLI named `ocss-conform`, **targeting Q3 2026**. That is *adopter / implementer* conformance.

**A1–A7 / `provider-harness` is a different layer:** the independent *verifying-agency*
behavioral attestation of an **Accredited** classifier-provider's **enclave** — closed-enum
fail-closed, content-free signal lane, minimization attestation, attestation-fail→suspend. It
is the CA-model mechanism behind the Accredited tier (§2 MUST/MUST-NEVER, §6 tiers).

Folding A1–A7 into the Rules-suite text would **contradict the page** (which says the runner is
`ocss-conform`, Q3 2026). So the harness content is a separate subsection, explicitly
distinguished — and its hook is that, *unlike* the drafting Rules suite, this layer **ships
today**.

---

## 3. Placement

Inside `<section id="sec3">`, after the existing **"What you'll actually run: the artifact
format"** block and its `draft-note` (currently ends ~line 537, before `</section>` at ~538).
The new subsection is appended as the last child of §3, before its closing `</section>`. No
other section moves; the §3 → §4 boundary is unchanged.

(Implementation note: line numbers are from the version read during design; the implementer
re-locates the `</section>` of `id="sec3"` rather than trusting a fixed line.)

---

## 4. Content & markup (reuse the page's existing design language)

A new `<h3>` (same inline-style recipe as the other §3 subheads) titled **"Provider-enclave
attestation: the verifying-agency layer"**, then:

### 4.1 Explainer — 2 × `<p class="sec-sub">`
- What it is: an *independent* party (a verifying-agency) attests that an Accredited
  classifier-provider's **enclave** behaves as the standard requires, signing a
  `conformance_attestation` with its own Ed25519 key. CA model: the standard's steward **cannot
  be the verifying-agency for its own provider partners** (a browser trusts Let's Encrypt, not
  the site).
- How it stays honest: the Trust List's **7-day TTL is the revocation mechanism** — the
  attestation is renewed weekly or the provider's accredited entry expires out of resolution.
  Distinguish from the Rules suite: this attests *enclave behavior*, not Rule-evaluation
  correctness.

### 4.2 A1–A7 assertion table — `class="table-scroll"` + a `<table>`
Columns: **ID · Assertion · Status**. Status uses the page's existing pills —
`class="status ok"` for passable, `class="pend"` for pending. Exact rows:

| ID | Assertion | Status |
|---|---|---|
| A1 | Closed-enum fail-closed (out-of-enum harm class rejected) | `status ok` "passable" |
| A2 | Content-free signal lane (no plaintext / no JWE leaks to the census) | `status ok` "passable" |
| A3 | Sealed-to-consent-recipient only | `pend` "pending — consent infra" |
| A4 | Parent-sole-control + visible `monitoring_active` | `pend` "pending — capability endpoint" |
| A5 | Minimization attestation (salted-HMAC Merkle leaves) | `status ok` "passable" |
| A6 | Abuse-at-home → independent-advocate routing | `pend` "pending — advocate lane" |
| A7 | Attestation-fail → suspend (fail-closed before content) | `status ok` "passable" |

One `sec-sub` caption under the table: **"4 of 7 passable today; A3/A4/A6 await infrastructure
not yet built."**

### 4.3 The shipping harness — a `<p class="sec-sub">` + a `<pre>` command block
Prose names the published tool and links it: **`@openchildsafety/provider-harness`**
(`https://www.npmjs.com/package/@openchildsafety/provider-harness`) and the source
(`https://github.com/jakekklinvex/ocss-provider-harness`), MIT, zero runtime deps. The `<pre>`
(same recipe as the other §3 `<pre>` blocks) shows the lifecycle:
```
npm i -g @openchildsafety/provider-harness
ocss-harness run    --enclave ref      # probe A1/A2/A5/A7 → report
ocss-harness attest --enclave ref …    # → unsigned conformance_attestation
ocss-harness sign   --key va.pem …     # the verifying-agency signs it
ocss-harness verify --trust-list … …   # sig · valid VA entry · 7-day TTL · COI · liability
```

### 4.4 A real sample `conformance_attestation` — a `<pre>` block
The **actual signed JSON** produced by the harness (see §5), with inline `var(--ink-3)` comments
on the key fields (`attested_by`, `assertions_passed`, `assertions_pending`, `liability_scope_ref`,
`key_id`, `sig`). A one-line caption marks it a **sample signed with a demo verifying-agency key**.

### 4.5 Honest-status — a `class="draft-note"`
Mirrors the page's honesty ethos and the harness README's v0 scope: A1/A2/A5/A7 pass today;
A3/A4/A6 are pending (consent infra / capability endpoint / advocate lane); and **v0 `verify`
checks the harness's own fixture Trust-List shape, not yet the live Trust List**, because the
`verifying-agency` role does not exist in the census yet. No overclaim.

---

## 5. The sample attestation must be real and verified (correctness)

The embedded sample is **not a mock**. It is generated from the published/local harness and
**proven to verify green before embedding**:
1. In the harness repo, generate a demo VA Ed25519 key + a root key (test helpers `makeEd25519`).
2. `buildAttestation(runSuite(makeReferenceEnclave()), …)` → unsigned doc (passed `[a1,a2,a5,a7]`,
   pending `[a3,a4,a6]`, a demo `attested_by`, a `liability_scope_ref`, a fixed `passed_at`).
3. `signAttestation(doc, {pkcs8Pem, key_id})` → signed JSON.
4. `mintTrustList([verifying-agency entry for the demo VA])` + `verifyAttestation(signed, tl,
   rootX)` → asserts `{ ok: true }`.
5. Capture the signed JSON; that exact artifact is what the HTML embeds.

This generation is a small committed script/test in the harness repo (so the sample is
reproducible), and its asserted `{ok:true}` is the proof the page shows a valid attestation.
The demo key material is throwaway (clearly labeled); no real VA key is used or implied.

---

## 6. Testing & verification

- **Sample validity:** the generator's `verifyAttestation(...) === {ok:true}` (§5) is the gate;
  the embedded JSON is copied from a verified run.
- **HTML integrity:** the new subsection is well-formed (balanced tags), uses only classes that
  already exist in `ocss-site.css` (`sec-sub`, `table-scroll`, `status ok`, `pend`, `draft-note`,
  `flux-tag`, the §3 `<pre>` inline recipe), and adds no new CSS.
- **No broken links:** the npm + GitHub URLs resolve (npm package is live; repo is public).
- **Visual check:** render the page locally (or in the running ocss-review app) and confirm the
  table pills, code blocks, and spacing match the surrounding §3 content.
- **No cache-bust needed:** HTML-only change; `ocss-site.css` is untouched (the page links it
  without a `?v=` token).

---

## 7. Deploy (gated — production)

openchildsafety.com is the **production** `ocss-review` Railway service, currently pinned to a
**surgical commit** (per the monorepo's prod-pin pattern), not `main` HEAD. Therefore:
- Implement + verify on a clean branch/worktree in the phosra monorepo, based on the commit that
  is actually live on prod (confirm the base before editing, since `ui/tweaks` is 546 commits of
  unrelated UI work and must not be the base).
- **Deploy only on Jake's explicit go-ahead**, following the established surgical-commit + Railway
  `serviceInstanceDeployV2(commitSha=…)` re-pin pattern for the `ocss-review` prod service — and
  re-verify the page is live afterward.

---

## 8. Out of scope (this sub-project)

- The live **verify widget** (sub-project 3) — this page links/describes verification but does
  not run it interactively against the live Trust List.
- Any change to the Rules-suite text, the nav, or other pages.
- Wiring the harness to the live `@ocss/ts` Trust-List wire form (follow-on, needs the
  verifying-agency role in the census).

---

## 9. Open items for the implementation plan

- Confirm the exact prod-live base commit for `ocss-review` (so the edit is cut from what's
  actually deployed, then promoted via the surgical-pin pattern) — from the monorepo's
  prod-deploy notes / Railway.
- Re-locate the `id="sec3"` closing `</section>` at implementation time (don't trust a line number).
- Generate the real sample attestation (§5) and paste its exact bytes into the plan so the HTML
  step has no placeholder.
