import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { resolveDetailDisplayPolicy } from "../src/renderer/detailDisplay.js";
import { buildScenarioFlowRenderModel } from "../src/renderer/scenarioFlowRenderModel.js";
import { buildScenarioFlowMiddleLayer } from "../src/renderer/staged/scenarioFlowMiddleLayer.js";
import type { ViewSpec } from "../src/bundle/types.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const scenarioBranchingPath = path.join(repoRoot, "bundle/v0.1/examples/scenario_branching.sdd");
const topologyChallengePath = path.join(repoRoot, "bundle/v0.1/examples/flow_journey_topology_challenge.sdd");

async function buildMiddleLayer(
  sourceText: string,
  profile = "strict",
  mutateView?: (view: ViewSpec) => void
) {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "scenario_flow");
  if (!view) {
    throw new Error("Could not resolve the scenario_flow view.");
  }
  mutateView?.(view);

  const input = {
    path: path.join(repoRoot, "tests/fixtures/render/__inline_scenario_flow_middle_layer__.sdd"),
    text: `${sourceText.trim()}\n`
  };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics).toEqual([]);
  if (!compiled.graph) {
    throw new Error("Could not compile inline scenario_flow source.");
  }

  const projected = projectView(compiled.graph, bundle, "scenario_flow");
  expect(projected.diagnostics).toEqual([]);
  if (!projected.projection) {
    throw new Error("Could not project inline scenario_flow source.");
  }

  const displayPolicy = resolveDetailDisplayPolicy(view, profile === "simple" ? "compact" : "detailed");
  const model = buildScenarioFlowRenderModel(projected.projection, compiled.graph, view, displayPolicy);
  return buildScenarioFlowMiddleLayer(model);
}

