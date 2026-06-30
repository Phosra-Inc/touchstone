# Publish `@ocss/provider-harness` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@ocss/provider-harness` publishable to public npm + GitHub by inlining the `@ocss/ts` crypto it uses (verbatim, with a dev-only parity guard), dropping the `@ocss/ts` runtime dependency so the package has zero runtime deps, then packaging it (entry points, LICENSE, CI).

**Architecture:** Tasks 1–4 are automatable, TDD-guarded code/config changes. Task 1 inlines the crypto and repoints the single seam (`crypto-adapter.ts`) at the local copies — behavior-preserving, guarded by the existing 39-test suite. Task 2 adds a byte-parity test against the still-vendored `@ocss/ts` (now a devDependency). Tasks 3–4 add npm packaging, LICENSE, and CI. The actual outward publish (GitHub repo + `npm publish`) is a gated, user-in-the-loop **Runbook** at the end.

**Tech Stack:** TypeScript (ESM, NodeNext), Node ≥ 20, vitest, `node:crypto`. After Task 1 the only `@ocss/ts` usage is the dev-only parity test.

## Global Constraints

- **ESM only**, explicit `.js` import extensions, `NodeNext`.
- **Behavior-preserving:** Tasks 1–4 must not change any harness behavior. The existing **39 tests stay green** after every task; `npm run typecheck` stays clean.
- **Single crypto seam preserved:** `src/crypto-adapter.ts` stays the only module the rest of the harness imports crypto from. After Task 1 it imports from `./crypto/*.js` (the inlined copies) instead of `@ocss/ts`; **no other `src/` or `reference-enclave/` file may import `@ocss/ts`** (only `test/parity.test.ts` may, and only as a devDependency).
- **Verbatim copy, not re-implementation:** the inlined `canon.ts` / `ed25519Sign` / vocab consts / envelope types are byte-for-byte copies of `@ocss/ts`; correctness is guaranteed by the parity test, never by hand-editing.
- **Zero runtime dependencies** after Task 3 (`@ocss/ts` is a devDependency; nothing in `dependencies`).
- **Package name** `@ocss/provider-harness`, **version** `0.1.0`, **license** MIT (holder "Jake Klinvex", 2026).
- **Published tarball ships only** `dist`, `README.md`, `LICENSE` (via `files`). Never `test/`, `vendor/`, `docs/`, `.superpowers/`.
- **GitHub owner** `jakekklinvex`, repo `ocss-provider-harness`, **public**. PAT lives in the monorepo's gitignored `~/builds/phosra/CLAUDE.local.md` (account `jakekklinvex`); `gh` CLI is NOT installed.

---

## File Structure

```
src/crypto/                 # NEW — inlined @ocss/ts primitives (verbatim copies)
├── canon.ts                #   marshal (JCS) — cp of @ocss/ts canon.ts
├── ed25519.ts              #   DER prefixes + ed25519Sign/Verify/PublicFromSeed
├── vocab.ts                #   HarmClass / EnvelopeType / TierLabel consts+types
└── envelope-types.ts       #   Outer / Inner / Envelope types
src/crypto-adapter.ts       # MODIFY — import from ./crypto/* not @ocss/ts; drop dead trust-list types
src/index.ts                # NEW — public API barrel (npm entry)
test/parity.test.ts         # NEW — inlined vs vendored @ocss/ts byte-parity
package.json                # MODIFY — devDep move, npm fields, version, license
LICENSE                     # NEW — MIT
.github/workflows/ci.yml    # NEW — typecheck + test
```

---

## Task 1: Inline the `@ocss/ts` crypto and repoint the seam (behavior-preserving)

**Files:**
- Create: `src/crypto/canon.ts`, `src/crypto/ed25519.ts`, `src/crypto/vocab.ts`, `src/crypto/envelope-types.ts`
- Modify: `src/crypto-adapter.ts`
- Test: the existing suite (regression guard — no new test file in this task)

