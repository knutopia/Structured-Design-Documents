import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  BundleValidationError,
  collectBundleDiagnostics,
  loadBundle,
  validateLoadedBundle,
  type Bundle
} from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(path.join(repoRoot, "bundle/v0.1/manifest.yaml"));
});

describe("bundle-owned syntax case policy", () => {
  it("rejects case-folded token collisions when parsing is case-insensitive", () => {
    const cloned = structuredClone(bundle) as Bundle;
    cloned.syntax.parsing_model.case_sensitive = false;
    cloned.vocab.relationship_types.push({
      ...cloned.vocab.relationship_types[0]!,
      token: cloned.vocab.relationship_types[0]!.token.toLowerCase()
    });

    expect(() => validateLoadedBundle(cloned)).toThrow(BundleValidationError);
    expect(collectBundleDiagnostics(cloned)).toContainEqual(expect.objectContaining({
      code: "bundle.syntax.case_insensitive_token_collision",
      message: expect.stringContaining("relationship_types")
    }));
  });
});
