import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { resolveDetailDisplayPolicy } from "../src/renderer/detailDisplay.js";
import { buildScenarioFlowRenderModel } from "../src/renderer/scenarioFlowRenderModel.js";
import type {
  MeasuredItem,
  NodeDecoratorMode,
  RendererScene,
  SceneItem
} from "../src/renderer/staged/contracts.js";
import { measureScene } from "../src/renderer/staged/pipeline.js";
import {
  buildScenarioFlowRendererScene,
  renderScenarioFlowStagedSvg
} from "../src/renderer/staged/scenarioFlow.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const scenarioBranchingPath = path.join(repoRoot, "bundle/v0.1/examples/scenario_branching.sdd");

type ScenarioContext = Awaited<ReturnType<typeof resolveScenarioContext>>;

async function resolveScenarioContext() {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "scenario_flow");
  if (!view) {
    throw new Error("Could not resolve the scenario_flow view.");
  }

  const input = {
    path: scenarioBranchingPath,
    text: await readFile(scenarioBranchingPath, "utf8")
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

function findSceneItem(children: SceneItem[], id: string): SceneItem {
  for (const child of children) {
    if (child.id === id) {
      return child;
    }
    if (child.kind === "container") {
      try {
        return findSceneItem(child.children, id);
      } catch {
        // Continue searching sibling containers.
      }
    }
  }
  throw new Error(`Could not find scene item "${id}".`);
}

function findMeasuredItem(children: MeasuredItem[], id: string): MeasuredItem {
  for (const child of children) {
    if (child.id === id) {
      return child;
    }
    if (child.kind === "container") {
      try {
        return findMeasuredItem(child.children, id);
      } catch {
        // Continue searching sibling containers.
      }
    }
  }
  throw new Error(`Could not find measured item "${id}".`);
}

function buildScene(context: ScenarioContext, nodeDecoratorMode?: NodeDecoratorMode): RendererScene {
  return buildScenarioFlowRendererScene(
    context.projection,
    context.graph,
    context.view,
    {
      detailId: "detailed",
      ...(nodeDecoratorMode ? { nodeDecoratorMode } : {})
    }
  );
}

describe("scenario_flow shared-node adoption", () => {
  let context: ScenarioContext;

  beforeAll(async () => {
    context = await resolveScenarioContext();
  });

  it("keeps an unformatted semantic title in the render model", () => {
    const model = buildScenarioFlowRenderModel(
      context.projection,
      context.graph,
      context.view,
      resolveDetailDisplayPolicy(context.view, "detailed")
    );
    const node = model.nodes.find((candidate) => candidate.id === "J-030");

    expect(node).toEqual(expect.objectContaining({
      id: "J-030",
      type: "Step",
      title: "Choose Fulfillment"
    }));
    expect(node).not.toHaveProperty("labelLines");
  });

  it("maps Step, Place, and ViewState leaves to structured shared nodes without local content policies", () => {
    const scene = buildScene(context);
    const cases = [
      { id: "J-030", type: "Step", title: "Choose Fulfillment", laneClass: "scenario-flow-lane-step" },
      { id: "P-030", type: "Place", title: "Fulfillment", laneClass: "scenario-flow-lane-place" },
      { id: "VS-030a", type: "ViewState", title: "Fulfillment Choice", laneClass: "scenario-flow-lane-view_state" }
    ] as const;

    for (const testCase of cases) {
      const item = findSceneItem(scene.root.children, testCase.id);
      if (item.kind !== "node") {
        throw new Error(`Expected "${testCase.id}" to be a semantic SceneNode.`);
      }

      expect(item.sharedNode).toEqual({
        title: testCase.title,
        decoratorMode: {
          id: "none",
          showNodeType: false,
          showNodeId: false
        },
        nodeType: testCase.type,
        nodeId: testCase.id,
        attributes: []
      });
      expect(item.content).toEqual([]);
      expect(item.widthPolicy).toEqual({ preferred: "standard", allowed: ["standard"] });
      expect(item.overflowPolicy).toEqual({ kind: "grow_height" });
      expect(item.classes).toEqual(expect.arrayContaining([
        "semantic_node",
        "scenario_flow_node",
        testCase.laneClass,
        `type-${testCase.type.toLowerCase()}`
      ]));
      expect(item.ports.map((port) => ({ id: port.id, role: port.role, side: port.side }))).toEqual([
        { id: "flow_in", role: "flow_in", side: "west" },
        { id: "flow_out", role: "flow_out", side: "east" },
        { id: "mirror_in", role: "mirror_in", side: "west" },
        { id: "mirror_out", role: "mirror_out", side: "east" },
        { id: "realization_in", role: "realization_in", side: "north" },
        { id: "realization_out", role: "realization_out", side: "south" }
      ]);
      expect(item.viewMetadata?.scenarioFlow).toEqual(expect.objectContaining({
        kind: "semantic_node",
        laneId: testCase.type === "Step" ? "step" : testCase.type === "Place" ? "place" : "view_state"
      }));
    }

    const viewState = findSceneItem(scene.root.children, "VS-030a");
    expect(viewState.classes).toContain("chrome-dashed");
  });

  it.each([
    {
      mode: { id: "type", showNodeType: true, showNodeId: false },
      expected: (type: string, _id: string) => [type]
    },
    {
      mode: { id: "id", showNodeType: false, showNodeId: true },
      expected: (_type: string, id: string) => [id]
    },
    {
      mode: { id: "type,id", showNodeType: true, showNodeId: true },
      expected: (type: string, id: string) => [type, id]
    }
  ] satisfies Array<{
    mode: NodeDecoratorMode;
    expected: (type: string, id: string) => string[];
  }>)("propagates the $mode.id decorator mode for every scenario leaf type", ({ mode, expected }) => {
    const scene = buildScene(context, mode);
    const measured = measureScene(scene);
    const cases = [
      { id: "J-030", type: "Step" },
      { id: "P-030", type: "Place" },
      { id: "VS-030a", type: "ViewState" }
    ];

    for (const testCase of cases) {
      const rendererItem = findSceneItem(scene.root.children, testCase.id);
      const measuredItem = findMeasuredItem(measured.root.children, testCase.id);
      if (rendererItem.kind !== "node" || measuredItem.kind !== "node" || !measuredItem.sharedNode) {
        throw new Error(`Expected a measured shared node for "${testCase.id}".`);
      }

      expect(rendererItem.sharedNode?.decoratorMode).toEqual(mode);
      expect(measuredItem.sharedNode.decorator?.items.map((item) => item.lines[0])).toEqual(
        expected(testCase.type, testCase.id)
      );
      expect(measuredItem.width).toBe(224);
    }
  });

  it("wraps a long semantic title and grows vertically at the fixed shared width", () => {
    const projection = {
      ...context.projection,
      nodes: context.projection.nodes.map((node) => node.id === "J-030"
        ? {
          ...node,
          name: "Choose a fulfillment approach with a deliberately long descriptive name"
        }
        : node)
    };
    const scene = buildScenarioFlowRendererScene(
      projection,
      context.graph,
      context.view,
      { detailId: "detailed" }
    );
    const measured = measureScene(scene);
    const item = findMeasuredItem(measured.root.children, "J-030");
    if (item.kind !== "node" || !item.sharedNode) {
      throw new Error("Expected J-030 to be measured by the shared node renderer.");
    }

    expect(item.width).toBe(224);
    expect(item.height).toBeGreaterThan(48);
    expect(item.sharedNode.body.title.lines.length).toBeGreaterThan(1);
    expect(item.sharedNode.body.title.lines.join(" ")).toContain("fulfillment approach");
    expect(item.overflow).toEqual({ status: "fits" });
  });

  it("renders shared SVG structure with alphabetic baselines and a dashed ViewState outline", async () => {
    const rendered = await renderScenarioFlowStagedSvg(
      context.projection,
      context.graph,
      context.view,
      { detailId: "detailed" }
    );

    expect(rendered.svg).toContain(".scene-node.chrome-dashed .shared-node__outline { stroke-dasharray: 8 6; }");
    expect(rendered.svg).toMatch(/id="scene-node-vs-030a" class="[^"]*chrome-dashed[^"]*"[^>]*>[\s\S]*?<rect class="shared-node__outline"/);
    expect(rendered.svg).toContain("shared-node__title-text");
    expect(rendered.svg).toMatch(/<tspan x="[^"]+" y="[^"]+">Choose Fulfillment<\/tspan>/);
    expect(rendered.svg).not.toMatch(/<text class="[^"]*shared-node[^"]*"[^>]*dominant-baseline/);
  });
});
