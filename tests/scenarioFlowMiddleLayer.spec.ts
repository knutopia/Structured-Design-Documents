import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { resolveProfileDisplayPolicy } from "../src/renderer/profileDisplay.js";
import { buildScenarioFlowRenderModel } from "../src/renderer/scenarioFlowRenderModel.js";
import { buildScenarioFlowMiddleLayer } from "../src/renderer/staged/scenarioFlowMiddleLayer.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const scenarioBranchingPath = path.join(repoRoot, "bundle/v0.1/examples/scenario_branching.sdd");

async function buildMiddleLayer(sourceText: string, profile = "strict") {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "scenario_flow");
  if (!view) {
    throw new Error("Could not resolve the scenario_flow view.");
  }

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

  const displayPolicy = resolveProfileDisplayPolicy(view, profile);
  const model = buildScenarioFlowRenderModel(projected.projection, compiled.graph, displayPolicy);
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
      id: "step__cell__band:2__track:1",
      rowOrder: 0,
      columnOrder: 1,
      trackOrder: 1,
      nodeIds: ["J-032"]
    });
  });

  it("derives branch-track order from branch metadata, edge author order, and stable ids", async () => {
    const middle = await buildMiddleLayer(fs.readFileSync(scenarioBranchingPath, "utf8"));

    expect(middle.tracks.map((track) => ({
      bandId: track.bandId,
      label: track.label,
      originatingDecisionNodeId: track.originatingDecisionNodeId,
      branchLabel: track.branchLabel,
      branchLabelSource: track.branchLabelSource
    }))).toEqual([
      {
        bandId: "band:1",
        label: "T0",
        originatingDecisionNodeId: undefined,
        branchLabel: undefined,
        branchLabelSource: undefined
      },
      {
        bandId: "band:2",
        label: "T0",
        originatingDecisionNodeId: "J-030",
        branchLabel: "delivery selected",
        branchLabelSource: "guard"
      },
      {
        bandId: "band:2",
        label: "T1",
        originatingDecisionNodeId: "J-030",
        branchLabel: "pickup selected",
        branchLabelSource: "guard"
      },
      {
        bandId: "band:3",
        label: "T0",
        originatingDecisionNodeId: undefined,
        branchLabel: undefined,
        branchLabelSource: undefined
      },
      {
        bandId: "band:4",
        label: "T0",
        originatingDecisionNodeId: "J-033",
        branchLabel: "e-032",
        branchLabelSource: "event"
      },
      {
        bandId: "band:4",
        label: "T1",
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
    expect(middle.bands.map((band) => band.label)).toEqual(["C1", "C2"]);

    const bandById = new Map(middle.bands.map((band) => [band.id, band]));
    const placementByNodeId = new Map(middle.placements.map((placement) => [placement.nodeId, placement]));
    expect(bandById.get(placementByNodeId.get("J-100")!.bandId)?.label).toBe("C1");
    expect(bandById.get(placementByNodeId.get("P-100")!.bandId)?.label).toBe("C1");
    expect(bandById.get(placementByNodeId.get("J-101")!.bandId)?.label).toBe("C2");
    expect(bandById.get(placementByNodeId.get("P-101")!.bandId)?.label).toBe("C2");
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
});
