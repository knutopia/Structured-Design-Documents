import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { buildOutcomeOpportunityMapRenderModel } from "../src/renderer/outcomeOpportunityMapRenderModel.js";
import { resolveProfileDisplayPolicy } from "../src/renderer/profileDisplay.js";
import {
  buildOutcomeOpportunityMapMiddleLayer,
  type OutcomeOpportunityMiddleLayerModel,
  type OutcomeOpportunityNodePlacement
} from "../src/renderer/staged/outcomeOpportunityMapMiddleLayer.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

async function buildMiddleLayer(sourceText: string, profileId = "strict"): Promise<OutcomeOpportunityMiddleLayerModel> {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "outcome_opportunity_map");
  if (!view) {
    throw new Error("Could not resolve the outcome_opportunity_map view.");
  }

  const input = {
    path: path.join(repoRoot, "tests/fixtures/render/__inline_outcome_opportunity_middle_layer__.sdd"),
    text: `${sourceText.trim()}\n`
  };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!compiled.graph) {
    throw new Error("Could not compile inline outcome_opportunity_map source.");
  }

  const projected = projectView(compiled.graph, bundle, "outcome_opportunity_map");
  expect(projected.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!projected.projection) {
    throw new Error("Could not project inline source to outcome_opportunity_map.");
  }

  const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
  const model = buildOutcomeOpportunityMapRenderModel(projected.projection, compiled.graph, view, displayPolicy);
  return buildOutcomeOpportunityMapMiddleLayer(model);
}

async function buildExampleMiddleLayer(exampleName: string, profileId = "strict"): Promise<OutcomeOpportunityMiddleLayerModel> {
  const examplePath = path.join(repoRoot, "bundle/v0.1/examples", `${exampleName}.sdd`);
  return buildMiddleLayer(await readFile(examplePath, "utf8"), profileId);
}

function placementMap(middle: OutcomeOpportunityMiddleLayerModel): Map<string, OutcomeOpportunityNodePlacement> {
  return new Map(middle.placements.map((placement) => [placement.nodeId, placement]));
}

function placementFor(
  middle: OutcomeOpportunityMiddleLayerModel,
  nodeId: string
): OutcomeOpportunityNodePlacement {
  const placement = placementMap(middle).get(nodeId);
  if (!placement) {
    throw new Error(`Missing placement for ${nodeId}`);
  }
  return placement;
}

function bandLabelsFor(middle: OutcomeOpportunityMiddleLayerModel, nodeIds: string[]): string[] {
  const bandById = new Map(middle.bands.map((band) => [band.id, band]));
  return nodeIds.map((nodeId) => bandById.get(placementFor(middle, nodeId).semanticBandId)?.label ?? "missing");
}

