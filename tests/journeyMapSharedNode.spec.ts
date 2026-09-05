import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { resolveDetailDisplayPolicy } from "../src/renderer/detailDisplay.js";
import { buildJourneyMapRenderModel } from "../src/renderer/journeyMapRenderModel.js";
import type {
  MeasuredItem,
  NodeDecoratorMode,
  RendererScene,
  SceneItem
} from "../src/renderer/staged/contracts.js";
import {
  buildJourneyMapRendererScene,
  buildJourneyMapRendererSceneFromModel,
  renderJourneyMapStagedSvg
} from "../src/renderer/staged/journeyMap.js";
import { measureScene } from "../src/renderer/staged/pipeline.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const primaryPath = path.join(repoRoot, "tests/fixtures/render/journey_map_staged_primary.sdd");

async function resolveContext() {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
  if (!view) throw new Error("Could not resolve journey_map view.");
  const input = { path: primaryPath, text: await readFile(primaryPath, "utf8") };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics).toEqual([]);
  if (!compiled.graph) throw new Error("Could not compile journey-map primary fixture.");
  const projected = projectView(compiled.graph, bundle, "journey_map");
  expect(projected.diagnostics).toEqual([]);
  if (!projected.projection) throw new Error("Could not project journey-map primary fixture.");
  return { bundle, view, graph: compiled.graph, projection: projected.projection };
}

type Context = Awaited<ReturnType<typeof resolveContext>>;

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
  return buildJourneyMapRendererScene(
    context.projection,
    context.graph,
    context.bundle,
    context.view,
    { detailId, ...(nodeDecoratorMode ? { nodeDecoratorMode } : {}) }
  );
}