describe("scenario_flow middle layer", () => {
  it("places the scenario_branching proof case into semantic chronology bands and branch tracks", async () => {
    const middle = await buildMiddleLayer(fs.readFileSync(scenarioBranchingPath, "utf8"));

    expect(middle.diagnostics).toEqual([]);
    expect(middle.laneGuides).toEqual([
      { laneId: "step", label: "Steps", order: 0 },
      { laneId: "place", label: "Places", order: 1 },
      { laneId: "view_state", label: "View States", order: 2 }
    ]);
    expect(middle.bands.map((band) => ({
      label: band.label,
      kind: band.kind,
      bandOrder: band.bandOrder
    }))).toEqual([
      { label: "C1", kind: "entry", bandOrder: 0 },
      { label: "C2", kind: "branch_target", bandOrder: 1 },
      { label: "C3", kind: "linear", bandOrder: 2 },
      { label: "C4", kind: "branch_target", bandOrder: 3 }
    ]);

    const bandById = new Map(middle.bands.map((band) => [band.id, band]));
    const trackById = new Map(middle.tracks.map((track) => [track.id, track]));
    const placementByNodeId = new Map(middle.placements.map((placement) => [placement.nodeId, placement]));
    const placed = (nodeId: string) => {
      const placement = placementByNodeId.get(nodeId);
      if (!placement) {
        throw new Error(`Missing placement for ${nodeId}`);
      }
      return `${bandById.get(placement.bandId)?.label}/${trackById.get(placement.trackId)?.label}`;
    };

    expect([
      ["J-030", "P-030", "VS-030a"].map(placed),
      ["J-031", "P-031", "VS-031a"].map(placed),
      ["J-032", "P-032", "VS-032a"].map(placed),
      ["J-033", "P-033", "VS-033a"].map(placed),
      ["J-034", "P-034", "VS-034a"].map(placed),
      ["J-035", "P-035", "VS-035a"].map(placed)
    ]).toEqual([
      ["C1/T0", "C1/T0", "C1/T0"],
      ["C2/T0", "C2/T0", "C2/T0"],
      ["C2/T1", "C2/T1", "C2/T1"],
      ["C3/T0", "C3/T0", "C3/T0"],
      ["C4/T0", "C4/T0", "C4/T0"],
      ["C4/T1", "C4/T1", "C4/T1"]
    ]);

    expect(placementByNodeId.get("J-030")).toEqual(expect.objectContaining({
      nodeType: "Step",
      laneId: "step",
      placementRole: "spine_step",
      sourceAuthorOrder: 0
    }));
    expect(placementByNodeId.get("J-032")).toEqual(expect.objectContaining({
      nodeType: "Step",
      laneId: "step",
      placementRole: "branch_step"
    }));
    expect(placementByNodeId.get("P-032")).toEqual(expect.objectContaining({
      nodeType: "Place",
      laneId: "place",
      placementRole: "realized_place"
    }));
    expect(placementByNodeId.get("VS-032a")).toEqual(expect.objectContaining({
      nodeType: "ViewState",
      laneId: "view_state",
      placementRole: "realized_view_state"
    }));

    expect(middle.cells).toHaveLength(18);
    expect(middle.cells.map((cell) => ({
      id: cell.id,
      rowOrder: cell.rowOrder,
      columnOrder: cell.columnOrder,
      trackOrder: cell.trackOrder,
      nodeIds: cell.nodeIds
    }))).toContainEqual({
      id: "step__cell__band:2__component:1__track:1",
      rowOrder: 1,
      columnOrder: 1,
      trackOrder: 1,
      nodeIds: ["J-032"]
    });
  });

  it("derives persistent lineages in source order and reuses ended physical rows", async () => {
    const middle = await buildMiddleLayer(fs.readFileSync(scenarioBranchingPath, "utf8"));

    expect(middle.lineages.map((lineage) => ({
      trackId: lineage.trackId,
      startBandOrder: lineage.startBandOrder,
      endBandOrder: lineage.endBandOrder,
      originatingDecisionNodeId: lineage.originatingDecisionNodeId,
      branchLabel: lineage.branchLabel,
      branchLabelSource: lineage.branchLabelSource
    }))).toEqual([
      {
        trackId: "component:1__track:0",
        startBandOrder: 0,
        endBandOrder: 3,
        originatingDecisionNodeId: undefined,
        branchLabel: undefined,
        branchLabelSource: undefined
      },
      {
        trackId: "component:1__track:1",
        startBandOrder: 1,
        endBandOrder: 1,
        originatingDecisionNodeId: "J-030",
        branchLabel: "pickup selected",
        branchLabelSource: "guard"
      },
      {
        trackId: "component:1__track:1",
        startBandOrder: 3,
        endBandOrder: 3,
        originatingDecisionNodeId: "J-033",
        branchLabel: "review pickup instructions",
        branchLabelSource: "to_name"
      }
    ]);
  });

  it("classifies scenario-flow edge channels and prepares connector plans without route geometry", async () => {
    const middle = await buildMiddleLayer(fs.readFileSync(scenarioBranchingPath, "utf8"));

    expect([...new Set(middle.edges.map((edge) => edge.channel))].sort()).toEqual([
      "place_navigation",
      "realization",
      "step_flow",
      "view_transition"
    ]);
    expect(middle.edges.find((edge) => edge.id === "J-030__precedes__J-031")).toEqual(expect.objectContaining({
      channel: "step_flow",
      type: "PRECEDES",
      branchLabel: "delivery selected",
      branchLabelSource: "guard"
    }));
    expect(middle.edges.find((edge) => edge.id === "P-030__navigates_to__P-031")).toEqual(expect.objectContaining({
      channel: "place_navigation",
      type: "NAVIGATES_TO"
    }));
    expect(middle.edges.find((edge) => edge.id === "VS-030a__transitions_to__VS-031a")).toEqual(expect.objectContaining({
      channel: "view_transition",
      type: "TRANSITIONS_TO"
    }));
    expect(middle.edges.find((edge) => edge.id === "J-030__realized_by__P-030")).toEqual(expect.objectContaining({
      channel: "realization",
      type: "REALIZED_BY"
    }));

    expect(middle.connectorPlans[0]).toEqual(expect.objectContaining({
      edgeId: "J-030__precedes__J-031",
      channel: "step_flow",
      priority: 0
    }));
    for (const plan of middle.connectorPlans) {
      expect(plan).not.toHaveProperty("points");
      expect(plan).not.toHaveProperty("x");
      expect(plan).not.toHaveProperty("y");
    }
  });

  it("emits deterministic diagnostics and author-order chronology when Step flow is absent", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Step J-100 "Start"
  REALIZED_BY P-100 "Start Place"
END

Step J-101 "Finish"
  REALIZED_BY P-101 "Finish Place"
END

Place P-100 "Start Place"
END

Place P-101 "Finish Place"
END
`);

    expect(middle.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderer.scene.scenario_flow_no_step_flow"
    ]);
    expect(middle.bands.map((band) => band.label)).toEqual(["C1"]);
    expect(middle.components.map((component) => ({
      nodeIds: component.nodeIds,
      rowStart: component.rowStart,
      rowSpan: component.rowSpan
    }))).toEqual([
      { nodeIds: ["J-100"], rowStart: 0, rowSpan: 1 },
      { nodeIds: ["J-101"], rowStart: 2, rowSpan: 1 }
    ]);

    const bandById = new Map(middle.bands.map((band) => [band.id, band]));
    const placementByNodeId = new Map(middle.placements.map((placement) => [placement.nodeId, placement]));
    expect(bandById.get(placementByNodeId.get("J-100")!.bandId)?.label).toBe("C1");
    expect(bandById.get(placementByNodeId.get("P-100")!.bandId)?.label).toBe("C1");
    expect(bandById.get(placementByNodeId.get("J-101")!.bandId)?.label).toBe("C1");
    expect(bandById.get(placementByNodeId.get("P-101")!.bandId)?.label).toBe("C1");
  });

  it("places the canonical nested-branch and parallel-flow challenge into separated component rows", async () => {
    const source = fs.readFileSync(topologyChallengePath, "utf8");
    const middle = await buildMiddleLayer(source);
    expect(middle.diagnostics).toEqual([]);
    expect(middle.laneGuides).toEqual([{ laneId: "step", label: "Steps", order: 0 }]);
    expect(middle.components.map((component) => ({
      id: component.id,
      rowStart: component.rowStart,
      rowSpan: component.rowSpan
    }))).toEqual([
      { id: "component:1", rowStart: 0, rowSpan: 4 },
      { id: "component:2", rowStart: 5, rowSpan: 1 }
    ]);
    expect(middle.totalTrackRows).toBe(6);

    const bandById = new Map(middle.bands.map((band) => [band.id, band.label]));
    const placementByNodeId = new Map(middle.placements.map((placement) => [placement.nodeId, placement]));
    const position = (nodeId: string) => {
      const placement = placementByNodeId.get(nodeId)!;
      return `${placement.componentId}/${placement.trackOrder}/${bandById.get(placement.bandId)}`;
    };
    expect(Object.fromEntries([
      "J-010", "J-020", "J-021", "J-022", "J-040", "J-041", "J-042", "J-043", "J-030", "J-031", "J-032"
    ].map((nodeId) => [nodeId, position(nodeId)]))).toEqual({
      "J-010": "component:1/0/C1",
      "J-020": "component:1/0/C2",
      "J-021": "component:1/0/C3",
      "J-022": "component:1/0/C4",
      "J-040": "component:1/1/C2",
      "J-041": "component:1/1/C3",
      "J-042": "component:1/2/C3",
      "J-043": "component:1/3/C3",
      "J-030": "component:2/0/C1",
      "J-031": "component:2/0/C2",
      "J-032": "component:2/0/C3"
    });
    expect(await buildMiddleLayer(source)).toEqual(middle);
  });

  it("uses bundle-owned lane visibility, lane order, labels, and component spacing", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Step J-110 "First"
END

Step J-111 "Second"
END
`, "strict", (view) => {
      const layout = view.conventions.renderer_defaults!.scenario_flow_layout!;
      layout.empty_lane_policy = "show";
      layout.component_gap_rows = 3;
      layout.lanes = [layout.lanes[1]!, { ...layout.lanes[0]!, label: "Actions" }, layout.lanes[2]!];
    });

    expect(middle.laneGuides).toEqual([
      { laneId: "place", label: "Places", order: 0 },
      { laneId: "step", label: "Actions", order: 1 },
      { laneId: "view_state", label: "View States", order: 2 }
    ]);
    expect(middle.components.map((component) => component.rowStart)).toEqual([0, 4]);
    expect(middle.totalTrackRows).toBe(5);
  });

  it("keeps joins on the earliest incoming lineage", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Step J-120 "Split"
  PRECEDES J-121 "Primary"
  PRECEDES J-122 "Secondary"
END

Step J-121 "Primary"
  PRECEDES J-123 "Join"
END

Step J-122 "Secondary"
  PRECEDES J-123 "Join"
END

Step J-123 "Join"
END
`);
    const placement = new Map(middle.placements.map((item) => [item.nodeId, item]));
    expect(placement.get("J-120")?.lineageId).toBe(placement.get("J-121")?.lineageId);
    expect(placement.get("J-121")?.lineageId).toBe(placement.get("J-123")?.lineageId);
    expect(placement.get("J-122")?.lineageId).not.toBe(placement.get("J-123")?.lineageId);
  });

  it("parks disconnected scoped nodes with deterministic diagnostics", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Step J-200 "Start"
  REALIZED_BY P-200 "Start Place"
END

Place P-200 "Start Place"
END

Place P-201 "Offline Place"
END

ViewState VS-201a "Offline State"
END
`);

    expect(middle.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      targetId: diagnostic.targetId
    }))).toEqual([
      {
        code: "renderer.scene.scenario_flow_disconnected_scoped_node",
        targetId: "P-201"
      },
      {
        code: "renderer.scene.scenario_flow_disconnected_scoped_node",
        targetId: "VS-201a"
      },
      {
        code: "renderer.scene.scenario_flow_no_step_flow",
        targetId: undefined
      }
    ]);
    expect(middle.bands.map((band) => ({
      label: band.label,
      kind: band.kind
    }))).toEqual([
      { label: "C1", kind: "entry" },
      { label: "P1", kind: "parking" }
    ]);

    const cellByNodeId = new Map(
      middle.cells.flatMap((cell) => cell.nodeIds.map((nodeId) => [nodeId, cell] as const))
    );
    expect(cellByNodeId.get("P-201")).toEqual(expect.objectContaining({
      bandId: "band:parking:1",
      laneId: "place",
      nodeIds: ["P-201"]
    }));
    expect(cellByNodeId.get("VS-201a")).toEqual(expect.objectContaining({
      bandId: "band:parking:1",
      laneId: "view_state",
      nodeIds: ["VS-201a"]
    }));
  });

  it("diagnoses Step cycles and falls back to deterministic author-order placement", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Step J-300 "First"
  PRECEDES J-301 "Second"
END

Step J-301 "Second"
  PRECEDES J-300 "First"
END
`);

    expect(middle.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderer.scene.scenario_flow_step_cycle"
    ]);
    expect(middle.bands.map((band) => band.label)).toEqual(["C1", "C2"]);

    const bandById = new Map(middle.bands.map((band) => [band.id, band]));
    const placementByNodeId = new Map(middle.placements.map((placement) => [placement.nodeId, placement]));
    expect(bandById.get(placementByNodeId.get("J-300")!.bandId)?.label).toBe("C1");
    expect(bandById.get(placementByNodeId.get("J-301")!.bandId)?.label).toBe("C2");
  });

  it("limits cycle fallback to the affected component", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Step J-310 "Cycle A"
  PRECEDES J-311 "Cycle B"
END

Step J-311 "Cycle B"
  PRECEDES J-310 "Cycle A"
END

Step J-320 "Linear A"
  PRECEDES J-321 "Linear B"
END

Step J-321 "Linear B"
END
`);
    expect(middle.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderer.scene.scenario_flow_step_cycle"
    ]);
    expect(middle.components.map((component) => ({
      nodeIds: component.nodeIds,
      rowStart: component.rowStart,
      hasCycle: component.hasCycle
    }))).toEqual([
      { nodeIds: ["J-310", "J-311"], rowStart: 0, hasCycle: true },
      { nodeIds: ["J-320", "J-321"], rowStart: 2, hasCycle: false }
    ]);
    const placement = new Map(middle.placements.map((item) => [item.nodeId, item]));
    expect(placement.get("J-320")?.lineageId).toBe(placement.get("J-321")?.lineageId);
  });
});