**Interfaces:**
- Produces: `src/crypto/canon.ts` exports `marshal(v: unknown): Uint8Array`. `src/crypto/ed25519.ts` exports `ed25519Sign(seed, msg)`, `ed25519Verify(pub, msg, sig)`, `ed25519PublicFromSeed(seed)`. `src/crypto/vocab.ts` exports the `HarmClass`/`EnvelopeType`/`TierLabel` const objects + their types. `src/crypto/envelope-types.ts` exports the `Outer`/`Inner`/`Envelope` types. `crypto-adapter.ts` keeps its EXACT current export surface (`marshal`, `ed25519Sign`, `ed25519Verify`, `ed25519PublicFromSeed`, `seedFromPkcs8Pem`, `b64urlEncode`, `b64urlDecode`, `vocab`, and the `Envelope` type) so no consumer changes.

- [ ] **Step 1: Copy `canon.ts` verbatim**

Run:
```bash
cp ~/builds/phosra/packages/ocss-ts/src/canon.ts ~/builds/ocss-provider-harness/src/crypto/canon.ts
```
Then prepend this one header line at the very top of `src/crypto/canon.ts` (above the existing top comment):
```ts
// Vendored verbatim from @ocss/ts src/canon.ts — kept byte-identical via test/parity.test.ts. Re-sync via scripts/refresh-ocss-ts.sh; never hand-edit.
```
(`canon.ts` has no imports — it is self-contained.)

- [ ] **Step 2: Create `src/crypto/ed25519.ts`**

```ts
// Vendored verbatim from @ocss/ts src/crypto.ts (ed25519Sign + DER prefixes) — kept
// byte-identical via test/parity.test.ts. ed25519Verify/ed25519PublicFromSeed use the
// same prefixes. Re-sync via scripts/refresh-ocss-ts.sh; never hand-edit.
import { createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify } from "node:crypto";

const ED25519_SPKI_PREFIX = Uint8Array.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);
const ED25519_PKCS8_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04,
  0x22, 0x04, 0x20,
]);

export function ed25519Sign(seed: Uint8Array, msg: Uint8Array): Uint8Array {
  if (seed.length !== 32) {
    throw new RangeError(`ed25519Sign: seed must be 32 bytes, got ${seed.length}`);
  }
  const pkcs8 = new Uint8Array(ED25519_PKCS8_PREFIX.length + 32);
  pkcs8.set(ED25519_PKCS8_PREFIX, 0);
  pkcs8.set(seed, ED25519_PKCS8_PREFIX.length);
  const keyObj = createPrivateKey({ key: Buffer.from(pkcs8), format: "der", type: "pkcs8" });
  return Uint8Array.from(nodeSign(null, Buffer.from(msg), keyObj));
}

export function ed25519Verify(pub: Uint8Array, msg: Uint8Array, sig: Uint8Array): boolean {
  if (pub.length !== 32) return false;
  const spki = new Uint8Array(ED25519_SPKI_PREFIX.length + 32);
  spki.set(ED25519_SPKI_PREFIX, 0);
  spki.set(pub, ED25519_SPKI_PREFIX.length);
  let keyObj;
  try {
    keyObj = createPublicKey({ key: Buffer.from(spki), format: "der", type: "spki" });
  } catch {
    return false;
  }
  try {
    return nodeVerify(null, Buffer.from(msg), keyObj, Buffer.from(sig));
  } catch {
    return false;
  }
}

export function ed25519PublicFromSeed(seed: Uint8Array): Uint8Array {
  if (seed.length !== 32) throw new RangeError(`ed25519PublicFromSeed: seed must be 32 bytes, got ${seed.length}`);
  const pkcs8 = new Uint8Array(ED25519_PKCS8_PREFIX.length + 32);
  pkcs8.set(ED25519_PKCS8_PREFIX, 0);
  pkcs8.set(seed, ED25519_PKCS8_PREFIX.length);
  const priv = createPrivateKey({ key: Buffer.from(pkcs8), format: "der", type: "pkcs8" });
  const spki = createPublicKey(priv).export({ format: "der", type: "spki" }) as Buffer;
  return Uint8Array.from(spki.subarray(12));
}
```

- [ ] **Step 3: Create `src/crypto/vocab.ts`** (the three consts the harness uses, copied verbatim)

