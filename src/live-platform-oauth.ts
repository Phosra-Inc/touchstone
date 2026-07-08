import { randomBytes } from "node:crypto";
import type {
  OAuthTestAccountName,
  PlatformOAuthConfig,
  PlatformOAuthUnderTest,
} from "./contract/platform-oauth.js";
import { normalizeEnclaveUrl } from "./live-enclave.js";

// Live platform-OAuth driver (CR-14 / a8): completes the target platform's
// authorize → token → profiles legs over HTTP for a declared test account and
// hands the probes the profiles response VERBATIM. Mirrors the live-enclave
// posture: the probes only see the PlatformOAuthUnderTest contract, so any
// platform whose OAuth surface satisfies the same behavioral assertion passes
// the same suite. HTTPS is required for any non-loopback host; plain http is
// tolerated only for loopback (local fixtures in tests/CI).
//
// Wire shape driven (the canonical connect-ceremony OAuth surface):
//   GET  {authorize_url}?redirect_uri=&state=&decision=approve&<authorize_params>
//        -> 302 Location: {redirect_uri}?code=...&state=...
//   POST {token_url}   (form: grant_type=authorization_code, code, redirect_uri)
//        -> { "access_token": string, ... }
//   GET  {profiles_url}   (Authorization: Bearer <access_token>)
//        -> the profiles response (EXT-04 §3.3.1: a bare JSON array)

export interface LivePlatformOAuthOptions {
  /** Per-request timeout in ms (default 15000). */
  timeoutMs?: number;
  /** Injected fetch, for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/** Validate a PlatformOAuthConfig (shape + URL discipline). Throws on bad input. */
export function validatePlatformOAuthConfig(cfg: PlatformOAuthConfig): PlatformOAuthConfig {
  for (const field of ["authorize_url", "token_url", "profiles_url"] as const) {
    const raw = cfg[field];
    if (typeof raw !== "string" || raw.length === 0) {
      throw new Error(`platform-oauth config: ${field} is required`);
    }
    normalizeEnclaveUrl(raw, `platform-oauth config ${field}`); // same https/loopback rule as --enclave-url
  }
  if (typeof cfg.redirect_uri !== "string" || cfg.redirect_uri.length === 0) {
    throw new Error("platform-oauth config: redirect_uri is required");
  }
  if (!cfg.accounts || typeof cfg.accounts !== "object") {
    throw new Error("platform-oauth config: accounts is required (a8 needs accounts.no_children)");
  }
  return cfg;
}

class LivePlatformOAuth implements PlatformOAuthUnderTest {
  constructor(
    private readonly cfg: PlatformOAuthConfig,
    private readonly opts: Required<LivePlatformOAuthOptions>,
  ) {}

  accounts(): Record<OAuthTestAccountName, boolean> {
    return {
      no_children: Boolean(this.cfg.accounts.no_children),
      with_children: Boolean(this.cfg.accounts.with_children),
    };
  }

  async profiles(account: OAuthTestAccountName): Promise<unknown> {
    const acct = this.cfg.accounts[account];
    if (!acct) throw new Error(`platform-oauth target declares no \`${account}\` test account`);

    // Leg 1 — authorize (machine-drivable approve for the declared test account).
    const state = randomBytes(16).toString("base64url");
    const authorizeUrl = new URL(this.cfg.authorize_url);
    authorizeUrl.searchParams.set("redirect_uri", this.cfg.redirect_uri);
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("decision", "approve");
    for (const [k, v] of Object.entries(acct.authorize_params ?? {})) {
      authorizeUrl.searchParams.set(k, v);
    }
    const authRes = await this.request(authorizeUrl.toString(), { method: "GET", redirect: "manual" });
    if (authRes.status < 300 || authRes.status >= 400) {
      throw new Error(`authorize leg: expected a 3xx redirect, got HTTP ${authRes.status}`);
    }
    const location = authRes.headers.get("location");
    if (!location) throw new Error("authorize leg: 3xx without a Location header");
    const cb = new URL(location, this.cfg.redirect_uri);
    const err = cb.searchParams.get("error");
    if (err) throw new Error(`authorize leg: platform returned error=${err}`);
    const code = cb.searchParams.get("code");
    if (!code) throw new Error("authorize leg: redirect carries no ?code=");
    const echoedState = cb.searchParams.get("state");
    if (echoedState !== null && echoedState !== state) {
      throw new Error("authorize leg: state did not round-trip");
    }

    // Leg 2 — token (authorization_code → access_token).
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.cfg.redirect_uri,
    });
    const tokRes = await this.request(this.cfg.token_url, {
      method: "POST",
      body: form.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    });
    if (!tokRes.ok) throw new Error(`token leg: HTTP ${tokRes.status}`);
    const tok = (await tokRes.json()) as Partial<{ access_token: string }>;
    if (!tok || typeof tok.access_token !== "string" || tok.access_token.length === 0) {
      throw new Error("token leg: response carries no access_token");
    }

    // Leg 3 — profiles: return the parsed body VERBATIM (the probe asserts shape).
    const profRes = await this.request(this.cfg.profiles_url, {
      method: "GET",
      headers: { authorization: `Bearer ${tok.access_token}`, accept: "application/json" },
    });
    if (!profRes.ok) throw new Error(`profiles leg: HTTP ${profRes.status}`);
    return profRes.json();
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.opts.timeoutMs);
    try {
      return await this.opts.fetchImpl(url, { ...init, signal: ac.signal });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new Error(`platform-oauth request timed out after ${this.opts.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Build a live PlatformOAuthUnderTest bound to a real platform OAuth surface. */
export function makeLivePlatformOAuth(
  config: PlatformOAuthConfig,
  options: LivePlatformOAuthOptions = {},
): PlatformOAuthUnderTest {
  return new LivePlatformOAuth(validatePlatformOAuthConfig(config), {
    timeoutMs: options.timeoutMs ?? 15000,
    fetchImpl: options.fetchImpl ?? fetch,
  });
}
