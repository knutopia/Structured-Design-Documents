import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { resolveProfileDisplayPolicy } from "../src/renderer/profileDisplay.js";
import { buildServiceBlueprintRenderModel } from "../src/renderer/serviceBlueprintRenderModel.js";
import type {
  PositionedDecoration,
  PositionedEdge,
  PositionedItem,
  PositionedScene,
  RendererScene
} from "../src/renderer/staged/contracts.js";
import {
  buildServiceBlueprintRendererScene,
  renderServiceBlueprintPreRoutingArtifacts,
  renderServiceBlueprintRoutingDebugArtifacts,
  renderServiceBlueprintStagedSvg
} from "../src/renderer/staged/serviceBlueprint.js";
import { measureScene, positionSceneBeforeRouting } from "../src/renderer/staged/pipeline.js";
import { buildServiceBlueprintMiddleLayer } from "../src/renderer/staged/serviceBlueprintMiddleLayer.js";
import { buildServiceBlueprintRoutingStages } from "../src/renderer/staged/serviceBlueprintRouting.js";
import { expectRendererStageSnapshot, expectRendererStageTextSnapshot } from "./rendererStageSnapshotHarness.js";
import {
  collectVisibleItemBoxes,
  expectNoForbiddenDiagnostics,
  expectNoRouteIntersectionsWithNonEndpointBoxes
} from "./stagedVisualHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

async function resolveServiceBlueprintContext(
  input: { path: string; text: string },
  profileId: string
) {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "service_blueprint");
  if (!view) {
    throw new Error("Could not resolve the service_blueprint view.");
  }

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

async function buildServiceBlueprintRoutingContext(
  input: { path: string; text: string },
  profileId: string
) {
  const context = await resolveServiceBlueprintContext(input, profileId);
  const displayPolicy = resolveProfileDisplayPolicy(context.view, profileId);
  const model = buildServiceBlueprintRenderModel(context.projection, context.graph, displayPolicy);
  const middleLayer = buildServiceBlueprintMiddleLayer(model);
  const rendererScene = buildServiceBlueprintRendererScene(
    context.projection,
    context.graph,
    context.view,
    profileId
  );
  const measuredScene = measureScene(rendererScene);
  const positionedScene = await positionSceneBeforeRouting(measuredScene);

  return {
    ...context,
    rendererScene,
    measuredScene,
    positionedScene,
    middleLayer,
    authorOrderByNodeId: new Map(model.nodes.map((node) => [node.id, node.authorOrder] as const))
  };
}