```ts
// Vendored verbatim from @ocss/ts src/vocab.ts (the closed enums the harness uses) —
// kept identical via test/parity.test.ts. Re-sync via scripts/refresh-ocss-ts.sh.

// §4.4 — content enum (closed).
export const HarmClass = {
  Grooming: "grooming",
  SelfHarm: "self_harm",
  SuicidalIdeation: "suicidal_ideation",
  SexualExploitation: "sexual_exploitation",
  Bullying: "bullying",
  CompanionDependency: "companion_dependency",
  AIMediatedGrooming: "ai_mediated_grooming",
} as const;
export type HarmClass = (typeof HarmClass)[keyof typeof HarmClass];

// §4.2.2 — registry vs vendor judgment label.
export const TierLabel = { Registry: "registry", Vendor: "vendor" } as const;
export type TierLabel = (typeof TierLabel)[keyof typeof TierLabel];

// §4.2.2 — typed payload class.
export const EnvelopeType = {
  AgeAssertion: "age_assertion",
  ConsentAttestation: "consent_attestation",
  ConsentWithdrawn: "consent_withdrawn",
  AbuseSignal: "abuse_signal",
  EnforcementProfile: "enforcement_profile",
  Directive: "directive",
  AuditAttestation: "audit_attestation",
} as const;
export type EnvelopeType = (typeof EnvelopeType)[keyof typeof EnvelopeType];
```

- [ ] **Step 4: Create `src/crypto/envelope-types.ts`** (copied verbatim)

```ts
// Vendored verbatim from @ocss/ts src/envelope/types.ts (the wire types the harness uses).
export interface Outer {
  ocss_version: string;
  intermediary_audience: string;
  issued_at: string;
  nonce: string;
  resource: string;
  sender_signature: string;
}
export interface Inner {
  receiver: string;
  envelope_type: string;
  family_hash?: string;
  tier_label?: string;
  payload: string;
}
export interface Envelope {
  outer: Outer;
  inner: Inner;
}
```

- [ ] **Step 5: Repoint `src/crypto-adapter.ts` at the local copies**

Replace the current import/export head of `src/crypto-adapter.ts` (the `@ocss/ts` imports, the duplicated DER prefixes, and the local `ed25519Verify`/`ed25519PublicFromSeed` definitions) so the file becomes exactly:

```ts
// The single crypto seam. Everything else imports crypto from here.
// After the publish inline, this re-exports the local ./crypto/* copies (no @ocss/ts at runtime).
import * as nodeCrypto from "node:crypto";
import { marshal } from "./crypto/canon.js";
import * as vocabNs from "./crypto/vocab.js";
import { ed25519Sign, ed25519Verify, ed25519PublicFromSeed } from "./crypto/ed25519.js";
import type { Envelope } from "./crypto/envelope-types.js";

export { marshal, ed25519Sign, ed25519Verify, ed25519PublicFromSeed };
export const vocab = vocabNs;
export type { Envelope };

export function b64urlEncode(b: Uint8Array): string {
  return Buffer.from(b).toString("base64url");
}
export function b64urlDecode(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

// PKCS#8 Ed25519 PEM -> raw 32-byte seed (the private scalar `d` of the OKP JWK).
export function seedFromPkcs8Pem(pem: string): Uint8Array {
  const jwk = nodeCrypto.createPrivateKey(pem).export({ format: "jwk" }) as { d?: string };
  if (!jwk.d) throw new Error("not an Ed25519 PKCS#8 private key");
  return b64urlDecode(jwk.d);
}
```

(Net changes vs. current: imports come from `./crypto/*.js`; `ed25519Verify`/`ed25519PublicFromSeed` are imported+re-exported instead of defined here; the dead `TrustListDocument`/`SignedDocument`/`Entry` type re-exports are gone; `seedFromPkcs8Pem`/`b64urlEncode`/`b64urlDecode` stay.)

- [ ] **Step 6: Confirm no `@ocss/ts` runtime import remains**

Run: `grep -rnE "from \"@ocss/ts" src reference-enclave`
Expected: **no output** (zero matches).

- [ ] **Step 7: Typecheck + full suite (behavior-preserving regression gate)**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; **39 tests pass** (14 files). The inline is behavior-preserving — any failure means a copy diverged; fix the copy, do not change behavior.

