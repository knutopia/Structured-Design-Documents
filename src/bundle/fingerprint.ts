import { createHash } from "node:crypto";
import type { Bundle } from "./types.js";

export type CanonicalJsonPrimitive = string | number | boolean | null;
export type CanonicalJsonValue = CanonicalJsonPrimitive | CanonicalJsonValue[] | { [key: string]: CanonicalJsonValue };

export interface BundleFingerprintInput {
  manifest: CanonicalJsonValue;
  vocab: CanonicalJsonValue;
  syntax: CanonicalJsonValue;
  schema: CanonicalJsonValue;
  projection_schema: CanonicalJsonValue;
  contracts: CanonicalJsonValue;
  views: CanonicalJsonValue;
  profiles: CanonicalJsonValue;
  authoring: CanonicalJsonValue;
}

export type BundleFingerprint = `bnd_${string}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function canonicalizeJson(value: unknown): CanonicalJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON does not support non-finite numbers");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJson(item));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, canonicalizeJson(value[key])])
    );
  }
  throw new TypeError(`Canonical JSON does not support values of type '${typeof value}'`);
}

export function stringifyCanonicalJson(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value));
}

export function createBundleFingerprintInput(bundle: Bundle): BundleFingerprintInput {
  return {
    manifest: canonicalizeJson(bundle.manifest),
    vocab: canonicalizeJson(bundle.vocab),
    syntax: canonicalizeJson(bundle.syntax),
    schema: canonicalizeJson(bundle.schema),
    projection_schema: canonicalizeJson(bundle.projectionSchema),
    contracts: canonicalizeJson(bundle.contracts),
    views: canonicalizeJson(bundle.views),
    profiles: canonicalizeJson(
      bundle.manifest.profiles.map((entry) => ({
        id: entry.id,
        profile: bundle.profiles[entry.id]
      }))
    ),
    authoring: canonicalizeJson(bundle.authoring ?? null)
  };
}

export function computeBundleFingerprint(bundle: Bundle): BundleFingerprint {
  const canonical = stringifyCanonicalJson(createBundleFingerprintInput(bundle));
  const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
  return `bnd_${digest}`;
}
