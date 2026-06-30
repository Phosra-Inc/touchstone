# Publish `@ocss/provider-harness` — Design

**Date:** 2026-06-30
**Status:** Approved design, pending implementation plan
**Repo:** `~/builds/ocss-provider-harness` (this repo)
**Sub-project:** 1 of 3 (Publish → docs.phosra.com page → openchildsafety.com verify widget)

---

## 1. Summary

Make `@ocss/provider-harness` publicly available as **(a) a public GitHub repo** under
`jakekklinvex` and **(b) an npm package** `@ocss/provider-harness`. To publish on npm the
package must have no unresolvable dependency, so this sub-project **inlines the small set of
`@ocss/ts` primitives the harness uses** (verbatim copy), drops the `@ocss/ts` *runtime*
dependency, and keeps the vendored `@ocss/ts` tarball as a **dev-only parity guard** so the
inlined copies cannot drift from the spec-pinned reference. After this, the harness has **zero
runtime dependencies** (only `node:crypto`).

This is the first of three sub-projects that take the already-built harness from "merged on
`main` locally" to "publicly usable and surfaced on docs.phosra.com / openchildsafety.com."
Sub-projects 2 and 3 get their own specs.

---

## 2. Goals / non-goals

### Goals
- Public GitHub repo `jakekklinvex/ocss-provider-harness`, pushed `main`, with MIT `LICENSE`
  and a CI workflow (typecheck + test).
- npm package `@ocss/provider-harness@0.1.0`, publishable and installable, with proper entry
  points (`main`/`types`/`exports`/`bin`) and a `files` whitelist that ships only `dist`.
- Inlined crypto with a parity test guaranteeing byte-identical output to `@ocss/ts`.
- Zero runtime dependencies.

### Non-goals
- Publishing `@ocss/ts` itself (explicitly the path NOT chosen).
- The docs page (sub-project 2) and the verify widget (sub-project 3).
- Any change to the harness's behavior, assertions, or attestation format.

---

## 3. What the harness actually uses from `@ocss/ts` (the inline surface)

`src/crypto-adapter.ts` is the only file importing `@ocss/ts` (verified). Of its imports, only
these are actually referenced anywhere in the codebase:

| Symbol | From | Used by | Action |
|---|---|---|---|
| `marshal` (JCS canon) | `@ocss/ts/canon` | `sign.ts`, `verify.ts` (via adapter) | **inline** (copy `canon.ts`) |
| `ed25519Sign` | `@ocss/ts` | `sign.ts` (via adapter) | **inline** (copy from `crypto.ts`) |
| `HarmClass`, `EnvelopeType`, `TierLabel` | `@ocss/ts/vocab` | reference enclave, A1 probe | **inline** (copy the consts) |
| `Envelope` (+ `Outer`/`Inner`) type | `@ocss/ts` | `contract/enclave.ts` | **inline** (copy the types) |
| `TrustListDocument`, `SignedDocument`, `Entry` types | `@ocss/ts` | **nobody** (dead re-export) | **drop** (do not inline) |

The harness already implements `ed25519Verify` / `ed25519PublicFromSeed` locally (using the same
DER prefixes as `@ocss/ts`), so those stay.

---

## 4. Design

### 4.1 Inlined crypto (`src/crypto/`)

Copy **verbatim** from the monorepo (`~/builds/phosra/packages/ocss-ts/src/`) — verbatim copy,
not re-implementation, so there is no JCS/canon/Ed25519 correctness risk:

```
src/crypto/
├── canon.ts          # copy of @ocss/ts canon.ts (marshal — JCS RFC 8785)
├── ed25519.ts        # ed25519Sign + the SPKI/PKCS8 DER prefixes (from @ocss/ts crypto.ts);
│                     #   also home for the harness's existing ed25519Verify/ed25519PublicFromSeed
├── vocab.ts          # the HarmClass / EnvelopeType / TierLabel consts (subset of @ocss/ts vocab.ts)
└── envelope-types.ts # the Envelope / Outer / Inner types (from @ocss/ts envelope/types.ts)
```