- [ ] **Step 8: Commit**

```bash
git add src/crypto src/crypto-adapter.ts
git commit -m "refactor: inline @ocss/ts crypto into src/crypto; drop runtime @ocss/ts import"
```

---

## Task 2: Parity guard + move `@ocss/ts` to devDependencies

**Files:**
- Modify: `package.json` (dependency move)
- Test: `test/parity.test.ts`

**Interfaces:**
- Consumes: the inlined `src/crypto/canon.ts` `marshal`, `src/crypto/ed25519.ts` `ed25519Sign`, `src/crypto/vocab.ts` `HarmClass`; the vendored `@ocss/ts` `marshal`/`ed25519Sign`/`HarmClass`.

- [ ] **Step 1: Move `@ocss/ts` from `dependencies` to `devDependencies`**

In `package.json`, delete the `"dependencies"` block's `@ocss/ts` entry (leaving `dependencies` empty — remove the now-empty `"dependencies": {}` too) and add `"@ocss/ts": "file:vendor/ocss-ts-0.0.0.tgz"` to `devDependencies`. Then run `npm install` so the lockfile reflects the move.
Expected: `npm install` succeeds (the tarball is still in `vendor/`).

- [ ] **Step 2: Write the failing test `test/parity.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { marshal as inlinedMarshal } from "../src/crypto/canon.js";
import { ed25519Sign as inlinedSign } from "../src/crypto/ed25519.js";
import { HarmClass as inlinedHarm } from "../src/crypto/vocab.js";
import { marshal as upstreamMarshal } from "@ocss/ts/canon";
import { ed25519Sign as upstreamSign } from "@ocss/ts";
import * as upstreamVocab from "@ocss/ts/vocab";

const CASES: unknown[] = [
  { age_band: "13_15", enabled: true, rule_category: "screen_time_report" },
  { b: 1, a: 2, nested: { z: [1, 2, 3], y: "x" } },
  { unicode: "😀！déjà", empty: "", arr: [] },
  { n: 9007199254740991, neg: -42, zero: 0 },
  "plain string", 0, true, null, [1, "two", { three: 3 }],
];

describe("parity: inlined crypto === vendored @ocss/ts", () => {
  it("marshal produces byte-identical output", () => {
    for (const c of CASES) {
      expect(Buffer.from(inlinedMarshal(c)).toString("hex"))
        .toBe(Buffer.from(upstreamMarshal(c)).toString("hex"));
    }
  });
  it("marshal matches the D-13 canon golden vector", () => {
    const obj = { age_band: "13_15", enabled: true, rule_category: "screen_time_report" };
    const digest = createHash("sha256").update(Buffer.from(inlinedMarshal(obj))).digest("hex");
    expect(digest).toBe("78b2ec890e18b5c4455c59ac1d11092985fb04910d1cc5bafbab586d7a0a27c0");
  });
  it("ed25519Sign produces identical signatures", () => {
    const seed = new Uint8Array(32).fill(9);
    const msg = inlinedMarshal({ hello: "world" });
    expect(Buffer.from(inlinedSign(seed, msg)).toString("hex"))
      .toBe(Buffer.from(upstreamSign(seed, msg)).toString("hex"));
  });
  it("HarmClass values match upstream", () => {
    expect(Object.values(inlinedHarm).sort())
      .toEqual(Object.values(upstreamVocab.HarmClass).sort());
  });
});
```

- [ ] **Step 3: Run the parity test**

Run: `npx vitest run test/parity.test.ts`
Expected: PASS (4 tests). If marshal/sign parity fails, the copy in Task 1 diverged — re-copy the exact `@ocss/ts` source, do not edit the test.

- [ ] **Step 4: Full suite + typecheck**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; all tests pass (now 43 across 15 files).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json test/parity.test.ts
git commit -m "test: parity guard for inlined crypto; move @ocss/ts to devDependencies"
```

---

## Task 3: npm packaging — public-API barrel + `package.json` fields

**Files:**
- Create: `src/index.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `src/index.ts` re-exporting the public API. `package.json` with npm publish fields.

- [ ] **Step 1: Create `src/index.ts`**

