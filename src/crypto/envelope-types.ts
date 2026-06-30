// Extracted from @ocss/ts src/envelope/types.ts (the wire types the harness uses).
export interface Outer {
  ocss_version: string;
  intermediary_audience: string;
  issued_at: string;
  nonce: string;
  resource: string;
  sender_signature: string;
}
export interface Inner {
  receiver: string;
  envelope_type: string;
  family_hash?: string;
  tier_label?: string;
  payload: string;
}
export interface Envelope {
  outer: Outer;
  inner: Inner;
}
