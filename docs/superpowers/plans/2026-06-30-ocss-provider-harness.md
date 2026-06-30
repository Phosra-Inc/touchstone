# OCSS Provider Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@ocss/provider-harness` — an independent verifying-agency conformance harness (TS library + `ocss-harness` CLI) that probes a provider enclave against assertions A1/A2/A5/A7, declares A3/A4/A6 pending, and builds/signs/verifies a `conformance_attestation` against the OCSS Trust List.

**Architecture:** Standalone git repo at `~/builds/ocss-provider-harness`, outside the Phosra monorepo. All OCSS crypto is reused from `@ocss/ts`, consumed as a vendored tarball (`vendor/ocss-ts-0.0.0.tgz`) behind a single `src/crypto-adapter.ts` seam — never re-implemented. Each assertion is a pure `(enclave) => Promise<ProbeResult>`. A reference enclave makes A1/A2/A5/A7 pass; deliberately-broken "mutant" enclaves make each probe fail (the anti-theater bar).

**Tech Stack:** TypeScript (ESM, `NodeNext`), Node ≥ 20, vitest, `tsx` (CLI dev runner), `@ocss/ts` (vendored), `node:crypto` (Ed25519 PEM parsing, HMAC, randomness).

## Global Constraints

- **ESM only.** `package.json` `"type": "module"`; tsconfig `module`/`moduleResolution` = `NodeNext`; all relative imports use explicit `.js` extensions.
- **Single crypto seam.** Only `src/crypto-adapter.ts` may import from `@ocss/ts`. Every other module imports crypto from `../crypto-adapter.js`.
- **Reuse, never re-implement crypto.** Canonicalization = `canon.marshal`; signatures = `ed25519Sign`/`ed25519Verify`; trust-list = `verifyDocument`/`fromVerifiedDocument`. The only new primitive is salted-HMAC Merkle (no `@ocss/ts` equivalent exists).
- **D-9 signing grammar.** A `conformance_attestation`'s `sig` covers `canon.marshal` of the document **with `key_id` and `sig` removed**. `key_id`/`sig` ride outside the signed bytes.
- **Signature wire form.** `sig` = the string `"ed25519:" + base64url(rawSig)`. Public keys are base64url-raw (the `x` of an OKP JWK).
- **Fail-closed.** If a probe cannot positively determine `pass`, its verdict is `fail` or `error`, never `pass`. A failed/errored probe is itself a recorded `ProbeResult`, never silence.
- **Closed harm-class enum** = `Object.values(vocab.HarmClass)` = `["grooming","self_harm","suicidal_ideation","sexual_exploitation","bullying","companion_dependency","ai_mediated_grooming"]`.
- **Package name** `@ocss/provider-harness` (OCSS-neutral, deliberate deviation from the role spec's `@phosra/provider-harness`).
- **Assertion ids** are lowercase: `a1 a2 a3 a4 a5 a6 a7`. Passable now: `a1 a2 a5 a7`. Pending: `a3 a4 a6`.

---

## File Structure

```
~/builds/ocss-provider-harness/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── vendor/ocss-ts-0.0.0.tgz
├── scripts/refresh-ocss-ts.sh
├── src/
│   ├── crypto-adapter.ts          # lone @ocss/ts importer
│   ├── merkle.ts                  # salted-HMAC leaves → Merkle root
│   ├── contract/enclave.ts        # EnclaveUnderTest + types
│   ├── assertions/
│   │   ├── registry.ts            # A1..A7 catalog (status + pending reasons)
│   │   ├── a1-closed-enum.ts
│   │   ├── a2-content-free.ts
│   │   ├── a5-minimization.ts
│   │   └── a7-attestation-suspend.ts
│   ├── probe.ts                   # ProbeResult + runAssertion
│   ├── suite.ts                   # runSuite
│   ├── report.ts                  # markdown report
│   ├── attestation/{build,sign,verify}.ts
│   └── cli.ts                     # ocss-harness
├── reference-enclave/index.ts     # correct EnclaveUnderTest
└── test/
    ├── helpers/{fixture-keys.ts,fixture-trustlist.ts,mutants.ts}
    ├── crypto-adapter.test.ts  merkle.test.ts  registry.test.ts
    ├── reference-enclave.test.ts
    ├── a1.test.ts a2.test.ts a5.test.ts a7.test.ts
    ├── suite.test.ts  build.test.ts  sign.test.ts  verify.test.ts
    └── cli.test.ts
```

---

## Task 1: Repo scaffold + vendored `@ocss/ts` + crypto-adapter smoke test

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `scripts/refresh-ocss-ts.sh`, `src/crypto-adapter.ts`, `vendor/ocss-ts-0.0.0.tgz`
- Test: `test/crypto-adapter.test.ts`

**Interfaces:**
- Produces: `crypto-adapter.ts` exports — `marshal(v: unknown): Uint8Array`, `ed25519Sign(seed: Uint8Array, msg: Uint8Array): Uint8Array`, `ed25519Verify(pub: Uint8Array, msg: Uint8Array, sig: Uint8Array): boolean`, `verifyDocument(signed, rootKeyXB64Url): TrustListDocument`, `fromVerifiedDocument(doc, now?): Resolver`, `vocab` (namespace), `b64urlEncode(b: Uint8Array): string`, `b64urlDecode(s: string): Uint8Array`, `seedFromPkcs8Pem(pem: string): Uint8Array`, `ed25519PublicFromSeed(seed: Uint8Array): Uint8Array`.

- [ ] **Step 1: Pack `@ocss/ts` into the vendor dir**

Run:
```bash
cd ~/builds/phosra/packages/ocss-ts && npm run build && npm pack --pack-destination ~/builds/ocss-provider-harness/vendor
mv ~/builds/ocss-provider-harness/vendor/ocss-ts-*.tgz ~/builds/ocss-provider-harness/vendor/ocss-ts-0.0.0.tgz
```
Expected: `vendor/ocss-ts-0.0.0.tgz` exists (a few hundred KB).

- [ ] **Step 2: Write `scripts/refresh-ocss-ts.sh`** (documented drift control)

```bash
#!/usr/bin/env bash
# Re-pack @ocss/ts from the monorepo into vendor/. Run when the monorepo crypto changes.
set -euo pipefail
SRC="${1:-$HOME/builds/phosra/packages/ocss-ts}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/vendor"
( cd "$SRC" && npm run build && npm pack --pack-destination "$DEST" )
mv "$DEST"/ocss-ts-*.tgz "$DEST/ocss-ts-0.0.0.tgz"
echo "refreshed $DEST/ocss-ts-0.0.0.tgz"
```
Then `chmod +x scripts/refresh-ocss-ts.sh`.

- [ ] **Step 3: Write `package.json`**

```json
{
  "name": "@ocss/provider-harness",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "bin": { "ocss-harness": "./dist/cli.js" },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "harness": "tsx src/cli.ts"
  },
  "dependencies": {
    "@ocss/ts": "file:vendor/ocss-ts-0.0.0.tgz"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0",
    "vitest": "^1.6.1",
    "tsx": "^4.19.0"
  }
}
```

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true
  },
  "include": ["src", "reference-enclave"]
}
```

- [ ] **Step 5: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["test/**/*.test.ts"] } });
```

- [ ] **Step 6: Install**

Run: `cd ~/builds/ocss-provider-harness && npm install`
Expected: installs `@ocss/ts` from the tarball plus dev deps, no errors. (Confirms the tarball packs/installs cleanly — spec §9 item.)

- [ ] **Step 7: Write the failing test `test/crypto-adapter.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import * as crypto from "../src/crypto-adapter.js";

describe("crypto-adapter", () => {
  it("re-exports canon.marshal and produces stable bytes", () => {
    const a = crypto.marshal({ b: 1, a: 2 });
    const b = crypto.marshal({ a: 2, b: 1 });
    expect(Buffer.from(a).toString()).toBe(Buffer.from(b).toString()); // JCS sorts keys
  });

  it("signs and verifies a round trip via @ocss/ts ed25519", () => {
    const seed = new Uint8Array(32).fill(7);
    const pub = crypto.ed25519PublicFromSeed(seed);
    const msg = crypto.marshal({ hello: "world" });
    const sig = crypto.ed25519Sign(seed, msg);
    expect(crypto.ed25519Verify(pub, msg, sig)).toBe(true);
    expect(crypto.ed25519Verify(pub, crypto.marshal({ hello: "x" }), sig)).toBe(false);
  });

  it("derives a 32-byte seed from a PKCS#8 Ed25519 PEM", () => {
    const { pem } = require("node:crypto").generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const seed = crypto.seedFromPkcs8Pem(pem);
    expect(seed.length).toBe(32);
  });

  it("b64url round-trips", () => {
    const b = new Uint8Array([1, 2, 3, 250]);
    expect([...crypto.b64urlDecode(crypto.b64urlEncode(b))]).toEqual([...b]);
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npx vitest run test/crypto-adapter.test.ts`
Expected: FAIL — `Cannot find module '../src/crypto-adapter.js'`.

