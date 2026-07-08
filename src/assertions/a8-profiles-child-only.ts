import type { ProbeResult } from "../probe.js";
import type { PlatformOAuthUnderTest } from "../contract/platform-oauth.js";

// A8 — profiles-child-only (EXT-04 §3.3.1; suite case EXT04-CN-09; CR-14).
//
// The platform's OAuth profiles leg returns the authenticated account's CHILD
// profiles only: exactly [] for an account holding none, and NEVER the account
// holder or an account-level placeholder ("Account"). The consuming Link plane
// has no signal by which to tell a placeholder from a real child — a lone
// placeholder entry gets auto-confirmed and the bind lands on (or fails
// against) a principal that is not a child. This is the observed violation
// that motivated the contract, so the placeholder case is named explicitly in
// the failure detail.
//
// Drive: complete authorize → token → profiles with the declared `no_children`
// test account (REQUIRED — a target that declares none errors, and cannot
// attest); when a `with_children` account is also declared, its entries must
// each carry child semantics only ({id, displayName}; `kind`, when present,
// MUST be "child"; no placeholder names).

/** A probe over the platform OAuth surface rather than the provider enclave. */
export type PlatformProbe = (p: PlatformOAuthUnderTest) => Promise<ProbeResult>;

// Account-holder / placeholder names a profile entry must never carry. Matched
// case-insensitively against `id` and `displayName` after trimming. Small and
// literal on purpose: the no-children lane already fails on ANY entry; this
// list only sharpens the detail (and catches the account holder hiding among
// real children on the with-children lane).
const PLACEHOLDER_NAMES = new Set([
  "account",
  "account holder",
  "accountholder",
  "account owner",
  "owner",
  "primary",
  "primary profile",
  "default",
  "default profile",
  "main profile",
  "adult",
]);

function isPlaceholderEntry(entry: unknown): boolean {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  for (const field of ["id", "displayName", "display_name", "name"]) {
    const v = e[field];
    if (typeof v === "string" && PLACEHOLDER_NAMES.has(v.trim().toLowerCase())) return true;
  }
  return false;
}

/** Returns the first child-semantics violation in an entry, or null if clean. */
function childSemanticsViolation(entry: unknown): string | null {
  if (typeof entry !== "object" || entry === null) return "entry is not a JSON object";
  const e = entry as Record<string, unknown>;
  if (typeof e.id !== "string" || e.id.trim() === "") return "entry has no non-empty string `id`";
  if (typeof e.displayName !== "string" || e.displayName.trim() === "") {
    return "entry has no non-empty string `displayName`";
  }
  if (e.kind !== undefined && e.kind !== "child") {
    return `entry carries kind=${JSON.stringify(e.kind)} — when present, kind MUST be "child"`;
  }
  if (isPlaceholderEntry(entry)) {
    return "entry is an account-holder/placeholder, not a child profile";
  }
  return null;
}

export const a8ProfilesChildOnly: PlatformProbe = async (p): Promise<ProbeResult> => {
  const declared = p.accounts();
  if (!declared.no_children) {
    return {
      assertion_id: "a8",
      verdict: "error",
      detail:
        "target declares no `no_children` test account (accounts.no_children in the platform-oauth config) — a8 requires one; a platform cannot attest without it",
    };
  }

  // The load-bearing case: an account with NO child profiles must yield exactly [].
  const empty = await p.profiles("no_children");
  if (!Array.isArray(empty)) {
    return {
      assertion_id: "a8",
      verdict: "fail",
      detail: "profiles response for the no-children account is not a bare JSON array (EXT-04 §3.3.1)",
      evidence: empty,
    };
  }
  if (empty.length !== 0) {
    const placeholder = empty.some(isPlaceholderEntry);
    return {
      assertion_id: "a8",
      verdict: "fail",
      detail: placeholder
        ? `no-children account returned ${empty.length} entr${empty.length === 1 ? "y" : "ies"} including an account-holder/placeholder — the account holder MUST NEVER be returned as a profile (EXT-04 §3.3.1)`
        : `expected exactly [] for an account with no child profiles, got ${empty.length} entr${empty.length === 1 ? "y" : "ies"} (EXT-04 §3.3.1)`,
      evidence: empty,
    };
  }

  // Optional second lane: a with-children account's entries carry child semantics only.
  if (declared.with_children) {
    const withKids = await p.profiles("with_children");
    if (!Array.isArray(withKids)) {
      return {
        assertion_id: "a8",
        verdict: "fail",
        detail: "profiles response for the with-children account is not a bare JSON array (EXT-04 §3.3.1)",
        evidence: withKids,
      };
    }
    if (withKids.length === 0) {
      return {
        assertion_id: "a8",
        verdict: "fail",
        detail:
          "with-children test account returned no profiles — the declared fixture does not hold child profiles (fix the target's test-account seed)",
      };
    }
    for (const entry of withKids) {
      const violation = childSemanticsViolation(entry);
      if (violation) {
        return {
          assertion_id: "a8",
          verdict: "fail",
          detail: `with-children account: ${violation} (EXT-04 §3.3.1 child-semantics)`,
          evidence: entry,
        };
      }
    }
    return {
      assertion_id: "a8",
      verdict: "pass",
      detail: `no-children account → []; ${withKids.length} child-semantic entr${withKids.length === 1 ? "y" : "ies"} on the with-children account`,
    };
  }

  return {
    assertion_id: "a8",
    verdict: "pass",
    detail: "no-children account → [] (no with_children account declared; child-semantics lane skipped)",
  };
};
