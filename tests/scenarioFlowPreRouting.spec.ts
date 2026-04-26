import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type {
  PositionedDecoration,
  PositionedItem,
  RendererScene
} from "../src/renderer/staged/contracts.js";
import {
  buildScenarioFlowRendererScene,
  renderScenarioFlowPreRoutingArtifacts
} from "../src/renderer/staged/scenarioFlow.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

async function resolveScenarioFlowContext(fileName: string, profileId: string) {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "scenario_flow");
  if (!view) {
    throw new Error("Could not resolve the scenario_flow view.");
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

  const projected = projectView(compiled.graph, bundle, "scenario_flow");
  expect(projected.diagnostics).toEqual([]);
  if (!projected.projection) {
    throw new Error(`Could not project ${input.path} to scenario_flow.`);
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

function findNestedRendererItem(
  children: RendererScene["root"]["children"],
  id: string
): RendererScene["root"]["children"][number] | undefined {
  for (const child of children) {
    if (child.id === id) {
      return child;
    }
    if (child.kind === "container") {
      const nested = findNestedRendererItem(child.children, id);
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
}

function findRootCells(
  scene: { root: { children: PositionedItem[] } }
): Array<Extract<PositionedItem, { kind: "container" }>> {
  return scene.root.children.filter((child): child is Extract<PositionedItem, { kind: "container" }> =>
    child.kind === "container" && child.viewMetadata?.scenarioFlow?.kind === "cell"
  );
}

function findCellContainingNode(
  scene: { root: { children: PositionedItem[] } },
  nodeId: string
): Extract<PositionedItem, { kind: "container" }> {
  const cell = findRootCells(scene).find((candidate) => findNestedPositionedItem(candidate.children, nodeId));
  if (!cell) {
    throw new Error(`Could not find scenario-flow cell for "${nodeId}".`);
  }
  return cell;
}

function getScenarioFlowCellMetadata(cell: Extract<PositionedItem, { kind: "container" }>) {
  const metadata = cell.viewMetadata?.scenarioFlow;
  if (!metadata || metadata.kind !== "cell") {
    throw new Error(`Expected scenario-flow cell metadata for "${cell.id}".`);
  }

  return metadata;
}

function findTextDecoration(
  decorations: PositionedDecoration[],
  id: string
): Extract<PositionedDecoration, { kind: "text" }> {
  const decoration = decorations.find((candidate) => candidate.kind === "text" && candidate.id === id);
  if (!decoration || decoration.kind !== "text") {
    throw new Error(`Could not find text decoration "${id}".`);
  }

  return decoration;
}

function findLineDecoration(
  decorations: PositionedDecoration[],
  id: string
): Extract<PositionedDecoration, { kind: "line" }> {
  const decoration = decorations.find((candidate) => candidate.kind === "line" && candidate.id === id);
  if (!decoration || decoration.kind !== "line") {
    throw new Error(`Could not find line decoration "${id}".`);
  }

  return decoration;
}

describe("scenario_flow pre-routing artifacts", () => {
  it("builds a staged renderer scene with explicit ports and semantic edge declarations", async () => {
    const context = await resolveScenarioFlowContext("scenario_branching.sdd", "strict");
    const rendererScene = buildScenarioFlowRendererScene(
      context.projection,
      context.graph,
      context.view,
      "strict"
    );

    expect(rendererScene.viewId).toBe("scenario_flow");
    expect(rendererScene.root.layout).toEqual(expect.objectContaining({
      strategy: "grid",
      columns: 4,
      crossAlignment: "stretch"
    }));
    expect(rendererScene.root.children.every((child) =>
      child.kind === "container" && child.primitive === "stack"
    )).toBe(true);
    expect(rendererScene.root.children.some((child) =>
      child.kind === "container" && child.viewMetadata?.scenarioFlow?.kind === "cell"
      && child.viewMetadata.scenarioFlow.placeholder === true
    )).toBe(true);

    const stepNode = findNestedRendererItem(rendererScene.root.children, "J-030");
    if (!stepNode || stepNode.kind !== "node") {
      throw new Error("Could not resolve staged scenario-flow proof-case node J-030.");
    }
    expect(stepNode.ports.map((port) => port.role)).toEqual([
      "flow_in",
      "flow_out",
      "mirror_in",
      "mirror_out",
      "realization_in",
      "realization_out"
    ]);
    expect(stepNode.viewMetadata).toEqual({
      scenarioFlow: {
        kind: "semantic_node",
        laneId: "step",
        bandId: "band:1",
        trackId: "band:1__track:0",
        cellId: "step__cell__band:1__track:0",
        placementRole: "spine_step"
      }
    });

    expect(rendererScene.edges.map((edge) => edge.id)).toContain("J-030__precedes__J-031");
    expect(rendererScene.edges.find((edge) => edge.id === "J-030__precedes__J-031")).toEqual(
      expect.objectContaining({
        classes: expect.arrayContaining(["scenario_flow_semantic_edge", "edge-channel-step_flow"]),
        routing: expect.objectContaining({
          sourcePortRole: "flow_out",
          targetPortRole: "flow_in"
        })
      })
    );
    expect(rendererScene.edges.find((edge) => edge.id === "J-030__realized_by__P-030")).toEqual(
      expect.objectContaining({
        routing: expect.objectContaining({
          sourcePortRole: "realization_out",
          targetPortRole: "realization_in"
        })
      })
    );
  });

  it("renders proof-case pre-routing cells, lane decorations, SVG, and PNG without positioned semantic edges", async () => {
    const context = await resolveScenarioFlowContext("scenario_branching.sdd", "strict");
    const rendered = await renderScenarioFlowPreRoutingArtifacts(
      context.projection,
      context.graph,
      context.view,
      "strict"
    );

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendered.rendererScene.edges.length).toBeGreaterThan(0);
    expect(rendered.preRoutingPositionedScene.edges).toEqual([]);
    expect(rendered.preRoutingSvg).toContain("Choose Fulfillment");
    expect(rendered.preRoutingSvg).toContain("Pickup Store");
    expect(rendered.preRoutingSvg).toContain("Selector");
    expect(rendered.preRoutingSvg).not.toContain("scenario_flow_cell");
    expect(rendered.preRoutingPng.byteLength).toBeGreaterThan(0);

    expect(findTextDecoration(rendered.preRoutingPositionedScene.decorations, "lane-step__title").text).toBe("Steps");
    expect(findTextDecoration(rendered.preRoutingPositionedScene.decorations, "lane-place__title").text).toBe("Places");
    expect(findTextDecoration(rendered.preRoutingPositionedScene.decorations, "lane-view_state__title").text)
      .toBe("View States");
    const stepSeparator = findLineDecoration(rendered.preRoutingPositionedScene.decorations, "lane-step__separator");
    const placeSeparator = findLineDecoration(rendered.preRoutingPositionedScene.decorations, "lane-place__separator");
    expect(stepSeparator.from).toEqual({
      x: 24,
      y: stepSeparator.to.y
    });
    expect(stepSeparator.to.x).toBe(Math.max(24, rendered.preRoutingPositionedScene.root.width - 28));
    expect(placeSeparator.from.x).toBe(24);
    expect(rendered.preRoutingPositionedScene.decorations.find((decoration) =>
      decoration.id === "lane-view_state__separator"
    )).toBeUndefined();

    const cellByNodeId = new Map(
      ["J-030", "P-030", "VS-030a", "J-031", "P-031", "VS-031a", "J-032", "P-032", "VS-032a"]
        .map((nodeId) => [nodeId, findCellContainingNode(rendered.preRoutingPositionedScene, nodeId)] as const)
    );
    const c2t0StepMeta = getScenarioFlowCellMetadata(cellByNodeId.get("J-031")!);
    const c2t1StepMeta = getScenarioFlowCellMetadata(cellByNodeId.get("J-032")!);

    expect(getScenarioFlowCellMetadata(cellByNodeId.get("J-030")!)).toEqual(expect.objectContaining({
      laneId: "step",
      bandLabel: "C1",
      trackLabel: "T0",
      trackOrder: 0
    }));
    expect(getScenarioFlowCellMetadata(cellByNodeId.get("P-030")!)).toEqual(expect.objectContaining({
      laneId: "place",
      bandLabel: "C1",
      trackLabel: "T0"
    }));
    expect(getScenarioFlowCellMetadata(cellByNodeId.get("VS-030a")!)).toEqual(expect.objectContaining({
      laneId: "view_state",
      bandLabel: "C1",
      trackLabel: "T0"
    }));
    expect(c2t0StepMeta).toEqual(expect.objectContaining({
      laneId: "step",
      bandLabel: "C2",
      trackLabel: "T0",
      trackOrder: 0,
      columnOrder: 1
    }));
    expect(c2t1StepMeta).toEqual(expect.objectContaining({
      laneId: "step",
      bandLabel: "C2",
      trackLabel: "T1",
      trackOrder: 1,
      columnOrder: 1
    }));
    expect(cellByNodeId.get("J-031")!.x).toBe(cellByNodeId.get("J-032")!.x);
    expect(cellByNodeId.get("J-032")!.y).toBeGreaterThan(cellByNodeId.get("J-031")!.y);
    expect(getScenarioFlowCellMetadata(cellByNodeId.get("P-032")!)).toEqual(expect.objectContaining({
      laneId: "place",
      bandLabel: "C2",
      trackLabel: "T1"
    }));
    expect(getScenarioFlowCellMetadata(cellByNodeId.get("VS-032a")!)).toEqual(expect.objectContaining({
      laneId: "view_state",
      bandLabel: "C2",
      trackLabel: "T1"
    }));
  });
});
