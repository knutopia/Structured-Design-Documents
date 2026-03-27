import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type { PositionedItem } from "../src/renderer/staged/contracts.js";
import {
  renderServiceBlueprintElkRoutingDebugArtifacts,
  renderServiceBlueprintStagedSvg
} from "../src/renderer/staged/serviceBlueprint.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

async function resolveServiceBlueprintContext(fileName: string, profileId: string) {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "service_blueprint");
  if (!view) {
    throw new Error("Could not resolve the service_blueprint view.");
  }

  const filePath = path.join(repoRoot, "bundle/v0.1/examples", fileName);
  const input = {
    path: filePath,
    text: await readFile(filePath, "utf8")
  };

  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics).toEqual([]);
  if (!compiled.graph) {
    throw new Error(`Could not compile ${input.path}.`);
  }

  const projected = projectView(compiled.graph, bundle, "service_blueprint");
  expect(projected.diagnostics).toEqual([]);
  if (!projected.projection) {
    throw new Error(`Could not project ${input.path} to service_blueprint.`);
  }

  return {
    graph: compiled.graph,
    projection: projected.projection,
    view
  };
}

function findNestedPositionedItem(children: PositionedItem[], id: string): PositionedItem | undefined {
  for (const child of children) {
    if (child.id === id) {
      return child;
    }
    if (child.kind === "container") {
      const nested = findNestedPositionedItem(child.children, id);
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
}

describe("service_blueprint ELK routing debug artifacts", () => {
  it("captures ELK routing checkpoints even while the strict routed render still fails", async () => {
    const context = await resolveServiceBlueprintContext("service_blueprint_slice.sdd", "recommended");
    const rendered = await renderServiceBlueprintElkRoutingDebugArtifacts(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );

    const inputGraph = JSON.parse(rendered.elkRoutingInputJson) as {
      children?: Array<{ id: string; x: number; y: number }>;
      edges?: Array<{ id: string }>;
    };
    const outputGraph = JSON.parse(rendered.elkRoutingOutputJson) as {
      children?: Array<{ id: string; x: number; y: number }>;
      edges?: Array<{ id: string; sections?: unknown[] }>;
    };
    const driftReport = JSON.parse(rendered.elkDriftReportJson) as {
      positionsPreserved: boolean;
      preservesRelativeGrid: boolean;
      firstDriftedChildId: string | null;
      nodes: Array<{ id: string; dx: number | null; dy: number | null }>;
      edges: Array<{ id: string; hasReturnedRoute: boolean; returnedRoutePointCount: number }>;
    };

    const semanticNodeIds = rendered.elkRoutingDebug.nodeDebug.map((node) => node.id);
    const minExpectedX = Math.min(...rendered.elkRoutingDebug.nodeDebug.map((node) => node.expectedFrame.x));
    const minExpectedY = Math.min(...rendered.elkRoutingDebug.nodeDebug.map((node) => node.expectedFrame.y));

    expect(inputGraph.children?.length).toBeGreaterThan(0);
    expect(outputGraph.children?.length).toBeGreaterThan(0);
    expect(outputGraph.edges?.length).toBeGreaterThan(0);
    expect(driftReport.positionsPreserved).toBe(false);
    expect(driftReport.preservesRelativeGrid).toBe(false);
    expect(driftReport.firstDriftedChildId).toBeTruthy();
    expect(driftReport.nodes.some((node) => node.dx !== null && Math.abs(node.dx) > 0)).toBe(true);
    expect(driftReport.edges.some((edge) => edge.hasReturnedRoute && edge.returnedRoutePointCount >= 2)).toBe(true);

    for (const nodeDebug of rendered.elkRoutingDebug.nodeDebug) {
      const inputChild = inputGraph.children?.find((child) => child.id === nodeDebug.id);
      expect(inputChild).toBeDefined();
      expect(inputChild?.x).toBe(nodeDebug.expectedFrame.x - minExpectedX);
      expect(inputChild?.y).toBe(nodeDebug.expectedFrame.y - minExpectedY);

      const preRoutingNode = findNestedPositionedItem(rendered.preRoutingPositionedScene.root.children, nodeDebug.id);
      expect(preRoutingNode?.kind).toBe("node");
      if (preRoutingNode?.kind === "node") {
        expect(preRoutingNode.x).toBe(nodeDebug.expectedFrame.x);
        expect(preRoutingNode.y).toBe(nodeDebug.expectedFrame.y);
      }
    }

    expect(rendered.elkRouteOverlaySvg).toContain("Submit Claim");
    expect(rendered.elkRouteOverlaySvg).toContain("Retention Policy");
    expect(rendered.elkRouteOverlaySvg).toContain("service_blueprint_debug_route");
    expect(rendered.elkRouteOverlaySvg).toContain("<path");
    expect(rendered.elkRouteOverlayPng.byteLength).toBeGreaterThan(0);

    expect(rendered.elkReturnedFramesOverlaySvg).toContain("Submit Claim");
    expect(rendered.elkReturnedFramesOverlaySvg).toContain("service_blueprint_debug_returned_frame");
    expect(rendered.elkReturnedFramesOverlaySvg).toContain("service_blueprint_debug_drift_vector");
    expect(rendered.elkReturnedFramesOverlayPng.byteLength).toBeGreaterThan(0);

    await expect(
      renderServiceBlueprintStagedSvg(
        context.projection,
        context.graph,
        context.view,
        "recommended"
      )
    ).rejects.toThrow(/ELK moved fixed service blueprint grid item/);

    expect(new Set(semanticNodeIds)).toContain("J-021");
  });
});