```ts
// Public API of @ocss/provider-harness.
export type { EnclaveUnderTest, ClassifyInput, ClassifyOutput, MinimizationAttestation, UpstreamAttestation, Envelope } from "./contract/enclave.js";
export { ASSERTIONS, type AssertionMeta } from "./assertions/registry.js";
export { makeReferenceEnclave } from "../reference-enclave/index.js";
export { runSuite } from "./suite.js";
export { renderReport } from "./report.js";
export type { ProbeResult, Probe } from "./probe.js";
export { runAssertion } from "./probe.js";
export { buildAttestation, type UnsignedAttestation, type AttestationMeta } from "./attestation/build.js";
export { signAttestation, signingBytes, type SignedAttestation } from "./attestation/sign.js";
export { verifyAttestation, VerifyError } from "./attestation/verify.js";
```

> Implementer note: confirm each named export exists with that exact name (read the source file if unsure — e.g. `contract/enclave.ts`, `assertions/registry.ts`). `UpstreamAttestation` is a type in `contract/enclave.ts`; include it only if it is exported there (it is). Do not invent exports.

- [ ] **Step 2: Write the failing test `test/index.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import * as api from "../src/index.js";

describe("public API barrel", () => {
  it("exposes the core entry points", () => {
    for (const name of ["makeReferenceEnclave","runSuite","renderReport","buildAttestation","signAttestation","signingBytes","verifyAttestation","VerifyError","ASSERTIONS","runAssertion"]) {
      expect(api).toHaveProperty(name);
    }
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run test/index.test.ts`
Expected: FAIL — cannot find `../src/index.js`.

- [ ] **Step 4: (index.ts already written in Step 1) Run it to verify it passes**

Run: `npx vitest run test/index.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Update `package.json` with npm fields**

Set `package.json` to (preserving `engines`, `scripts.build/typecheck/test/harness`, `bin`, and the `devDependencies` from Task 2):
```json
{
  "name": "@ocss/provider-harness",
  "version": "0.1.0",
  "description": "Independent OCSS verifying-agency conformance harness: probe a provider enclave against assertions A1/A2/A5/A7 and build/sign/verify a conformance_attestation.",
  "type": "module",
  "license": "MIT",
  "engines": { "node": ">=20" },
  "bin": { "ocss-harness": "./dist/src/cli.js" },
  "main": "./dist/src/index.js",
  "types": "./dist/src/index.d.ts",
  "exports": { ".": { "import": "./dist/src/index.js", "types": "./dist/src/index.d.ts" } },
  "files": ["dist", "README.md", "LICENSE"],
  "publishConfig": { "access": "public" },
  "keywords": ["ocss", "child-safety", "conformance", "attestation", "verifying-agency"],
  "repository": { "type": "git", "url": "git+https://github.com/jakekklinvex/ocss-provider-harness.git" },
  "homepage": "https://github.com/jakekklinvex/ocss-provider-harness#readme",
  "bugs": { "url": "https://github.com/jakekklinvex/ocss-provider-harness/issues" },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc -p tsconfig.test.json",
    "test": "vitest run",
    "harness": "tsx src/cli.ts",
    "prepublishOnly": "npm run build"
  },
  "devDependencies": {
    "@ocss/ts": "file:vendor/ocss-ts-0.0.0.tgz",
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0",
    "vitest": "^1.6.1",
    "tsx": "^4.19.0"
  }
}
```
There is intentionally **no `dependencies`** key (zero runtime deps). `private` is removed.

- [ ] **Step 6: Build + verify the published tarball contents + entry**

Run:
```bash
npm run build
node -e "import('./dist/src/index.js').then(m=>console.log(Object.keys(m).sort().join(',')))"
npm pack --dry-run
```
Expected: build clean; the import prints the API names (incl. `verifyAttestation`, `runSuite`, `makeReferenceEnclave`); `npm pack --dry-run` lists ONLY files under `dist/`, plus `README.md`, `LICENSE`, `package.json` — and NO `test/`, `vendor/`, `docs/`, `.superpowers/`, `src/`. Then `rm -rf dist` (gitignored; don't commit).

- [ ] **Step 7: Full suite + typecheck**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; all tests pass (now 44 across 16 files).

- [ ] **Step 8: Commit**

```bash
git add package.json src/index.ts test/index.test.ts
git commit -m "feat: npm packaging — public-API barrel, entry points, publish config"
```

---

## Task 4: LICENSE + CI workflow

**Files:**
- Create: `LICENSE`, `.github/workflows/ci.yml`

- [ ] **Step 1: Create `LICENSE`** (MIT)

```
MIT License

