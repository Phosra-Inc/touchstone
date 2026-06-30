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
