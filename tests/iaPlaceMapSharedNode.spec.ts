import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { resolveDetailDisplayPolicy } from "../src/renderer/detailDisplay.js";
import { buildIaPlaceMapRenderModel, type IaRenderItem } from "../src/renderer/iaPlaceMapRenderModel.js";
import type {
  MeasuredItem,
  NodeDecoratorMode,
  RendererScene,
  SceneItem
} from "../src/renderer/staged/contracts.js";
import {
  buildIaPlaceMapRendererScene,
  renderIaPlaceMapStagedSvg
} from "../src/renderer/staged/iaPlaceMap.js";
import { measureScene } from "../src/renderer/staged/pipeline.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

async function resolveContext(filePath: string) {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "ia_place_map");
  if (!view) throw new Error("Could not resolve ia_place_map view.");
  const input = { path: filePath, text: await readFile(filePath, "utf8") };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!compiled.graph) throw new Error(`Could not compile ${filePath}.`);
  const projected = projectView(compiled.graph, bundle, "ia_place_map");
  expect(projected.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!projected.projection) throw new Error(`Could not project ${filePath}.`);
  return { graph: compiled.graph, projection: projected.projection, view };
}

type Context = Awaited<ReturnType<typeof resolveContext>>;

function collectRenderPlaces(items: readonly IaRenderItem[]): Array<Extract<IaRenderItem, { kind: "place" }>> {
  return items.flatMap((item) => item.kind === "place"
    ? [item, ...collectRenderPlaces(item.items)]
    : collectRenderPlaces(item.items));
}

function collectSceneItems(children: readonly SceneItem[]): SceneItem[] {
  return children.flatMap((child) => child.kind === "container"
    ? [child, ...collectSceneItems(child.children)]
    : [child]);
}

