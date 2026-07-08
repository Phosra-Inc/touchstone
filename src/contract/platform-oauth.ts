// The platform-hosted OAuth surface under test (EXT-04 §3.3.1 / CR-14).
//
// A consuming platform's connect entry names three OAuth legs — authorize_url,
// token_url, profiles_url. The profiles leg carries ceremony-load-bearing
// semantics the spec contracts (EXT-04 §3.3.1, conformance case EXT04-CN-09):
// it returns the authenticated account's CHILD profiles only, as a bare JSON
// array; exactly [] when none exist; and NEVER the account holder or any
// placeholder entry ("Account"). Assertion a8 machine-checks that contract.
//
// Targets declare TEST ACCOUNTS for the harness to drive: at minimum a
// `no_children` account (an account holding zero child profiles — the case
// the observed violation shipped: a lone account-level "Account" entry), and
// optionally a `with_children` account whose entries a8 checks for child
// semantics. Account selection rides the authorize leg's query string via
// `authorize_params` — whatever the target's machine-drivable test lane keys
// on (login_hint, account, a fixture token, ...).

export type OAuthTestAccountName = "no_children" | "with_children";

export interface OAuthTestAccount {
  /** Extra query parameters the harness adds to the authorize leg to select
   *  this test account. The harness always sends redirect_uri, state, and
   *  decision=approve (the canonical machine-drivable approve; a value here
   *  overrides it). */
  authorize_params?: Record<string, string>;
}

export interface PlatformOAuthConfig {
  authorize_url: string;
  token_url: string;
  profiles_url: string;
  /** The redirect_uri the authorize leg 302s back to with ?code=&state=.
   *  The harness never serves it — it only parses the Location header. */
  redirect_uri: string;
  /** The declared test accounts. a8 REQUIRES `no_children`. */
  accounts: Partial<Record<OAuthTestAccountName, OAuthTestAccount>>;
}

export interface PlatformOAuthUnderTest {
  /** Which test accounts the target declares. */
  accounts(): Record<OAuthTestAccountName, boolean>;
  /** Complete authorize → token for the named test account, then GET the
   *  profiles leg and return its response body parsed as JSON — VERBATIM
   *  (a8 asserts on the raw wire shape, e.g. bare-array-ness). */
  profiles(account: OAuthTestAccountName): Promise<unknown>;
}
