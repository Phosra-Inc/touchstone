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
  attestation (salted-HMAC Merkle) · **A7** attestation-fail → suspend — **passable today**.
- **A3 / A4 / A6** — declared `pending` (consent infra / capability endpoint / advocate lane).

## Install
```bash
npm install @openchildsafety/provider-harness
npx ocss-harness run --enclave ref          # probe the reference enclave + print the report
```

## Develop (from a clone)
```bash
npm install
npx vitest run                              # full test suite
npm run harness -- run    --enclave ref     # probe + report
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
