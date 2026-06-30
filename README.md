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