describe("journey_map shared-node adoption", () => {
  let context: Context;

  beforeAll(async () => {
    context = await resolveContext();
  });

  it("uses shared nodes for every Step while retaining Stage containers, ports, classes, and metadata", () => {
    const scene = buildScene(context, "detailed");
    const items = collectSceneItems(scene.root.children);
    const nodes = items.filter((item): item is Extract<SceneItem, { kind: "node" }> => item.kind === "node");
    const stages = items.filter((item): item is Extract<SceneItem, { kind: "container" }> =>
      item.kind === "container" && item.role === "journey_stage");

    expect(nodes).toHaveLength(context.projection.nodes.filter((node) => node.type === "Step").length);
    expect(nodes.every((node) => node.sharedNode?.nodeType === "Step")).toBe(true);
    expect(stages).toHaveLength(context.projection.nodes.filter((node) => node.type === "Stage").length);
    expect(stages.every((stage) => !("sharedNode" in stage))).toBe(true);

    for (const node of nodes) {
      expect(node.content).toEqual([]);
      expect(node.widthPolicy).toEqual({ preferred: "standard", allowed: ["standard"] });
      expect(node.overflowPolicy).toEqual({ kind: "grow_height" });
      expect(node.classes).toEqual(expect.arrayContaining([
        "semantic_node",
        "journey_map",
        "journey_step",
        node.viewMetadata?.journeyMap?.kind === "step" && node.viewMetadata.journeyMap.uncontained
          ? "journey_step_root"
          : "journey_step_contained"
      ]));
      expect(node.ports.map(({ id, role, side }) => ({ id, role, side }))).toEqual([
        { id: `${node.id}__flow_in`, role: "journey_flow_in", side: "west" },
        { id: `${node.id}__flow_out`, role: "journey_flow_out", side: "east" },
        { id: `${node.id}__escape_in`, role: "journey_escape_in", side: "south" },
        { id: `${node.id}__escape_out`, role: "journey_escape_out", side: "south" }
      ]);
      expect(node.viewMetadata?.journeyMap).toEqual(expect.objectContaining({ kind: "step" }));
    }
  });

  it("groups repeated references and suppresses them in compact detail", () => {
    const detailed = findMeasuredItem(measureScene(buildScene(context, "detailed")).root.children, "J-201");
    const compact = findMeasuredItem(measureScene(buildScene(context, "compact")).root.children, "J-201");
    if (detailed.kind !== "node" || !detailed.sharedNode || compact.kind !== "node" || !compact.sharedNode) {
      throw new Error("Expected measured shared nodes for J-201.");
    }
    expect(detailed.sharedNode.body.attributeGroups.map((group) => ({
      id: group.id,
      label: group.label.lines,
      values: group.values.map((value) => value.lines)
    }))).toEqual([{
      id: "opportunity_ref",
      label: ["Opportunity Ref"],
      values: [["Clear total cost"], ["Confidence before commitment"]]
    }]);
    expect(compact.sharedNode.body.attributeGroups).toEqual([]);
  });

  it("propagates Step type and ID decorators", () => {
    const mode = { id: "type,id", showNodeType: true, showNodeId: true };
    const measured = measureScene(buildScene(context, "detailed", mode));
    for (const id of ["J-101", "J-250"]) {
      const item = findMeasuredItem(measured.root.children, id);
      if (item.kind !== "node" || !item.sharedNode) throw new Error(`Expected shared node ${id}.`);
      expect(item.width).toBe(224);
      expect(item.sharedNode.decorator?.items.map((entry) => entry.lines[0])).toEqual(["Step", id]);
    }
  });

  it("composes contained and root Steps identically for equivalent semantic requests", () => {
    const model = buildJourneyMapRenderModel(
      context.projection,
      context.graph,
      context.bundle,
      context.view.projection.hierarchy_edges,
      context.view.projection.ordering_edges,
      resolveDetailDisplayPolicy(context.view, "compact")
    );
    const stage = model.rootItems.find((item) => item.kind === "stage" && item.id === "G-100");
    const rootStep = model.rootItems.find((item) => item.kind === "step" && item.id === "J-250");
    if (stage?.kind !== "stage" || rootStep?.kind !== "step") {
      throw new Error("Expected contained and root render-model Steps.");
    }
    const containedStep = stage.items.find((step) => step.id === "J-101");
    if (!containedStep) throw new Error("Expected contained render-model Step J-101.");
    rootStep.title = containedStep.title;
    rootStep.references = containedStep.references.map((reference) => ({ ...reference }));
    const layout = context.view.conventions.renderer_defaults?.journey_map_layout;
    if (!layout) throw new Error("Missing bundle journey-map layout.");
    const scene = buildJourneyMapRendererSceneFromModel(model, "compact", layout);
    const contained = findSceneItem(scene, "J-101");
    const root = findSceneItem(scene, "J-250");
    if (contained.kind !== "node" || root.kind !== "node" || !contained.sharedNode || !root.sharedNode) {
      throw new Error("Expected contained and root shared Steps.");
    }
    const semanticComposition = (sharedNode: NonNullable<typeof contained.sharedNode>) => ({
      title: sharedNode.title,
      decoratorMode: sharedNode.decoratorMode,
      nodeType: sharedNode.nodeType,
      attributes: sharedNode.attributes
    });
    expect(semanticComposition(contained.sharedNode)).toEqual(semanticComposition(root.sharedNode));
  });

  it("wraps and grows long Step titles at the fixed shared width", () => {
    const item = findMeasuredItem(measureScene(buildScene(context, "detailed")).root.children, "J-102");
    if (item.kind !== "node" || !item.sharedNode) throw new Error("Expected shared node J-102.");
    expect(item.width).toBe(224);
    expect(item.height).toBeGreaterThan(48);
    expect(item.sharedNode.body.title.lines.length).toBeGreaterThan(1);
    expect(item.overflow).toEqual({ status: "fits" });
  });

  it("emits shared SVG structure, portable root canvas chrome, and explicit baselines", async () => {
    const rendered = await renderJourneyMapStagedSvg(
      context.projection,
      context.graph,
      context.bundle,
      context.view,
      { detailId: "detailed" }
    );
    expect(rendered.svg).toContain("shared-node__attribute-group");
    expect(rendered.svg).toContain('data-attribute-group="opportunity_ref"');
    expect(rendered.svg).toContain(".scene-container__chrome--canvas { fill: #f7f8fb; }");
    expect(rendered.svg).toMatch(
      /id="scene-container-root"[\s\S]*?<rect class="scene-container__chrome scene-container__chrome--canvas"/
    );
    expect(rendered.svg).not.toContain(" style=\"");
    expect(rendered.svg).toMatch(
      /<text class="[^"]*shared-node__title-text[^"]*"[^>]*>[\s\S]*?<tspan x="[^"]+" y="[^"]+">/
    );
    expect(rendered.svg).not.toMatch(/<text class="[^"]*shared-node[^"]*"[^>]*dominant-baseline/);
  });
});
