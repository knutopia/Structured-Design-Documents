import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import type { Bundle } from "../src/bundle/types.js";
import { projectView } from "../src/projector/projectView.js";
import { normalizeLineEndings } from "./textNormalization.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

describe("projectView projection snapshots", () => {
  it("matches every manifest-declared projection snapshot", async () => {
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

      for (const snapshotRelativePath of example.projection_snapshots ?? []) {
        const snapshotPath = path.join(bundle.rootDir, snapshotRelativePath);
        const expectedSnapshotText = await readFile(snapshotPath, "utf8");
        const expectedSnapshot = JSON.parse(expectedSnapshotText) as { view_id: string };
        const projected = projectView(compiled.graph!, bundle, expectedSnapshot.view_id);

        expect(projected.diagnostics).toEqual([]);
        expect(normalizeLineEndings(JSON.stringify(projected.projection, null, 2))).toBe(
          normalizeLineEndings(JSON.stringify(expectedSnapshot, null, 2)).trimEnd()
        );
      }
    }
  }, 15000);

  it("uses the journey bundle reference sort instead of a hidden projection default", async () => {
    const bundle = await loadBundle(manifestPath);
    const compiled = compileSource({
      path: "journey-reference-sort.sdd",
      text: [
        "SDD-TEXT 0.1",
        "",
        'Opportunity OP-100 "Clear total cost"',
        "END",
        "",
        'Opportunity OP-200 "Confidence before commitment"',
        "END",
        "",
        'Step J-201 "Review the recommendation"',
        '  opportunity_refs="OP-200, OP-100"',
        "END",
        ""
      ].join("\n")
    }, bundle);

    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.graph).toBeDefined();

    const configured = projectView(compiled.graph!, bundle, "journey_map");
    const configuredReferences = configured.projection?.derived.node_annotations[0]?.references ?? [];
    expect(configuredReferences.map((reference) => reference.target_id)).toEqual(["OP-100", "OP-200"]);

    const authoredOrderBundle = structuredClone(bundle) as Bundle;
    const journeyView = authoredOrderBundle.views.views.find((view) => view.id === "journey_map");
    const referenceAnnotations = journeyView?.conventions.renderer_defaults?.reference_annotations as
      | Record<string, unknown>
      | undefined;
    delete referenceAnnotations?.sort;

    const authoredOrder = projectView(compiled.graph!, authoredOrderBundle, "journey_map");
    const authoredOrderReferences = authoredOrder.projection?.derived.node_annotations[0]?.references ?? [];
    expect(authoredOrderReferences.map((reference) => reference.target_id)).toEqual(["OP-200", "OP-100"]);
  });
});
