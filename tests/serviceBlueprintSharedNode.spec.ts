import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { resolveDetailDisplayPolicy } from "../src/renderer/detailDisplay.js";
import { buildServiceBlueprintRenderModel } from "../src/renderer/serviceBlueprintRenderModel.js";
import type {
  MeasuredItem,
  NodeDecoratorMode,
  RendererScene,
  SceneItem
} from "../src/renderer/staged/contracts.js";
import { measureScene } from "../src/renderer/staged/pipeline.js";
import {
  buildServiceBlueprintRendererScene,
  renderServiceBlueprintStagedSvg
} from "../src/renderer/staged/serviceBlueprint.js";
import { getRendererTheme } from "../src/renderer/staged/theme.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const serviceBlueprintPath = path.join(repoRoot, "bundle/v0.1/examples/service_blueprint_slice.sdd");

type ServiceBlueprintContext = Awaited<ReturnType<typeof resolveServiceBlueprintContext>>;

async function resolveServiceBlueprintContext() {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "service_blueprint");
  if (!view) {
    throw new Error("Could not resolve the service_blueprint view.");
  }

  const input = {
    path: serviceBlueprintPath,
    text: await readFile(serviceBlueprintPath, "utf8")
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

function collectSceneNodes(children: SceneItem[]): Array<Extract<SceneItem, { kind: "node" }>> {
  return children.flatMap((child) => child.kind === "container"
    ? collectSceneNodes(child.children)
    : child.kind === "node"
      ? [child]
      : []);
}

function buildScene(
  context: ServiceBlueprintContext,
  nodeDecoratorMode?: NodeDecoratorMode
): RendererScene {
  return buildServiceBlueprintRendererScene(
    context.projection,
    context.graph,
    context.view,
    {
      detailId: "detailed",
      ...(nodeDecoratorMode ? { nodeDecoratorMode } : {})
    }
  );
}

describe("service_blueprint shared-node adoption", () => {
  let context: ServiceBlueprintContext;

  beforeAll(async () => {
    context = await resolveServiceBlueprintContext();
  });

  it("keeps unformatted semantic titles and legacy shape metadata in the render model", () => {
    const model = buildServiceBlueprintRenderModel(
      context.projection,
      context.graph,
      resolveDetailDisplayPolicy(context.view, "detailed")
    );

    expect(model.nodes.find((node) => node.id === "J-020")).toEqual(expect.objectContaining({
      id: "J-020",
      type: "Step",
      title: "Submit Claim",
      shape: "box"
    }));
    expect(model.nodes.find((node) => node.id === "SA-020")).toEqual(expect.objectContaining({
      type: "SystemAction",
      shape: "component"
    }));
    expect(model.nodes.find((node) => node.id === "D-020")).toEqual(expect.objectContaining({
      type: "DataEntity",
      shape: "cylinder"
    }));
    expect(model.nodes.find((node) => node.id === "PL-020")).toEqual(expect.objectContaining({
      type: "Policy",
      shape: "hexagon"
    }));
    expect(model.nodes.every((node) => !("labelLines" in node))).toBe(true);
  });

  it("maps every admitted semantic leaf to a structured shared node without local content policies", () => {
    const model = buildServiceBlueprintRenderModel(
      context.projection,
      context.graph,
      resolveDetailDisplayPolicy(context.view, "detailed")
    );
    const scene = buildScene(context);
    const sceneNodes = collectSceneNodes(scene.root.children);

    expect(sceneNodes).toHaveLength(model.nodes.length);
    for (const item of sceneNodes) {
      const renderNode = model.nodes.find((node) => node.id === item.id);
      if (!renderNode) {
        throw new Error(`Could not resolve service-blueprint render node "${item.id}".`);
      }

      expect(item.sharedNode).toEqual({
        title: renderNode.title,
        decoratorMode: {
          id: "none",
          showNodeType: false,
          showNodeId: false
        },
        nodeType: renderNode.type,
        nodeId: renderNode.id,
        attributes: []
      });
      expect(item.content).toEqual([]);
      expect(item.widthPolicy).toEqual({ preferred: "standard", allowed: ["standard"] });
      expect(item.overflowPolicy).toEqual({ kind: "grow_height" });
      expect(item.classes).toEqual(expect.arrayContaining([
        "semantic_node",
        "service_blueprint_node",
        `shape-${renderNode.shape}`,
        `type-${renderNode.type.toLowerCase()}`
      ]));
      expect(item.viewMetadata?.serviceBlueprint).toEqual({
        kind: "semantic_node",
        cellId: expect.any(String)
      });
      expect(item.ports.map((port) => ({
        id: port.id,
        role: port.role,
        side: port.side,
        offset: port.offset
      }))).toEqual([
        { id: "flow_in", role: "flow_in", side: "west", offset: undefined },
        { id: "flow_out", role: "flow_out", side: "east", offset: undefined },
        { id: "support_in", role: "support_in", side: "north", offset: undefined },
        { id: "support_out", role: "support_out", side: "south", offset: undefined },
        { id: "resource_in", role: "resource_in", side: "north", offset: 36 },
        { id: "resource_out", role: "resource_out", side: "south", offset: 36 }
      ]);
    }

    expect(findSceneItem(scene.root.children, "J-020")).toHaveProperty("sharedNode.nodeType", "Step");
    expect(findSceneItem(scene.root.children, "SA-020")).toHaveProperty("sharedNode.nodeType", "SystemAction");
    expect(findSceneItem(scene.root.children, "D-020")).toHaveProperty("sharedNode.nodeType", "DataEntity");
    expect(findSceneItem(scene.root.children, "PL-020")).toHaveProperty("sharedNode.nodeType", "Policy");
    expect(findSceneItem(scene.root.children, "D-020")).toHaveProperty("classes", expect.arrayContaining(["shape-cylinder"]));
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
  }>)("propagates the $mode.id decorator mode for every proof leaf type", ({ mode, expected }) => {
    const scene = buildScene(context, mode);
    const measured = measureScene(scene);
    const cases = [
      { id: "J-020", type: "Step" },
      { id: "PR-020", type: "Process" },
      { id: "SA-020", type: "SystemAction" },
      { id: "D-020", type: "DataEntity" },
      { id: "PL-020", type: "Policy" }
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

  it("wraps a long Step title and grows vertically at the fixed shared width", () => {
    const projection = {
      ...context.projection,
      nodes: context.projection.nodes.map((node) => node.id === "J-020"
        ? {
          ...node,
          name: "Submit a customer support claim with a deliberately long descriptive title"
        }
        : node)
    };
    const scene = buildServiceBlueprintRendererScene(
      projection,
      context.graph,
      context.view,
      { detailId: "detailed" }
    );
    const measured = measureScene(scene);
    const item = findMeasuredItem(measured.root.children, "J-020");
    if (item.kind !== "node" || !item.sharedNode) {
      throw new Error("Expected J-020 to be measured by the shared node renderer.");
    }

    expect(item.width).toBe(224);
    expect(item.height).toBeGreaterThan(48);
    expect(item.sharedNode.body.title.lines.length).toBeGreaterThan(1);
    expect(item.sharedNode.body.title.lines.join(" ")).toContain("customer support claim");
    expect(item.overflow).toEqual({ status: "fits" });
  });

  it("renders shared SVG structure with explicit alphabetic baselines", async () => {
    const rendered = await renderServiceBlueprintStagedSvg(
      context.projection,
      context.graph,
      context.view,
      { detailId: "detailed" }
    );

    expect(rendered.svg).toContain("shared-node__title-text");
    expect(rendered.svg).toMatch(/id="scene-node-d-020" class="[^"]*shape-cylinder[^"]*"[^>]*>[\s\S]*?<rect class="shared-node__outline"/);
    expect(rendered.svg).toMatch(/<tspan x="[^"]+" y="[^"]+">Submit Claim<\/tspan>/);
    expect(rendered.svg).not.toMatch(/<text class="[^"]*shared-node[^"]*"[^>]*dominant-baseline/);
  });

  it("emits element-level service-blueprint paint fallbacks for SVG importers", async () => {
    const rendered = await renderServiceBlueprintStagedSvg(
      context.projection,
      context.graph,
      context.view,
      { detailId: "detailed" }
    );
    const theme = getRendererTheme(rendered.positionedScene.themeId);
    const cellCount = rendered.positionedScene.root.children.filter((item) =>
      item.kind === "container" && item.classes.includes("service_blueprint_cell")
    ).length;

    expect(rendered.svg).toContain(
      `.scene-container__chrome--canvas { fill: ${theme.paint.palette.canvas}; }`
    );
    expect(rendered.svg).toContain(
      `.scene-container__chrome--hidden { display: none; }`
    );
    expect(rendered.svg).toContain(
      `.scene-decoration__line--service-blueprint-separator { stroke: ${theme.paint.palette.containerStroke}; stroke-dasharray: 6 4; }`
    );
    expect(rendered.svg).toContain(
      `.scene-text--service-blueprint-secondary { fill: ${theme.paint.palette.secondaryText}; }`
    );
    expect(rendered.svg).toMatch(new RegExp(
      `id="scene-container-root"[\\s\\S]*?<rect class="scene-container__chrome scene-container__chrome--canvas"`
    ));
    expect(rendered.svg.match(
      /<rect class="scene-container__chrome scene-container__chrome--hidden"/g
    )).toHaveLength(cellCount);
    expect(rendered.svg).toContain(
      `<line class="scene-decoration__line scene-decoration__line--service-blueprint-separator"`
    );
    expect(rendered.svg).toMatch(
      /service_blueprint_lane_title[\s\S]*?<text class="[^"]*scene-text--service-blueprint-secondary[^"]*"/
    );
    expect(rendered.svg).toMatch(
      /service_blueprint_separator_title[\s\S]*?<text class="[^"]*scene-text--service-blueprint-secondary[^"]*"/
    );
    expect(rendered.svg).not.toContain(" style=\"");
  });
});
