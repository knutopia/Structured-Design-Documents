import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { resolveDetailDisplayPolicy } from "../src/renderer/detailDisplay.js";
import { buildOutcomeOpportunityMapRenderModel } from "../src/renderer/outcomeOpportunityMapRenderModel.js";
import type {
  MeasuredItem,
  NodeDecoratorMode,
  RendererScene,
  SceneItem
} from "../src/renderer/staged/contracts.js";
import {
  buildOutcomeOpportunityMapRendererScene,
  renderOutcomeOpportunityMapStagedSvg
} from "../src/renderer/staged/outcomeOpportunityMap.js";
import { measureScene } from "../src/renderer/staged/pipeline.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

async function resolveContext(exampleName: string) {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "outcome_opportunity_map");
  if (!view) throw new Error("Could not resolve outcome_opportunity_map view.");
  const input = {
    path: path.join(bundle.rootDir, "examples", `${exampleName}.sdd`),
    text: await readFile(path.join(bundle.rootDir, "examples", `${exampleName}.sdd`), "utf8")
  };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!compiled.graph) throw new Error(`Could not compile ${input.path}.`);
  const projected = projectView(compiled.graph, bundle, "outcome_opportunity_map");
  expect(projected.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!projected.projection) throw new Error(`Could not project ${input.path}.`);
  return { graph: compiled.graph, projection: projected.projection, view };
}

type Context = Awaited<ReturnType<typeof resolveContext>>;