- [ ] **Step 9: Write `src/crypto-adapter.ts`**

```ts
// The ONLY module permitted to import from @ocss/ts. Everything else imports crypto from here.
import * as nodeCrypto from "node:crypto";
import { marshal } from "@ocss/ts/canon";
import * as vocabNs from "@ocss/ts/vocab";
import { ed25519Sign, ed25519Verify } from "@ocss/ts";
import { verifyDocument, fromVerifiedDocument, Resolver } from "@ocss/ts";
import type { TrustListDocument, SignedDocument, Entry } from "@ocss/ts";

export { marshal, ed25519Sign, ed25519Verify, verifyDocument, fromVerifiedDocument, Resolver };
export const vocab = vocabNs;
export type { TrustListDocument, SignedDocument, Entry };

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

// Raw 32-byte seed -> 32-byte public key (the `x` of the OKP JWK).
export function ed25519PublicFromSeed(seed: Uint8Array): Uint8Array {
  const key = nodeCrypto.createPrivateKey({
    key: { kty: "OKP", crv: "Ed25519", d: b64urlEncode(seed) },
    format: "jwk",
  });
  const jwk = nodeCrypto.createPublicKey(key).export({ format: "jwk" }) as { x: string };
  return b64urlDecode(jwk.x);
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npx vitest run test/crypto-adapter.test.ts`
Expected: PASS (4 tests). If `@ocss/ts/canon` or `@ocss/ts/vocab` subpath import fails, fall back to `import { canon, vocab } from "@ocss/ts"` and use `canon.marshal`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: scaffold repo + vendored @ocss/ts behind crypto-adapter"
```

---

## Task 2: Contract types + assertion registry

**Files:**
- Create: `src/contract/enclave.ts`, `src/assertions/registry.ts`
- Test: `test/registry.test.ts`

**Interfaces:**
- Produces: `EnclaveUnderTest`, `ClassifyInput`, `ClassifyOutput`, `MinimizationAttestation`, `UpstreamAttestation`, `Envelope` (re-export of the `@ocss/ts` shape used in signal output), and `ASSERTIONS: AssertionMeta[]` where `AssertionMeta = { id: string; title: string; status: "passable" | "pending"; pendingReason?: string }`.

- [ ] **Step 1: Write `src/contract/enclave.ts`**

```ts
import type { Envelope } from "@ocss/ts";
export type { Envelope };

export interface MinimizationAttestation {
  alg: "hmac-sha256+merkle";
  merkle_root: string;     // hex
  leaves: string[];        // each = hex HMAC-SHA256(salt, canonical(field))
  salt_commitment: string; // hex SHA-256(salt); the salt itself is never emitted
}

export type UpstreamAttestation = { valid: true } | { valid: false };

export interface ClassifyInput {
  content: string;
  declared_harm_class?: string; // A1 injects an out-of-enum value here
  recipient_did?: string;       // A2 context
}

export type ClassifyOutput =
  | { kind: "signal"; envelope: Envelope; minimization: MinimizationAttestation }
  | { kind: "rejected"; code: string; reason: string }
  | { kind: "suspended"; reason: string };

export interface EnclaveUnderTest {
  buildInfo(): { build_hash: string; suite_version: string };
  classify(input: ClassifyInput): Promise<ClassifyOutput>;
  setUpstreamAttestation(state: UpstreamAttestation | "invalid" | "expired"): void;
}
```

- [ ] **Step 2: Write the failing test `test/registry.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { ASSERTIONS } from "../src/assertions/registry.js";

