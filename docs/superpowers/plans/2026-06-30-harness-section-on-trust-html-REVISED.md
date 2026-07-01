# Harness section on trust.html (RE-HOMED) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **Supersedes** `2026-06-30-conformance-page-harness-section.md` — the original target `conformance.html` was DELETED when openchildsafety.com was consolidated (13→7 pages on `origin/main`, 345 commits ahead of the stale base). The verifying-agency/attestation content now lives in `trust.html`. Same content + verified sample; new page, new design system, new framing.

**Goal:** Add a "Run the suite today" section to `apps/ocss-review/public/trust.html` (openchildsafety.com) presenting the A1–A7 enclave assertions, the published `@openchildsafety/provider-harness`, and the real signed sample attestation — in the page's card/chip idiom — making Path B / "By the suite" concrete and shipping.

**Architecture:** One additive `<section>` inserted into `trust.html` (the current site's Trust & Conformance page), on a clean worktree off the CURRENT `origin/main`. The page uses `kit.css` (cache-busted `?v=m6`) with a card/chip/diagram vocabulary and ZERO `<pre>`/`<code>`. Reuse existing classes only → no CSS change → no `?v=` bump.

**Tech Stack:** Static HTML + `kit.css`. Phosra monorepo, Railway `ocss-review`.

## Global Constraints

- **Target:** `apps/ocss-review/public/trust.html` in `~/builds/phosra`. **Base: a worktree off the CURRENT `origin/main`** (fetch first; the local `main` is 345 commits stale — do NOT use it, and do NOT use `ui/tweaks`).
- **Additive only:** insert ONE `<section>` between the close of the "Self-attest, or pass the suite" section and the `<!-- 4 · D5 TRUST LIST model -->` comment (the "One signed file…" section). Change nothing else.
- **Reuse existing kit.css classes ONLY** — `section`, `wrap`, `shead`, `eyebrow`, `grid g2`, `card`, `card--sunk`, `k`, `mt8`/`mt16`/`mt24`/`mt40`, `chip-row`, `chip`, `chip chip--ok`, `chip chip--accent`, `dot`, `muted`, `note`. NO new classes, NO `<pre>`/`<code>`/`<kbd>` (the page has none), NO `<style>`, NO `kit.css` edit (so no `?v=` bump).
- **Honest status:** A1/A2/A5/A7 passable; A3/A4/A6 pending with reasons; v0 verify is against the fixture trust-list shape, not the live registry. No overclaim.
- **The sample sig is the real verified artifact** (truncated for display is acceptable on this clean page; the reproducible generator is Appendix A). The attestation is `attested_by: did:ocss:touchstone`, `key_id: touchstone-2026-07` — Touchstone is the named verifying-agency. Full sig value `ed25519:-Wi-DxQta76YjT5VQjIsMvtgt6FbYehVARu7IRzckLxZ0RJLZDHMkVu6RZ_rUy76CsX0Km_4_AFSNaNhkb93Bw`; display truncation `ed25519:-Wi-DxQt…hkb93Bw`.
- **Links:** npm `https://www.npmjs.com/package/@openchildsafety/provider-harness`; source `https://github.com/jakekklinvex/ocss-provider-harness`.
- **Production deploy is gated** (staging-first; never deploy without Jake's go-ahead).

---

## Task 1: Add the "Run the suite today" section to trust.html

**Files:**
- Modify: `~/builds/phosra/apps/ocss-review/public/trust.html` (insert after the "Self-attest, or pass the suite" `</section>`)

- [ ] **Step 1: Fetch + clean worktree off the CURRENT origin/main**

From `~/builds/phosra`:
```bash
git fetch origin --quiet
git worktree add -b feat/harness-on-trust .worktrees/harness-trust origin/main
cd .worktrees/harness-trust
```
Confirm `git status` clean and `apps/ocss-review/public/trust.html` exists (~869 lines, title "Trust &amp; Conformance · OCSS", links `kit.css?v=m6`).

- [ ] **Step 2: Locate the insertion point**

The new section goes immediately AFTER the `</section>` that closes the "Self-attest, or pass the suite" block and BEFORE the `<!-- 4 · D5 TRUST LIST model -->` comment / the "One signed file…" section.
```bash
grep -n 'D5 TRUST LIST model\|Self-attest, or pass the suite\|One signed file' apps/ocss-review/public/trust.html
```
Insert on the blank line just before the `<!-- 4 · D5 TRUST LIST model -->` comment.

- [ ] **Step 3: Insert this exact section**

```html

<!-- 3b · the harness that runs the suite -->
<section class="section" id="run-the-suite">
  <div class="wrap">
    <div class="shead">
      <span class="eyebrow">Path B, made concrete</span>
      <h2>Run the suite today</h2>
      <p>Path B is not a someday. The behavioral suite for a classifier provider's enclave ships now as an open harness: point it at an endpoint, and it throws the crafted assertions, then emits the signed attestation that gets listed.</p>
    </div>

    <div class="grid g2 mt40">
      <div class="card card--sunk">
        <span class="k">the seven assertions</span>
        <h3 class="mt8">What the enclave must do</h3>
        <p>Each is a behavior observed, not a value claimed: an out-of-enum harm class is refused, no content leaks to the router, a minimization proof is attached, and the enclave suspends before reading content when its own attestation fails.</p>
        <div class="chip-row mt16">
          <span class="chip chip--ok"><span class="dot"></span>A1 fail-closed enum</span>
          <span class="chip chip--ok"><span class="dot"></span>A2 content-free lane</span>
          <span class="chip chip--ok"><span class="dot"></span>A5 minimization proof</span>
          <span class="chip chip--ok"><span class="dot"></span>A7 suspend on attest-fail</span>
        </div>
        <div class="chip-row mt8">
          <span class="chip"><span class="dot" style="background:var(--t3);box-shadow:none"></span>A3 sealed-to-consent · pending</span>
          <span class="chip"><span class="dot" style="background:var(--t3);box-shadow:none"></span>A4 parent-sole-control · pending</span>
          <span class="chip"><span class="dot" style="background:var(--t3);box-shadow:none"></span>A6 advocate routing · pending</span>
        </div>
      </div>

      <div class="card">
        <span class="k">open · MIT · zero deps</span>
        <h3 class="mt8" style="font-family:var(--serif);font-weight:500;font-size:20px">The harness</h3>
        <p><span class="k">@openchildsafety/provider-harness</span> runs the assertions against an enclave; <span class="k">Touchstone</span> — the independent verifying-agency — then signs the result with its own key, the CA model where the steward cannot certify its own partners. Four verbs: <span class="k">run</span> · <span class="k">attest</span> · <span class="k">sign</span> · <span class="k">verify</span>.</p>
        <div class="chip-row mt16">
          <span class="chip chip--accent"><span class="dot"></span><a href="https://www.npmjs.com/package/@openchildsafety/provider-harness" rel="noopener" style="color:inherit;text-decoration:none">npm</a></span>
          <span class="chip chip--accent"><span class="dot"></span><a href="https://github.com/jakekklinvex/ocss-provider-harness" rel="noopener" style="color:inherit;text-decoration:none">source</a></span>
          <span class="chip"><span class="dot" style="background:var(--t3);box-shadow:none"></span>v0.1 · 4 of 7</span>
        </div>
      </div>
    </div>

    <p class="muted mt24" style="max-width:760px;font-size:15px">A signed <span class="k">conformance_attestation</span> is one file anyone verifies offline — the same shape as the trust list below: attested by <span class="k">Touchstone</span> (the verifying-agency), scoped to <span class="k">a1 a2 a5 a7</span>, sealed with <span class="k" style="word-break:break-all">ed25519:-Wi-DxQt…hkb93Bw</span>. It lists what passed and what is pending, so a partial pass is honest, never a silent gap.</p>

    <div class="note mt24">Honest status: A1, A2, A5, A7 pass today; A3, A4, A6 are pending the infrastructure named above. And v0 verifies against the harness's own fixture trust-list shape, not yet the live registry — the verifying-agency role is not seated yet. The mechanism is real and shipping; the live binding lands with it.</div>
  </div>
</section>
```

- [ ] **Step 4: Verify markup integrity + classes are pre-existing**

```bash
F=apps/ocss-review/public/trust.html
# the truncated sig + the new section id present once:
grep -c 'ed25519:-Wi-DxQt…hkb93Bw' "$F"
grep -c 'id="run-the-suite"' "$F"
# every class used in the new block already appears elsewhere in the file (no new classes):
for c in 'section' 'wrap' 'shead' 'eyebrow' 'grid g2' 'card card--sunk' 'card' 'chip-row' 'chip chip--ok' 'chip chip--accent' 'note' 'muted'; do echo -n "$c: "; grep -c "class=\"$c\"" "$F"; done
# NO code/pre introduced; section tags still balanced:
python3 -c "h=open('$F').read();print('pre/code/kbd:',h.count('<pre')+h.count('<code')+h.count('<kbd'));print('section:',h.count('<section'),h.count('</section>'))"
```
Expected: sig=1; id=1; every class count ≥2 (used elsewhere + here); pre/code/kbd = **0**; `<section>` count == `</section>` count.

- [ ] **Step 5: Render check (best-effort)**

Serve `apps/ocss-review/public` (`python3 -m http.server 8099`) and load `http://localhost:8099/trust.html#run-the-suite` in a browser; confirm the new section renders between "Self-attest, or pass the suite" and "One signed file…", with the green `chip--ok` A1/A2/A5/A7 pills, the muted pending A3/A4/A6 chips, the harness card with npm/source accent chips, and the `note`. If browser automation is unavailable, record that and rely on Step 4 + the staging deploy for the visual. Stop the server after.

- [ ] **Step 6: Commit**

```bash
git add apps/ocss-review/public/trust.html
git commit -m "feat(ocss-site): add 'Run the suite today' (A1-A7 + @openchildsafety/provider-harness) to trust.html"
```

---

## Deploy Runbook (OUTWARD / PRODUCTION — gated; staging-first; only on Jake's go-ahead)

- [ ] **D1 — Rebase-clean onto origin/main + land on main.** The branch is already cut from `origin/main`, so it is a clean 1-commit fast-forward. Merge/push `feat/harness-on-trust` → `origin/main` (verify `git merge-base --is-ancestor origin/main HEAD` is true first — never force a stale base over the trunk). Push auto-deploys the Railway **staging** `ocss-review`.
- [ ] **D2 — Verify on staging.** Load the staging URL `…/trust.html#run-the-suite`; confirm the section renders. **PAUSE here for Jake's visual approval before prod.**
- [ ] **D3 — Promote to production.** Per the documented `ocss-review` prod surgical-pin pattern (re-confirm the exact prod base + `serviceInstanceDeployV2(serviceId=44d11006…, commitSha=…)` against the latest prod-deploy note).
- [ ] **D4 — Verify on production.** Load `https://openchildsafety.com/trust.html#run-the-suite`; confirm live.

---

## Self-Review notes
- **Spec coverage:** A1–A7 (chips, 4 ok / 3 pending), the published harness card (npm/source), the real sample attestation (sig, scoped to a1/a2/a5/a7, offline-verifiable framing), honest-status note, Path-B/"By the suite" framing, kit.css idiom (no code blocks), gated staging-first deploy.
- **No placeholders:** full section HTML inline; sig values exact.
- **Base discipline:** worktree off the CURRENT `origin/main` (not stale local `main`, not `ui/tweaks`); the earlier near-miss (a 345-commit-stale base that would have reverted the trunk) is why D1 re-checks ancestry before pushing.
- **Design fidelity:** the page has zero `<pre>`/`<code>`; Step 4 asserts that stays 0.
