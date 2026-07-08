import type {
  OAuthTestAccountName,
  PlatformOAuthUnderTest,
} from "../../src/contract/platform-oauth.js";

// In-memory platform-OAuth fixtures for a8 (EXT-04 §3.3.1 / CR-14): a
// conformant reference target plus the mutants the discrimination tests fire.
// Same anti-theater bar as helpers/mutants.ts — every failure mode a8 exists
// to catch has a mutant that must make it fail.

const CHILD_PROFILES = [
  { id: "mia", displayName: "Mia", kind: "child" },
  { id: "leo", displayName: "Leo", kind: "child" },
];

function fixture(perAccount: Partial<Record<OAuthTestAccountName, unknown>>): PlatformOAuthUnderTest {
  return {
    accounts: () => ({
      no_children: Object.prototype.hasOwnProperty.call(perAccount, "no_children"),
      with_children: Object.prototype.hasOwnProperty.call(perAccount, "with_children"),
    }),
    profiles: async (account) => {
      if (!Object.prototype.hasOwnProperty.call(perAccount, account)) {
        throw new Error(`fixture declares no \`${account}\` account`);
      }
      return perAccount[account];
    },
  };
}

/** Conformant: no-children account → []; with-children → child-semantic entries. */
export function makeReferencePlatformOAuth(): PlatformOAuthUnderTest {
  return fixture({ no_children: [], with_children: CHILD_PROFILES });
}

/** Conformant, but only the REQUIRED no-children account is declared. */
export function makeNoChildrenOnlyPlatformOAuth(): PlatformOAuthUnderTest {
  return fixture({ no_children: [] });
}

/** The observed CR-14 violation: a lone account-level "Account" placeholder
 *  where [] belongs. */
export function mutantA8AccountPlaceholder(): PlatformOAuthUnderTest {
  return fixture({
    no_children: [{ id: "account", displayName: "Account" }],
    with_children: CHILD_PROFILES,
  });
}

/** A non-placeholder entry leaks onto the no-children account (still a fail:
 *  the response must be exactly []). */
export function mutantA8NonEmptyForNoChildren(): PlatformOAuthUnderTest {
  return fixture({ no_children: [{ id: "zoe", displayName: "Zoe", kind: "child" }] });
}

/** Wraps the array in an object — the F4 leg-3 bug shape ({"profiles": []});
 *  the contract is a BARE array. */
export function mutantA8WrappedResponse(): PlatformOAuthUnderTest {
  return fixture({ no_children: { profiles: [] } });
}

/** The account holder hides among real children on the with-children account. */
export function mutantA8OwnerAmongChildren(): PlatformOAuthUnderTest {
  return fixture({
    no_children: [],
    with_children: [...CHILD_PROFILES, { id: "owner", displayName: "Account" }],
  });
}

/** A with-children entry carries a non-child kind. */
export function mutantA8NonChildKind(): PlatformOAuthUnderTest {
  return fixture({
    no_children: [],
    with_children: [{ id: "p1", displayName: "Jamie", kind: "adult_supervisor" }],
  });
}

/** Target declares NO no-children test account at all (a8 must error, and the
 *  platform cannot attest). */
export function makeNoAccountsPlatformOAuth(): PlatformOAuthUnderTest {
  return fixture({ with_children: CHILD_PROFILES });
}
