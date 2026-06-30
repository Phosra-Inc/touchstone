# conformance.html "Provider-enclave attestation" subsection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a distinct "Provider-enclave attestation: the verifying-agency layer" subsection to §3 of `apps/ocss-review/public/conformance.html` (openchildsafety.com) — the A1–A7 table, the published `@openchildsafety/provider-harness`, and a real verified sample `conformance_attestation` — reusing the page's existing design system.

**Architecture:** A single, additive HTML edit to one static file in the phosra monorepo, done on a clean worktree off `main` (the live-site base) to avoid the dirty `ui/tweaks` tree. Pure markup reusing existing classes (`sec-sub`, `table-scroll`/`data-table`, `status ok`/`pend`, the §3 `<pre>` recipe, `draft-note`) — no CSS, no new page, no cache-bust. The embedded sample attestation is a real artifact already generated + verified `{ok:true}` (Appendix A is the reproducible generator). Deploy to production is a separate gated runbook.

**Tech Stack:** Static HTML + the existing `ocss-site.css` design system. Phosra monorepo (`~/builds/phosra`), Railway-deployed `ocss-review` service.

## Global Constraints

- **Target file:** `apps/ocss-review/public/conformance.html` in `~/builds/phosra`. **Base branch: `main`** (its `conformance.html` is the live 812-line version; `ui/tweaks` must NOT be the base).
- **Additive only:** insert one subsection as the last child of `<section ... id="sec3">`, immediately before that section's closing `</section>`. Do not move or alter any other section, the nav, or other pages.
- **Reuse existing classes only** — `sec-sub`, `table-scroll`, `data-table`, `status ok`, `pend`, `dot`, `draft-note`, `flux-tag`, `<code>`, and the §3 inline-styled `<pre>`/`<h3>` recipe. Add NO new CSS and NO new class names (so `ocss-site.css` is untouched → no `?v=` cache-bust needed).
- **The sample attestation bytes are fixed and load-bearing** — embed them verbatim (especially the `sig`). The canonical artifact:
  ```json
  {"attested_by":"did:ocss:demo-verifying-agency","suite_version":"ocss-provider-harness/v0","build_hash":"ref-fb6776ceebea35c9","passed_at":"2026-06-30T00:00:00Z","assertions_passed":["a1","a2","a5","a7"],"assertions_pending":["a3","a4","a6"],"liability_scope_ref":"https://openchildsafety.com/conformance.html#verifying-agency-liability","spec":"ocss-provider-harness/v0","key_id":"va-demo-2026-06","sig":"ed25519:S0ySVrEc32i9ioYmOWHZBWPnRqdzg6MK-N9rsitxwINB_07iE4-kTehEH7hS3v5-P_e4HhKxviSnxrVIQG0MDQ"}
  ```
  (Generated + verified `{ok:true}` via Appendix A; the demo VA/root keys are throwaway fixed-seed keys.)
- **Honesty:** A1/A2/A5/A7 passable, A3/A4/A6 pending with reasons; v0 `verify` is against the fixture Trust-List shape, not the live Trust List. No overclaim.
- **Links:** npm `https://www.npmjs.com/package/@openchildsafety/provider-harness`; source `https://github.com/jakekklinvex/ocss-provider-harness`; internal `trust-list.html`. The sample's `liability_scope_ref` anchor `#verifying-agency-liability` MUST resolve — put `id="verifying-agency-liability"` on the subsection `<h3>`.
- **Production deploy is gated** (Deploy Runbook) — never deploy to openchildsafety.com without Jake's explicit go-ahead.

---

## File Structure

```
~/builds/phosra/apps/ocss-review/public/conformance.html   # MODIFY — add one subsection to §3
```
(Single-file change. The reproducible sample generator is Appendix A, kept in this plan for provenance — committing it to the harness repo is optional and not required for this deliverable.)

---

## Task 1: Add the "Provider-enclave attestation" subsection to conformance.html

**Files:**
- Modify: `~/builds/phosra/apps/ocss-review/public/conformance.html` (insert before the `</section>` that closes `id="sec3"`)

