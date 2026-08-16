import { createHash } from "node:crypto";
import { stringifyCanonicalJson } from "../../bundle/fingerprint.js";

export type GuidedOpaqueIdPrefix = "relc" | "ntc" | "epc" | "plc" | "eff" | "addp";

export function createGuidedOpaqueId(prefix: GuidedOpaqueIdPrefix, input: unknown): string {
  const digest = createHash("sha256").update(stringifyCanonicalJson(input), "utf8").digest("hex");
  return `${prefix}_${digest}`;
}

