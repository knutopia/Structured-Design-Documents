import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import type { Bundle, ViewSpec } from "../src/bundle/types.js";
import { projectView } from "../src/projector/projectView.js";
import type { Projection } from "../src/projector/types.js";
import { resolveDetailDisplayPolicy } from "../src/renderer/detailDisplay.js";
import {
  isBatchApplicable,
  prepareProjectionForRender
} from "../src/renderer/prepareProjectionForRender.js";
import { renderPreparedProjectionText } from "../src/renderer/renderView.js";
import { buildScenarioFlowRenderModel } from "../src/renderer/scenarioFlowRenderModel.js";
import { renderScenarioFlowStagedSvg } from "../src/renderer/staged/scenarioFlow.js";
import type { CompiledGraph } from "../src/compiler/types.js";

const manifestPath = new URL("../bundle/v0.1/manifest.yaml", import.meta.url).pathname;

const mixedSource = `SDD-TEXT 0.1

Step J-001 "First Step"
  REALIZED_BY P-001 "Connected Place"
END

Place P-001 "Connected Place"
END

Place P-002 "Outside Edge Only"
  CONTAINS VS-002 "Nested State"
END

ViewState VS-002 "Nested State"
END
`;

const disconnectedSource = `SDD-TEXT 0.1

Step J-001 "First Step"
END

Place P-002 "Disconnected Place"
END
`;

async function context(source: string): Promise<{
  bundle: Bundle;
  view: ViewSpec;
  graph: CompiledGraph;
  projection: Projection;
}> {
  const bundle = await loadBundle(manifestPath);
  const input = { path: "/tmp/scenario_flow_disconnected_places.sdd", text: source };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  expect(compiled.graph).toBeDefined();
  const projected = projectView(compiled.graph!, bundle, "scenario_flow");
  expect(projected.diagnostics).toEqual([]);
  expect(projected.projection).toBeDefined();
  const view = bundle.views.views.find((candidate) => candidate.id === "scenario_flow")!;
  return { bundle, view, graph: compiled.graph!, projection: projected.projection! };
}

function nodeIds(
  fixture: Awaited<ReturnType<typeof context>>,
  detailId: string
): string[] {
  const policy = resolveDetailDisplayPolicy(fixture.view, detailId);
  return buildScenarioFlowRenderModel(fixture.projection, fixture.graph, fixture.view, policy)
    .nodes.map((node) => node.id);
}