function findSceneItem(scene: RendererScene, id: string): SceneItem {
  const item = collectSceneItems(scene.root.children).find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Could not find scene item "${id}".`);
  return item;
}

function findMeasuredItem(children: readonly MeasuredItem[], id: string): MeasuredItem {
  for (const child of children) {
    if (child.id === id) return child;
    if (child.kind === "container") {
      try {
        return findMeasuredItem(child.children, id);
      } catch {
        // Continue through sibling containers.
      }
    }
  }
  throw new Error(`Could not find measured item "${id}".`);
}

function buildScene(context: Context, detailId: "compact" | "detailed", nodeDecoratorMode?: NodeDecoratorMode) {
  return buildIaPlaceMapRendererScene(context.projection, context.graph, context.view, {
    detailId,
    ...(nodeDecoratorMode ? { nodeDecoratorMode } : {})
  });
}

describe("ia_place_map shared-node adoption", () => {
  let detailedContext: Context;
  let mixedContext: Context;

  beforeAll(async () => {
    [detailedContext, mixedContext] = await Promise.all([
      resolveContext(path.join(repoRoot, "bundle/v0.1/examples/place_viewstate_transition.sdd")),
      resolveContext(path.join(repoRoot, "tests/fixtures/render/source_order_ia.sdd"))
    ]);
  });

  it("keeps Place titles and detail-filtered annotations structured in the render model", () => {
    const detailed = buildIaPlaceMapRenderModel(
      detailedContext.projection,
      detailedContext.graph,
      detailedContext.view.projection.hierarchy_edges ?? [],
      resolveDetailDisplayPolicy(detailedContext.view, "detailed")
    );
    const compact = buildIaPlaceMapRenderModel(
      detailedContext.projection,
      detailedContext.graph,
      detailedContext.view.projection.hierarchy_edges ?? [],
      resolveDetailDisplayPolicy(detailedContext.view, "compact")
    );
    const detailedBilling = collectRenderPlaces(detailed.rootItems).find((place) => place.id === "P-010");
    const compactBilling = collectRenderPlaces(compact.rootItems).find((place) => place.id === "P-010");

    expect(detailedBilling).toEqual(expect.objectContaining({
      title: "Billing",
      attributes: [
        { groupId: "route_or_key", label: "route or key", value: "/billing" },
        { groupId: "access", label: "access", value: "auth" },
        { groupId: "entry_points", label: "entry_points", value: "link:/billing,notification:payment_failed" },
        { groupId: "primary_nav", label: "primary_nav", value: "true" }
      ]
    }));
    expect(detailedBilling).not.toHaveProperty("labelLines");
    expect(compactBilling?.attributes).toEqual([
      { groupId: "primary_nav", label: "primary_nav", value: "true" }
    ]);
  });

  it("changes the staged attribute list when the bundle detail policy changes", () => {
    const mutatedView = structuredClone(detailedContext.view);
    const detailDisplay = mutatedView.conventions.renderer_defaults?.detail_display as
      | Record<string, Record<string, boolean>>
      | undefined;
    if (!detailDisplay?.compact) throw new Error("Expected compact IA detail policy in the bundle view.");
    detailDisplay.compact.show_place_route_or_key = true;
    detailDisplay.compact.show_place_access = true;
    detailDisplay.compact.show_place_entry_points = true;
    detailDisplay.compact.show_place_primary_nav = false;

    const model = buildIaPlaceMapRenderModel(
      detailedContext.projection,
      detailedContext.graph,
      mutatedView.projection.hierarchy_edges ?? [],
      resolveDetailDisplayPolicy(mutatedView, "compact")
    );
    expect(collectRenderPlaces(model.rootItems).find((place) => place.id === "P-010")?.attributes).toEqual([
      { groupId: "route_or_key", label: "route or key", value: "/billing" },
      { groupId: "access", label: "access", value: "auth" },
      { groupId: "entry_points", label: "entry_points", value: "link:/billing,notification:payment_failed" }
    ]);
  });

  it("uses shared nodes only for Place leaves while preserving Area and ownership containers", () => {
    const scene = buildScene(mixedContext, "compact");
    const items = collectSceneItems(scene.root.children);
    const nodes = items.filter((item): item is Extract<SceneItem, { kind: "node" }> => item.kind === "node");
    const containers = items.filter((item): item is Extract<SceneItem, { kind: "container" }> => item.kind === "container");

    expect(nodes).toHaveLength(mixedContext.projection.nodes.filter((node) => node.type === "Place").length);
    expect(nodes.every((node) => node.sharedNode?.nodeType === "Place")).toBe(true);
    expect(containers.some((container) => container.role === "area")).toBe(true);
    expect(containers.some((container) => container.role === "place_group")).toBe(true);
    expect(containers.some((container) => container.role === "contains_scope_single")).toBe(true);
    expect(containers.every((container) => !("sharedNode" in container))).toBe(true);

    const rootPlace = findSceneItem(scene, "P-700");
    const nestedPlace = findSceneItem(scene, "P-900");
    if (rootPlace.kind !== "node" || nestedPlace.kind !== "node") {
      throw new Error("Expected root and nested Place scene nodes.");
    }
    expect(rootPlace.classes).toEqual(expect.arrayContaining(["semantic_node", "place", "root_place", "depth-0"]));
    expect(nestedPlace.classes).toEqual(expect.arrayContaining(["semantic_node", "place", "nested_place", "depth-1"]));
    expect(rootPlace.widthPolicy).toEqual({ preferred: "standard", allowed: ["standard"] });
    expect(rootPlace.overflowPolicy).toEqual({ kind: "grow_height" });
    expect(rootPlace.content).toEqual([]);
    expect(rootPlace.ports).toEqual([
      { id: "north_chain", role: "north_chain", side: "north", offset: 24, offsetPolicy: undefined },
      { id: "south_chain", role: "south_chain", side: "south", offset: 24, offsetPolicy: undefined },
      { id: "east", role: "east", side: "east", offset: undefined, offsetPolicy: undefined },
      { id: "west", role: "west", side: "west", offset: undefined, offsetPolicy: undefined }
    ]);
  });

  it("propagates Place type and ID decorators", () => {
    const mode = { id: "type,id", showNodeType: true, showNodeId: true };
    const scene = buildScene(detailedContext, "detailed", mode);
    const measured = measureScene(scene);
    const item = findMeasuredItem(measured.root.children, "P-010");
    if (item.kind !== "node" || !item.sharedNode) throw new Error("Expected shared node P-010.");
    expect(item.width).toBe(224);
    expect(item.sharedNode.decorator?.items.map((entry) => entry.lines[0])).toEqual(["Place", "P-010"]);
  });

  it("wraps and grows a long Place title at the fixed shared width", () => {
    const projection = {
      ...detailedContext.projection,
      nodes: detailedContext.projection.nodes.map((node) => node.id === "P-010"
        ? { ...node, name: "A deliberately long information architecture place title that must wrap" }
        : node)
    };
    const scene = buildIaPlaceMapRendererScene(
      projection,
      detailedContext.graph,
      detailedContext.view,
      { detailId: "detailed" }
    );
    const item = findMeasuredItem(measureScene(scene).root.children, "P-010");
    if (item.kind !== "node" || !item.sharedNode) throw new Error("Expected shared node P-010.");
    expect(item.width).toBe(224);
    expect(item.sharedNode.body.title.lines.length).toBeGreaterThan(1);
    expect(item.overflow).toEqual({ status: "fits" });
  });

  it("emits shared SVG structure, portable root canvas chrome, and explicit baselines", async () => {
    const rendered = await renderIaPlaceMapStagedSvg(
      detailedContext.projection,
      detailedContext.graph,
      detailedContext.view,
      { detailId: "detailed" }
    );
    expect(rendered.svg).toContain("shared-node__attribute-group");
    expect(rendered.svg).toContain('data-attribute-group="route_or_key"');
    expect(rendered.svg).toContain('data-attribute-group="access"');
    expect(rendered.svg).toContain(".scene-container__chrome--canvas { fill: #f7f8fb; }");
    expect(rendered.svg).toMatch(
      /id="scene-container-root"[\s\S]*?<rect class="scene-container__chrome scene-container__chrome--canvas"/
    );
    expect(rendered.svg).not.toContain(" style=\"");
    expect(rendered.svg).toMatch(/<tspan x="[^"]+" y="[^"]+">Billing<\/tspan>/);
    expect(rendered.svg).not.toMatch(/<text class="[^"]*shared-node[^"]*"[^>]*dominant-baseline/);
  });
});
