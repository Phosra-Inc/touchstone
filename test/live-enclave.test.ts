import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { makeLiveEnclave, normalizeEnclaveUrl } from "../src/live-enclave.js";
import { makeReferenceEnclave } from "../reference-enclave/index.js";
import { runSuite } from "../src/suite.js";

// A local HTTP fixture enclave that satisfies the same behavioral contract as the
// bundled reference enclave, exposed over the wire the live-target mode expects.
function startFixtureEnclave(): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      const send = (code: number, body: unknown) => {
        res.writeHead(code, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      try {
        if (req.method === "GET" && req.url === "/buildinfo") {
          return send(200, makeReferenceEnclave().buildInfo());
        }
        if (req.method === "POST" && req.url === "/classify") {
          const input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          const e = makeReferenceEnclave();
          if (input.upstream_attestation !== undefined) e.setUpstreamAttestation(input.upstream_attestation);
          return send(200, await e.classify(input));
        }
        send(404, { error: "not found" });
      } catch (err) {
        send(500, { error: (err as Error).message });
      }
    });
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

describe("live-enclave target mode", () => {
  let fixture: { url: string; close: () => Promise<void> };
  beforeAll(async () => {
    fixture = await startFixtureEnclave();
  });
  afterAll(async () => {
    await fixture.close();
  });

  it("fetches build info from the live endpoint", async () => {
    const e = await makeLiveEnclave(fixture.url);
    expect(e.buildInfo().build_hash).toMatch(/^ref-/);
    expect(e.buildInfo().suite_version).toBe("ocss-provider-harness/v0");
  });

  it("runs A1/A2/A5/A7 green against a conformant live enclave; A3/A4/A6 pending", async () => {
    const e = await makeLiveEnclave(fixture.url);
    const results = await runSuite(e);
    const byId = Object.fromEntries(results.map((r) => [r.assertion_id, r.verdict]));
    expect(byId).toMatchObject({ a1: "pass", a2: "pass", a5: "pass", a7: "pass" });
    expect(byId).toMatchObject({ a3: "pending", a4: "pending", a6: "pending" });
  });

  it("carries the upstream-attestation state over the wire (A7 suspends)", async () => {
    const e = await makeLiveEnclave(fixture.url);
    e.setUpstreamAttestation("invalid");
    const out = await e.classify({ content: "sensitive" });
    expect(out.kind).toBe("suspended");
  });

  it("surfaces a live-enclave transport failure as a probe error, not a crash", async () => {
    // Point at a closed port on loopback.
    const e = await makeLiveEnclave(fixture.url); // reachable buildinfo first
    await fixture.close(); // now tear the server down
    const results = await runSuite(e);
    expect(results.find((r) => r.assertion_id === "a1")?.verdict).toBe("error");
    // re-open a fresh fixture so afterAll close() is a no-op-safe double close
    fixture = await startFixtureEnclave();
  });
});

describe("normalizeEnclaveUrl", () => {
  it("accepts https for any host", () => {
    expect(normalizeEnclaveUrl("https://enclave.example.com").protocol).toBe("https:");
  });
  it("accepts http only for loopback", () => {
    expect(normalizeEnclaveUrl("http://127.0.0.1:8080").hostname).toBe("127.0.0.1");
    expect(normalizeEnclaveUrl("http://localhost:8080").hostname).toBe("localhost");
  });
  it("rejects plain http for a non-loopback host", () => {
    expect(() => normalizeEnclaveUrl("http://enclave.example.com")).toThrow(/must be https/);
  });
  it("rejects a non-URL", () => {
    expect(() => normalizeEnclaveUrl("not a url")).toThrow(/not a valid URL/);
  });
});
