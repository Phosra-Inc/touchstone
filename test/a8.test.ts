import { describe, it, expect } from "vitest";
import { a8ProfilesChildOnly } from "../src/assertions/a8-profiles-child-only.js";
import { runAssertion } from "../src/probe.js";
import {
  makeReferencePlatformOAuth,
  makeNoChildrenOnlyPlatformOAuth,
  makeNoAccountsPlatformOAuth,
  mutantA8AccountPlaceholder,
  mutantA8NonEmptyForNoChildren,
  mutantA8WrappedResponse,
  mutantA8OwnerAmongChildren,
  mutantA8NonChildKind,
} from "./helpers/platform-oauth-fixtures.js";

describe("A8 profiles: child profiles only, [] when none (EXT-04 §3.3.1 / EXT04-CN-09)", () => {
  it("passes against the conformant reference platform (both accounts)", async () => {
    const r = await runAssertion("a8", a8ProfilesChildOnly, makeReferencePlatformOAuth());
    expect(r.verdict).toBe("pass");
    expect(r.detail).toMatch(/child-semantic/);
  });

  it("passes with only the required no-children account declared", async () => {
    const r = await runAssertion("a8", a8ProfilesChildOnly, makeNoChildrenOnlyPlatformOAuth());
    expect(r.verdict).toBe("pass");
    expect(r.detail).toMatch(/child-semantics lane skipped/);
  });

  it("fails the observed CR-14 violation: a lone 'Account' placeholder instead of []", async () => {
    const r = await runAssertion("a8", a8ProfilesChildOnly, mutantA8AccountPlaceholder());
    expect(r.verdict).toBe("fail");
    expect(r.detail).toMatch(/account-holder\/placeholder/i);
    expect(r.detail).toMatch(/MUST NEVER/);
  });

  it("fails ANY entry on the no-children account, placeholder or not", async () => {
    const r = await runAssertion("a8", a8ProfilesChildOnly, mutantA8NonEmptyForNoChildren());
    expect(r.verdict).toBe("fail");
    expect(r.detail).toMatch(/exactly \[\]/);
  });

  it("fails a wrapped (non-bare-array) profiles response", async () => {
    const r = await runAssertion("a8", a8ProfilesChildOnly, mutantA8WrappedResponse());
    expect(r.verdict).toBe("fail");
    expect(r.detail).toMatch(/bare JSON array/);
  });

  it("fails the account holder hiding among real children on the with-children account", async () => {
    const r = await runAssertion("a8", a8ProfilesChildOnly, mutantA8OwnerAmongChildren());
    expect(r.verdict).toBe("fail");
    expect(r.detail).toMatch(/child-semantics/);
  });

  it("fails a with-children entry whose kind is not \"child\"", async () => {
    const r = await runAssertion("a8", a8ProfilesChildOnly, mutantA8NonChildKind());
    expect(r.verdict).toBe("fail");
    expect(r.detail).toMatch(/kind/);
  });

  it("errors (cannot attest) when the target declares no no-children test account", async () => {
    const r = await runAssertion("a8", a8ProfilesChildOnly, makeNoAccountsPlatformOAuth());
    expect(r.verdict).toBe("error");
    expect(r.detail).toMatch(/no_children/);
  });

  it("contains a thrown transport failure as a probe error", async () => {
    const broken = {
      accounts: () => ({ no_children: true, with_children: false }),
      profiles: async () => {
        throw new Error("connection refused");
      },
    };
    const r = await runAssertion("a8", a8ProfilesChildOnly, broken);
    expect(r.verdict).toBe("error");
    expect(r.detail).toMatch(/connection refused/);
  });
});
