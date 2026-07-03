import type {
  EnclaveUnderTest,
  ClassifyInput,
  ClassifyOutput,
  UpstreamAttestation,
} from "./contract/enclave.js";

// Live-target adapter (P1-03 "touchstone-live"): drives the A1/A2/A5/A7 probes
// against a REAL provider enclave over HTTP, instead of the bundled reference enclave.
// This is the tool leg of OCSS §5.9 ("the verifier tool" that ship-gates v1.0) run by
// an independent assessor under the open-market lane of §5.4 — the harness targets a
// provider's own endpoint rather than a mock it also authored.
//
// Wire contract the target enclave MUST implement (documented in README):
//   GET  {base}/buildinfo  -> { "build_hash": string, "suite_version": string }
//   POST {base}/classify   (JSON ClassifyInput + { "upstream_attestation": <state> })
//                          -> ClassifyOutput  ({kind:"signal"|"rejected"|"suspended", ...})
// The probes are transport-agnostic: they only see the EnclaveUnderTest contract, so a
// live enclave that satisfies the same behavioral assertions passes the same suite.

export interface LiveEnclaveOptions {
  /** Per-request timeout in ms (default 15000). */
  timeoutMs?: number;
  /** Injected fetch, for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Validate + normalize an enclave base URL. HTTPS is required for any non-loopback
 * host (an assessor probing a real provider must not send its inputs in the clear);
 * plain http is tolerated only for loopback so the suite can run against a local
 * fixture server in tests/CI.
 */
export function normalizeEnclaveUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`--enclave-url is not a valid URL: ${raw}`);
  }
  const isLoopback = LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new Error(
      `--enclave-url must be https (got ${url.protocol}//). Plain http is allowed only for loopback hosts.`,
    );
  }
  return url;
}

function joinPath(base: URL, path: string): string {
  // Preserve any base path (e.g. https://host/ocss) and append the endpoint segment.
  const trimmed = base.pathname.replace(/\/+$/, "");
  return new URL(`${trimmed}/${path}`, base).toString();
}

class LiveEnclave implements EnclaveUnderTest {
  private upstream: UpstreamAttestation | "invalid" | "expired" = { valid: true };

  constructor(
    private readonly base: URL,
    private readonly info: { build_hash: string; suite_version: string },
    private readonly opts: Required<LiveEnclaveOptions>,
  ) {}

  buildInfo() {
    return this.info;
  }

  setUpstreamAttestation(state: UpstreamAttestation | "invalid" | "expired"): void {
    this.upstream = state;
  }

  async classify(input: ClassifyInput): Promise<ClassifyOutput> {
    const body = JSON.stringify({ ...input, upstream_attestation: this.upstream });
    const res = await this.request("classify", { method: "POST", body });
    const out = (await res.json()) as ClassifyOutput;
    if (!out || (out.kind !== "signal" && out.kind !== "rejected" && out.kind !== "suspended")) {
      throw new Error(`enclave /classify returned an unrecognized kind: ${JSON.stringify(out)}`);
    }
    return out;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.opts.timeoutMs);
    try {
      const res = await this.opts.fetchImpl(joinPath(this.base, path), {
        ...init,
        signal: ac.signal,
        headers: { "content-type": "application/json", accept: "application/json", ...(init.headers ?? {}) },
      });
      if (!res.ok) throw new Error(`enclave ${path} -> HTTP ${res.status} ${res.statusText}`);
      return res;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new Error(`enclave ${path} timed out after ${this.opts.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Build a live-target EnclaveUnderTest bound to a real HTTP endpoint. Fetches
 * {base}/buildinfo up front so the synchronous buildInfo() the report/attestation
 * paths call can return the target's real identity (not a mock's).
 */
export async function makeLiveEnclave(
  rawUrl: string,
  options: LiveEnclaveOptions = {},
): Promise<EnclaveUnderTest> {
  const base = normalizeEnclaveUrl(rawUrl);
  const opts: Required<LiveEnclaveOptions> = {
    timeoutMs: options.timeoutMs ?? 15000,
    fetchImpl: options.fetchImpl ?? fetch,
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs);
  let info: { build_hash: string; suite_version: string };
  try {
    const res = await opts.fetchImpl(joinPath(base, "buildinfo"), {
      method: "GET",
      signal: ac.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`enclave buildinfo -> HTTP ${res.status} ${res.statusText}`);
    const raw = (await res.json()) as Partial<{ build_hash: string; suite_version: string }>;
    if (!raw || typeof raw.build_hash !== "string" || typeof raw.suite_version !== "string") {
      throw new Error(`enclave /buildinfo must return { build_hash, suite_version }; got ${JSON.stringify(raw)}`);
    }
    info = { build_hash: raw.build_hash, suite_version: raw.suite_version };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`enclave buildinfo timed out after ${opts.timeoutMs}ms`);
    }
    throw new Error(`could not reach live enclave at ${rawUrl}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  return new LiveEnclave(base, info, opts);
}