describe("assertion registry", () => {
  it("has 7 assertions a1..a7", () => {
    expect(ASSERTIONS.map((a) => a.id)).toEqual(["a1","a2","a3","a4","a5","a6","a7"]);
  });
  it("marks a1 a2 a5 a7 passable and a3 a4 a6 pending with reasons", () => {
    const passable = ASSERTIONS.filter((a) => a.status === "passable").map((a) => a.id);
    const pending = ASSERTIONS.filter((a) => a.status === "pending");
    expect(passable.sort()).toEqual(["a1","a2","a5","a7"]);
    expect(pending.map((a) => a.id).sort()).toEqual(["a3","a4","a6"]);
    for (const p of pending) expect(p.pendingReason && p.pendingReason.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/registry.test.ts`
Expected: FAIL — cannot find `../src/assertions/registry.js`.

- [ ] **Step 4: Write `src/assertions/registry.ts`**

```ts
export interface AssertionMeta {
  id: string;
  title: string;
  status: "passable" | "pending";
  pendingReason?: string;
}

export const ASSERTIONS: AssertionMeta[] = [
  { id: "a1", title: "Closed-enum fail-closed", status: "passable" },
  { id: "a2", title: "Content-free signal lane", status: "passable" },
  { id: "a3", title: "Sealed-to-consent-recipient only", status: "pending", pendingReason: "needs consent infra" },
  { id: "a4", title: "Parent-sole-control + visible monitoring_active", status: "pending", pendingReason: "needs capability endpoint" },
  { id: "a5", title: "Minimization attestation wired", status: "passable" },
  { id: "a6", title: "Abuse-at-home -> independent-advocate routing", status: "pending", pendingReason: "advocate lane not built" },
  { id: "a7", title: "Attestation-fail -> suspend", status: "passable" },
];
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/registry.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: enclave contract types + assertion registry"
```

---

## Task 3: Salted-HMAC Merkle helper

**Files:**
- Create: `src/merkle.ts`
- Test: `test/merkle.test.ts`

**Interfaces:**
- Produces: `saltedLeaf(salt: Uint8Array, field: string): string` (hex), `merkleRoot(leavesHex: string[]): string` (hex), `buildMinimization(fields: string[], salt?: Uint8Array): MinimizationAttestation`.

- [ ] **Step 1: Write the failing test `test/merkle.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { saltedLeaf, merkleRoot, buildMinimization } from "../src/merkle.js";

describe("merkle", () => {
  it("salted leaves are HMAC (differ across salts for the same field)", () => {
    const a = saltedLeaf(new Uint8Array(32).fill(1), "f");
    const b = saltedLeaf(new Uint8Array(32).fill(2), "f");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("merkleRoot is deterministic and order-sensitive", () => {
    const leaves = ["aa".repeat(32), "bb".repeat(32), "cc".repeat(32)];
    expect(merkleRoot(leaves)).toBe(merkleRoot([...leaves]));
    expect(merkleRoot(leaves)).not.toBe(merkleRoot([leaves[1], leaves[0], leaves[2]]));
  });
  it("single leaf root equals that leaf", () => {
    expect(merkleRoot(["ab".repeat(32)])).toBe("ab".repeat(32));
  });
  it("buildMinimization produces a recomputable root", () => {
    const m = buildMinimization(["a", "b", "c"]);
    expect(m.alg).toBe("hmac-sha256+merkle");
    expect(merkleRoot(m.leaves)).toBe(m.merkle_root);
    expect(m.salt_commitment).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/merkle.test.ts`
Expected: FAIL — cannot find `../src/merkle.js`.

- [ ] **Step 3: Write `src/merkle.ts`**

```ts
import { createHmac, createHash, randomBytes } from "node:crypto";
import type { MinimizationAttestation } from "./contract/enclave.js";

export function saltedLeaf(salt: Uint8Array, field: string): string {
  return createHmac("sha256", Buffer.from(salt)).update(field, "utf8").digest("hex");
}

function hashPair(a: string, b: string): string {
  return createHash("sha256").update(Buffer.from(a + b, "hex")).digest("hex");
}

export function merkleRoot(leavesHex: string[]): string {
  if (leavesHex.length === 0) throw new Error("merkleRoot: no leaves");
  let level = [...leavesHex];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
    }
    level = next;
  }
  return level[0];
}

export function buildMinimization(fields: string[], salt: Uint8Array = new Uint8Array(randomBytes(32))): MinimizationAttestation {
  const leaves = fields.map((f) => saltedLeaf(salt, f));
  return {
    alg: "hmac-sha256+merkle",
    merkle_root: merkleRoot(leaves),
    leaves,
    salt_commitment: createHash("sha256").update(Buffer.from(salt)).digest("hex"),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/merkle.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: salted-HMAC Merkle helper for minimization attestation"
```

---

## Task 4: Reference enclave

**Files:**
- Create: `reference-enclave/index.ts`
- Test: `test/reference-enclave.test.ts`

**Interfaces:**
- Consumes: `EnclaveUnderTest`, `ClassifyOutput` (Task 2); `buildMinimization` (Task 3); `vocab` (crypto-adapter).
- Produces: `class ReferenceEnclave implements EnclaveUnderTest` and `export function makeReferenceEnclave(): EnclaveUnderTest`. The signal envelope's census-bound `inner` carries only `{ envelope_type:"abuse_signal", harm_class, tier_label, family_hash }` and **no `payload`** (router stays content-blind).

- [ ] **Step 1: Write the failing test `test/reference-enclave.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { makeReferenceEnclave } from "../reference-enclave/index.js";
import { vocab } from "../src/crypto-adapter.js";

describe("reference enclave", () => {
  it("reports build info", () => {
    expect(makeReferenceEnclave().buildInfo().build_hash).toMatch(/.+/);
  });
  it("emits a content-free signal with minimization on valid content", async () => {
    const out = await makeReferenceEnclave().classify({ content: "worrying message", recipient_did: "did:ocss:parent" });
    expect(out.kind).toBe("signal");
    if (out.kind !== "signal") return;
    expect(Object.values(vocab.HarmClass)).toContain((out.envelope.inner as any).harm_class);
    expect((out.envelope.inner as any).payload).toBeUndefined(); // no census-openable content
    expect(out.minimization.alg).toBe("hmac-sha256+merkle");
  });
  it("rejects an out-of-enum harm class (fail-closed)", async () => {
    const out = await makeReferenceEnclave().classify({ content: "x", declared_harm_class: "made_up_class" });
    expect(out.kind).toBe("rejected");
  });
  it("suspends before content when upstream attestation is invalid", async () => {
    const e = makeReferenceEnclave();
    e.setUpstreamAttestation("invalid");
    const out = await e.classify({ content: "x" });
    expect(out.kind).toBe("suspended");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/reference-enclave.test.ts`
Expected: FAIL — cannot find `../reference-enclave/index.js`.

- [ ] **Step 3: Write `reference-enclave/index.ts`**

```ts
import type { EnclaveUnderTest, ClassifyInput, ClassifyOutput, UpstreamAttestation } from "../src/contract/enclave.js";
import { buildMinimization } from "../src/merkle.js";
import { vocab } from "../src/crypto-adapter.js";
import { createHash } from "node:crypto";

const BUILD_HASH = "ref-" + createHash("sha256").update("ocss-reference-enclave-v0").digest("hex").slice(0, 16);

class ReferenceEnclave implements EnclaveUnderTest {
  private attestationValid = true;

  buildInfo() {
    return { build_hash: BUILD_HASH, suite_version: "ocss-provider-harness/v0" };
  }

  setUpstreamAttestation(state: UpstreamAttestation | "invalid" | "expired"): void {
    this.attestationValid = state === "expired" || state === "invalid" ? false : (state as UpstreamAttestation).valid;
  }

  async classify(input: ClassifyInput): Promise<ClassifyOutput> {
    // A7: fail-closed BEFORE touching content.
    if (!this.attestationValid) return { kind: "suspended", reason: "upstream attestation invalid" };

    // A1: closed-enum fail-closed.
    const harm = input.declared_harm_class ?? classifyContent(input.content);
    if (!(Object.values(vocab.HarmClass) as string[]).includes(harm)) {
      return { kind: "rejected", code: "harm_class_out_of_enum", reason: `unknown harm_class: ${harm}` };
    }

    // A2: census-bound inner is content-free (NO payload). A5: minimization over content-derived fields.
    const minimization = buildMinimization([harm, "severity:moderate", `len:${input.content.length}`]);
    const envelope = {
      outer: {
        ocss_version: "4",
        intermediary_audience: "did:ocss:phosra-router",
        issued_at: new Date(0).toISOString(),
        nonce: "ref-nonce",
        resource: "ocss-provider-harness/v0",
        sender_signature: "ed25519:reference",
      },
      inner: {
        receiver: "did:ocss:phosra-router",
        envelope_type: vocab.EnvelopeType.AbuseSignal,
        harm_class: harm,
        tier_label: vocab.TierLabel.Vendor,
        family_hash: createHash("sha256").update("family:" + (input.recipient_did ?? "anon")).digest("hex"),
      },
    } as any;
    return { kind: "signal", envelope, minimization };
  }
}

function classifyContent(content: string): string {
  return /\bself harm\b/i.test(content) ? vocab.HarmClass.SelfHarm : vocab.HarmClass.Grooming;
}

export function makeReferenceEnclave(): EnclaveUnderTest {
  return new ReferenceEnclave();
}
```

> Note for the implementer: `new Date(0)` keeps the reference enclave deterministic. If `vocab.EnvelopeType.AbuseSignal` / `vocab.TierLabel.Vendor` are not exported under those exact names, read `src/vocab.ts` in the monorepo and use the real constant; the test only requires `harm_class` to be a valid `HarmClass` and `payload` to be absent.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/reference-enclave.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: reference enclave (correct A1/A2/A5/A7 behavior)"
```

---

## Task 5: Probe runner + A1 probe (+ mutant helpers)

**Files:**
- Create: `src/probe.ts`, `src/assertions/a1-closed-enum.ts`, `test/helpers/mutants.ts`
- Test: `test/a1.test.ts`

**Interfaces:**
- Consumes: `EnclaveUnderTest`, `makeReferenceEnclave`.
- Produces: `ProbeResult = { assertion_id: string; verdict: "pass"|"fail"|"error"; detail: string; evidence?: unknown }`; `type Probe = (e: EnclaveUnderTest) => Promise<ProbeResult>`; `runAssertion(id: string, probe: Probe, e: EnclaveUnderTest): Promise<ProbeResult>` (wraps thrown errors into `verdict:"error"`); `a1ClosedEnum: Probe`; and mutant factories `mutantA1PassesBogusClass()`, `mutantA2LeaksExcerpt()`, `mutantA5RawHashLeaves()`, `mutantA7ProcessesContent()` (each returns an `EnclaveUnderTest`).

- [ ] **Step 1: Write `src/probe.ts`**

```ts
import type { EnclaveUnderTest } from "./contract/enclave.js";

export interface ProbeResult {
  assertion_id: string;
  verdict: "pass" | "fail" | "error";
  detail: string;
  evidence?: unknown;
}
export type Probe = (e: EnclaveUnderTest) => Promise<ProbeResult>;

export async function runAssertion(id: string, probe: Probe, e: EnclaveUnderTest): Promise<ProbeResult> {
  try {
    return await probe(e);
  } catch (err) {
    return { assertion_id: id, verdict: "error", detail: `probe threw: ${(err as Error).message}` };
  }
}
```

- [ ] **Step 2: Write `test/helpers/mutants.ts`** (all four mutants, used across Tasks 5-8)

```ts
import type { EnclaveUnderTest } from "../../src/contract/enclave.js";
import { makeReferenceEnclave } from "../../reference-enclave/index.js";
import { buildMinimization } from "../../src/merkle.js";
import { createHash } from "node:crypto";

// A1 mutant: coerces any declared harm class to a valid one (passes bogus input through).
export function mutantA1PassesBogusClass(): EnclaveUnderTest {
  const ref = makeReferenceEnclave();
  return { ...wrap(ref), classify: (i) => ref.classify({ ...i, declared_harm_class: "grooming" }) };
}

// A2 mutant: stuffs the content excerpt into the census-bound inner payload.
export function mutantA2LeaksExcerpt(): EnclaveUnderTest {
  const ref = makeReferenceEnclave();
  return {
    ...wrap(ref),
    classify: async (i) => {
      const out = await ref.classify(i);
      if (out.kind === "signal") (out.envelope.inner as any).payload = `excerpt:${i.content}`;
      return out;
    },
  };
}

// A5 mutant: replaces salted-HMAC leaves with brute-forceable raw sha256(field).
export function mutantA5RawHashLeaves(): EnclaveUnderTest {
  const ref = makeReferenceEnclave();
  return {
    ...wrap(ref),
    classify: async (i) => {
      const out = await ref.classify(i);
      if (out.kind === "signal") {
        const fields = ["grooming", "severity:moderate", `len:${i.content.length}`];
        const leaves = fields.map((f) => createHash("sha256").update(f).digest("hex"));
        out.minimization = { ...buildMinimization(fields), leaves, merkle_root: leaves[0] };
      }
      return out;
    },
  };
}

// A7 mutant: ignores attestation failure and emits a signal anyway.
export function mutantA7ProcessesContent(): EnclaveUnderTest {
  const ref = makeReferenceEnclave();
  return { ...wrap(ref), setUpstreamAttestation: () => {} };
}

function wrap(ref: EnclaveUnderTest): EnclaveUnderTest {
  return {
    buildInfo: () => ref.buildInfo(),
    classify: (i) => ref.classify(i),
    setUpstreamAttestation: (s) => ref.setUpstreamAttestation(s),
  };
}
```

- [ ] **Step 3: Write the failing test `test/a1.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { a1ClosedEnum } from "../src/assertions/a1-closed-enum.js";
import { runAssertion } from "../src/probe.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";
import { mutantA1PassesBogusClass } from "./helpers/mutants.js";

describe("A1 closed-enum fail-closed", () => {
  it("passes against the reference enclave", async () => {
    const r = await runAssertion("a1", a1ClosedEnum, makeReferenceEnclave());
    expect(r.verdict).toBe("pass");
  });
  it("fails against a mutant that passes the bogus class through", async () => {
    const r = await runAssertion("a1", a1ClosedEnum, mutantA1PassesBogusClass());
    expect(r.verdict).toBe("fail");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run test/a1.test.ts`
Expected: FAIL — cannot find `../src/assertions/a1-closed-enum.js`.

- [ ] **Step 5: Write `src/assertions/a1-closed-enum.ts`**

```ts
import type { Probe, ProbeResult } from "../probe.js";

const BOGUS = "ocss_harness_out_of_enum_zzz";

export const a1ClosedEnum: Probe = async (e): Promise<ProbeResult> => {
  const out = await e.classify({ content: "any", declared_harm_class: BOGUS });
  if (out.kind === "rejected") {
    return { assertion_id: "a1", verdict: "pass", detail: `out-of-enum harm class rejected: ${out.code}` };
  }
  return {
    assertion_id: "a1",
    verdict: "fail",
    detail: `expected rejection of out-of-enum harm class, got kind=${out.kind}`,
    evidence: out,
  };
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/a1.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: probe runner + A1 closed-enum probe + mutant helpers"
```

---

## Task 6: A2 content-free probe

**Files:**
- Create: `src/assertions/a2-content-free.ts`
- Test: `test/a2.test.ts`

**Interfaces:**
- Consumes: `Probe`/`ProbeResult` (Task 5); `mutantA2LeaksExcerpt` (Task 5 helpers).
- Produces: `a2ContentFree: Probe`.

- [ ] **Step 1: Write the failing test `test/a2.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { a2ContentFree } from "../src/assertions/a2-content-free.js";
import { runAssertion } from "../src/probe.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";
import { mutantA2LeaksExcerpt } from "./helpers/mutants.js";

describe("A2 content-free signal lane", () => {
  it("passes against the reference enclave", async () => {
    const r = await runAssertion("a2", a2ContentFree, makeReferenceEnclave());
    expect(r.verdict).toBe("pass");
  });
  it("fails against a mutant that leaks the excerpt into the census-bound payload", async () => {
    const r = await runAssertion("a2", a2ContentFree, mutantA2LeaksExcerpt());
    expect(r.verdict).toBe("fail");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/a2.test.ts`
Expected: FAIL — cannot find `../src/assertions/a2-content-free.js`.

- [ ] **Step 3: Write `src/assertions/a2-content-free.ts`**

```ts
import type { Probe, ProbeResult } from "../probe.js";

const SECRET = "the-quick-brown-fox-secret-9f2a";
const ALLOWED_INNER_KEYS = new Set(["receiver", "envelope_type", "harm_class", "tier_label", "family_hash"]);

export const a2ContentFree: Probe = async (e): Promise<ProbeResult> => {
  const out = await e.classify({ content: SECRET, recipient_did: "did:ocss:parent" });
  if (out.kind !== "signal") {
    return { assertion_id: "a2", verdict: "fail", detail: `expected a signal, got kind=${out.kind}`, evidence: out };
  }
  const inner = out.envelope.inner as Record<string, unknown>;
  const serialized = JSON.stringify(out.envelope);

  // (1) no census-openable payload field; (2) no unexpected (content-bearing) inner keys;
  // (3) the raw secret content must not appear anywhere in the census-bound envelope.
  if ("payload" in inner && inner.payload != null) {
    return { assertion_id: "a2", verdict: "fail", detail: "inner carries a payload the census could open", evidence: inner };
  }
  const extraneous = Object.keys(inner).filter((k) => !ALLOWED_INNER_KEYS.has(k));
  if (extraneous.length) {
    return { assertion_id: "a2", verdict: "fail", detail: `inner has non-content-free keys: ${extraneous.join(",")}` };
  }
  if (serialized.includes(SECRET)) {
    return { assertion_id: "a2", verdict: "fail", detail: "raw content leaked into the census-bound envelope" };
  }
  return { assertion_id: "a2", verdict: "pass", detail: "census-bound envelope is content-free" };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/a2.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: A2 content-free signal-lane probe"
```

---

## Task 7: A5 minimization probe

**Files:**
- Create: `src/assertions/a5-minimization.ts`
- Test: `test/a5.test.ts`

**Interfaces:**
- Consumes: `Probe`/`ProbeResult`; `merkleRoot` (Task 3); `mutantA5RawHashLeaves`.
- Produces: `a5Minimization: Probe`.

- [ ] **Step 1: Write the failing test `test/a5.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { a5Minimization } from "../src/assertions/a5-minimization.js";
import { runAssertion } from "../src/probe.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";
import { mutantA5RawHashLeaves } from "./helpers/mutants.js";

describe("A5 minimization attestation", () => {
  it("passes against the reference enclave", async () => {
    const r = await runAssertion("a5", a5Minimization, makeReferenceEnclave());
    expect(r.verdict).toBe("pass");
  });
  it("fails against a mutant emitting raw-hash leaves / bad root", async () => {
    const r = await runAssertion("a5", a5Minimization, mutantA5RawHashLeaves());
    expect(r.verdict).toBe("fail");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/a5.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/assertions/a5-minimization.ts`**

```ts
import { createHash } from "node:crypto";
import type { Probe, ProbeResult } from "../probe.js";
import { merkleRoot } from "../merkle.js";

// A leaf that is a raw sha256 of a low-entropy guessable field is brute-forceable.
// Salted-HMAC leaves are not: enumerate a small dictionary and confirm no leaf matches a raw hash.
const DICTIONARY = ["grooming", "self_harm", "severity:moderate", "severity:high", "len:0", "len:1"];

export const a5Minimization: Probe = async (e): Promise<ProbeResult> => {
  const out = await e.classify({ content: "worrying message", recipient_did: "did:ocss:parent" });
  if (out.kind !== "signal") {
    return { assertion_id: "a5", verdict: "fail", detail: `expected a signal, got kind=${out.kind}` };
  }
  const m = out.minimization;
  if (m?.alg !== "hmac-sha256+merkle" || !Array.isArray(m.leaves) || m.leaves.length === 0) {
    return { assertion_id: "a5", verdict: "fail", detail: "missing/malformed minimization attestation", evidence: m };
  }
  if (merkleRoot(m.leaves) !== m.merkle_root) {
    return { assertion_id: "a5", verdict: "fail", detail: "merkle root does not recompute from leaves" };
  }
  const rawHashes = new Set(DICTIONARY.map((d) => createHash("sha256").update(d).digest("hex")));
  if (m.leaves.some((leaf) => rawHashes.has(leaf))) {
    return { assertion_id: "a5", verdict: "fail", detail: "leaf is a brute-forceable raw hash, not salted-HMAC" };
  }
  if (!/^[0-9a-f]{64}$/.test(m.salt_commitment)) {
    return { assertion_id: "a5", verdict: "fail", detail: "missing salt commitment" };
  }
  return { assertion_id: "a5", verdict: "pass", detail: "minimization root recomputes; leaves are salted-HMAC" };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/a5.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: A5 minimization-attestation probe"
```

---

## Task 8: A7 attestation-fail → suspend probe

**Files:**
- Create: `src/assertions/a7-attestation-suspend.ts`
- Test: `test/a7.test.ts`

**Interfaces:**
- Consumes: `Probe`/`ProbeResult`; `mutantA7ProcessesContent`.
- Produces: `a7AttestationSuspend: Probe`.

- [ ] **Step 1: Write the failing test `test/a7.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { a7AttestationSuspend } from "../src/assertions/a7-attestation-suspend.js";
import { runAssertion } from "../src/probe.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";
import { mutantA7ProcessesContent } from "./helpers/mutants.js";

describe("A7 attestation-fail -> suspend", () => {
  it("passes against the reference enclave", async () => {
    const r = await runAssertion("a7", a7AttestationSuspend, makeReferenceEnclave());
    expect(r.verdict).toBe("pass");
  });
  it("fails against a mutant that processes content despite attestation failure", async () => {
    const r = await runAssertion("a7", a7AttestationSuspend, mutantA7ProcessesContent());
    expect(r.verdict).toBe("fail");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/a7.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/assertions/a7-attestation-suspend.ts`**

```ts
import type { Probe, ProbeResult } from "../probe.js";

export const a7AttestationSuspend: Probe = async (e): Promise<ProbeResult> => {
  e.setUpstreamAttestation("invalid");
  const out = await e.classify({ content: "sensitive content that must not be processed" });
  if (out.kind === "suspended") {
    return { assertion_id: "a7", verdict: "pass", detail: "enclave suspended before processing content" };
  }
  return {
    assertion_id: "a7",
    verdict: "fail",
    detail: `expected suspension on attestation failure, got kind=${out.kind}`,
    evidence: out,
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/a7.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: A7 attestation-fail -> suspend probe"
```

---

## Task 9: Suite runner + markdown report

**Files:**
- Create: `src/suite.ts`, `src/report.ts`
- Test: `test/suite.test.ts`

**Interfaces:**
- Consumes: all four probes; `ASSERTIONS` (registry); `runAssertion`; `ProbeResult`.
- Produces: `runSuite(e: EnclaveUnderTest): Promise<ProbeResult[]>` (4 executed + 3 pending results, ordered a1..a7, pending verdict `"pending"` — extend the `ProbeResult.verdict` union to include `"pending"`); `renderReport(results: ProbeResult[], meta: { build_hash: string; suite_version: string }): string`.

- [ ] **Step 1: Extend `ProbeResult.verdict` in `src/probe.ts`**

Change the `verdict` union to: `"pass" | "fail" | "error" | "pending"`. Run `npx vitest run` to confirm existing probe tests still pass.

- [ ] **Step 2: Write the failing test `test/suite.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { runSuite } from "../src/suite.js";
import { renderReport } from "../src/report.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";

describe("suite", () => {
  it("runs 4 passing + 3 pending against the reference enclave", async () => {
    const results = await runSuite(makeReferenceEnclave());
    expect(results.map((r) => r.assertion_id)).toEqual(["a1","a2","a3","a4","a5","a6","a7"]);
    expect(results.filter((r) => r.verdict === "pass").map((r) => r.assertion_id).sort()).toEqual(["a1","a2","a5","a7"]);
    expect(results.filter((r) => r.verdict === "pending").map((r) => r.assertion_id).sort()).toEqual(["a3","a4","a6"]);
  });
  it("renders a markdown report naming every assertion", async () => {
    const e = makeReferenceEnclave();
    const md = renderReport(await runSuite(e), e.buildInfo());
    for (const id of ["a1","a2","a3","a4","a5","a6","a7"]) expect(md.toLowerCase()).toContain(id);
    expect(md).toContain("PASS");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/suite.test.ts`
Expected: FAIL — cannot find `../src/suite.js`.

- [ ] **Step 4: Write `src/suite.ts`**

```ts
import type { EnclaveUnderTest } from "./contract/enclave.js";
import { runAssertion, type ProbeResult, type Probe } from "./probe.js";
import { ASSERTIONS } from "./assertions/registry.js";
import { a1ClosedEnum } from "./assertions/a1-closed-enum.js";
import { a2ContentFree } from "./assertions/a2-content-free.js";
import { a5Minimization } from "./assertions/a5-minimization.js";
import { a7AttestationSuspend } from "./assertions/a7-attestation-suspend.js";

const PROBES: Record<string, Probe> = {
  a1: a1ClosedEnum, a2: a2ContentFree, a5: a5Minimization, a7: a7AttestationSuspend,
};

export async function runSuite(e: EnclaveUnderTest): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  for (const meta of ASSERTIONS) {
    if (meta.status === "pending") {
      results.push({ assertion_id: meta.id, verdict: "pending", detail: meta.pendingReason ?? "pending" });
      continue;
    }
    results.push(await runAssertion(meta.id, PROBES[meta.id], e));
  }
  return results;
}
```

- [ ] **Step 5: Write `src/report.ts`**

```ts
import type { ProbeResult } from "./probe.js";

export function renderReport(results: ProbeResult[], meta: { build_hash: string; suite_version: string }): string {
  const lines = [
    `# OCSS conformance report`,
    ``,
    `- suite_version: \`${meta.suite_version}\``,
    `- build_hash: \`${meta.build_hash}\``,
    ``,
    `| assertion | verdict | detail |`,
    `|---|---|---|`,
    ...results.map((r) => `| ${r.assertion_id} | ${r.verdict.toUpperCase()} | ${r.detail.replace(/\|/g, "/")} |`),
  ];
  return lines.join("\n") + "\n";
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/suite.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: suite runner (4 pass + 3 pending) + markdown report"
```

---

## Task 10: Attestation build

**Files:**
- Create: `src/attestation/build.ts`
- Test: `test/build.test.ts`

**Interfaces:**
- Consumes: `ProbeResult` (Task 9).
- Produces: `UnsignedAttestation` type and `buildAttestation(results: ProbeResult[], meta: { attested_by: string; suite_version: string; build_hash: string; passed_at: string; liability_scope_ref: string }): UnsignedAttestation`. `assertions_passed` = ids with verdict `pass`; `assertions_pending` = ids with verdict `pending`. Throws if any executed assertion verdict is `fail`/`error` (a partial attestation must not silently claim a passing build).

- [ ] **Step 1: Write the failing test `test/build.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildAttestation } from "../src/attestation/build.js";
import { runSuite } from "../src/suite.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";

const META = {
  attested_by: "did:ocss:test-va",
  suite_version: "ocss-provider-harness/v0",
  build_hash: "ref-abc",
  passed_at: "2026-06-30T00:00:00Z",
  liability_scope_ref: "https://ocss.example/liability#v0",
};

describe("buildAttestation", () => {
  it("records passed and pending ids from reference results", async () => {
    const att = buildAttestation(await runSuite(makeReferenceEnclave()), META);
    expect(att.assertions_passed).toEqual(["a1","a2","a5","a7"]);
    expect(att.assertions_pending).toEqual(["a3","a4","a6"]);
    expect(att.spec).toBe("ocss-provider-harness/v0");
    expect(att.attested_by).toBe("did:ocss:test-va");
  });
  it("throws if an executed assertion failed", async () => {
    const results = await runSuite(makeReferenceEnclave());
    results[0] = { assertion_id: "a1", verdict: "fail", detail: "x" };
    expect(() => buildAttestation(results, META)).toThrow(/failed/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/build.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/attestation/build.ts`**

```ts
import type { ProbeResult } from "../probe.js";

export interface UnsignedAttestation {
  attested_by: string;
  suite_version: string;
  build_hash: string;
  passed_at: string;
  assertions_passed: string[];
  assertions_pending: string[];
  liability_scope_ref: string;
  spec: string;
}

export interface AttestationMeta {
  attested_by: string;
  suite_version: string;
  build_hash: string;
  passed_at: string;
  liability_scope_ref: string;
}

export function buildAttestation(results: ProbeResult[], meta: AttestationMeta): UnsignedAttestation {
  const failed = results.filter((r) => r.verdict === "fail" || r.verdict === "error");
  if (failed.length) {
    throw new Error(`cannot attest: ${failed.map((f) => f.assertion_id).join(",")} failed`);
  }
  return {
    attested_by: meta.attested_by,
    suite_version: meta.suite_version,
    build_hash: meta.build_hash,
    passed_at: meta.passed_at,
    assertions_passed: results.filter((r) => r.verdict === "pass").map((r) => r.assertion_id),
    assertions_pending: results.filter((r) => r.verdict === "pending").map((r) => r.assertion_id),
    liability_scope_ref: meta.liability_scope_ref,
    spec: "ocss-provider-harness/v0",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/build.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: build unsigned conformance_attestation from probe results"
```

---

## Task 11: Attestation sign (D-9 grammar)

**Files:**
- Create: `src/attestation/sign.ts`
- Test: `test/sign.test.ts`

**Interfaces:**
- Consumes: `UnsignedAttestation`; crypto-adapter (`marshal`, `ed25519Sign`, `ed25519Verify`, `seedFromPkcs8Pem`, `ed25519PublicFromSeed`, `b64urlEncode`, `b64urlDecode`).
- Produces: `SignedAttestation = UnsignedAttestation & { key_id: string; sig: string }`; `signingBytes(doc: UnsignedAttestation): Uint8Array` (canon of the doc with `key_id`/`sig` absent — exported so `verify` reuses the identical preimage); `signAttestation(doc: UnsignedAttestation, opts: { pkcs8Pem: string; key_id: string }): SignedAttestation`.

- [ ] **Step 1: Write the failing test `test/sign.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { signAttestation, signingBytes } from "../src/attestation/sign.js";
import * as crypto from "../src/crypto-adapter.js";

const DOC = {
  attested_by: "did:ocss:test-va", suite_version: "ocss-provider-harness/v0",
  build_hash: "ref-abc", passed_at: "2026-06-30T00:00:00Z",
  assertions_passed: ["a1","a2","a5","a7"], assertions_pending: ["a3","a4","a6"],
  liability_scope_ref: "https://ocss.example/liability#v0", spec: "ocss-provider-harness/v0",
};

describe("signAttestation", () => {
  it("produces an ed25519: sig that verifies over the key_id/sig-stripped canon", () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    const signed = signAttestation(DOC, { pkcs8Pem: pem, key_id: "va-2026-06" });
    expect(signed.sig.startsWith("ed25519:")).toBe(true);
    expect(signed.key_id).toBe("va-2026-06");

    const seed = crypto.seedFromPkcs8Pem(pem);
    const pub = crypto.ed25519PublicFromSeed(seed);
    const sigBytes = crypto.b64urlDecode(signed.sig.slice("ed25519:".length));
    expect(crypto.ed25519Verify(pub, signingBytes(DOC), sigBytes)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/sign.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/attestation/sign.ts`**

```ts
import type { UnsignedAttestation } from "./build.js";
import { marshal, ed25519Sign, seedFromPkcs8Pem, b64urlEncode } from "../crypto-adapter.js";

export interface SignedAttestation extends UnsignedAttestation {
  key_id: string;
  sig: string;
}

// D-9: sign over canon of the doc with key_id/sig absent.
export function signingBytes(doc: UnsignedAttestation): Uint8Array {
  return marshal(doc);
}

export function signAttestation(doc: UnsignedAttestation, opts: { pkcs8Pem: string; key_id: string }): SignedAttestation {
  const seed = seedFromPkcs8Pem(opts.pkcs8Pem);
  const sig = ed25519Sign(seed, signingBytes(doc));
  return { ...doc, key_id: opts.key_id, sig: "ed25519:" + b64urlEncode(sig) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/sign.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: sign conformance_attestation (D-9 grammar, ed25519)"
```

---

## Task 12: Attestation verify + fixture Trust List

**Files:**
- Create: `src/attestation/verify.ts`, `test/helpers/fixture-keys.ts`, `test/helpers/fixture-trustlist.ts`
- Test: `test/verify.test.ts`

**Interfaces:**
- Consumes: `SignedAttestation`, `signingBytes`; crypto-adapter (`verifyDocument`, `fromVerifiedDocument`, `ed25519Verify`, `b64urlDecode`).
- Produces: `verifyAttestation(att: SignedAttestation, trustList: SignedDocument, rootKeyXB64Url: string, now?: () => number): { ok: true }` (throws `VerifyError` with a `code` otherwise). Gate codes: `missing_liability_scope`, `bad_signature`, `unknown_signer`, `not_verifying_agency`, `conflict_of_interest`. Test helpers: `makeFixtureRoot()` → `{ pkcs8Pem, xB64Url }`; `mintTrustList(entries, root)` → `SignedDocument` (a root-signed Trust List whose entries may carry a `role` field).

> Implementer note: read `~/builds/phosra/packages/ocss-ts/src/trustlist/types.ts` for the exact `SignedDocument`/`TrustListDocument`/`Entry` field names and how the Go census shapes the signed `document`. `mintTrustList` must reproduce the same canonical `document` bytes the compiler signs (`canon.marshal` of the inner doc, signature over those bytes with the root seed, `key_id`/`alg`/`sig` outside). If reproducing the compiler's exact wire shape proves fiddly, the fallback is to construct the `TrustListDocument` object directly and call `fromVerifiedDocument(doc)` — bypassing `verifyDocument` — and verify the root signature separately; keep the public `verifyAttestation` signature unchanged.

- [ ] **Step 1: Write `test/helpers/fixture-keys.ts`**

```ts
import { generateKeyPairSync } from "node:crypto";
import * as crypto from "../../src/crypto-adapter.js";

export function makeEd25519(): { pkcs8Pem: string; xB64Url: string } {
  const { privateKey } = generateKeyPairSync("ed25519");
  const pkcs8Pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const seed = crypto.seedFromPkcs8Pem(pkcs8Pem);
  return { pkcs8Pem, xB64Url: crypto.b64urlEncode(crypto.ed25519PublicFromSeed(seed)) };
}
```

- [ ] **Step 2: Write `test/helpers/fixture-trustlist.ts`**

```ts
import * as crypto from "../../src/crypto-adapter.js";

export interface FixtureEntry {
  entity: string; did: string; role?: string; tier: string;
  status: "active" | "suspended" | "revoked"; valid_through: string;
  jwks: { signing_keys: { kty: "OKP"; crv: "Ed25519"; x: string; kid: string }[] };
}

// Minimal root-signed Trust List matching the @ocss/ts SignedDocument wire form.
// Adjust field names to trustlist/types.ts as needed (see implementer note).
export function mintTrustList(entries: FixtureEntry[], rootPkcs8Pem: string, issuedAt = "2026-06-30T00:00:00Z") {
  const document = { ocss_version: "4", type: "issue", issued_at: issuedAt, entries };
  const bytes = crypto.marshal(document);
  const seed = crypto.seedFromPkcs8Pem(rootPkcs8Pem);
  const sig = "ed25519:" + crypto.b64urlEncode(crypto.ed25519Sign(seed, bytes));
  return { document: Buffer.from(bytes).toString("utf8"), key_id: "root-fixture", alg: "ed25519", sig } as any;
}
```

- [ ] **Step 3: Write the failing test `test/verify.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { signAttestation } from "../src/attestation/sign.js";
import { verifyAttestation } from "../src/attestation/verify.js";
import { makeEd25519 } from "./helpers/fixture-keys.js";
import { mintTrustList, type FixtureEntry } from "./helpers/fixture-trustlist.js";

const BASE = {
  attested_by: "did:ocss:va", suite_version: "ocss-provider-harness/v0", build_hash: "ref-abc",
  passed_at: "2026-06-30T00:00:00Z", assertions_passed: ["a1","a2","a5","a7"],
  assertions_pending: ["a3","a4","a6"], liability_scope_ref: "https://x/liability#v0", spec: "ocss-provider-harness/v0",
};

function vaEntry(did: string, kid: string, x: string, role = "verifying-agency"): FixtureEntry {
  return { entity: "VA", did, role, tier: "accredited", status: "active",
    valid_through: "2026-07-06T00:00:00Z", jwks: { signing_keys: [{ kty: "OKP", crv: "Ed25519", x, kid }] } };
}

describe("verifyAttestation", () => {
  it("accepts a valid VA-signed attestation", () => {
    const root = makeEd25519(); const va = makeEd25519();
    const att = signAttestation(BASE, { pkcs8Pem: va.pkcs8Pem, key_id: "va-k" });
    const tl = mintTrustList([vaEntry("did:ocss:va", "va-k", va.xB64Url)], root.pkcs8Pem);
    expect(verifyAttestation(att, tl, root.xB64Url, () => Date.parse("2026-07-01T00:00:00Z"))).toEqual({ ok: true });
  });
  it("rejects a tampered signature", () => {
    const root = makeEd25519(); const va = makeEd25519();
    const att = signAttestation(BASE, { pkcs8Pem: va.pkcs8Pem, key_id: "va-k" });
    att.build_hash = "tampered";
    const tl = mintTrustList([vaEntry("did:ocss:va", "va-k", va.xB64Url)], root.pkcs8Pem);
    expect(() => verifyAttestation(att, tl, root.xB64Url, () => Date.parse("2026-07-01T00:00:00Z"))).toThrow(/bad_signature/);
  });
  it("rejects a signer that is not a verifying-agency", () => {
    const root = makeEd25519(); const va = makeEd25519();
    const att = signAttestation(BASE, { pkcs8Pem: va.pkcs8Pem, key_id: "va-k" });
    const tl = mintTrustList([vaEntry("did:ocss:va", "va-k", va.xB64Url, "classifier-accredited")], root.pkcs8Pem);
    expect(() => verifyAttestation(att, tl, root.xB64Url, () => Date.parse("2026-07-01T00:00:00Z"))).toThrow(/not_verifying_agency/);
  });
  it("rejects a conflicted signer (also classifier-accredited)", () => {
    const root = makeEd25519(); const va = makeEd25519();
    const att = signAttestation(BASE, { pkcs8Pem: va.pkcs8Pem, key_id: "va-k" });
    const tl = mintTrustList([
      vaEntry("did:ocss:va", "va-k", va.xB64Url),
      { entity: "VA", did: "did:ocss:va", role: "classifier-accredited", tier: "accredited", status: "active",
        valid_through: "2026-07-06T00:00:00Z", jwks: { signing_keys: [{ kty: "OKP", crv: "Ed25519", x: va.xB64Url, kid: "va-k" }] } },
    ], root.pkcs8Pem);
    expect(() => verifyAttestation(att, tl, root.xB64Url, () => Date.parse("2026-07-01T00:00:00Z"))).toThrow(/conflict_of_interest/);
  });
  it("rejects a missing liability scope", () => {
    const root = makeEd25519(); const va = makeEd25519();
    const att = signAttestation({ ...BASE, liability_scope_ref: "" }, { pkcs8Pem: va.pkcs8Pem, key_id: "va-k" });
    const tl = mintTrustList([vaEntry("did:ocss:va", "va-k", va.xB64Url)], root.pkcs8Pem);
    expect(() => verifyAttestation(att, tl, root.xB64Url, () => Date.parse("2026-07-01T00:00:00Z"))).toThrow(/missing_liability_scope/);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run test/verify.test.ts`
Expected: FAIL — cannot find `../src/attestation/verify.js`.

- [ ] **Step 5: Write `src/attestation/verify.ts`**

```ts
import type { SignedAttestation } from "./sign.js";
import { signingBytes } from "./sign.js";
import { ed25519Verify, b64urlDecode } from "../crypto-adapter.js";

export class VerifyError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "VerifyError"; }
}

interface RawEntry {
  did: string; role?: string; status?: string; valid_through?: string;
  jwks?: { signing_keys?: { x: string; kid: string }[] };
}

export function verifyAttestation(
  att: SignedAttestation,
  trustList: { document: string; sig: string; key_id: string },
  rootKeyXB64Url: string,
  now: () => number = () => Date.now(),
): { ok: true } {
  // Gate 0: liability scope MUST be present (spec §8).
  if (!att.liability_scope_ref || att.liability_scope_ref.length === 0) {
    throw new VerifyError("missing_liability_scope", "attestation has no liability_scope_ref");
  }

  // Verify the Trust List is root-signed, then read its entries.
  const tlBytes = new TextEncoder().encode(trustList.document);
  const tlSig = b64urlDecode(trustList.sig.replace(/^ed25519:/, ""));
  if (!ed25519Verify(b64urlDecode(rootKeyXB64Url), tlBytes, tlSig)) {
    throw new VerifyError("bad_signature", "trust list root signature invalid");
  }
  const entries: RawEntry[] = JSON.parse(trustList.document).entries ?? [];

  const signer = entries.find((e) => e.did === att.attested_by && e.role === "verifying-agency");
  if (!signer) throw new VerifyError("not_verifying_agency", `no verifying-agency entry for ${att.attested_by}`);
  if (signer.status !== "active") throw new VerifyError("not_verifying_agency", "signer entry not active");
  if (signer.valid_through && now() > Date.parse(signer.valid_through)) {
    throw new VerifyError("not_verifying_agency", "signer entry expired (TTL)");
  }

  // Conflict of interest: same DID must not also hold a classifier-accredited entry.
  if (entries.some((e) => e.did === att.attested_by && e.role === "classifier-accredited")) {
    throw new VerifyError("conflict_of_interest", "signer also holds a classifier-accredited entry");
  }

  // Verify the attestation signature with the signer's published key.
  const key = signer.jwks?.signing_keys?.find((k) => k.kid === att.key_id);
  if (!key) throw new VerifyError("unknown_signer", `key_id ${att.key_id} not on signer entry`);
  const sigBytes = b64urlDecode(att.sig.replace(/^ed25519:/, ""));
  const { key_id, sig, ...unsigned } = att;
  if (!ed25519Verify(b64urlDecode(key.x), signingBytes(unsigned), sigBytes)) {
    throw new VerifyError("bad_signature", "attestation signature invalid");
  }
  return { ok: true };
}
```

> Implementer note: this reads entries from the signed `document` string directly (after verifying the root signature) rather than via `fromVerifiedDocument`, because the `role` field is not on the typed `Entry`. If you prefer the typed `Resolver` path for status/TTL, use it for those checks and still read `role` off the raw entry. Keep all five gate codes and the thrown `VerifyError`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/verify.test.ts`
Expected: PASS (5 tests). If the fixture `document` shape mismatches what `verifyAttestation` parses, align `mintTrustList`'s object with what `verify.ts` reads (both use `{ entries: [...] }`).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: verify attestation against Trust List (sig/VA/TTL/COI/liability gates)"
```

---

## Task 13: CLI

**Files:**
- Create: `src/cli.ts`
- Test: `test/cli.test.ts`

**Interfaces:**
- Consumes: `runSuite`, `renderReport`, `buildAttestation`, `signAttestation`, `verifyAttestation`, `makeReferenceEnclave`.
- Produces: a CLI with subcommands `run` / `attest` / `sign` / `verify`. `--enclave ref` selects the reference enclave (the only adapter in v0). `run` prints the markdown report and exits non-zero if any executed assertion is not `pass`. `attest` prints the unsigned attestation JSON. `sign --key <pem> --attested-by <did> --key-id <kid> <att.json>` prints the signed JSON. `verify --trust-list <file> --root-x <b64url> <signed.json>` prints `OK` / exits non-zero on `VerifyError`.

- [ ] **Step 1: Write the failing test `test/cli.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

function cli(args: string[], input?: string): { out: string; code: number } {
  try {
    const out = execFileSync("npx", ["tsx", "src/cli.ts", ...args], { input, encoding: "utf8" });
    return { out, code: 0 };
  } catch (e: any) {
    return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status ?? 1 };
  }
}

describe("cli", () => {
  it("run --enclave ref prints a report and exits 0", () => {
    const r = cli(["run", "--enclave", "ref"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("OCSS conformance report");
    expect(r.out.toUpperCase()).toContain("PASS");
  }, 30000);

  it("attest --enclave ref emits attestation JSON with passed/pending", () => {
    const r = cli(["attest", "--enclave", "ref", "--attested-by", "did:ocss:va",
      "--liability-scope-ref", "https://x/liability#v0", "--passed-at", "2026-06-30T00:00:00Z"]);
    const att = JSON.parse(r.out);
    expect(att.assertions_passed).toEqual(["a1","a2","a5","a7"]);
    expect(att.assertions_pending).toEqual(["a3","a4","a6"]);
  }, 30000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/cli.test.ts`
Expected: FAIL — cannot find `src/cli.ts`.

- [ ] **Step 3: Write `src/cli.ts`**

```ts
#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { makeReferenceEnclave } from "../reference-enclave/index.js";
import { runSuite } from "./suite.js";
import { renderReport } from "./report.js";
import { buildAttestation } from "./attestation/build.js";
import { signAttestation } from "./attestation/sign.js";
import { verifyAttestation, VerifyError } from "./attestation/verify.js";

function flag(args: string[], name: string, def?: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
}
function pickEnclave(args: string[]) {
  if (flag(args, "--enclave", "ref") !== "ref") throw new Error("v0 supports only --enclave ref");
  return makeReferenceEnclave();
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "run") {
    const e = pickEnclave(args);
    const results = await runSuite(e);
    process.stdout.write(renderReport(results, e.buildInfo()));
    process.exit(results.some((r) => r.verdict === "fail" || r.verdict === "error") ? 1 : 0);
  }
  if (cmd === "attest") {
    const e = pickEnclave(args);
    const results = await runSuite(e);
    const att = buildAttestation(results, {
      attested_by: flag(args, "--attested-by")!,
      suite_version: e.buildInfo().suite_version,
      build_hash: e.buildInfo().build_hash,
      passed_at: flag(args, "--passed-at")!,
      liability_scope_ref: flag(args, "--liability-scope-ref")!,
    });
    process.stdout.write(JSON.stringify(att, null, 2) + "\n");
    return;
  }
  if (cmd === "sign") {
    const doc = JSON.parse(readFileSync(args[args.length - 1], "utf8"));
    const signed = signAttestation(doc, { pkcs8Pem: readFileSync(flag(args, "--key")!, "utf8"), key_id: flag(args, "--key-id")! });
    process.stdout.write(JSON.stringify(signed, null, 2) + "\n");
    return;
  }
  if (cmd === "verify") {
    const att = JSON.parse(readFileSync(args[args.length - 1], "utf8"));
    const tl = JSON.parse(readFileSync(flag(args, "--trust-list")!, "utf8"));
    try {
      verifyAttestation(att, tl, flag(args, "--root-x")!);
      process.stdout.write("OK\n");
    } catch (err) {
      process.stderr.write(`FAIL ${(err as VerifyError).code ?? ""}: ${(err as Error).message}\n`);
      process.exit(1);
    }
    return;
  }
  process.stderr.write("usage: ocss-harness <run|attest|sign|verify> [flags]\n");
  process.exit(2);
}
main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/cli.test.ts`
Expected: PASS (2 tests). (First run compiles via tsx; the 30s timeout covers cold start.)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: ocss-harness CLI (run|attest|sign|verify)"
```

---

## Task 14: README + end-to-end pipeline test + final gate

**Files:**
- Create: `README.md`, `test/e2e.test.ts`

**Interfaces:**
- Consumes: the full public surface (suite → build → sign → verify).

- [ ] **Step 1: Write `test/e2e.test.ts`** (in-process full pipeline)

```ts
import { describe, it, expect } from "vitest";
import { runSuite } from "../src/suite.js";
import { buildAttestation } from "../src/attestation/build.js";
import { signAttestation } from "../src/attestation/sign.js";
import { verifyAttestation } from "../src/attestation/verify.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";
import { makeEd25519 } from "./helpers/fixture-keys.js";
import { mintTrustList, type FixtureEntry } from "./helpers/fixture-trustlist.js";

describe("end-to-end", () => {
  it("run -> attest -> sign -> verify is green for the reference enclave", () => {
    const root = makeEd25519(); const va = makeEd25519();
    return runSuite(makeReferenceEnclave()).then((results) => {
      const unsigned = buildAttestation(results, {
        attested_by: "did:ocss:va", suite_version: "ocss-provider-harness/v0",
        build_hash: "ref-abc", passed_at: "2026-06-30T00:00:00Z",
        liability_scope_ref: "https://ocss.example/liability#v0",
      });
      const signed = signAttestation(unsigned, { pkcs8Pem: va.pkcs8Pem, key_id: "va-k" });
      const entry: FixtureEntry = { entity: "VA", did: "did:ocss:va", role: "verifying-agency",
        tier: "accredited", status: "active", valid_through: "2026-07-06T00:00:00Z",
        jwks: { signing_keys: [{ kty: "OKP", crv: "Ed25519", x: va.xB64Url, kid: "va-k" }] } };
      const tl = mintTrustList([entry], root.pkcs8Pem);
      expect(verifyAttestation(signed, tl, root.xB64Url, () => Date.parse("2026-07-01T00:00:00Z"))).toEqual({ ok: true });
    });
  });
});
```

- [ ] **Step 2: Run the e2e test**

Run: `npx vitest run test/e2e.test.ts`
Expected: PASS (1 test).

- [ ] **Step 3: Write `README.md`** (usage + the independence framing)

````markdown
# @ocss/provider-harness

Independent OCSS conformance harness. A **verifying-agency** runs it against a provider
enclave, then signs the resulting `conformance_attestation` with its own Ed25519 key. This
project is intentionally independent of Phosra (the CA model: a verifier cannot accredit a
service it operates). It reuses the OCSS crypto from `@ocss/ts` (vendored tarball, behind
`src/crypto-adapter.ts`).

## Assertions
- **A1** closed-enum fail-closed · **A2** content-free signal lane · **A5** minimization
  attestation (salted-HMAC Merkle) · **A7** attestation-fail → suspend — **passable today**.
- **A3 / A4 / A6** — declared `pending` (consent infra / capability endpoint / advocate lane).

## Use
```bash
npm install
npx vitest run                              # full test suite
npm run harness -- run    --enclave ref     # probe + report
npm run harness -- attest --enclave ref --attested-by did:ocss:va \
  --liability-scope-ref https://ocss.example/liability#v0 --passed-at 2026-06-30T00:00:00Z > att.json
npm run harness -- sign   --key va.pem --key-id va-2026-06 att.json > signed.json
npm run harness -- verify --trust-list trust-list.json --root-x <rootKeyX> signed.json
```

## Refreshing the vendored crypto
`scripts/refresh-ocss-ts.sh` re-packs `@ocss/ts` from the monorepo when its crypto changes.
````

- [ ] **Step 4: Final gate — typecheck + full suite**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; ALL tests pass (crypto-adapter, merkle, registry, reference-enclave, a1, a2, a5, a7, suite, build, sign, verify, cli, e2e).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "docs: README + end-to-end pipeline test; final green gate"
```

---

## Self-Review notes (for the executor)

- **Spec coverage:** contract (Task 2), reference enclave (Task 4), A1/A2/A5/A7 probes with discriminating mutants (Tasks 5–8), A3/A4/A6 pending (Tasks 2 + 9), attestation build/sign/verify with all four gates + liability (Tasks 10–12), CLI run/attest/sign/verify (Task 13), report + README + e2e (Tasks 9, 14). Independence (separate repo, OCSS-neutral name, vendored crypto) is structural across Task 1.
- **Anti-theater bar:** every green probe (Tasks 5–8) ships a reference-pass test **and** a mutant-fail test.
- **Type consistency:** `ProbeResult.verdict` gains `"pending"` in Task 9 Step 1 before `suite.ts` uses it; `signingBytes` is defined in Task 11 and reused by Task 12; `UnsignedAttestation`/`SignedAttestation` flow build → sign → verify unchanged.
- **Known soft spot:** the fixture Trust List wire shape (Task 12) is the one place that must match `@ocss/ts` `trustlist/types.ts`; both the implementer note and the fallback path are documented so a mismatch is a quick alignment, not a redesign.
```
