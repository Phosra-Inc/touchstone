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
