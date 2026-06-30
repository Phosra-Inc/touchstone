// Vendored verbatim from @ocss/ts src/canon.ts — kept byte-identical via test/parity.test.ts. Re-sync via scripts/refresh-ocss-ts.sh; never hand-edit.
// Package canon renders the RFC 8785 (JCS) canonical-JSON subset every OCSS
// signature base and Receipt signed-bytes use (contract D-2): object keys
// sorted by UTF-16 code units, JCS string escaping, integers only — any float
// is an error, because no OCSS signed artifact carries one. time.Time values
// are pre-serialized by callers as RFC3339 strings (the wire string is what
// marshal sees).
//
// This is the TypeScript reference port. It reproduces internal/ocss/canon/
// canon.go byte-for-byte; the 9 golden vectors in the §8.5 bundle's
// canon-vectors.json pin the exact bytes. NEVER edit a `canonical` string — a
// Go<->TS split is a spec defect on the errata rail, never a vector edit.
//
// Preconditions (mirror canon.go's doc):
//   - Raw JSON input MUST NOT contain duplicate member names. JSON.parse keeps
//     the LAST duplicate (matching Go map decoding); verifiers consuming
//     EXTERNAL bytes must reject duplicates BEFORE canonicalizing — that is the
//     envelope/receipt verifier's duty (Tasks 6/7), not this module's.
//   - Input strings MUST be well-formed Unicode. Behavior on lone surrogates is
//     outside the cross-language byte contract the vectors pin.
//
// The 1.0/1e3 boundary (Task 1 spike finding, folded in): JS has no int/float
// distinction. `1.0` === `1` and `1e3` === `1000` at runtime (IEEE 754), and
// Number.isInteger(1.0) === true — so a runtime number cannot carry float-ness.
// The float-TEXT rejection (a wire string "1.0") therefore lives at the
// JSON.parse boundary, where "1.0" parses to the integer 1; it is NOT a
// marshal-layer reject. What marshal DOES reject at runtime: fractions, NaN,
// Infinity, and any integer beyond 2^53-1.

const MAX_SAFE = 9007199254740991; // 2^53 - 1 = Number.MAX_SAFE_INTEGER

/**
 * marshal renders v as RFC 8785 (JCS) canonical JSON over the value domain OCSS
 * signs: objects, arrays, strings, integers, booleans, null. Floats are
 * rejected (no OCSS signed artifact carries one). Returns UTF-8 bytes.
 */
export function marshal(v: unknown): Uint8Array {
  return new TextEncoder().encode(emit(v));
}

function emit(v: unknown): string {
  if (v === null) return "null";
  switch (typeof v) {
    case "boolean":
      return v ? "true" : "false";
    case "number":
      return emitNumber(v);
    case "string":
      return emitString(v);
    case "object":
      if (Array.isArray(v)) {
        return "[" + v.map(emit).join(",") + "]";
      }
      return emitObject(v as Record<string, unknown>);
    default:
      // bigint, undefined, function, symbol — none is an OCSS signed value.
      throw new Error(`canon: unsupported value type ${typeof v}`);
  }
}

function emitNumber(n: number): string {
  // The integer test IS the float rejection: Number.isInteger is false for
  // 1.5, 1e-3, NaN, Infinity. (1.0/1e3 are integer-valued doubles — see header.)
  if (!Number.isInteger(n)) {
    throw new Error(
      `canon: non-integer number ${n} rejected — OCSS signed artifacts carry integers only (D-2)`,
    );
  }
  if (Math.abs(n) > MAX_SAFE) {
    throw new Error(
      `canon: integer ${n} exceeds 2^53-1 and is not exactly representable as an IEEE 754 double`,
    );
  }
  if (Object.is(n, -0)) return "0"; // -0 normalizes to 0 (canon.go emitInteger)
  return String(n);
}

function emitString(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const cu = s.charCodeAt(i); // UTF-16 code unit — surrogate pairs preserved
    switch (cu) {
      case 0x22: out += '\\"'; break;
      case 0x5c: out += "\\\\"; break;
      case 0x08: out += "\\b"; break;
      case 0x09: out += "\\t"; break;
      case 0x0a: out += "\\n"; break;
      case 0x0c: out += "\\f"; break;
      case 0x0d: out += "\\r"; break;
      default:
        if (cu < 0x20) {
          out += "\\u" + cu.toString(16).padStart(4, "0"); // lowercase hex
        } else {
          out += s[i]; // literal char (incl. each half of an astral pair)
        }
    }
  }
  return out + '"';
}

function emitObject(o: Record<string, unknown>): string {
  // Native JS string comparison is UTF-16-code-unit lexicographic — exactly
  // RFC 8785 §3.2.3 / canon.go's sortUTF16. NEVER sort by code point
  // (.codePointAt / Array.from re-combine astral chars and mis-order them:
  // the utf16_key_order vector pins 😀 before ！).
  const keys = Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return "{" + keys.map((k) => emitString(k) + ":" + emit(o[k])).join(",") + "}";
}
