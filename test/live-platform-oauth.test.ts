import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { makeLivePlatformOAuth, validatePlatformOAuthConfig } from "../src/live-platform-oauth.js";
import type { PlatformOAuthConfig } from "../src/contract/platform-oauth.js";
import { a8ProfilesChildOnly } from "../src/assertions/a8-profiles-child-only.js";
import { runAssertion } from "../src/probe.js";

// A local HTTP fixture platform serving the canonical connect-ceremony OAuth
// surface (authorize 302 → token → profiles), account-scoped via the
// `account` authorize param the config's authorize_params carries — the same
// wire the live driver aims at a real platform.
function startFixturePlatform(profilesByAccount: Record<string, unknown>): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const send = (code: number, body: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(code, { "content-type": "application/json", ...headers });
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET" && url.pathname === "/api/ocss/authorize") {
      const redirectUri = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state") ?? "";
      const account = url.searchParams.get("account") ?? "";
      if (!redirectUri || url.searchParams.get("decision") !== "approve") {
        return send(400, { error: "invalid_request" });
      }
      const cb = new URL(redirectUri);
      cb.searchParams.set("code", `fixcode_${account}`);
      cb.searchParams.set("state", state);
      res.writeHead(302, { location: cb.toString() });
      return res.end();
    }
    if (req.method === "POST" && url.pathname === "/api/ocss/token") {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
        const code = form.get("code") ?? "";
        if (form.get("grant_type") !== "authorization_code" || !code.startsWith("fixcode_")) {
          return send(400, { error: "invalid_grant" });
        }
        send(200, { access_token: `fixtok_${code.slice("fixcode_".length)}`, token_type: "Bearer" });
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/ocss/profiles") {
      const auth = req.headers.authorization ?? "";
      if (!auth.startsWith("Bearer fixtok_")) return send(401, { error: "invalid_token" });
      const account = auth.slice("Bearer fixtok_".length);
      if (!(account in profilesByAccount)) return send(403, { error: "unknown_account" });
      return send(200, profilesByAccount[account]);
    }
    send(404, { error: "not found" });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

function configFor(base: string): PlatformOAuthConfig {
  return {
    authorize_url: `${base}/api/ocss/authorize`,
    token_url: `${base}/api/ocss/token`,
    profiles_url: `${base}/api/ocss/profiles`,
    redirect_uri: "http://127.0.0.1/callback",
    accounts: {
      no_children: { authorize_params: { account: "empty-nest" } },
      with_children: { authorize_params: { account: "family" } },
    },
  };
}

describe("live platform-oauth target mode", () => {
  let fixture: { url: string; close: () => Promise<void> };
  beforeAll(async () => {
    fixture = await startFixturePlatform({
      "empty-nest": [],
      family: [{ id: "mia", displayName: "Mia", kind: "child" }],
    });
  });
  afterAll(async () => {
    await fixture.close();
  });

  it("drives authorize -> token -> profiles and returns the body verbatim", async () => {
    const p = makeLivePlatformOAuth(configFor(fixture.url));
    expect(await p.profiles("no_children")).toEqual([]);
    expect(await p.profiles("with_children")).toEqual([{ id: "mia", displayName: "Mia", kind: "child" }]);
  });

  it("reports the declared accounts", () => {
    const p = makeLivePlatformOAuth(configFor(fixture.url));
    expect(p.accounts()).toEqual({ no_children: true, with_children: true });
  });

  it("a8 passes end-to-end against the conformant fixture platform", async () => {
    const r = await runAssertion("a8", a8ProfilesChildOnly, makeLivePlatformOAuth(configFor(fixture.url)));
    expect(r.verdict).toBe("pass");
  });

  it("a8 fails end-to-end against a fixture serving the 'Account' placeholder", async () => {
    const bad = await startFixturePlatform({
      "empty-nest": [{ id: "account", displayName: "Account" }],
      family: [{ id: "mia", displayName: "Mia", kind: "child" }],
    });
    try {
      const r = await runAssertion("a8", a8ProfilesChildOnly, makeLivePlatformOAuth(configFor(bad.url)));
      expect(r.verdict).toBe("fail");
      expect(r.detail).toMatch(/account-holder\/placeholder/i);
    } finally {
      await bad.close();
    }
  });

  it("surfaces a transport failure as a probe error, not a crash", async () => {
    const dead = await startFixturePlatform({ "empty-nest": [] });
    await dead.close();
    const r = await runAssertion("a8", a8ProfilesChildOnly, makeLivePlatformOAuth(configFor(dead.url)));
    expect(r.verdict).toBe("error");
  });
});

describe("validatePlatformOAuthConfig", () => {
  const base: PlatformOAuthConfig = {
    authorize_url: "https://platform.example/api/ocss/authorize",
    token_url: "https://platform.example/api/ocss/token",
    profiles_url: "https://platform.example/api/ocss/profiles",
    redirect_uri: "https://harness.example/callback",
    accounts: { no_children: {} },
  };
  it("accepts a well-formed https config", () => {
    expect(validatePlatformOAuthConfig(base)).toBe(base);
  });
  it("rejects a missing leg URL", () => {
    expect(() => validatePlatformOAuthConfig({ ...base, token_url: "" })).toThrow(/token_url is required/);
  });
  it("rejects plain http for a non-loopback host", () => {
    expect(() =>
      validatePlatformOAuthConfig({ ...base, profiles_url: "http://platform.example/api/ocss/profiles" }),
    ).toThrow(/must be https/);
  });
  it("rejects a config without accounts", () => {
    expect(() =>
      validatePlatformOAuthConfig({ ...base, accounts: undefined as unknown as PlatformOAuthConfig["accounts"] }),
    ).toThrow(/accounts is required/);
  });
});