Each file carries a header comment: `// Vendored verbatim from @ocss/ts <file> — kept byte-identical via test/parity.test.ts. Do not edit by hand; re-sync from the monorepo + re-run parity.`

`src/crypto-adapter.ts` changes its imports from `@ocss/ts*` to `./crypto/canon.js`,
`./crypto/ed25519.js`, `./crypto/vocab.js`, `./crypto/envelope-types.js`. It remains the single
crypto seam (every other module still imports crypto from `../crypto-adapter.js`); the
`./crypto/*` files are its internals. The dead `TrustListDocument`/`SignedDocument`/`Entry`
re-exports are removed.

### 4.2 Parity guard (`test/parity.test.ts`)

The vendored `@ocss/ts` tarball moves from `dependencies` to **`devDependencies`** (it ships to
no consumer). A new parity test imports BOTH the inlined primitives and the vendored `@ocss/ts`
ones and asserts byte-identical output:

- `marshal`: for a spread of objects (nested, unicode, integers/floats, key-order permutations),
  `inlined.marshal(x)` bytes === `@ocss/ts.marshal(x)` bytes. Plus a fixed **spec golden vector**:
  `sha256(marshal({"age_band":"13_15","enabled":true,"rule_category":"screen_time_report"}))`
  === `78b2ec890e18b5c4455c59ac1d11092985fb04910d1cc5bafbab586d7a0a27c0` (D-13 canon baseline),
  asserted for the inlined `marshal`.
- `ed25519Sign`: for fixed seeds + messages, `inlined.ed25519Sign(seed,msg)` === `@ocss/ts.ed25519Sign(seed,msg)`.
- `HarmClass`: `Object.values(inlined.HarmClass)` deep-equals `Object.values(@ocss/ts.HarmClass)`.

If the inlined copy ever drifts, this test fails. The dev-only `@ocss/ts` tarball is the source
of truth; `scripts/refresh-ocss-ts.sh` (already present) re-packs it from the monorepo.

### 4.3 npm packaging

- **`src/index.ts`** (new barrel) re-exports the public API: the contract types
  (`EnclaveUnderTest`, `ClassifyInput`, `ClassifyOutput`, `MinimizationAttestation`), the
  assertion `ASSERTIONS` registry, `makeReferenceEnclave`, `runSuite`, `renderReport`,
  `buildAttestation` (+ `UnsignedAttestation`/`AttestationMeta`), `signAttestation` (+
  `SignedAttestation`, `signingBytes`), `verifyAttestation` (+ `VerifyError`), and `ProbeResult`.
- **`package.json`**: remove `private`; `version: "0.1.0"`; `license: "MIT"`; add
  `"main": "./dist/src/index.js"`, `"types": "./dist/src/index.d.ts"`,
  `"exports": { ".": { "import": "./dist/src/index.js", "types": "./dist/src/index.d.ts" } }`,
  `"files": ["dist", "README.md", "LICENSE"]`, `"publishConfig": { "access": "public" }`,
  `"prepublishOnly": "npm run build"`, `"repository"`, `"homepage"`, `"bugs"` (the GitHub URL),
  `"keywords"`, `"description"`. `bin` stays `./dist/src/cli.js`. Move `@ocss/ts` to
  `devDependencies`. Runtime `dependencies` becomes empty (removed).
- **Build**: `tsc` already emits to `dist/` (`dist/src/*.js`, `dist/reference-enclave/*.js`).
  `tsconfig.json` (`include: ["src","reference-enclave"]`) already produces what `bin`/`main`
  reference. Confirm `dist/src/index.js` is emitted.
- **`npm pack --dry-run`** verifies the tarball ships only `dist` + README + LICENSE (no
  `test/`, no `vendor/`, no `.superpowers/`, no `docs/`).

### 4.4 GitHub repo + CI