**Interfaces:** none (terminal static-HTML deliverable).

- [ ] **Step 1: Create a clean worktree off `main`**

The phosra working tree is on `ui/tweaks` with unrelated uncommitted changes; do NOT use it. From `~/builds/phosra`:
```bash
git worktree add -b feat/conformance-harness-section .worktrees/conformance-harness main
cd .worktrees/conformance-harness
```
Expected: a clean checkout of `main` at `.worktrees/conformance-harness`. Confirm `git status` is clean and `apps/ocss-review/public/conformance.html` exists (812 lines).

- [ ] **Step 2: Locate the insertion point**

Run: `grep -n 'id="sec3"' apps/ocss-review/public/conformance.html` and then find the FIRST `</section>` after that line (the close of §3 — it is immediately before `<div class="shell"><hr class="rule-motif" /></div>` and `<section class="section shell" id="sec4">`).
```bash
awk '/id="sec3"/{f=1} f&&/<\/section>/{print NR": "$0; exit}' apps/ocss-review/public/conformance.html
```
Expected: prints the line number of §3's closing `</section>` (around line 538). The subsection is inserted on the line(s) immediately BEFORE that `</section>`.

- [ ] **Step 3: Insert the subsection HTML**

Insert exactly this block immediately before §3's closing `</section>` (after the existing `<p class="sec-sub" style="margin-top:var(--sp-5)">Want a seat…</p>`):

