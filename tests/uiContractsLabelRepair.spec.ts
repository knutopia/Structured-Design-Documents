import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type { PositionedEdge, PositionedScene } from "../src/renderer/staged/contracts.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import { buildUiContractsRendererScene } from "../src/renderer/staged/uiContracts.js";
import { auditUiContractsFinalScene, repairUiContractsLabels } from "../src/renderer/staged/uiContractsLabels.js";
import { renderPositionedSceneToPng, renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import { assessUiContractsGeometry } from "./uiContractsB5Acceptance.js";

const fixture = "tests/fixtures/render/ui_contracts_label_clearance.sdd";
let bundle: Awaited<ReturnType<typeof loadBundle>>;
beforeAll(async () => { bundle = await loadBundle("bundle/v0.1/manifest.yaml"); });

function edge(id: string, points: Array<{ x: number; y: number }>, x: number, y: number): PositionedEdge {
  return {
    id, role: "transition", classes: [], paintGroup: "edges",
    from: { itemId: `${id}:source`, ...points[0]! },
    to: { itemId: `${id}:target`, ...points[points.length - 1]! },
    route: { style: "orthogonal", points },
    label: { lines: ["Synthetic action"], width: 180, height: 20, lineHeight: 20,
      textStyleRole: "edge_label", x, y }
  };
}

function scene(ids = ["connector-a", "connector-b"]): PositionedScene {
  const first = edge(ids[0]!, [
    { x: 100, y: 120 }, { x: 200, y: 120 }, { x: 200, y: 132 }, { x: 340, y: 132 }
  ], 125, 108);
  const second = edge(ids[1]!, [{ x: 100, y: 108 }, { x: 340, y: 108 }], 125, 70);
  return {
    viewId: "ui_contracts", detailId: "detailed", themeId: "default",
    root: {
      kind: "container", id: "root", role: "root", primitive: "root", classes: [],
      layout: { strategy: "manual" },
      chrome: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
      headerContent: [], children: [], ports: [], x: 0, y: 0, width: 500, height: 300
    },
    edges: [first, second], decorations: [], diagnostics: [],
    paintOrder: ["chrome", "nodes", "labels", "edges", "edge_labels"]
  };
}

function labelCodes(scene: PositionedScene): string[] {
  return auditUiContractsFinalScene(scene).filter((item) => item.code.startsWith("renderer.routing.ui_contracts_label_"))
    .map((item) => item.code);
}

describe("UI Contracts final label repair", () => {
  it("allows its own route but rejects and repairs a neighboring route without moving either connector", () => {
    const original = scene();
    expect(labelCodes(original)).toContain("renderer.routing.ui_contracts_label_connector");
    const routes = original.edges.map((item) => item.route.points);
    const repaired = repairUiContractsLabels(original);
    expect(repaired.edges.map((item) => item.route.points)).toEqual(routes);
    expect(repaired.edges[1]!.label).toEqual(original.edges[1]!.label);
    expect(repaired.edges[0]!.label).not.toEqual(original.edges[0]!.label);
    expect(labelCodes(repaired)).toEqual([]);
    const ownOnly = structuredClone(repaired);
    const first = ownOnly.edges[0]!;
    first.label = { ...first.label!, x: 125, y: 114 };
    ownOnly.edges = [first];
    expect(labelCodes(ownOnly)).toEqual([]);
  });

  it("repairs a vertical-stem label that intrudes into an adjacent node", () => {
    const original = scene();
    const first = original.edges[0]!;
    first.route.points = [{ x: 200, y: 60 }, { x: 200, y: 160 }];
    first.from.x = 200; first.from.y = 60;
    first.to.x = 200; first.to.y = 160;
    first.label = { ...first.label!, x: 212, y: 100 };
    original.root.children.push({ kind: "node", id: "adjacent", x: 250, y: 80,
      width: 60, height: 60 } as PositionedScene["root"]["children"][number]);
    expect(labelCodes(original)).toContain("renderer.routing.ui_contracts_label_node");
    const repaired = repairUiContractsLabels(original);
    expect(repaired.edges[0]!.route).toEqual(first.route);
    expect(labelCodes(repaired)).toEqual([]);
  });

  it("moves a label only when its final route leaves it detached", () => {
    const clean = repairUiContractsLabels(scene());
    const changed = structuredClone(clean);
    const moving = changed.edges[0]!;
    moving.route.points = moving.route.points.map((point) => ({ x: point.x, y: point.y + 150 }));
    moving.from.y += 150;
    moving.to.y += 150;
    expect(labelCodes(changed)).toContain("renderer.routing.ui_contracts_label_association");
    const repaired = repairUiContractsLabels(changed);
    expect(repaired.edges[0]!.label).not.toEqual(clean.edges[0]!.label);
    expect(repaired.edges[1]!.label).toEqual(clean.edges[1]!.label);
    expect(labelCodes(repaired)).toEqual([]);
  });

  it("aligns a repaired short-dogleg label in a measured narrow lane", () => {
    const original = scene();
    const first = original.edges[0]!;
    first.route.points = [
      { x: 120, y: 100 }, { x: 207, y: 100 },
      { x: 207, y: 108 }, { x: 294, y: 108 }
    ];
    first.from = { itemId: "source", x: 120, y: 100 };
    first.to = { itemId: "target", x: 294, y: 108 };
    first.label = { ...first.label!, width: 150, x: 132, y: 94 };
    original.edges[1]!.route.points = [{ x: 120, y: 94 }, { x: 294, y: 94 }];
    original.edges[1]!.from = { itemId: "other-source", x: 120, y: 94 };
    original.edges[1]!.to = { itemId: "other-target", x: 294, y: 94 };
    original.edges[1]!.label = { ...original.edges[1]!.label!, x: 10, y: 60 };
    original.root.children.push(
      { kind: "node", id: "source", x: 20, y: 80, width: 100, height: 40 } as PositionedScene["root"]["children"][number],
      { kind: "node", id: "target", x: 294, y: 80, width: 100, height: 40 } as PositionedScene["root"]["children"][number]
    );
    expect(labelCodes(original)).toContain("renderer.routing.ui_contracts_label_connector");
    const repaired = repairUiContractsLabels(original);
    expect(repaired.edges[0]!.label?.x).toBe(132);
    expect(labelCodes(repaired)).toEqual([]);
  });

  it("reports an unresolved label when all placement space is blocked", () => {
    const original = scene();
    original.root.width = 190;
    original.root.height = 30;
    const repaired = repairUiContractsLabels(original);
    expect(repaired.diagnostics.some((item) => item.code === "renderer.routing.ui_contracts_edge_label_unresolved"
      && item.severity === "error")).toBe(true);
  });

  it("checks nodes, headers, other labels, markers, scope and bounds", () => {
    const base = scene();
    const withNode = structuredClone(base);
    withNode.root.children.push({ kind: "node", id: "blocker", x: 150, y: 100,
      width: 100, height: 40 } as PositionedScene["root"]["children"][number]);
    expect(labelCodes(withNode)).toContain("renderer.routing.ui_contracts_label_node");

    const withHeader = structuredClone(base);
    withHeader.root.chrome.headerBandHeight = 30;
    withHeader.edges[1]!.label = { ...withHeader.edges[1]!.label!, y: 12 };
    expect(labelCodes(withHeader)).toContain("renderer.routing.ui_contracts_label_header");

    const withLabel = structuredClone(base);
    withLabel.edges[1]!.label = { ...withLabel.edges[1]!.label!, x: 125, y: 108 };
    expect(labelCodes(withLabel)).toContain("renderer.routing.ui_contracts_label_label");

    const withMarker = structuredClone(base);
    withMarker.edges[1]!.markers = { end: "arrow" };
    withMarker.edges[0]!.label = { ...withMarker.edges[0]!.label!, x: 300, y: 104 };
    expect(labelCodes(withMarker)).toContain("renderer.routing.ui_contracts_label_marker");

    const outOfBounds = structuredClone(base);
    outOfBounds.edges[0]!.label = { ...outOfBounds.edges[0]!.label!, x: 400 };
    expect(labelCodes(outOfBounds)).toContain("renderer.routing.ui_contracts_label_bounds");

    const scoped = structuredClone(base);
    scoped.root.children.push({ ...scoped.root, id: "inner", x: 90, y: 50,
      width: 260, height: 200, children: [] });
    scoped.edges[0]!.from.itemId = "inner";
    scoped.edges[0]!.to.itemId = "inner";
    scoped.edges[0]!.label = { ...scoped.edges[0]!.label!, x: 355 };
    expect(labelCodes(scoped)).toContain("renderer.routing.ui_contracts_label_bounds");
  });

  it("rechecks routing after a late geometry pass", async () => {
    const changed = structuredClone(repairUiContractsLabels(scene()));
    changed.edges[0]!.route.points[1]!.y += 3;
    const result = await renderPositionedSceneToSvg(changed);
    expect(result.diagnostics.some((item) => item.code === "renderer.routing.ui_contracts_non_orthogonal_segment")).toBe(true);
  });

  it("uses stable geometry rather than connector identifiers", () => {
    const a = repairUiContractsLabels(scene(["alpha", "beta"]));
    const b = repairUiContractsLabels(scene(["renamed-a", "renamed-b"]));
    expect(a.edges.map((item) => item.label)).toEqual(b.edges.map((item) => item.label));
  });

  it("audits late mutations in both SVG and PNG output", async () => {
    const clean = repairUiContractsLabels(scene());
    const changed = structuredClone(clean);
    changed.edges[0]!.label = { ...changed.edges[0]!.label!, x: 125, y: 102 };
    const svg = await renderPositionedSceneToSvg(changed);
    const png = await renderPositionedSceneToPng(changed);
    expect(svg.diagnostics.some((item) => item.code === "renderer.routing.ui_contracts_label_connector")).toBe(true);
    expect(png.diagnostics.some((item) => item.code === "renderer.routing.ui_contracts_label_connector")).toBe(true);
  });

  for (const detailId of ["compact", "detailed"]) for (const mode of ["none", "type,id"]) {
    it(`checks independently authored transitions / ${detailId} / ${mode}`, async () => {
      const source = await readFile(fixture, "utf8");
      const graph = compileSource({ path: fixture, text: source }, bundle).graph!;
      const view = bundle.views.views.find((candidate) => candidate.id === "ui_contracts")!;
      const projection = projectView(graph, bundle, view.id).projection!;
      const rendererScene = buildUiContractsRendererScene(projection, graph, view, {
        detailId, nodeDecoratorMode: {
          id: mode, showNodeType: mode.includes("type"), showNodeId: mode.includes("id")
        }
      });
      const first = await runStagedRendererPipeline(rendererScene);
      const second = await runStagedRendererPipeline(rendererScene);
      expect(first.positionedScene).toEqual(second.positionedScene);
      expect(first.positionedScene.edges.some((item) => item.label)).toBe(true);
      expect(assessUiContractsGeometry(first.positionedScene)).toEqual([]);
      expect(labelCodes(first.positionedScene)).toEqual([]);
      const rendered = await renderPositionedSceneToSvg(first.positionedScene);
      expect(rendered.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    });
  }
});