async function loadExampleInput(fileName: string): Promise<{ path: string; text: string }> {
  const filePath = path.join(repoRoot, "bundle/v0.1/examples", fileName);
  return {
    path: filePath,
    text: await readFile(filePath, "utf8")
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

function findRootCells(
  scene: { root: { children: PositionedItem[] } }
): Array<Extract<PositionedItem, { kind: "container" }>> {
  return scene.root.children.filter((child): child is Extract<PositionedItem, { kind: "container" }> =>
    child.kind === "container" && child.classes.includes("service_blueprint_cell")
  );
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

function findSemanticEdge(edges: PositionedEdge[], id: string): PositionedEdge {
  const edge = edges.find((candidate) => candidate.id === id);
  if (!edge) {
    throw new Error(`Could not find routed edge "${id}".`);
  }
  return edge;
}

function findEdgeLabel(edge: PositionedEdge): NonNullable<PositionedEdge["label"]> {
  if (!edge.label) {
    throw new Error(`Expected routed edge "${edge.id}" to have a label.`);
  }
  return edge.label;
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

function findLaneCells(
  scene: PositionedScene,
  laneClass: string
): Array<Extract<PositionedItem, { kind: "container" }>> {
  return findRootCells(scene).filter((cell) => cell.classes.includes(laneClass));
}

function expectLaneGuideLayout(
  scene: PositionedScene,
  laneClass: string,
  hasSeparator: boolean
): void {
  const laneCells = findLaneCells(scene, laneClass);
  expect(laneCells.length).toBeGreaterThan(0);
  const minY = Math.min(...laneCells.map((cell) => cell.y));
  const maxY = Math.max(...laneCells.map((cell) => cell.y + cell.height));
  const title = findTextDecoration(scene.decorations, `${laneClass}__title`);

  expect(title.text).toBe(laneClass.replace(/^lane-/, ""));
  expect(title.x).toBe(24);
  expect(title.y).toBe(minY + Math.max(10, (maxY - minY) / 2 - 10));

  const separatorId = `${laneClass}__separator`;
  const separator = scene.decorations.find((candidate) => candidate.kind === "line" && candidate.id === separatorId);
  if (!hasSeparator) {
    expect(separator).toBeUndefined();
    return;
  }

  const resolvedSeparator = findLineDecoration(scene.decorations, separatorId);
  expect(resolvedSeparator.from).toEqual({
    x: 24,
    y: maxY
  });
  expect(resolvedSeparator.to).toEqual({
    x: Math.max(24, scene.root.width - 28),
    y: maxY
  });
}

function expectOrthogonalRoute(edge: PositionedEdge): void {
  for (let index = 1; index < edge.route.points.length; index += 1) {
    const start = edge.route.points[index - 1]!;
    const end = edge.route.points[index]!;
    expect(start.x === end.x || start.y === end.y).toBe(true);
  }
}

function boxesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function measureBoxClearance(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
): number {
  const horizontalGap = Math.max(
    right.x - (left.x + left.width),
    left.x - (right.x + right.width),
    0
  );
  const verticalGap = Math.max(
    right.y - (left.y + left.height),
    left.y - (right.y + right.height),
    0
  );
  return Math.hypot(horizontalGap, verticalGap);
}

function translatePositionedItem(item: PositionedItem, dx: number, dy: number): void {
  item.x += dx;
  item.y += dy;
  if (item.kind === "container") {
    item.children.forEach((child) => translatePositionedItem(child, dx, dy));
  }
}

function recomputeRootBounds(root: { children: PositionedItem[]; width: number; height: number }): void {
  root.width = Math.max(...root.children.map((child) => child.x + child.width));
  root.height = Math.max(...root.children.map((child) => child.y + child.height));
}

describe("staged service_blueprint", () => {
  it("builds a fixed root grid for service_blueprint_slice instead of using root ELK placement", async () => {
    const context = await resolveServiceBlueprintContext(
      await loadExampleInput("service_blueprint_slice.sdd"),
      "recommended"
    );

    const rendererScene = buildServiceBlueprintRendererScene(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );
    expect(rendererScene.root.layout).toEqual(expect.objectContaining({
      strategy: "grid",
      columns: 4,
      crossAlignment: "stretch"
    }));
    expect(findRootCells(rendererScene)).toHaveLength(24);
    expect(findRootCells(rendererScene).slice(0, 4).map((child) => child.id)).toEqual([
      "lane:01:customer__shell__cell__band:anchor:1",
      "lane:01:customer__shell__cell__band:interstitial:1",
      "lane:01:customer__shell__cell__band:anchor:2",
      "lane:01:customer__shell__cell__band:sidecar:1"
    ]);
    expect(findRootCells(rendererScene).slice(4, 8).map((child) => child.id)).toEqual([
      "lane:02:frontstage__shell__cell__band:anchor:1",
      "lane:02:frontstage__shell__cell__band:interstitial:1",
      "lane:02:frontstage__shell__cell__band:anchor:2",
      "lane:02:frontstage__shell__cell__band:sidecar:1"
    ]);
  });

  it("renders routing stages for the proof case with deterministic step-2, step-3, and final service_blueprint routes", async () => {
    const context = await buildServiceBlueprintRoutingContext(
      await loadExampleInput("service_blueprint_slice.sdd"),
      "recommended"
    );
    const routedStages = buildServiceBlueprintRoutingStages(
      context.positionedScene,
      context.rendererScene,
      context.middleLayer,
      context.authorOrderByNodeId
    );

    const preRouting = await renderServiceBlueprintPreRoutingArtifacts(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );
    const routingDebug = await renderServiceBlueprintRoutingDebugArtifacts(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );
    const rendered = await renderServiceBlueprintStagedSvg(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );

    expect(rendered.positionedScene.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendered.svg).toContain("Submit Claim");
    expect(rendered.svg).toContain("Retention Policy");
    expect(rendered.svg).toContain("reads, writes");
    expect(routingDebug.step2PositionedScene.edges.every((edge) => edge.label === undefined)).toBe(true);
    expect(routingDebug.step3PositionedScene.edges.every((edge) => edge.label === undefined)).toBe(true);

    [routedStages.step2.positionedScene, routedStages.step3.positionedScene, routedStages.final.positionedScene]
      .forEach((scene) => {
        expectLaneGuideLayout(scene, "lane-customer", true);
        expectLaneGuideLayout(scene, "lane-frontstage", true);
        expectLaneGuideLayout(scene, "lane-backstage", true);
        expectLaneGuideLayout(scene, "lane-system", false);
      });

    for (const edge of rendered.positionedScene.edges.filter((candidate) =>
      candidate.classes.includes("service_blueprint_semantic_edge")
    )) {
      if (edge.role === "precedes") {
        expect(edge.label).toBeUndefined();
      } else {
        expect(edge.label).toBeDefined();
      }
      expectOrthogonalRoute(edge);
    }

    const precedesEdge = findSemanticEdge(rendered.positionedScene.edges, "J-020__precedes__J-021");
    const j020 = findNestedPositionedItem(rendered.positionedScene.root.children, "J-020");
    const j021 = findNestedPositionedItem(rendered.positionedScene.root.children, "J-021");
    if (!j020 || !j021) {
      throw new Error("Could not resolve proof-case nodes.");
    }
    expect(precedesEdge.from.itemId).toBe("J-020");
    expect(precedesEdge.to.itemId).toBe("J-021");
    expect(precedesEdge.from.x).toBe(j020.x + j020.width);
    expect(precedesEdge.from.y).toBe(j020.y + j020.height / 2);
    expect(precedesEdge.to.x).toBe(j021.x);
    expect(precedesEdge.to.y).toBe(j021.y + j021.height / 2);
    expect(precedesEdge.route.points).toEqual([
      { x: precedesEdge.from.x, y: precedesEdge.from.y },
      { x: precedesEdge.to.x, y: precedesEdge.to.y }
    ]);

    const realizedByEdge = findSemanticEdge(rendered.positionedScene.edges, "J-020__realized_by__PR-020");
    expect(realizedByEdge.route.points).toEqual([
      { x: realizedByEdge.from.x, y: realizedByEdge.from.y },
      { x: realizedByEdge.to.x, y: realizedByEdge.to.y }
    ]);
    expect(realizedByEdge.from.x).toBe(realizedByEdge.to.x);
    expect(realizedByEdge.from.y).toBeLessThan(realizedByEdge.to.y);
    const realizedByLabel = findEdgeLabel(realizedByEdge);
    const interactionLine = findLineDecoration(rendered.positionedScene.decorations, "lane-customer__separator");
    const pr020 = findNestedPositionedItem(rendered.positionedScene.root.children, "PR-020");
    if (!pr020) {
      throw new Error("Could not resolve PR-020 for realized-by label assertions.");
    }
    expect(realizedByLabel.lines).toEqual(["realized by"]);
    expect(realizedByLabel.x).toBe(realizedByEdge.from.x + 12);
    expect(realizedByLabel.y).toBeGreaterThan(interactionLine.from.y);
    expect(pr020.y - (realizedByLabel.y + realizedByLabel.height)).toBeGreaterThan(0);
    expect(
      Math.abs(
        (realizedByLabel.y - interactionLine.from.y)
        - (pr020.y - (realizedByLabel.y + realizedByLabel.height))
      )
    ).toBeLessThanOrEqual(1);
    expect(boxesOverlap(realizedByLabel, j020)).toBe(false);
    expect(boxesOverlap(realizedByLabel, pr020)).toBe(false);
    expect(rendered.svg).toContain("block-kind-edge_label");
    expect(rendered.svg).toContain("dominant-baseline=\"middle\"");

    const step2ConstrainedBy = findSemanticEdge(
      routingDebug.step2PositionedScene.edges,
      "PR-020__constrained_by__PL-020"
    );
    const step3ConstrainedBy = findSemanticEdge(
      routingDebug.step3PositionedScene.edges,
      "PR-020__constrained_by__PL-020"
    );
    const finalConstrainedBy = findSemanticEdge(
      rendered.positionedScene.edges,
      "PR-020__constrained_by__PL-020"
    );
    const step3Sa020 = findNestedPositionedItem(routingDebug.step3PositionedScene.root.children, "SA-020");
    const finalSa020Node = findNestedPositionedItem(rendered.positionedScene.root.children, "SA-020");
    if (!step3Sa020 || !finalSa020Node) {
      throw new Error("Could not resolve SA-020 for obstacle-clearance assertions.");
    }
    expect(step2ConstrainedBy.route.points).toHaveLength(2);
    expect(step3ConstrainedBy.route.points).toHaveLength(6);
    expect(step3ConstrainedBy.route.points[0]!.x).toBe(step3ConstrainedBy.route.points[1]!.x);
    expect(step3ConstrainedBy.route.points[1]!.x).toBeLessThan(step3ConstrainedBy.route.points[2]!.x);
    expect(step3ConstrainedBy.route.points[2]!.x).toBe(step3ConstrainedBy.route.points[3]!.x);
    expect(step3ConstrainedBy.route.points[3]!.y).toBe(step3ConstrainedBy.route.points[4]!.y);
    expect(step3ConstrainedBy.route.points[4]!.x).toBe(step3ConstrainedBy.route.points[5]!.x);
    expect(step3ConstrainedBy.route.points[4]!.x).toBe(step3ConstrainedBy.route.points[0]!.x);
    expect(step3ConstrainedBy.route.points[1]!.y).toBe(464);
    expect(step3ConstrainedBy.route.points[3]!.y).toBe(592);
    expect(step3Sa020.y - step3ConstrainedBy.route.points[1]!.y).toBeGreaterThanOrEqual(32);
    expect(step3ConstrainedBy.route.points[3]!.y - (step3Sa020.y + step3Sa020.height)).toBeGreaterThanOrEqual(48);
    expect(step3ConstrainedBy.route.points[2]!.x - (step3Sa020.x + step3Sa020.width)).toBeGreaterThanOrEqual(16);
    expect(finalConstrainedBy.route.points).toHaveLength(6);
    expect(finalConstrainedBy.route.points[0]!.x).toBe(finalConstrainedBy.route.points[1]!.x);
    expect(finalConstrainedBy.route.points[1]!.y).toBe(480);
    expect(finalConstrainedBy.route.points[2]!.x).toBe(step3ConstrainedBy.route.points[2]!.x);
    expect(finalConstrainedBy.route.points[3]!.y).toBe(576);
    expect(finalConstrainedBy.route.points[4]!.x).toBe(finalConstrainedBy.route.points[5]!.x);
    expect(finalSa020Node.y - finalConstrainedBy.route.points[1]!.y).toBeGreaterThanOrEqual(16);
    expect(finalConstrainedBy.route.points[3]!.y - (finalSa020Node.y + finalSa020Node.height)).toBeGreaterThanOrEqual(16);
    expect(finalConstrainedBy.route.points[2]!.x - (finalSa020Node.x + finalSa020Node.width)).toBeGreaterThanOrEqual(16);
    const finalConstrainedByLabel = findEdgeLabel(finalConstrainedBy);
    const constrainedByHorizontalY = finalConstrainedBy.route.points[1]!.y;
    expect(
      finalConstrainedByLabel.y + finalConstrainedByLabel.height <= constrainedByHorizontalY - 12
      || finalConstrainedByLabel.y >= constrainedByHorizontalY + 12
    ).toBe(true);
    expect(measureBoxClearance(finalConstrainedByLabel, finalSa020Node)).toBeGreaterThanOrEqual(12);

    const finalDependsOn = findSemanticEdge(rendered.positionedScene.edges, "PR-020__depends_on__SA-020");
    expect(finalDependsOn.route.points).toEqual([
      { x: finalDependsOn.from.x, y: finalDependsOn.from.y },
      { x: finalDependsOn.to.x, y: finalDependsOn.to.y }
    ]);
    expect(finalDependsOn.from.x).toBe(finalDependsOn.to.x);
    expect(finalDependsOn.from.x).toBeLessThan(finalConstrainedBy.route.points[0]!.x);
    expect(finalConstrainedBy.route.points[1]!.y).toBeLessThan(finalDependsOn.to.y);
    const finalDependsOnLabel = findEdgeLabel(finalDependsOn);
    expect(finalDependsOnLabel.lines).toEqual(["depends on"]);
    expect(finalDependsOnLabel.x + finalDependsOnLabel.width).toBeLessThanOrEqual(finalDependsOn.from.x - 12);

    const finalStraightDependsOn = findSemanticEdge(
      rendered.positionedScene.edges,
      "PR-021__depends_on__SA-021"
    );
    expect(finalStraightDependsOn.route.points).toEqual([
      { x: finalStraightDependsOn.from.x, y: finalStraightDependsOn.from.y },
      { x: finalStraightDependsOn.to.x, y: finalStraightDependsOn.to.y }
    ]);
    expect(finalStraightDependsOn.from.x).toBe(finalStraightDependsOn.to.x);

    const finalSaConstrainedBy = findSemanticEdge(rendered.positionedScene.edges, "SA-020__constrained_by__PL-020");
    expect(finalSaConstrainedBy.route.points).toEqual([
      { x: finalSaConstrainedBy.from.x, y: finalSaConstrainedBy.from.y },
      { x: finalSaConstrainedBy.to.x, y: finalSaConstrainedBy.to.y }
    ]);
    expect(finalSaConstrainedBy.from.x).toBe(finalSaConstrainedBy.to.x);
    expect(finalSaConstrainedBy.to.x).toBeLessThan(finalConstrainedBy.route.points[5]!.x);

    const finalReadsWrites = findSemanticEdge(rendered.positionedScene.edges, "SA-020__reads_writes__D-020");
    expect(finalReadsWrites.route.points[1]!.y).toBe(560);
    expect(finalConstrainedBy.route.points[3]!.y).toBeGreaterThan(finalReadsWrites.route.points[1]!.y);
    expect(finalConstrainedBy.route.points[3]!.y - finalReadsWrites.route.points[1]!.y).toBe(16);
    expect(finalReadsWrites.route.points[1]!.y).toBeGreaterThan(finalSaConstrainedBy.from.y);

    const saBottomBundleOccupancy = routedStages.final.gutterOccupancy.filter((occupancy) =>
      occupancy.key === "node:SA-020:bottom" && occupancy.axis === "horizontal"
    ).map((occupancy) => ({
      connectorId: occupancy.connectorId,
      nominalCoordinate: occupancy.nominalCoordinate
    })).sort((left, right) =>
      left.nominalCoordinate - right.nominalCoordinate
      || left.connectorId.localeCompare(right.connectorId)
    );
    expect(saBottomBundleOccupancy).toEqual([
      {
        connectorId: "SA-020__reads_writes__D-020",
        nominalCoordinate: finalReadsWrites.route.points[1]!.y
      },
      {
        connectorId: "PR-020__constrained_by__PL-020",
        nominalCoordinate: finalConstrainedBy.route.points[3]!.y
      }
    ]);

    const finalProcessPrecedes = findSemanticEdge(rendered.positionedScene.edges, "PR-020__precedes__PR-021");
    expect(finalProcessPrecedes.route.points).toHaveLength(4);
    expect(finalProcessPrecedes.route.points[0]!.y).toBe(finalProcessPrecedes.route.points[1]!.y);
    expect(finalProcessPrecedes.route.points[1]!.x).toBe(finalProcessPrecedes.route.points[2]!.x);
    expect(finalProcessPrecedes.route.points[2]!.y).toBe(finalProcessPrecedes.route.points[3]!.y);
    expect(finalProcessPrecedes.route.points[2]!.x).toBeLessThan(finalProcessPrecedes.route.points[3]!.x);

    const finalSupportPrecedes = findSemanticEdge(rendered.positionedScene.edges, "PR-021__precedes__PR-022");
    expect(finalSupportPrecedes.route.points).toHaveLength(4);
    expect(finalSupportPrecedes.route.points[2]!.x).toBeLessThan(finalSupportPrecedes.route.points[3]!.x);

    const pr020BottomOccupancy = routedStages.step3.gutterOccupancy.filter((occupancy) =>
      occupancy.key === "node:PR-020:bottom" && occupancy.axis === "vertical"
    );
    expect(
      pr020BottomOccupancy.map((occupancy) => ({
        connectorId: occupancy.connectorId,
        nominalCoordinate: occupancy.nominalCoordinate
      }))
    ).toEqual([
      {
        connectorId: "PR-020__constrained_by__PL-020",
        nominalCoordinate: 256
      },
      {
        connectorId: "PR-020__depends_on__SA-020",
        nominalCoordinate: 256
      }
    ]);

    expect(
      routedStages.final.gutterOccupancy.some((occupancy) =>
        occupancy.connectorId === "PR-021__precedes__PR-022" && occupancy.key === "node:PR-021:bottom"
      )
    ).toBe(false);
    expect(
      routedStages.final.gutterOccupancy.filter((occupancy) =>
        occupancy.connectorId === "PR-021__depends_on__SA-021"
      )
    ).toEqual([
      expect.objectContaining({
        key: "node:PR-021:bottom",
        axis: "vertical",
        nominalCoordinate: 528,
        spanStart: 320,
        spanEnd: 364
      })
    ]);

    expect(
      routedStages.final.gutterOccupancy.filter((occupancy) =>
        occupancy.key === "obstacle:SA-020:north" && occupancy.axis === "horizontal"
      ).map((occupancy) => ({
        connectorId: occupancy.connectorId,
        nominalCoordinate: occupancy.nominalCoordinate,
        ownershipRank: occupancy.ownershipRank
      }))
    ).toEqual([
      {
        connectorId: "PR-020__constrained_by__PL-020",
        nominalCoordinate: finalConstrainedBy.route.points[1]!.y,
        ownershipRank: 1
      }
    ]);
    expect(
      routedStages.final.gutterOccupancy.filter((occupancy) =>
        occupancy.key === "obstacle:SA-020:south" && occupancy.axis === "horizontal"
      ).map((occupancy) => ({
        connectorId: occupancy.connectorId,
        nominalCoordinate: occupancy.nominalCoordinate,
        ownershipRank: occupancy.ownershipRank
      }))
    ).toEqual(expect.arrayContaining([
      {
        connectorId: "SA-020__reads_writes__D-020",
        nominalCoordinate: finalReadsWrites.route.points[1]!.y,
        ownershipRank: 0
      },
      {
        connectorId: "PR-020__constrained_by__PL-020",
        nominalCoordinate: finalConstrainedBy.route.points[3]!.y,
        ownershipRank: 1
      }
    ]));

    const resourceEdges = [
      finalReadsWrites,
      findSemanticEdge(rendered.positionedScene.edges, "SA-021__reads__D-020"),
      findSemanticEdge(rendered.positionedScene.edges, "SA-022__reads__D-020")
    ];
    const resourceTrackYs = resourceEdges.map((edge) => edge.route.points[1]!.y);
    expect(new Set(resourceTrackYs).size).toBeGreaterThanOrEqual(2);
    expect(resourceTrackYs.every((y) => y > resourceEdges[0]!.from.y)).toBe(true);
    const sa021ReadsLabel = findEdgeLabel(resourceEdges[1]!);
    expect(sa021ReadsLabel.x).toBeGreaterThan(resourceEdges[1]!.route.points[1]!.x);

    expect(rendered.rendererScene.edges.map((edge) => edge.id)).toContain("SA-020__reads_writes__D-020");
    expect(rendered.rendererScene.edges.map((edge) => edge.id)).not.toContain("SA-020__reads__D-020");
    expect(rendered.rendererScene.edges.map((edge) => edge.id)).not.toContain("SA-020__writes__D-020");
    expect(findSemanticEdge(rendered.positionedScene.edges, "SA-020__reads_writes__D-020").classes).not.toContain("edge-bold");
    expect(findEdgeLabel(finalReadsWrites).lines.join(" ")).toBe("reads, writes");

    expect(routingDebug.step2PositionedScene.root.width).toBe(preRouting.preRoutingPositionedScene.root.width);
    expect(routingDebug.step2PositionedScene.root.height).toBe(preRouting.preRoutingPositionedScene.root.height);
    expect(routingDebug.step3PositionedScene.root.width).toBe(preRouting.preRoutingPositionedScene.root.width);
    expect(routingDebug.step3PositionedScene.root.height).toBe(preRouting.preRoutingPositionedScene.root.height);
    expect(rendered.positionedScene.root.width).toBeGreaterThanOrEqual(preRouting.preRoutingPositionedScene.root.width);
    expect(rendered.positionedScene.root.height).toBeGreaterThanOrEqual(preRouting.preRoutingPositionedScene.root.height);

    expectNoForbiddenDiagnostics(rendered.positionedScene.diagnostics, [
      "renderer.routing.service_blueprint_node_intersection"
    ]);
    expectNoRouteIntersectionsWithNonEndpointBoxes(
      rendered.positionedScene.edges,
      collectVisibleItemBoxes(rendered.positionedScene.root).filter((box) =>
        box.itemId !== "root" && !box.itemId.includes("__cell__")
      )
    );
    const visibleNodeBoxes = collectVisibleItemBoxes(rendered.positionedScene.root).filter((box) =>
      box.itemId !== "root"
      && !box.itemId.includes("__cell__")
      && box.kind === "node"
    );
    for (const edge of [realizedByEdge, finalDependsOn, resourceEdges[1]!]) {
      const label = findEdgeLabel(edge);
      const nonEndpointBoxes = visibleNodeBoxes.filter((box) =>
        box.itemId !== edge.from.itemId && box.itemId !== edge.to.itemId
      );
      expect(nonEndpointBoxes.some((box) => boxesOverlap(label, box))).toBe(false);
    }
  });

  it("matches staged renderer snapshots for the service_blueprint proof case and routing debug stages", async () => {
    const context = await resolveServiceBlueprintContext(
      await loadExampleInput("service_blueprint_slice.sdd"),
      "recommended"
    );

    const rendererScene = buildServiceBlueprintRendererScene(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );
    const measuredScene = measureScene(rendererScene);
    const routingDebug = await renderServiceBlueprintRoutingDebugArtifacts(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );
    const rendered = await renderServiceBlueprintStagedSvg(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );

    await expectRendererStageSnapshot("service-blueprint.slice.renderer-scene.json", rendererScene);
    await expectRendererStageSnapshot("service-blueprint.slice.measured-scene.json", measuredScene);
    await expectRendererStageSnapshot("service-blueprint.slice.positioned-scene.json", rendered.positionedScene);
    await expectRendererStageTextSnapshot("service-blueprint.slice.svg", rendered.svg);
    await expectRendererStageSnapshot("service-blueprint.slice.step-2.positioned-scene.json", routingDebug.step2PositionedScene);
    await expectRendererStageTextSnapshot("service-blueprint.slice.step-2.svg", routingDebug.step2Svg);
    await expectRendererStageSnapshot("service-blueprint.slice.step-3.positioned-scene.json", routingDebug.step3PositionedScene);
    await expectRendererStageTextSnapshot("service-blueprint.slice.step-3.svg", routingDebug.step3Svg);
  });

  it("expands the lane gutter when a crowded bottom-gutter bundle no longer fits", async () => {
    const context = await buildServiceBlueprintRoutingContext(
      await loadExampleInput("service_blueprint_slice.sdd"),
      "recommended"
    );
    const compressedScene = structuredClone(context.positionedScene);
    for (const child of compressedScene.root.children) {
      if (child.kind !== "container") {
        continue;
      }
      if (child.id.startsWith("lane:05:") || child.id.startsWith("lane:06:")) {
        translatePositionedItem(child, 0, -32);
      }
    }
    recomputeRootBounds(compressedScene.root);

    const routedStages = buildServiceBlueprintRoutingStages(
      compressedScene,
      context.rendererScene,
      context.middleLayer,
      context.authorOrderByNodeId
    );

    expect(routedStages.final.globalGutterState.laneExpansions[4]).toBeGreaterThan(0);
    expectLaneGuideLayout(routedStages.final.positionedScene, "lane-customer", true);
    expectLaneGuideLayout(routedStages.final.positionedScene, "lane-frontstage", true);
    expectLaneGuideLayout(routedStages.final.positionedScene, "lane-backstage", true);
    expectLaneGuideLayout(routedStages.final.positionedScene, "lane-system", false);

    const finalReadsWrites = findSemanticEdge(
      routedStages.final.positionedScene.edges,
      "SA-020__reads_writes__D-020"
    );
    const finalSaConstrainedBy = findSemanticEdge(
      routedStages.final.positionedScene.edges,
      "SA-020__constrained_by__PL-020"
    );
    const finalPrConstrainedBy = findSemanticEdge(
      routedStages.final.positionedScene.edges,
      "PR-020__constrained_by__PL-020"
    );
    expect(finalSaConstrainedBy.route.points).toEqual([
      { x: finalSaConstrainedBy.from.x, y: finalSaConstrainedBy.from.y },
      { x: finalSaConstrainedBy.to.x, y: finalSaConstrainedBy.to.y }
    ]);
    expect(finalReadsWrites.route.points[1]!.y).toBeLessThan(finalPrConstrainedBy.route.points[3]!.y);
    expect(finalPrConstrainedBy.route.points[3]!.y - finalReadsWrites.route.points[1]!.y).toBeGreaterThanOrEqual(16);
    expectNoForbiddenDiagnostics(routedStages.final.positionedScene.diagnostics, [
      "renderer.routing.service_blueprint_node_intersection"
    ]);
  });

  it("merges routing-compatible same-node connectors after side resolution", async () => {
    const context = await buildServiceBlueprintRoutingContext(
      await loadExampleInput("service_blueprint_slice.sdd"),
      "recommended"
    );
    const duplicateMiddleEdge = structuredClone(
      context.middleLayer.edges.find((edge) => edge.id === "PR-020__depends_on__SA-020")
    );
    const duplicateSceneEdge = structuredClone(
      context.rendererScene.edges.find((edge) => edge.id === "PR-020__depends_on__SA-020")
    );
    if (!duplicateMiddleEdge || !duplicateSceneEdge) {
      throw new Error("Could not resolve the proof-case edge to duplicate.");
    }

    duplicateMiddleEdge.id = "PR-020__depends_on__SA-020__duplicate";
    duplicateMiddleEdge.semanticEdgeIds = ["PR-020__depends_on__SA-020__duplicate_semantic"];
    duplicateSceneEdge.id = duplicateMiddleEdge.id;

    const routed = buildServiceBlueprintRoutingStages(
      context.positionedScene,
      {
        ...context.rendererScene,
        edges: [...context.rendererScene.edges, duplicateSceneEdge]
      },
      {
        ...context.middleLayer,
        edges: [...context.middleLayer.edges, duplicateMiddleEdge]
      },
      context.authorOrderByNodeId
    );

    expect(
      routed.step2.positionedScene.edges.filter((edge) =>
        edge.from.itemId === "PR-020" && edge.to.itemId === "SA-020"
      )
    ).toHaveLength(1);
    const mergedPlan = routed.step2.connectorPlans.find((plan) => plan.id === "PR-020__depends_on__SA-020");
    expect(mergedPlan?.memberConnectorIds).toEqual([
      "PR-020__depends_on__SA-020",
      "PR-020__depends_on__SA-020__duplicate"
    ]);
    expect(mergedPlan?.semanticEdgeIds).toEqual(expect.arrayContaining([
      "PR-020__depends_on__SA-020",
      "PR-020__depends_on__SA-020__duplicate_semantic"
    ]));
    expect(
      routed.final.diagnostics.some((diagnostic) =>
        diagnostic.code === "renderer.routing.service_blueprint_same_node_connector_not_merged"
      )
    ).toBe(false);
  });

  it("keeps incompatible same-node connectors separate and reports that choice explicitly", async () => {
    const context = await buildServiceBlueprintRoutingContext(
      await loadExampleInput("service_blueprint_slice.sdd"),
      "recommended"
    );
    const duplicateMiddleEdge = structuredClone(
      context.middleLayer.edges.find((edge) => edge.id === "PR-020__constrained_by__PL-020")
    );
    const duplicateSceneEdge = structuredClone(
      context.rendererScene.edges.find((edge) => edge.id === "PR-020__constrained_by__PL-020")
    );
    if (!duplicateMiddleEdge || !duplicateSceneEdge) {
      throw new Error("Could not resolve the proof-case policy edge to duplicate.");
    }

    duplicateMiddleEdge.id = "PR-020__depends_on__PL-020__synthetic";
    duplicateMiddleEdge.semanticEdgeIds = ["PR-020__depends_on__PL-020__synthetic"];
    duplicateMiddleEdge.type = "DEPENDS_ON";
    duplicateMiddleEdge.channel = "support";
    duplicateSceneEdge.id = duplicateMiddleEdge.id;
    duplicateSceneEdge.role = "depends_on";
    duplicateSceneEdge.classes = [
      ...duplicateSceneEdge.classes.filter((className) => !className.startsWith("edge-type-") && !className.startsWith("edge-channel-")),
      "edge-type-depends_on",
      "edge-channel-support"
    ];

    const routed = buildServiceBlueprintRoutingStages(
      context.positionedScene,
      {
        ...context.rendererScene,
        edges: [...context.rendererScene.edges, duplicateSceneEdge]
      },
      {
        ...context.middleLayer,
        edges: [...context.middleLayer.edges, duplicateMiddleEdge]
      },
      context.authorOrderByNodeId
    );

    expect(
      routed.step2.positionedScene.edges.filter((edge) =>
        edge.from.itemId === "PR-020" && edge.to.itemId === "PL-020"
      )
    ).toHaveLength(2);
    expect(
      routed.final.diagnostics.some((diagnostic) =>
        diagnostic.code === "renderer.routing.service_blueprint_same_node_connector_not_merged"
      )
    ).toBe(true);
  });

  it("appends a synthetic ungrouped lane shell when projection omits derived lane mapping", async () => {
    const source = `
SDD-TEXT 0.1

Step J-100 "Start"
END

Process PR-100 "Investigate"
END
`;
    const context = await resolveServiceBlueprintContext({
      path: path.join(repoRoot, "tests/fixtures/render/__inline_service_blueprint_ungrouped__.sdd"),
      text: source.trimStart()
    }, "recommended");

    const rendererScene = buildServiceBlueprintRendererScene(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );

    expect(rendererScene.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "renderer.scene.service_blueprint_ungrouped_lane"
    );
    const ungroupedCells = rendererScene.root.children.filter(
      (child): child is Extract<RendererScene["root"]["children"][number], { kind: "container" }> =>
        child.kind === "container"
        && child.classes.includes("service_blueprint_cell")
        && child.classes.includes("lane-ungrouped")
    );
    expect(ungroupedCells.map((child) => child.id)).toEqual([
      "lane:99:ungrouped__shell__cell__band:anchor:1",
      "lane:99:ungrouped__shell__cell__band:sidecar:1",
      "lane:99:ungrouped__shell__cell__band:parking:lane:99:ungrouped:1"
    ]);
    expect(findNestedRendererItem(rendererScene.root.children, "PR-100")).toBeDefined();
  });

  it("keeps disconnected scene construction deterministic in lane order", async () => {
    const source = `
SDD-TEXT 0.1

Step J-200 "Start"
END

Process PR-200 "Assist"
  visibility=support
END

SystemAction SA-200 "Log"
END
`;
    const firstContext = await resolveServiceBlueprintContext({
      path: path.join(repoRoot, "tests/fixtures/render/__inline_service_blueprint_disconnected_a__.sdd"),
      text: source.trimStart()
    }, "recommended");
    const secondContext = await resolveServiceBlueprintContext({
      path: path.join(repoRoot, "tests/fixtures/render/__inline_service_blueprint_disconnected_b__.sdd"),
      text: source.trimStart()
    }, "recommended");

    const firstScene = buildServiceBlueprintRendererScene(
      firstContext.projection,
      firstContext.graph,
      firstContext.view,
      "recommended"
    );
    const secondScene = buildServiceBlueprintRendererScene(
      secondContext.projection,
      secondContext.graph,
      secondContext.view,
      "recommended"
    );

    expect(firstScene).toEqual(secondScene);
  });
});
