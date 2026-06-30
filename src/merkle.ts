import { createHmac, createHash, randomBytes } from "node:crypto";
import type { MinimizationAttestation } from "./contract/enclave.js";

export function saltedLeaf(salt: Uint8Array, field: string): string {
  return createHmac("sha256", Buffer.from(salt)).update(field, "utf8").digest("hex");
}

function hashPair(a: string, b: string): string {
  return createHash("sha256").update(Buffer.from(a + b, "hex")).digest("hex");
}

export function merkleRoot(leavesHex: string[]): string {
  if (leavesHex.length === 0) throw new Error("merkleRoot: no leaves");
  let level = [...leavesHex];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
    }
    level = next;
  }
  return level[0];
}

export function buildMinimization(fields: string[], salt: Uint8Array = new Uint8Array(randomBytes(32))): MinimizationAttestation {
  const leaves = fields.map((f) => saltedLeaf(salt, f));
  return {
    alg: "hmac-sha256+merkle",
    merkle_root: merkleRoot(leaves),
    leaves,
    salt_commitment: createHash("sha256").update(Buffer.from(salt)).digest("hex"),
  };
}
