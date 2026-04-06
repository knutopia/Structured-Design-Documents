import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle, validateGraph } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

describe("validateGraph", () => {
  it("loads the simple profile from the bundle manifest", async () => {
    const bundle = await loadBundle(manifestPath);

    expect(bundle.manifest.profiles.map((profile) => profile.id)).toContain("simple");
    expect(bundle.profiles.simple?.id).toBe("simple");
  });

  it("validates all manifest examples under the simple profile with zero errors", async () => {
    const bundle = await loadBundle(manifestPath);

    for (const example of bundle.manifest.examples) {
      const examplePath = path.join(bundle.rootDir, example.path);
      const input = {
        path: examplePath,
        text: await readFile(examplePath, "utf8")
      };
      const compiled = compileSource(input, bundle);
      expect(compiled.graph).toBeDefined();
      expect(compiled.diagnostics).toEqual([]);

      const validation = validateGraph(compiled.graph!, bundle, "simple");
      expect(validation.errorCount).toBe(0);
    }
  });

  it("validates all manifest examples under the recommended profile with zero errors", async () => {
    const bundle = await loadBundle(manifestPath);

    for (const example of bundle.manifest.examples) {
      const examplePath = path.join(bundle.rootDir, example.path);
      const input = {
        path: examplePath,
        text: await readFile(examplePath, "utf8")
      };
      const compiled = compileSource(input, bundle);
      expect(compiled.graph).toBeDefined();
      expect(compiled.diagnostics).toEqual([]);

      const validation = validateGraph(compiled.graph!, bundle, "recommended");
      expect(validation.errorCount).toBe(0);
    }
  });

  it("accepts the BillSage draft example under simple", async () => {
    const bundle = await loadBundle(manifestPath);
    const examplePath = path.join(repoRoot, "real_world_exploration/billSage_simple_structure.sdd");
    const input = {
      path: examplePath,
      text: await readFile(examplePath, "utf8")
    };

    const compiled = compileSource(input, bundle);
    expect(compiled.graph).toBeDefined();
    expect(compiled.diagnostics).toEqual([]);

    const validation = validateGraph(compiled.graph!, bundle, "simple");
    expect(validation.errorCount).toBe(0);
  });

  it("flags the BillSage draft example under recommended for missing governance metadata", async () => {
    const bundle = await loadBundle(manifestPath);
    const examplePath = path.join(repoRoot, "real_world_exploration/billSage_simple_structure.sdd");
    const input = {
      path: examplePath,
      text: await readFile(examplePath, "utf8")
    };

    const compiled = compileSource(input, bundle);
    expect(compiled.graph).toBeDefined();
    expect(compiled.diagnostics).toEqual([]);

    const validation = validateGraph(compiled.graph!, bundle, "recommended");
    expect(validation.errorCount).toBeGreaterThan(0);
    expect(validation.diagnostics.some((diagnostic) => diagnostic.code === "validate.required_props_by_type")).toBe(true);
  });

  it("attaches source spans to referential_integrity diagnostics", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = {
      path: path.join(repoRoot, "tests/fixtures/invalid/referential_integrity_missing_node.sdd"),
      text: [
        "Place P-100 \"Dashboard\"",
        "  COMPOSED_OF C-999 \"Missing Component\"",
        "END"
      ].join("\n")
    };

    const compiled = compileSource(input, bundle);
    expect(compiled.graph).toBeDefined();
    expect(compiled.diagnostics).toEqual([]);

    const validation = validateGraph(compiled.graph!, bundle, "simple");
    const referentialIntegrity = validation.diagnostics.find((diagnostic) => diagnostic.code === "validate.referential_integrity");

    expect(referentialIntegrity).toBeDefined();
    expect(referentialIntegrity?.span).toBeDefined();
    expect(referentialIntegrity?.span?.line).toBe(2);
    expect(referentialIntegrity?.span?.column).toBe(1);
  });
});