describe("outcome_opportunity_map middle layer", () => {
  it("places outcome_to_ia_trace into one outcome band with bundle-derived connector channels", async () => {
    const middle = await buildExampleMiddleLayer("outcome_to_ia_trace");

    expect(middle.diagnostics).toEqual([]);
    expect(middle.columns.map((column) => ({
      id: column.id,
      label: column.label,
      order: column.order
    }))).toEqual([
      { id: "initiative", label: "Initiatives", order: 0 },
      { id: "opportunity", label: "Opportunities", order: 1 },
      { id: "outcome", label: "Outcomes", order: 2 },
      { id: "metric", label: "Metrics", order: 3 }
    ]);
    expect(middle.bands.map((band) => ({
      label: band.label,
      kind: band.kind,
      anchorOutcomeId: band.anchorOutcomeId
    }))).toEqual([
      { label: "B1", kind: "outcome", anchorOutcomeId: "O-001" }
    ]);
    expect(new Set(bandLabelsFor(middle, ["I-001", "OP-001", "O-001", "M-001"]))).toEqual(new Set(["B1"]));
    expect(placementFor(middle, "O-001")).toEqual(expect.objectContaining({
      semanticColumnId: "outcome",
      placementRole: "anchor_outcome",
      anchorOutcomeId: "O-001",
      parking: false
    }));
    expect(placementFor(middle, "OP-001")).toEqual(expect.objectContaining({
      semanticColumnId: "opportunity",
      placementRole: "supporting_opportunity",
      anchorOutcomeId: "O-001"
    }));
    expect(placementFor(middle, "I-001")).toEqual(expect.objectContaining({
      semanticColumnId: "initiative",
      placementRole: "addressing_initiative",
      anchorOutcomeId: "O-001"
    }));
    expect(placementFor(middle, "M-001")).toEqual(expect.objectContaining({
      semanticColumnId: "metric",
      placementRole: "measuring_metric",
      anchorOutcomeId: "O-001"
    }));
    expect([...new Set(middle.edges.map((edge) => edge.channel))].sort()).toEqual([
      "initiative_addressing",
      "opportunity_support",
      "outcome_measurement"
    ]);
    for (const plan of middle.connectorPlans) {
      expect(plan).not.toHaveProperty("points");
      expect(plan).not.toHaveProperty("x");
      expect(plan).not.toHaveProperty("y");
    }
  });

  it("stacks metric_event_instrumentation metrics in stable same-band slots", async () => {
    const middle = await buildExampleMiddleLayer("metric_event_instrumentation");

    expect(middle.diagnostics).toEqual([]);
    expect(new Set(bandLabelsFor(middle, ["I-050", "OP-050", "O-050", "M-050", "M-051"]))).toEqual(new Set(["B1"]));
    expect(placementFor(middle, "M-050")).toEqual(expect.objectContaining({
      semanticColumnId: "metric",
      slotOrderWithinBand: 0,
      rowOrder: 0
    }));
    expect(placementFor(middle, "M-051")).toEqual(expect.objectContaining({
      semanticColumnId: "metric",
      slotOrderWithinBand: 1,
      rowOrder: 1
    }));
    expect(middle.physicalSlots.map((slot) => ({
      bandId: slot.bandId,
      rowOrder: slot.rowOrder,
      slotOrderWithinBand: slot.slotOrderWithinBand,
      kind: slot.kind
    }))).toEqual([
      {
        bandId: "band:outcome:1",
        rowOrder: 0,
        slotOrderWithinBand: 0,
        kind: "primary"
      },
      {
        bandId: "band:outcome:1",
        rowOrder: 1,
        slotOrderWithinBand: 1,
        kind: "stack"
      }
    ]);
  });

  it("keeps multiple outcomes as independent source-ordered bands without timeline edges", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Outcome O-200 "Second Authored Outcome"
END

Outcome O-100 "First Stable Id Outcome"
END

Opportunity OP-200 "Second Opportunity"
  SUPPORTS O-200 "Second Authored Outcome"
END

Opportunity OP-100 "First Opportunity"
  SUPPORTS O-100 "First Stable Id Outcome"
END
`);

    expect(middle.diagnostics).toEqual([]);
    expect(middle.bands.map((band) => ({
      label: band.label,
      anchorOutcomeId: band.anchorOutcomeId
    }))).toEqual([
      { label: "B1", anchorOutcomeId: "O-200" },
      { label: "B2", anchorOutcomeId: "O-100" }
    ]);
    expect(bandLabelsFor(middle, ["OP-200", "O-200"])).toEqual(["B1", "B1"]);
    expect(bandLabelsFor(middle, ["OP-100", "O-100"])).toEqual(["B2", "B2"]);
    expect(middle.edges.map((edge) => edge.type)).toEqual(["SUPPORTS", "SUPPORTS"]);
  });

  it("keeps shared opportunity, initiative, and metric nodes canonical while routing later edges back to them", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Outcome O-301 "Outcome A"
  MEASURED_BY M-399 "Shared Metric"
END

Outcome O-302 "Outcome B"
  MEASURED_BY M-399 "Shared Metric"
END

Opportunity OP-399 "Shared Opportunity"
  SUPPORTS O-302 "Outcome B"
  SUPPORTS O-301 "Outcome A"
END

Opportunity OP-301 "Opportunity A"
  SUPPORTS O-301 "Outcome A"
END

Initiative I-399 "Shared Initiative"
  ADDRESSES OP-301 "Opportunity A"
  ADDRESSES OP-399 "Shared Opportunity"
END

Metric M-399 "Shared Metric"
END
`);

    expect(middle.diagnostics).toEqual([]);
    const placementsByNodeId = placementMap(middle);
    expect(middle.placements.filter((placement) => placement.nodeId === "OP-399")).toHaveLength(1);
    expect(middle.placements.filter((placement) => placement.nodeId === "I-399")).toHaveLength(1);
    expect(middle.placements.filter((placement) => placement.nodeId === "M-399")).toHaveLength(1);
    expect(placementsByNodeId.get("OP-399")).toEqual(expect.objectContaining({
      anchorOutcomeId: "O-302",
      placementRole: "supporting_opportunity"
    }));
    expect(placementsByNodeId.get("I-399")).toEqual(expect.objectContaining({
      anchorOutcomeId: "O-301",
      placementRole: "addressing_initiative"
    }));
    expect(placementsByNodeId.get("M-399")).toEqual(expect.objectContaining({
      anchorOutcomeId: "O-301",
      placementRole: "measuring_metric"
    }));
    expect(middle.connectorPlans.map((plan) => plan.edgeId)).toEqual([
      "OP-301__supports__O-301",
      "OP-399__supports__O-302",
      "OP-399__supports__O-301",
      "I-399__addresses__OP-301",
      "I-399__addresses__OP-399",
      "O-301__measured_by__M-399",
      "O-302__measured_by__M-399"
    ]);
  });

  it("creates dense metric fan-out slots and preserves projected secondary connector channels", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Outcome O-900 "Dense Outcome"
  MEASURED_BY M-901 "Metric One"
  MEASURED_BY M-902 "Metric Two"
  MEASURED_BY M-903 "Metric Three"
END

Metric M-901 "Metric One"
  INSTRUMENTED_AT O-900 "Dense Outcome"
END

Metric M-902 "Metric Two"
END

Metric M-903 "Metric Three"
END

Opportunity OP-901 "Dense Opportunity"
  SUPPORTS O-900 "Dense Outcome"
END

Initiative I-901 "Implementation Reference"
  ADDRESSES OP-901 "Dense Opportunity"
  IMPLEMENTED_BY M-901 "Metric One"
END
`);

    expect(middle.diagnostics).toEqual([]);
    expect(placementFor(middle, "M-901").slotOrderWithinBand).toBe(0);
    expect(placementFor(middle, "M-902").slotOrderWithinBand).toBe(1);
    expect(placementFor(middle, "M-903").slotOrderWithinBand).toBe(2);
    expect(middle.physicalSlots).toHaveLength(3);
    expect(middle.edges.map((edge) => ({
      id: edge.id,
      channel: edge.channel
    }))).toEqual([
      { id: "O-900__measured_by__M-901", channel: "outcome_measurement" },
      { id: "O-900__measured_by__M-902", channel: "outcome_measurement" },
      { id: "O-900__measured_by__M-903", channel: "outcome_measurement" },
      { id: "M-901__instrumented_at__O-900", channel: "instrumentation_reference" },
      { id: "OP-901__supports__O-900", channel: "opportunity_support" },
      { id: "I-901__addresses__OP-901", channel: "initiative_addressing" },
      { id: "I-901__implemented_by__M-901", channel: "implementation_reference" }
    ]);
  });

  it("parks nodes without outcome anchors in terminal deterministic parking bands", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Outcome O-990 "Anchored Outcome"
END

Opportunity OP-991 "Orphan Opportunity"
END

Initiative I-991 "Orphan Initiative"
  ADDRESSES OP-991 "Orphan Opportunity"
END

Metric M-991 "Orphan Metric"
END
`);

    expect(middle.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      targetId: diagnostic.targetId,
      severity: diagnostic.severity
    }))).toEqual([
      {
        code: "renderer.scene.outcome_opportunity_map_parking_node",
        targetId: "I-991",
        severity: "info"
      },
      {
        code: "renderer.scene.outcome_opportunity_map_parking_node",
        targetId: "M-991",
        severity: "info"
      },
      {
        code: "renderer.scene.outcome_opportunity_map_parking_node",
        targetId: "OP-991",
        severity: "info"
      }
    ]);
    expect(middle.bands.map((band) => ({
      label: band.label,
      kind: band.kind,
      bandOrder: band.bandOrder
    }))).toEqual([
      { label: "B1", kind: "outcome", bandOrder: 0 },
      { label: "P1", kind: "parking", bandOrder: 1 },
      { label: "P2", kind: "parking", bandOrder: 2 },
      { label: "P3", kind: "parking", bandOrder: 3 }
    ]);
    expect(placementFor(middle, "OP-991")).toEqual(expect.objectContaining({
      placementRole: "parking",
      semanticColumnId: "opportunity",
      parking: true,
      bandOrder: 1
    }));
    expect(placementFor(middle, "I-991")).toEqual(expect.objectContaining({
      placementRole: "parking",
      semanticColumnId: "initiative",
      parking: true,
      bandOrder: 2
    }));
    expect(placementFor(middle, "M-991")).toEqual(expect.objectContaining({
      placementRole: "parking",
      semanticColumnId: "metric",
      parking: true,
      bandOrder: 3
    }));
    expect(middle.connectorPlans).toEqual([
      expect.objectContaining({
        edgeId: "I-991__addresses__OP-991",
        fromPlacementId: placementFor(middle, "I-991").cellId,
        toPlacementId: placementFor(middle, "OP-991").cellId
      })
    ]);
  });
});