```html
  <h3 id="verifying-agency-liability" style="margin-top:var(--sp-7);font-size:18px;font-weight:560;color:var(--ink-1);letter-spacing:-0.012em">Provider-enclave attestation: the verifying-agency layer</h3>
  <p class="sec-sub">Distinct from the Rules suite above, the Accredited tier carries a second, behavioral check. An <em>independent</em> party — a verifying-agency — attests that a classifier provider's <em>enclave</em> behaves as the standard requires, and signs a <code>conformance_attestation</code> with its own Ed25519 key. This follows the CA model: the standard's steward cannot be the verifying-agency for its own provider partners, exactly as a browser trusts Let's Encrypt — not the website — to attest domain control.</p>
  <p class="sec-sub">It stays honest through the Trust List's 7-day TTL. The attestation is renewed weekly or the provider's accredited entry expires out of resolution — passive revocation, no CRL. Where the Rules suite proves an implementation evaluates Rules correctly, this proves an enclave's behavior: it rejects out-of-enum harm classes, leaks no content to the router, attaches a minimization proof, and suspends before processing content when its own attestation fails. The runnable harness ships today.</p>

  <div class="table-scroll">
    <table class="data-table">
      <thead><tr><th>ID</th><th>Assertion</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td>A1</td><td>Closed-enum fail-closed — an out-of-enum harm class is rejected</td><td><span class="status ok"><span class="dot"></span>passable</span></td></tr>
        <tr><td>A2</td><td>Content-free signal lane — no plaintext, no JWE leaks to the router</td><td><span class="status ok"><span class="dot"></span>passable</span></td></tr>
        <tr><td>A3</td><td>Sealed-to-consent-recipient only</td><td><span class="pend">pending</span> consent infra</td></tr>
        <tr><td>A4</td><td>Parent-sole-control + visible <code>monitoring_active</code> indicator</td><td><span class="pend">pending</span> capability endpoint</td></tr>
        <tr><td>A5</td><td>Minimization attestation wired — salted-HMAC Merkle leaves</td><td><span class="status ok"><span class="dot"></span>passable</span></td></tr>
        <tr><td>A6</td><td>Abuse-at-home &rarr; independent-advocate routing</td><td><span class="pend">pending</span> advocate lane</td></tr>
        <tr><td>A7</td><td>Attestation-fail &rarr; suspend — fail-closed before content</td><td><span class="status ok"><span class="dot"></span>passable</span></td></tr>
      </tbody>
    </table>
  </div>
  <p class="sec-sub">Four of seven pass today; A3, A4, and A6 await infrastructure not yet built. An attestation scopes its claim with <code>assertions_passed</code> and <code>assertions_pending</code>, so a partial pass is honest, never a silent gap.</p>

  <p class="sec-sub">The harness is published, MIT-licensed, zero runtime dependencies: <a href="https://www.npmjs.com/package/@openchildsafety/provider-harness" rel="noopener"><code>@openchildsafety/provider-harness</code></a> (source: <a href="https://github.com/jakekklinvex/ocss-provider-harness" rel="noopener">github.com/jakekklinvex/ocss-provider-harness</a>). A verifying-agency runs it against a provider's enclave, then signs the result:</p>
  <pre style="font-family:var(--font-mono);font-size:13px;line-height:1.6;color:var(--ink-2);background:var(--paper-sunk);border:1px solid var(--edge-strong);border-radius:var(--r-card);padding:var(--sp-4) var(--sp-5);overflow-x:auto;margin:var(--sp-5) 0">npm i -g @openchildsafety/provider-harness
ocss-harness <b style="color:var(--ink-1)">run</b>    --enclave ref      <span style="color:var(--ink-3)"># probe A1/A2/A5/A7 &rarr; report</span>
ocss-harness <b style="color:var(--ink-1)">attest</b> --enclave ref …    <span style="color:var(--ink-3)"># &rarr; unsigned conformance_attestation</span>
ocss-harness <b style="color:var(--ink-1)">sign</b>   --key va.pem …     <span style="color:var(--ink-3)"># the verifying-agency signs it</span>
ocss-harness <b style="color:var(--ink-1)">verify</b> --trust-list … …  <span style="color:var(--ink-3)"># sig · valid VA entry · 7-day TTL · COI · liability</span></pre>

  <p class="sec-sub">A signed <code>conformance_attestation</code>, scoped to the four passable assertions (a sample, signed with a demo verifying-agency key):</p>
  <pre style="font-family:var(--font-mono);font-size:13px;line-height:1.6;color:var(--ink-2);background:var(--paper-sunk);border:1px solid var(--edge-strong);border-radius:var(--r-card);padding:var(--sp-4) var(--sp-5);overflow-x:auto;margin:var(--sp-5) 0">{
  <span style="color:var(--ink-3)">"attested_by"</span>:        <b style="color:var(--ink-1)">"did:ocss:demo-verifying-agency"</b>,
  <span style="color:var(--ink-3)">"suite_version"</span>:      <b style="color:var(--ink-1)">"ocss-provider-harness/v0"</b>,
  <span style="color:var(--ink-3)">"build_hash"</span>:         <b style="color:var(--ink-1)">"ref-fb6776ceebea35c9"</b>,
  <span style="color:var(--ink-3)">"passed_at"</span>:          <b style="color:var(--ink-1)">"2026-06-30T00:00:00Z"</b>,
  <span style="color:var(--ink-3)">"assertions_passed"</span>:  [<b style="color:var(--ink-1)">"a1","a2","a5","a7"</b>],
  <span style="color:var(--ink-3)">"assertions_pending"</span>: [<b style="color:var(--ink-1)">"a3","a4","a6"</b>],
  <span style="color:var(--ink-3)">"liability_scope_ref"</span>: <b style="color:var(--ink-1)">"https://openchildsafety.com/conformance.html#verifying-agency-liability"</b>,
  <span style="color:var(--ink-3)">"spec"</span>:               <b style="color:var(--ink-1)">"ocss-provider-harness/v0"</b>,
  <span style="color:var(--ink-3)">"key_id"</span>:             <b style="color:var(--ink-1)">"va-demo-2026-06"</b>,
  <span style="color:var(--ink-3)">"sig"</span>:                <b style="color:var(--ink-1)">"ed25519:S0ySVrEc32i9ioYmOWHZBWPnRqdzg6MK-N9rsitxwINB_07iE4-kTehEH7hS3v5-P_e4HhKxviSnxrVIQG0MDQ"</b>
}</pre>

  <div class="draft-note">
    Honest status. A1, A2, A5, A7 pass today; A3, A4, A6 are pending the infrastructure named above. And v0 of <code>verify</code> checks the harness's own fixture Trust-List shape, not yet the live <a href="trust-list.html">Trust List</a> — the <code>verifying-agency</code> role is not seated in the registry yet. The mechanism is real and shipping; the live-registry binding lands with it.
  </div>
```