Copyright (c) 2026 Jake Klinvex

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 3: Verify the CI commands pass locally (the workflow just runs these)**

Run: `npm ci && npm run typecheck && npm test`
Expected: clean install + typecheck + all tests pass. (`npm ci` requires `package-lock.json` in sync — it is, after Task 2's `npm install`. The vendored `@ocss/ts` dev tarball resolves from `vendor/`.)

- [ ] **Step 4: Commit**

```bash
git add LICENSE .github/workflows/ci.yml
git commit -m "chore: MIT LICENSE + CI workflow (typecheck + test)"
```

---

## Publish Runbook (OUTWARD-FACING — gated; execute only on Jake's explicit go-ahead)

These steps are irreversible / outward-facing and partly require Jake (npm org creation, `npm publish` 2FA). Do them only after Tasks 1–4 are reviewed and green. Confirm with Jake immediately before R3 and R4.

- [ ] **R1 — Create the public GitHub repo (agent, via API + PAT).**
  Read the PAT from `~/builds/phosra/CLAUDE.local.md` (account `jakekklinvex`). Then:
  ```bash
  curl -sS -X POST -H "Authorization: token <PAT>" -H "Accept: application/vnd.github+json" \
    https://api.github.com/user/repos \
    -d '{"name":"ocss-provider-harness","private":false,"description":"Independent OCSS verifying-agency conformance harness"}'
  git remote add origin "https://<PAT>@github.com/jakekklinvex/ocss-provider-harness.git"
  git push -u origin main
  ```
  Verify: the repo exists at github.com/jakekklinvex/ocss-provider-harness and CI runs green on the push.

- [ ] **R2 — Create the `ocss` npm org (Jake, on npmjs.com).**
  Jake creates a free npm org named `ocss` so `@ocss/provider-harness` is publishable under his account (`npm whoami` → `jakeklinvex`). *Fallback:* if Jake declines, change `name` to `@jakeklinvex/provider-harness` in `package.json` (one-line change, no org needed) and re-commit.

- [ ] **R3 — Dry-run, then publish (Jake runs publish / supplies OTP).**
  ```bash
  npm run build && npm pack --dry-run    # review contents one more time
  npm publish --access public            # Jake runs this (2FA OTP prompt)
  ```

- [ ] **R4 — Smoke-test the published package.**
  ```bash
  cd "$(mktemp -d)" && npm init -y >/dev/null && npm i @ocss/provider-harness
  npx ocss-harness run --enclave ref
  ```
  Expected: the install resolves with zero runtime deps; the CLI prints the A1–A7 report (4 PASS + 3 PENDING).

---

## Self-Review notes (for the executor)

- **Spec coverage:** inline crypto (Task 1) + parity guard (Task 2) + zero-runtime-dep/devDep move (Tasks 2–3) + barrel & npm fields (Task 3) + LICENSE/CI (Task 4) + publish runbook (R1–R4). Drop of dead trust-list types is in Task 1 Step 5.
- **Behavior-preserving:** Tasks 1–4 each end with the full existing suite green; no harness behavior changes.
- **Type/name consistency:** `crypto-adapter.ts` keeps its exact export names (Step 5), so no consumer import breaks; `src/index.ts` re-exports only names that exist (Task 3 note flags verification).
- **No-secret-leak:** `files: ["dist",…]` + the `npm pack --dry-run` check (Task 3 Step 6) is the gate; `.superpowers/`/`vendor/` excluded from the tarball.
- **Soft spot:** if `@ocss/ts`'s `canon.ts` is ever updated upstream, the parity test catches drift; `scripts/refresh-ocss-ts.sh` re-syncs the dev tarball (the inlined copies are then re-copied by hand + re-verified).
