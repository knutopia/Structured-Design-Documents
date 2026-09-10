import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PositionedScene, RendererScene } from "../src/renderer/staged/contracts.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import { assessUiContractsGeometry } from "./uiContractsB5Acceptance.js";

const directory = "docs/hierarchical_ui_contracts/";
const evidence = JSON.parse(readFileSync(`${directory}b5_pipeline_evidence.json`, "utf8")) as {
  proofs: Array<{ file: string; rendererScene: RendererScene; positionedScene: PositionedScene }>;
};
const baseline = JSON.parse(readFileSync(`${directory}b5_implementation_baseline.json`, "utf8"));

describe("B5 immutable acceptance baseline", () => {
  it("preserves protected source and accepted design references", () => {
    for (const [path, hash] of Object.entries({ ...baseline.protectedSourceHashes, ...baseline.referenceHashes })) {
      expect(createHash("sha256").update(readFileSync(path)).digest("hex"), path).toBe(hash);
    }
  });

  for (const proof of evidence.proofs) it(`reproduces ${proof.file} with independent geometry acceptance`, async () => {
    const result = await runStagedRendererPipeline(proof.rendererScene);
    expect(JSON.parse(JSON.stringify(result.positionedScene))).toEqual(proof.positionedScene);
    expect(assessUiContractsGeometry(result.positionedScene)).toEqual([]);
  });

  it("rejects route/label intersections even when native diagnostics are empty", () => {
    const scene = structuredClone(evidence.proofs[0].positionedScene);
    const edge = scene.edges.find(edge => edge.label)!;
    const point = edge.route.points[0];
    edge.label!.x = point.x - 5;
    edge.label!.y = point.y;
    expect(assessUiContractsGeometry(scene).some(issue => issue.startsWith("route/interior:"))).toBe(true);
  });
});