- [ ] **Step 4: Verify markup integrity + the sample bytes are verbatim**

Run these checks from the worktree root:
```bash
F=apps/ocss-review/public/conformance.html
# (a) the load-bearing sample sig appears verbatim exactly once:
grep -c 'ed25519:S0ySVrEc32i9ioYmOWHZBWPnRqdzg6MK-N9rsitxwINB_07iE4-kTehEH7hS3v5-P_e4HhKxviSnxrVIQG0MDQ' "$F"
# (b) the anchor the sample references now exists:
grep -c 'id="verifying-agency-liability"' "$F"
# (c) only existing classes used in the new block — these must all already appear elsewhere in the file:
for c in 'table-scroll' 'data-table' 'status ok' 'pend' 'draft-note'; do echo -n "$c: "; grep -c "class=\"$c\"" "$F"; done
# (d) tag balance for the new <section>'s children — confirm the file still has exactly one </section> per <section>:
python3 -c "import re,sys;h=open('$F').read();print('sections:',h.count('<section'),'closers:',h.count('</section>'),'tables:',h.count('<table'),h.count('</table>'),'pre:',h.count('<pre'),h.count('</pre>'))"
```
Expected: (a) `1`; (b) `≥1`; (c) every class count `≥2` (used elsewhere + here); (d) `<section>`==`</section>`, `<table>`==`</table>`, `<pre>`==`</pre>` (balanced).

- [ ] **Step 5: Render the page and confirm the subsection looks right**

Serve the static dir and open the page (or use the running ocss-review app):
```bash
( cd apps/ocss-review/public && python3 -m http.server 8099 >/dev/null 2>&1 & echo $! > /tmp/cf-server.pid )
```
Then load `http://localhost:8099/conformance.html#verifying-agency-liability` in the browser (Chrome MCP or manual). Confirm: the new §3 subsection renders below "Want a seat at the table…"; the A1–A7 table shows green `status ok` dots for A1/A2/A5/A7 and `pend` pills for A3/A4/A6; both `<pre>` blocks render monospaced with the comment/value colors; the `draft-note` callout renders; no layout break vs. the surrounding §3. Capture a screenshot. Then `kill $(cat /tmp/cf-server.pid)`.

