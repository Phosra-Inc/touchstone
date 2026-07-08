# @openchildsafety/provider-harness

Independent OCSS conformance harness. A **verifying-agency** — the reference one is named
**Touchstone** (`did:ocss:touchstone`) — runs it against a provider enclave, then signs the
resulting `conformance_attestation` with its own Ed25519 key. This project is the *tooling*;
Touchstone is the *agency* that runs it, and is intentionally independent of Phosra (the CA
model: a verifier cannot accredit a service it operates). The OCSS crypto it uses (JCS canon + Ed25519 + the closed vocab) is
inlined under `src/crypto/` behind the single `src/crypto-adapter.ts` seam, so the package has
**zero runtime dependencies**; a dev-only parity test keeps the inlined copies byte-identical to
the OCSS reference implementation (`@openchildsafety/ocss`).

## Assertions
- **A1** closed-enum fail-closed · **A2** content-free signal lane · **A5** minimization
  attestation (salted-HMAC Merkle) · **A7** attestation-fail → suspend — **passable today**
  against a provider enclave.
- **A8** profiles-child-only (EXT-04 §3.3.1 / EXT04-CN-09): the platform's OAuth profiles
  leg returns the authenticated account's **child profiles only** — exactly `[]` for an
  account with none, and **never** the account holder or a placeholder ("Account") entry —
  **passable today** against a platform OAuth target (`--platform-oauth`); `pending` when
  no platform target is configured.
- **A3 / A4 / A6** — declared `pending` (consent infra / capability endpoint / advocate lane).

## Install
```bash
npm install @openchildsafety/provider-harness
npx provider-harness run --enclave ref                 # probe the bundled reference enclave
npx provider-harness run --enclave-url https://enclave.example.com   # probe a REAL enclave (live-target)
```

### CLI name
The canonical bin is **`provider-harness`**. `ocss-harness` is kept as a back-compat alias
(both resolve to the same entrypoint), reconciling the name Phosra's accreditation docs use
(`npx -p @openchildsafety/provider-harness provider-harness`) with the published package.

## Target modes
- **`--enclave ref`** (default) — the bundled reference enclave; makes A1/A2/A5/A7 pass. Used to
  self-test the harness and demo the report.
- **`--enclave-url <https url>`** — the **live-target** mode: run the same A1–A7 suite against a
  real provider enclave over HTTP. This is the independent-assessor tool of OCSS **§5.9** ("the
  verifier tool" that ship-gates v1.0), operated under the open assessor market of **§5.4** — the
  harness aims at a provider's own endpoint, not a mock it also authored. HTTPS is required for any
  non-loopback host; plain `http` is tolerated only for `localhost`/`127.0.0.1` (local fixtures).

  The target enclave MUST implement:
  ```
  GET  {url}/buildinfo  -> { "build_hash": string, "suite_version": string }
  POST {url}/classify   (JSON ClassifyInput + { "upstream_attestation": <state> })
                        -> ClassifyOutput  ({ "kind": "signal" | "rejected" | "suspended", ... })
  ```
- **`--platform-oauth <config.json>`** — the **platform-profiles** target (A8): drive the
  platform's hosted OAuth surface (authorize → token → profiles) with its **declared test
  accounts** and check the EXT-04 §3.3.1 profiles contract. The config declares the three
  leg URLs, the registered `redirect_uri`, and the test accounts (`no_children` is REQUIRED
  for A8 — a target that declares none errors and cannot attest; `with_children` is optional
  and adds the child-semantics lane). Account selection rides the authorize query string via
  `authorize_params` (whatever the platform's machine-drivable test lane keys on); the
  harness always sends `redirect_uri`, `state`, and `decision=approve`. HTTPS required for
  non-loopback hosts, as with `--enclave-url`.

  ```json
  {
    "authorize_url": "https://platform.example/api/ocss/authorize",
    "token_url":     "https://platform.example/api/ocss/token",
    "profiles_url":  "https://platform.example/api/ocss/profiles",
    "redirect_uri":  "https://harness.example/callback",
    "accounts": {
      "no_children":   { "authorize_params": { "account": "e2e-no-children" } },
      "with_children": { "authorize_params": { "account": "e2e-with-children" } }
    }
  }
  ```

## Develop (from a clone)
```bash
npm install
npx vitest run                              # full test suite
npm run harness -- run    --enclave ref     # probe + report (bin: provider-harness / ocss-harness)
npm run harness -- attest --enclave ref --attested-by did:ocss:va \
  --liability-scope-ref https://ocss.example/liability#v0 --passed-at 2026-06-30T00:00:00Z > att.json
npm run harness -- sign   --key va.pem --key-id va-2026-06 att.json > signed.json
npm run harness -- verify --trust-list trust-list.json --root-x <rootKeyX> signed.json
```

## v0 scope & limitations

- The reference enclave emits a **structural/mock** OCSS envelope (a plain object), not yet
  produced via `@ocss/ts` `seal`/`signSender`; A2 inspects structure rather than calling
  `@ocss/ts` `validate`/`open`.
- `verify` checks attestations against the harness's **own fixture Trust-List shape**
  (`{document, sig, key_id}` with a `role` field on entries), NOT yet the live `@ocss/ts`
  `SignedDocument`/`Entry` wire form — because the `verifying-agency` role does not exist in
  the OCSS census yet, so there is no real VA Trust-List entry to test against.
- Real-Trust-List and real-envelope interop are deliberate follow-on work.

## Refreshing the vendored crypto
`scripts/refresh-ocss-ts.sh` re-packs `@ocss/ts` from the monorepo when its crypto changes.