describe("scenario_flow disconnected Place visibility", () => {
  it("uses only projected edges to keep connected Places in compact detail", async () => {
    const fixture = await context(mixedSource);
    expect(fixture.graph.edges.some((edge) =>
      edge.from === "P-002" && edge.to === "VS-002" && edge.type === "CONTAINS"
    )).toBe(true);
    expect(fixture.projection.edges.some((edge) => edge.from === "P-002")).toBe(false);

    expect(nodeIds(fixture, "compact")).toEqual(["J-001", "P-001", "VS-002"]);
    expect(nodeIds(fixture, "detailed")).toEqual(["J-001", "P-001", "P-002", "VS-002"]);

    const compactModel = buildScenarioFlowRenderModel(
      fixture.projection, fixture.graph, fixture.view,
      resolveDetailDisplayPolicy(fixture.view, "compact")
    );
    expect(compactModel.lanes.find((lane) => lane.id === "place")?.nodeIds).toEqual(["P-001"]);
    expect(compactModel.edges.every((edge) =>
      compactModel.nodes.some((node) => node.id === edge.from)
      && compactModel.nodes.some((node) => node.id === edge.to)
    )).toBe(true);
  });

  it("omits the Places lane in staged and legacy compact output when all Places are disconnected", async () => {
    const fixture = await context(disconnectedSource);
    const compact = await renderScenarioFlowStagedSvg(
      fixture.projection, fixture.graph, fixture.view, { detailId: "compact" }
    );
    const detailed = await renderScenarioFlowStagedSvg(
      fixture.projection, fixture.graph, fixture.view, { detailId: "detailed" }
    );

    expect(compact.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(compact.middleLayer.laneGuides.map((lane) => lane.laneId)).toEqual(["step"]);
    expect(compact.positionedScene.decorations.some((decoration) => decoration.id.startsWith("lane-place"))).toBe(false);
    expect(compact.svg).not.toContain("Disconnected Place");
    expect(compact.svg).not.toContain("Places");
    expect(detailed.middleLayer.laneGuides.map((lane) => lane.laneId)).toEqual(["step", "place"]);
    expect(detailed.svg).toContain("Disconnected Place");
    expect(detailed.svg).toContain("Places");

    for (const format of ["dot", "mermaid"] as const) {
      const compactText = renderPreparedProjectionText(
        fixture.graph, fixture.bundle, fixture.view, fixture.projection,
        { viewId: "scenario_flow", format, profileId: "simple", detailId: "compact" }
      ).text;
      const detailedText = renderPreparedProjectionText(
        fixture.graph, fixture.bundle, fixture.view, fixture.projection,
        { viewId: "scenario_flow", format, profileId: "simple", detailId: "detailed" }
      ).text;
      expect(compactText).not.toContain("Disconnected Place");
      expect(compactText).not.toContain("Places");
      expect(detailedText).toContain("Disconnected Place");
    }
  });

  it("omits the Places lane when the projection has no Places", async () => {
    const fixture = await context(`SDD-TEXT 0.1\n\nStep J-001 "First Step"\nEND\n`);
    for (const detailId of ["compact", "detailed"]) {
      const model = buildScenarioFlowRenderModel(
        fixture.projection, fixture.graph, fixture.view,
        resolveDetailDisplayPolicy(fixture.view, detailId)
      );
      expect(model.lanes.map((lane) => lane.id)).toEqual(["step"]);
    }
  });

  it("makes batch applicability reflect Place visibility", async () => {
    const fixture = await context(`SDD-TEXT 0.1\n\nPlace P-002 "Disconnected Place"\nEND\n`);
    const compact = prepareProjectionForRender(fixture.view, fixture.projection, fixture.graph, "compact");
    const detailed = prepareProjectionForRender(fixture.view, fixture.projection, fixture.graph, "detailed");

    expect(compact.projection).toBe(fixture.projection);
    expect(compact.visibleSemanticNodeIds).toEqual([]);
    expect(isBatchApplicable(fixture.view, compact)).toBe(false);
    expect(detailed.visibleSemanticNodeIds).toEqual(["P-002"]);
    expect(isBatchApplicable(fixture.view, detailed)).toBe(true);

    const compactDirectRender = await renderScenarioFlowStagedSvg(
      fixture.projection, fixture.graph, fixture.view, { detailId: "compact" }
    );
    expect(compactDirectRender.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(compactDirectRender.middleLayer.laneGuides).toEqual([]);
    expect(compactDirectRender.svg).not.toContain("Places");
    expect(compactDirectRender.svg).not.toContain("Disconnected Place");
  });

  it("takes the visibility rule from the bundle and ignores validation profile", async () => {
    const fixture = await context(disconnectedSource);
    const render = (profileId: string) => renderPreparedProjectionText(
      fixture.graph, fixture.bundle, fixture.view, fixture.projection,
      { viewId: "scenario_flow", format: "dot", profileId, detailId: "compact" }
    ).text;

    expect(render("simple")).toBe(render("strict"));
    expect(nodeIds(fixture, "compact")).toEqual(["J-001"]);

    const policies = fixture.view.conventions.renderer_defaults!.detail_display as Record<string, Record<string, boolean>>;
    policies.compact!.show_disconnected_places = true;
    expect(nodeIds(fixture, "compact")).toEqual(["J-001", "P-002"]);
    expect(render("simple")).toContain("Disconnected Place");
  });

  it("does not treat a self edge as a connection to another node", async () => {
    const fixture = await context(mixedSource);
    const selfEdge = {
      ...fixture.projection.edges[0]!,
      from: "P-002",
      to: "P-002",
      type: "NAVIGATES_TO"
    };
    const projection = {
      ...fixture.projection,
      edges: [selfEdge]
    } as Projection;
    const model = buildScenarioFlowRenderModel(
      projection, fixture.graph, fixture.view,
      resolveDetailDisplayPolicy(fixture.view, "compact")
    );
    expect(model.nodes.map((node) => node.id)).toEqual(["J-001", "VS-002"]);
    expect(model.edges).toEqual([]);
  });
});
