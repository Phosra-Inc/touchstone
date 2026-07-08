#!/usr/bin/env node
import { readFileSync } from "node:fs";
import type { EnclaveUnderTest } from "./contract/enclave.js";
import type { PlatformOAuthConfig, PlatformOAuthUnderTest } from "./contract/platform-oauth.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";
import { makeLiveEnclave } from "./live-enclave.js";
import { makeLivePlatformOAuth } from "./live-platform-oauth.js";
import { runSuite, type SuiteTargets } from "./suite.js";
import { renderReport } from "./report.js";
import { buildAttestation } from "./attestation/build.js";
import { signAttestation } from "./attestation/sign.js";
import { verifyAttestation, VerifyError } from "./attestation/verify.js";

function flag(args: string[], name: string, def?: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
}

// Enclave selection. Two target modes:
//   --enclave-url <https url>  -> probe a REAL provider enclave over HTTP (live-target).
//   --enclave ref              -> the bundled reference enclave (default; unchanged).
// The live-target leg is the independent-assessor tool of OCSS §5.9 run under the
// open assessor market of §5.4: the same A1/A2/A5/A7 assertions, aimed at a provider's
// own endpoint instead of a mock the harness also ships.
async function selectEnclave(args: string[]): Promise<EnclaveUnderTest> {
  const url = flag(args, "--enclave-url");
  if (url) {
    const timeout = flag(args, "--timeout-ms");
    return makeLiveEnclave(url, timeout ? { timeoutMs: Number(timeout) } : {});
  }
  if (flag(args, "--enclave", "ref") !== "ref") {
    throw new Error("v0 supports only --enclave ref, or --enclave-url <https url> for a live target");
  }
  return makeReferenceEnclave();
}

// Platform-OAuth target selection (a8 / EXT-04 §3.3.1):
//   --platform-oauth <config.json>  -> drive the platform's authorize/token/profiles
//                                      legs with its declared test accounts.
// Absent, the platform-oauth assertions report `pending` — never a silent pass.
function selectTargets(args: string[]): SuiteTargets {
  const path = flag(args, "--platform-oauth");
  if (!path) return {};
  const timeout = flag(args, "--timeout-ms");
  const config = JSON.parse(readFileSync(path, "utf8")) as PlatformOAuthConfig;
  const platform: PlatformOAuthUnderTest = makeLivePlatformOAuth(
    config,
    timeout ? { timeoutMs: Number(timeout) } : {},
  );
  return { platform };
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "run") {
    const e = await selectEnclave(args);
    const results = await runSuite(e, selectTargets(args));
    process.stdout.write(renderReport(results, e.buildInfo()));
    process.exit(results.some((r) => r.verdict === "fail" || r.verdict === "error") ? 1 : 0);
  }
  if (cmd === "attest") {
    const e = await selectEnclave(args);
    const results = await runSuite(e, selectTargets(args));
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
  process.stderr.write(
    "usage: provider-harness <run|attest|sign|verify> [--enclave ref | --enclave-url <https url>] [--platform-oauth <config.json>] [flags]\n",
  );
  process.exit(2);
}
main().catch((err) => {
  process.stderr.write(`error: ${(err as Error).message}\n`);
  process.exit(1);
});