- [ ] **Step 6: Commit (on the worktree's `feat/conformance-harness-section` branch)**

```bash
git add apps/ocss-review/public/conformance.html
git commit -m "feat(ocss-site): add provider-enclave attestation (A1-A7 + @openchildsafety/provider-harness) to conformance §3"
```

---

## Deploy Runbook (OUTWARD / PRODUCTION — gated; execute only on Jake's explicit go-ahead)

openchildsafety.com is the production `ocss-review` Railway service, deployed via a **surgical commit pin** (not `main` HEAD). Do this only after Task 1 is reviewed + the render screenshot is approved.

- [ ] **D1 — Land on `main`.** Merge `feat/conformance-harness-section` into `main` (fast-forward/`--no-ff` per house style) and push. Per CLAUDE.md, pushing `main` auto-deploys the Railway **staging** ocss-review.
- [ ] **D2 — Verify on staging.** Load the staging ocss-review URL `…/conformance.html#verifying-agency-liability`; confirm the subsection renders live. (Staging URL from the monorepo's deploy notes.)
- [ ] **D3 — Promote to production (surgical pin).** Following the documented `ocss-review` prod pattern: create the surgical prod commit (current prod base + this change) OR, if the change is already in a promotable main commit, re-pin the prod service: `serviceInstanceDeployV2(serviceId=44d11006…, commitSha=<the conformance commit>)` on the production env. Confirm the exact mechanism against the latest prod-deploy note before running (the prod base + pin commit can move).
- [ ] **D4 — Verify on production.** Load `https://openchildsafety.com/conformance.html#verifying-agency-liability`; confirm the subsection is live and renders correctly. Report the live URL.

---

## Self-Review notes (for the executor)

- **Spec coverage:** placement (Task 1 Step 2-3), A1–A7 table with status pills (Step 3), harness links + commands (Step 3), real verified sample attestation embedded verbatim (Step 3 + Global Constraints), honest-status note (Step 3), reuse-existing-classes/no-CSS (Global Constraints + Step 4c), render verification (Step 5), gated prod deploy (Deploy Runbook). The `#verifying-agency-liability` anchor (referenced by the sample) is created on the `<h3>`.
- **No placeholders:** the full subsection HTML and the exact sample bytes are inline; the only `…` characters are inside displayed CLI examples (intentional, illustrative), not plan gaps.
- **Base discipline:** worktree off `main` (not `ui/tweaks`); production deploy is explicitly gated.
- **Soft spot:** §3's closing `</section>` is found by anchor (Step 2), not a fixed line number, so the insert is robust to the 4-line `main`↔`ui/tweaks` drift.

---

## Appendix A — Reproducible sample-attestation generator (provenance)

The embedded sample was produced + verified `{ok:true}` by this deterministic script (fixed throwaway seeds → stable `sig`), run from the harness repo `~/builds/ocss-provider-harness` via `npx tsx`:

```ts
import { createPrivateKey } from "node:crypto";
import { ed25519PublicFromSeed, b64urlEncode } from "./src/crypto-adapter.js";
import { makeReferenceEnclave } from "./reference-enclave/index.js";
import { runSuite } from "./src/suite.js";
import { buildAttestation } from "./src/attestation/build.js";
import { signAttestation } from "./src/attestation/sign.js";
import { verifyAttestation } from "./src/attestation/verify.js";
import { mintTrustList, type FixtureEntry } from "./test/helpers/fixture-trustlist.js";

const PKCS8_PREFIX = Uint8Array.from([0x30,0x2e,0x02,0x01,0x00,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x04,0x22,0x04,0x20]);
const pemFromSeed = (seed: Uint8Array) => { const d = new Uint8Array(PKCS8_PREFIX.length+32); d.set(PKCS8_PREFIX,0); d.set(seed,PKCS8_PREFIX.length); return createPrivateKey({key:Buffer.from(d),format:"der",type:"pkcs8"}).export({type:"pkcs8",format:"pem"}) as string; };
const vaSeed = new Uint8Array(32).fill(0x2a), rootSeed = new Uint8Array(32).fill(0x2b);
const va = { pkcs8Pem: pemFromSeed(vaSeed), xB64Url: b64urlEncode(ed25519PublicFromSeed(vaSeed)) };
const root = { pkcs8Pem: pemFromSeed(rootSeed), xB64Url: b64urlEncode(ed25519PublicFromSeed(rootSeed)) };
const KID = "va-demo-2026-06", DID = "did:ocss:demo-verifying-agency";
const unsigned = buildAttestation(await runSuite(makeReferenceEnclave()), { attested_by: DID, suite_version: "ocss-provider-harness/v0", build_hash: makeReferenceEnclave().buildInfo().build_hash, passed_at: "2026-06-30T00:00:00Z", liability_scope_ref: "https://openchildsafety.com/conformance.html#verifying-agency-liability" });
const signed = signAttestation(unsigned, { pkcs8Pem: va.pkcs8Pem, key_id: KID });
const vaEntry: FixtureEntry = { entity: "Demo Verifying-Agency", did: DID, role: "verifying-agency", tier: "accredited", status: "active", valid_through: "2026-07-06T00:00:00Z", jwks: { signing_keys: [{ kty: "OKP", crv: "Ed25519", x: va.xB64Url, kid: KID }] } };
console.log("VERIFY:", JSON.stringify(verifyAttestation(signed, mintTrustList([vaEntry], root.pkcs8Pem), root.xB64Url, () => Date.parse("2026-07-01T00:00:00Z"))));
console.log(JSON.stringify(signed, null, 2));
```
Re-running prints `VERIFY: {"ok":true}` and the exact JSON embedded in the page (the `sig` is stable because the seeds are fixed).
```