function collectSceneNodes(children: readonly SceneItem[]): Array<Extract<SceneItem, { kind: "node" }>> {
  return children.flatMap((child) => child.kind === "container"
    ? collectSceneNodes(child.children)
    : child.kind === "node"
      ? [child]
      : []);
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

function buildScene(context: Context, detailId: "compact" | "detailed", nodeDecoratorMode?: NodeDecoratorMode): RendererScene {
  return buildOutcomeOpportunityMapRendererScene(
    context.projection,
    context.graph,
    context.view,
    { detailId, ...(nodeDecoratorMode ? { nodeDecoratorMode } : {}) }
  );
}

describe("outcome_opportunity_map shared-node adoption", () => {
  let canonical: Context;
  let instrumentation: Context;

  beforeAll(async () => {
    [canonical, instrumentation] = await Promise.all([
      resolveContext("outcome_to_ia_trace"),
      resolveContext("metric_event_instrumentation")
    ]);
  });

  it("keeps semantic titles and ordered structured references in the render model", () => {
    const model = buildOutcomeOpportunityMapRenderModel(
      instrumentation.projection,
      instrumentation.graph,
      instrumentation.view,
      resolveDetailDisplayPolicy(instrumentation.view, "detailed")
    );
    expect(model.nodes.every((node) => !("labelLines" in node))).toBe(true);
    expect(model.nodes.find((node) => node.id === "M-050")).toEqual(expect.objectContaining({
      title: "Alert Stream Coverage",
      attributes: [
        { groupId: "event", label: "event", value: "E-050 Alert Emitted" },
        { groupId: "event", label: "event", value: "E-051 Review Completed Event" }
      ]
    }));
    expect(model.nodes.find((node) => node.id === "I-050")?.attributes).toEqual([
      { groupId: "implemented_by", label: "Implemented by", value: "P-050 Risk Review Queue" }
    ]);
  });

  it("maps every eligible leaf to a fixed-width shared node while preserving ports, selectors, and placement metadata", () => {
    const model = buildOutcomeOpportunityMapRenderModel(
      canonical.projection,
      canonical.graph,
      canonical.view,
      resolveDetailDisplayPolicy(canonical.view, "detailed")
    );
    const scene = buildScene(canonical, "detailed");
    const nodes = collectSceneNodes(scene.root.children);
    expect(nodes).toHaveLength(model.nodes.length);
    expect(new Set(nodes.map((node) => node.sharedNode?.nodeType))).toEqual(
      new Set(["Outcome", "Opportunity", "Initiative", "Metric"])
    );

    for (const node of nodes) {
      const renderNode = model.nodes.find((candidate) => candidate.id === node.id);
      if (!renderNode) throw new Error(`Missing render node ${node.id}.`);
      expect(node.sharedNode).toEqual({
        title: renderNode.title,
        decoratorMode: { id: "none", showNodeType: false, showNodeId: false },
        nodeType: renderNode.type,
        nodeId: renderNode.id,
        attributes: renderNode.attributes
      });
      expect(node.content).toEqual([]);
      expect(node.widthPolicy).toEqual({ preferred: "standard", allowed: ["standard"] });
      expect(node.overflowPolicy).toEqual({ kind: "grow_height" });
      expect(node.classes).toEqual(expect.arrayContaining([
        "semantic_node",
        "outcome_opportunity_node",
        `type-${renderNode.type.toLowerCase()}`,
        `visual-role-${renderNode.visualRole}`,
        `shape-${renderNode.shape}`
      ]));
      expect(node.ports.map((port) => [port.id, port.role, port.side])).toEqual([
        ["intent_in", "intent_in", "west"],
        ["intent_out", "intent_out", "east"],
        ["measure_in", "measure_in", "west"],
        ["measure_out", "measure_out", "east"],
        ["secondary_in", "secondary_in", "north"],
        ["secondary_out", "secondary_out", "south"]
      ]);
      expect(node.viewMetadata?.outcomeOpportunity).toEqual(expect.objectContaining({
        kind: "semantic_node",
        semanticColumnId: expect.any(String),
        semanticBandId: expect.any(String),
        physicalSlotId: expect.any(String),
        cellId: expect.any(String)
      }));
    }
  });

  it("propagates type and ID decorators for all four semantic types", () => {
    const mode: NodeDecoratorMode = {
      id: "type,id",
      showNodeType: true,
      showNodeId: true
    };
    const measured = measureScene(buildScene(canonical, "detailed", mode));
    for (const [id, type] of [["O-001", "Outcome"], ["OP-001", "Opportunity"], ["I-001", "Initiative"], ["M-001", "Metric"]]) {
      const item = findMeasuredItem(measured.root.children, id);
      if (item.kind !== "node" || !item.sharedNode) throw new Error(`Expected shared node ${id}.`);
      expect(item.width).toBe(224);
      expect(item.sharedNode.decorator?.items.map((entry) => entry.lines[0])).toEqual([type, id]);
    }
  });

  it("consolidates repeated Event references and suppresses all optional attributes in compact detail", () => {
    const detailed = measureScene(buildScene(instrumentation, "detailed"));
    const compact = measureScene(buildScene(instrumentation, "compact"));
    const detailedMetric = findMeasuredItem(detailed.root.children, "M-050");
    const compactMetric = findMeasuredItem(compact.root.children, "M-050");
    const compactInitiative = findMeasuredItem(compact.root.children, "I-050");
    if (
      detailedMetric.kind !== "node" || !detailedMetric.sharedNode
      || compactMetric.kind !== "node" || !compactMetric.sharedNode
      || compactInitiative.kind !== "node" || !compactInitiative.sharedNode
    ) throw new Error("Expected measured shared nodes for detail-policy proof.");

    expect(detailedMetric.sharedNode.body.attributeGroups.map((group) => ({
      id: group.id,
      label: group.label.lines,
      values: group.values.map((value) => value.lines)
    }))).toEqual([{
      id: "event",
      label: ["Event"],
      values: [["E-050 Alert Emitted"], ["E-051 Review Completed Event"]]
    }]);
    expect(compactMetric.sharedNode.body.attributeGroups).toEqual([]);
    expect(compactInitiative.sharedNode.body.attributeGroups).toEqual([]);
  });

  it("wraps and grows long titles without local width escalation", () => {
    const projection = {
      ...canonical.projection,
      nodes: canonical.projection.nodes.map((node) => node.id === "OP-001"
        ? { ...node, name: "A deliberately long opportunity title that must wrap at the shared node width" }
        : node)
    };
    const measured = measureScene(buildOutcomeOpportunityMapRendererScene(
      projection,
      canonical.graph,
      canonical.view,
      { detailId: "detailed" }
    ));
    const item = findMeasuredItem(measured.root.children, "OP-001");
    if (item.kind !== "node" || !item.sharedNode) throw new Error("Expected shared node OP-001.");
    expect(item.width).toBe(224);
    expect(item.height).toBeGreaterThan(48);
    expect(item.sharedNode.body.title.lines.length).toBeGreaterThan(1);
    expect(item.overflow).toEqual({ status: "fits" });
  });

  it("emits shared SVG structure and explicit alphabetic baselines", async () => {
    const rendered = await renderOutcomeOpportunityMapStagedSvg(
      instrumentation.projection,
      instrumentation.graph,
      instrumentation.view,
      { detailId: "detailed" }
    );
    expect(rendered.svg).toContain("shared-node__attribute-group");
    expect(rendered.svg).toContain('data-attribute-group="event"');
    expect(rendered.svg).toContain("shared-node__title-text");
    expect(rendered.svg).toContain(".scene-container__chrome--canvas { fill: #f7f8fb; }");
    expect(rendered.svg).toMatch(
      /id="scene-container-root"[\s\S]*?<rect class="scene-container__chrome scene-container__chrome--canvas"/
    );
    expect(rendered.svg).not.toContain(" style=\"");
    expect(rendered.svg).toMatch(/<tspan x="[^"]+" y="[^"]+">Alert Stream Coverage<\/tspan>/);
    expect(rendered.svg).not.toMatch(/<text class="[^"]*shared-node[^"]*"[^>]*dominant-baseline/);
  });
});