- Create public repo `jakekklinvex/ocss-provider-harness` via the GitHub REST API
  (`POST /user/repos`, `{"name":"ocss-provider-harness","private":false}`) using the PAT stored
  in the monorepo's gitignored `CLAUDE.local.md` (account `jakekklinvex`) — `gh` CLI is not
  installed. Add the remote (`https://<pat>@github.com/jakekklinvex/ocss-provider-harness.git`),
  `git push -u origin main`.
- **`LICENSE`**: MIT, copyright holder **"Jake Klinvex"**, year 2026.
- **`.github/workflows/ci.yml`**: on push + PR, Node 20, `npm ci && npm run typecheck && npm test`
  (the vendored `@ocss/ts` dev tarball is committed in `vendor/`, so `npm ci` resolves it and the
  parity test runs in CI).
- The committed `docs/superpowers/{specs,plans}` travel with the repo (useful public artifacts);
  `.superpowers/` (the SDD ledger) stays gitignored and is not pushed.

### 4.5 Publish runbook (outward-facing — user-in-the-loop)

The automatable work (4.1–4.4) is built and verified by the plan. The outward, irreversible
steps are a short runbook executed WITH Jake (npm org creation and `npm publish` may require web
access / a 2FA OTP that the agent cannot perform):

1. **Create the `ocss` npm org** at npmjs.com (Jake) so the `@ocss/` scope is publishable.
   *Fallback:* if Jake prefers not to, rename the package to `@jakeklinvex/provider-harness`
   (Jake's existing user scope, no org needed) — a one-line `package.json` change.
2. `npm run build && npm pack --dry-run` — review the tarball contents.
3. `npm publish --access public` — Jake runs it (or supplies the OTP).
4. Create + push the GitHub repo (agent, via the API + PAT).
5. **Smoke test:** in a temp dir, `npm i @ocss/provider-harness` then
   `npx ocss-harness run --enclave ref` → the green A1–A7 report (4 PASS + 3 PENDING).

---

## 5. Testing

- The existing 39 tests stay green (the inline is behavior-preserving; `crypto-adapter`'s public
  surface is unchanged).
- **New:** `test/parity.test.ts` (byte-parity of inlined vs vendored `@ocss/ts` + the golden
  vector).
- `npm run typecheck` clean (the inlined `./crypto/*` typecheck; the dead trust-list types are
  gone).
- `npm pack --dry-run` shows only `dist` + README + LICENSE.
- Build smoke: `node dist/src/cli.js run --enclave ref` exits 0 with the report (already verified
  for `bin`); after `src/index.ts`, also `node -e "import('./dist/src/index.js').then(m=>console.log(Object.keys(m)))"` lists the public API.
- Final install smoke test (runbook step 5) proves a real consumer install works.

---

## 6. Risks & mitigations

- **Drift between inlined crypto and the spec** → the parity test against the vendored `@ocss/ts`
  (which is pinned to the spec's golden vectors) fails loudly on any drift. `refresh-ocss-ts.sh`
  re-syncs.
- **`@ocss/ts` source uses an internal import the copy misses** → `canon.ts`/`crypto.ts`/`vocab.ts`
  are small and self-contained (only `node:crypto`); the plan copies their full transitive surface
  and the parity + existing tests catch any miss at build time.
- **npm scope `@ocss` not owned** → runbook step 1 (create the org) or the `@jakeklinvex/...`
  fallback; either resolves it before publish. The package is not published until the scope exists.
- **Accidentally shipping secrets/ledger** → `files: ["dist"]` whitelist + `npm pack --dry-run`
  review; `.superpowers/` and `vendor/` are excluded from the published tarball.

---

## 7. Open items for the implementation plan

- Confirm `@ocss/ts` `canon.ts` has no imports beyond `node:crypto` (copy its full content; if it
  imports a sibling like an encoding helper, copy that too).
- Confirm the exact `vocab.ts` lines for `HarmClass`/`EnvelopeType`/`TierLabel` and copy only those
  consts (not the whole vocab) to keep `src/crypto/vocab.ts` minimal.
- Decide whether to expose subpath `exports` (e.g. `./contract`) — default: single `.` entry only
  (YAGNI) unless a consumer need appears.
