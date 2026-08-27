import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type { PositionedNode } from "../src/renderer/staged/contracts.js";
import { renderJourneyMapRoutingArtifacts } from "../src/renderer/staged/journeyMap.js";
import {
  expectNoRouteIntersectionsWithNonEndpointBoxes,
  expectRoutesDoNotEnterEndpointBoxes,
  flattenPositionedItems
} from "./stagedVisualHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const challengePath = path.join(
  repoRoot,
  "bundle/v0.1/examples/flow_journey_topology_challenge.sdd"
);

describe("journey-map branch stacking", () => {
  it("uses the existing topology challenge as a test-only nested and disconnected proof", async () => {
    const bundle = await loadBundle(manifestPath);
    const compiled = compileSource({
      path: challengePath,
      text: await readFile(challengePath, "utf8")
    }, bundle);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.graph).toBeDefined();
    const projected = projectView(compiled.graph!, bundle, "journey_map");
    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection).toBeDefined();
    const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
    expect(view).toBeDefined();

    const rendered = await renderJourneyMapRoutingArtifacts(
      projected.projection!,
      compiled.graph!,
      bundle,
      view!,
      { detailId: "compact" }
    );
    const scene = rendered.routingStages.finalPositionedScene;
    const nodes = flattenPositionedItems(scene.root)
      .filter((item): item is PositionedNode => item.kind === "node");
    const nodeById = new Map(nodes.map((node) => [node.id, node] as const));

    expect(nodeById.get("J-020")!.x).toBe(nodeById.get("J-040")!.x);
    expect(nodeById.get("J-020")!.y).toBeLessThan(nodeById.get("J-040")!.y);
    expect([
      nodeById.get("J-041")!.y,
      nodeById.get("J-042")!.y,
      nodeById.get("J-043")!.y
    ]).toEqual([...[
      nodeById.get("J-041")!.y,
      nodeById.get("J-042")!.y,
      nodeById.get("J-043")!.y
    ]].sort((left, right) => left - right));
    expect(nodeById.get("J-030")!.x)
      .toBeGreaterThan(nodeById.get("J-022")!.x + nodeById.get("J-022")!.width);

    const routeFamily = (from: string, to: string) => rendered.routingStages.connectorPlans.find(
      (plan) => plan.from === from && plan.to === to
    )?.routeFamily;
    expect(routeFamily("J-010", "J-020")).toBe("direct_horizontal");
    expect(routeFamily("J-010", "J-040")).toBe("minimal_l");
    expect(routeFamily("J-040", "J-041")).toBe("direct_horizontal");
    expect(routeFamily("J-040", "J-042")).toBe("minimal_l");
    expect(routeFamily("J-040", "J-043")).toBe("minimal_l");

    const nodeBoxes = nodes.map((node) => ({
      itemId: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height
    }));
    expectNoRouteIntersectionsWithNonEndpointBoxes(scene.edges, nodeBoxes);
    expectRoutesDoNotEnterEndpointBoxes(scene.edges, nodeBoxes);
    expect(rendered.routingStages.failedConnectorIds).toEqual([]);
    expect(rendered.routingStages.residualCrossings).toEqual([]);
    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity !== "info")).toEqual([]);
  });
});
