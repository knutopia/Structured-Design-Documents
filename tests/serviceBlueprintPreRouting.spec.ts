import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type { PositionedDecoration, PositionedItem } from "../src/renderer/staged/contracts.js";
import {
  renderServiceBlueprintPreRoutingArtifacts,
  renderServiceBlueprintRoutingDebugArtifacts,
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

function findNestedPositionedNode(
  children: PositionedItem[],
  id: string
): Extract<PositionedItem, { kind: "node" }> | undefined {
  const item = findNestedPositionedItem(children, id);
  return item?.kind === "node" ? item : undefined;
}

function findRootCells(
  scene: { root: { children: PositionedItem[] } }
): Array<Extract<PositionedItem, { kind: "container" }>> {
  return scene.root.children.filter((child): child is Extract<PositionedItem, { kind: "container" }> =>
    child.kind === "container" && child.viewMetadata?.serviceBlueprint?.kind === "cell"
  );
}

function findCellContainingNode(
  scene: { root: { children: PositionedItem[] } },
  nodeId: string
): Extract<PositionedItem, { kind: "container" }> {
  const cell = findRootCells(scene).find((candidate) => findNestedPositionedItem(candidate.children, nodeId));
  if (!cell) {
    throw new Error(`Could not find service blueprint cell for "${nodeId}".`);
  }
  return cell;
}

function getServiceBlueprintCellMetadata(
  cell: Extract<PositionedItem, { kind: "container" }>
) {
  const metadata = cell.viewMetadata?.serviceBlueprint;
  if (!metadata || metadata.kind !== "cell") {
    throw new Error(`Expected service blueprint cell metadata for "${cell.id}".`);
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

function assertNodeWithinAssignedCellContentBox(
  scene: { root: { children: PositionedItem[] } },
  nodeId: string
): void {
  const cell = findCellContainingNode(scene, nodeId);
  const node = findNestedPositionedNode(cell.children, nodeId);
  if (!node) {
    throw new Error(`Could not find positioned node "${nodeId}" inside "${cell.id}".`);
  }

  const contentLeft = cell.x + cell.chrome.padding.left;
  const contentTop = cell.y + cell.chrome.padding.top + (cell.chrome.headerBandHeight ?? 0);
  const contentRight = cell.x + cell.width - cell.chrome.padding.right;
  const contentBottom = cell.y + cell.height - cell.chrome.padding.bottom;

  expect(node.x).toBeGreaterThanOrEqual(contentLeft);
  expect(node.y).toBeGreaterThanOrEqual(contentTop);
  expect(node.x + node.width).toBeLessThanOrEqual(contentRight);
  expect(node.y + node.height).toBeLessThanOrEqual(contentBottom);
}

describe("service_blueprint pre-routing artifacts", () => {
  it("render the fixed grid with decorations and without semantic edges", async () => {
    const context = await resolveServiceBlueprintContext("service_blueprint_slice.sdd", "strict");
    const rendered = await renderServiceBlueprintPreRoutingArtifacts(
      context.projection,
      context.graph,
      context.view,
      "strict"
    );

    expect(rendered.preRoutingDiagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendered.preRoutingPositionedScene.edges).toEqual([]);
    expect(rendered.preRoutingSvg).toContain("Submit Claim");
    expect(rendered.preRoutingSvg).toContain("Retention Policy");
    expect(rendered.preRoutingPng.byteLength).toBeGreaterThan(0);

    const customerTitle = findTextDecoration(rendered.preRoutingPositionedScene.decorations, "lane-customer__title");
    expect(customerTitle.text).toBe("Customer");

    const a1Cells = [
      findCellContainingNode(rendered.preRoutingPositionedScene, "J-020"),
      findCellContainingNode(rendered.preRoutingPositionedScene, "PR-020"),
      findCellContainingNode(rendered.preRoutingPositionedScene, "SA-020"),
      findCellContainingNode(rendered.preRoutingPositionedScene, "PL-020")
    ];
    const i1Cells = [
      findCellContainingNode(rendered.preRoutingPositionedScene, "PR-021"),
      findCellContainingNode(rendered.preRoutingPositionedScene, "SA-021")
    ];
    const a2Cells = [
      findCellContainingNode(rendered.preRoutingPositionedScene, "J-021"),
      findCellContainingNode(rendered.preRoutingPositionedScene, "PR-022"),
      findCellContainingNode(rendered.preRoutingPositionedScene, "SA-022")
    ];
    const systemA1PrimaryCell = findCellContainingNode(rendered.preRoutingPositionedScene, "SA-020");
    const systemI1Cell = findCellContainingNode(rendered.preRoutingPositionedScene, "SA-021");
    const resourceCell = findCellContainingNode(rendered.preRoutingPositionedScene, "D-020");
    const resourceCellMeta = getServiceBlueprintCellMetadata(resourceCell);
    const systemA1PrimaryMeta = getServiceBlueprintCellMetadata(systemA1PrimaryCell);
    const systemI1CellMeta = getServiceBlueprintCellMetadata(systemI1Cell);

    expect(resourceCell.classes).toContain("service_blueprint_cell");
    expect(resourceCellMeta).toEqual(expect.objectContaining({
      kind: "cell",
      laneId: "lane:05:system",
      laneShellId: "lane:05:system__shell",
      bandId: "band:anchor:1",
      bandLabel: "A1",
      bandKind: "anchor",
      slotKind: "spill",
      slotOrderWithinBand: 1
    }));
    expect(findNestedPositionedItem(resourceCell.children, "D-020")?.viewMetadata).toEqual({
      serviceBlueprint: {
        kind: "semantic_node",
        cellId: resourceCell.id
      }
    });

    expect(new Set(a1Cells.map((cell) => `${cell.x}:${cell.width}`)).size).toBe(1);
    expect(new Set(i1Cells.map((cell) => `${cell.x}:${cell.width}`)).size).toBe(1);
    expect(new Set(a2Cells.map((cell) => `${cell.x}:${cell.width}`)).size).toBe(1);
    expect(resourceCellMeta.columnOrder).toBe(systemA1PrimaryMeta.columnOrder + 1);
    expect(systemI1CellMeta.columnOrder).toBe(resourceCellMeta.columnOrder + 1);
    expect(resourceCell.x).toBeGreaterThan(systemA1PrimaryCell.x);
    expect(systemI1Cell.x).toBeGreaterThan(resourceCell.x);
    expect(a2Cells[0]!.x).toBeGreaterThan(i1Cells[0]!.x);

    [
      "J-020",
      "PR-020",
      "SA-020",
      "PL-020",
      "PR-021",
      "SA-021",
      "J-021",
      "PR-022",
      "SA-022",
      "D-020"
    ].forEach((nodeId) => {
      assertNodeWithinAssignedCellContentBox(rendered.preRoutingPositionedScene, nodeId);
    });
  });

  it("succeeds before routing while later routing stages and the final staged render stay available", async () => {
    const context = await resolveServiceBlueprintContext("service_blueprint_slice.sdd", "strict");

    await expect(
      renderServiceBlueprintPreRoutingArtifacts(
        context.projection,
        context.graph,
        context.view,
        "strict"
      )
    ).resolves.toEqual(expect.objectContaining({
      preRoutingSvg: expect.any(String),
      preRoutingPng: expect.any(Uint8Array)
    }));

    await expect(
      renderServiceBlueprintRoutingDebugArtifacts(
        context.projection,
        context.graph,
        context.view,
        "strict"
      )
    ).resolves.toEqual(expect.objectContaining({
      step2Svg: expect.any(String),
      step2Png: expect.any(Uint8Array),
      step3Svg: expect.any(String),
      step3Png: expect.any(Uint8Array)
    }));

    await expect(
      renderServiceBlueprintStagedSvg(
        context.projection,
        context.graph,
        context.view,
        "strict"
      )
    ).resolves.toEqual(expect.objectContaining({
      svg: expect.any(String)
    }));
  });
});
