import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { resolveProfileDisplayPolicy } from "../src/renderer/profileDisplay.js";
import { buildServiceBlueprintRenderModel } from "../src/renderer/serviceBlueprintRenderModel.js";
import { buildServiceBlueprintMiddleLayer } from "../src/renderer/staged/serviceBlueprintMiddleLayer.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

async function buildMiddleLayer(sourceText: string) {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "service_blueprint");
  if (!view) {
    throw new Error("Could not resolve the service_blueprint view.");
  }

  const input = {
    path: path.join(repoRoot, "tests/fixtures/render/__inline_service_blueprint_middle_layer__.sdd"),
    text: `${sourceText.trim()}\n`
  };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics).toEqual([]);
  if (!compiled.graph) {
    throw new Error("Could not compile inline service_blueprint source.");
  }

  const projected = projectView(compiled.graph, bundle, "service_blueprint");
  expect(projected.diagnostics).toEqual([]);
  if (!projected.projection) {
    throw new Error("Could not project inline service_blueprint source.");
  }

  const displayPolicy = resolveProfileDisplayPolicy(view, "strict");
  const model = buildServiceBlueprintRenderModel(projected.projection, compiled.graph, displayPolicy);
  return buildServiceBlueprintMiddleLayer(model);
}

describe("service_blueprint middle layer", () => {
  it("anchors proof-case support nodes to A1 and realizes D-020 in an A1 spill slot", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Step J-020 "Submit Claim"
  PRECEDES J-021 "Receive Confirmation"
  REALIZED_BY PR-020 "Validate Claim"
END

Step J-021 "Receive Confirmation"
  REALIZED_BY PR-022 "Notify Customer"
END

Process PR-020 "Validate Claim"
  visibility=frontstage
  PRECEDES PR-021 "Review Claim History"
  DEPENDS_ON SA-020 "Store Claim"
END

Process PR-021 "Review Claim History"
  visibility=backstage
  PRECEDES PR-022 "Notify Customer"
  DEPENDS_ON SA-021 "Load Claim History"
END

Process PR-022 "Notify Customer"
  visibility=support
  DEPENDS_ON SA-022 "Send Email"
END

SystemAction SA-020 "Store Claim"
  READS D-020 "Claim"
  WRITES D-020 "Claim"
  CONSTRAINED_BY PL-020 "Retention Policy"
END

SystemAction SA-021 "Load Claim History"
  READS D-020 "Claim"
END

SystemAction SA-022 "Send Email"
  READS D-020 "Claim"
END

DataEntity D-020 "Claim"
END

Policy PL-020 "Retention Policy"
END
`);

    expect(middle.bands.map((band) => band.label)).toEqual(["A1", "I1", "A2"]);
    expect(middle.columns.map((column) => ({
      label: column.label,
      bandId: column.bandId,
      bandKind: column.bandKind,
      columnOrder: column.columnOrder,
      slotKind: column.slotKind,
      slotOrderWithinBand: column.slotOrderWithinBand
    }))).toEqual([
      {
        label: "A1",
        bandId: "band:anchor:1",
        bandKind: "anchor",
        columnOrder: 0,
        slotKind: "primary",
        slotOrderWithinBand: 0
      },
      {
        label: "A1",
        bandId: "band:anchor:1",
        bandKind: "anchor",
        columnOrder: 1,
        slotKind: "spill",
        slotOrderWithinBand: 1
      },
      {
        label: "I1",
        bandId: "band:interstitial:1",
        bandKind: "interstitial",
        columnOrder: 2,
        slotKind: "primary",
        slotOrderWithinBand: 0
      },
      {
        label: "A2",
        bandId: "band:anchor:2",
        bandKind: "anchor",
        columnOrder: 3,
        slotKind: "primary",
        slotOrderWithinBand: 0
      }
    ]);
    expect(middle.cells).toHaveLength(24);

    const cellByNodeId = new Map(
      middle.cells.flatMap((cell) => cell.nodeIds.map((nodeId) => [nodeId, cell] as const))
    );
    expect(cellByNodeId.get("J-020")?.bandLabel).toBe("A1");
    expect(cellByNodeId.get("PR-020")?.bandLabel).toBe("A1");
    expect(cellByNodeId.get("SA-020")?.bandLabel).toBe("A1");
    expect(cellByNodeId.get("PR-021")?.bandLabel).toBe("I1");
    expect(cellByNodeId.get("SA-021")?.bandLabel).toBe("I1");
    expect(cellByNodeId.get("J-021")?.bandLabel).toBe("A2");
    expect(cellByNodeId.get("PR-022")?.bandLabel).toBe("A2");
    expect(cellByNodeId.get("SA-022")?.bandLabel).toBe("A2");
    expect(cellByNodeId.get("D-020")?.bandLabel).toBe("A1");
    expect(cellByNodeId.get("D-020")?.slotKind).toBe("spill");
    expect(cellByNodeId.get("PL-020")?.bandLabel).toBe("A1");
    expect(cellByNodeId.get("PL-020")?.slotKind).toBe("primary");

    const placementByNodeId = new Map(middle.placements.map((placement) => [placement.nodeId, placement]));
    expect(placementByNodeId.get("D-020")).toEqual(expect.objectContaining({
      bandId: "band:anchor:1",
      placementMode: "band_spill_support",
      classification: "shared_resource",
      columnOrder: 1,
      slotKind: "spill",
      slotOrderWithinBand: 1
    }));
    expect(placementByNodeId.get("PL-020")).toEqual(expect.objectContaining({
      bandId: "band:anchor:1",
      placementMode: "band_primary_support",
      classification: "band_support",
      columnOrder: 0,
      slotKind: "primary",
      slotOrderWithinBand: 0
    }));

    const mergedReadWrites = middle.edges.find((edge) => edge.id === "SA-020__reads_writes__D-020");
    expect(mergedReadWrites).toEqual(expect.objectContaining({
      type: "READS_WRITES",
      style: "dashed",
      semanticEdgeIds: [
        "SA-020__reads__D-020",
        "SA-020__writes__D-020"
      ]
    }));

    expect([...new Set(middle.edges.map((edge) => edge.channel))].sort()).toEqual([
      "flow",
      "resource_policy",
      "support"
    ]);
    for (const edge of middle.edges) {
      expect(edge).not.toHaveProperty("hidden");
      expect(edge).not.toHaveProperty("strictRoute");
    }
  });

  it("interleaves spill columns with their owning semantic bands", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Step J-400 "Start"
  PRECEDES J-401 "Finish"
  REALIZED_BY PR-400 "Store Draft"
END

Step J-401 "Finish"
  REALIZED_BY PR-401 "Archive Draft"
END

Process PR-400 "Store Draft"
  visibility=frontstage
  DEPENDS_ON SA-400 "Save Draft"
END

Process PR-401 "Archive Draft"
  visibility=backstage
  DEPENDS_ON SA-401 "Archive Draft"
END

SystemAction SA-400 "Save Draft"
  WRITES D-400 "Draft"
END

SystemAction SA-401 "Archive Draft"
  WRITES D-401 "Archive"
END

DataEntity D-400 "Draft"
END

DataEntity D-401 "Archive"
END
`);

    expect(middle.bands.map((band) => band.label)).toEqual(["A1", "A2"]);
    expect(middle.columns.map((column) => ({
      bandId: column.bandId,
      columnOrder: column.columnOrder,
      slotKind: column.slotKind,
      slotOrderWithinBand: column.slotOrderWithinBand
    }))).toEqual([
      {
        bandId: "band:anchor:1",
        columnOrder: 0,
        slotKind: "primary",
        slotOrderWithinBand: 0
      },
      {
        bandId: "band:anchor:1",
        columnOrder: 1,
        slotKind: "spill",
        slotOrderWithinBand: 1
      },
      {
        bandId: "band:anchor:2",
        columnOrder: 2,
        slotKind: "primary",
        slotOrderWithinBand: 0
      },
      {
        bandId: "band:anchor:2",
        columnOrder: 3,
        slotKind: "spill",
        slotOrderWithinBand: 1
      }
    ]);

    const placementByNodeId = new Map(middle.placements.map((placement) => [placement.nodeId, placement]));
    expect(placementByNodeId.get("D-400")).toEqual(expect.objectContaining({
      bandId: "band:anchor:1",
      columnOrder: 1,
      slotKind: "spill"
    }));
    expect(placementByNodeId.get("D-401")).toEqual(expect.objectContaining({
      bandId: "band:anchor:2",
      columnOrder: 3,
      slotKind: "spill"
    }));
  });

  it("falls back to author order when customer steps do not declare PRECEDES", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Step J-100 "Start"
  REALIZED_BY PR-100 "Open Case"
END

Step J-101 "Finish"
  REALIZED_BY PR-101 "Close Case"
END

Process PR-100 "Open Case"
  visibility=frontstage
END

Process PR-101 "Close Case"
  visibility=support
END
`);

    const cellByNodeId = new Map(
      middle.cells.flatMap((cell) => cell.nodeIds.map((nodeId) => [nodeId, cell] as const))
    );

    expect(cellByNodeId.get("J-100")?.bandLabel).toBe("A1");
    expect(cellByNodeId.get("PR-100")?.bandLabel).toBe("A1");
    expect(cellByNodeId.get("J-101")?.bandLabel).toBe("A2");
    expect(cellByNodeId.get("PR-101")?.bandLabel).toBe("A2");
  });

  it("creates a deterministic degraded action spine when no customer steps exist", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Process PR-200 "Validate"
  visibility=frontstage
  PRECEDES PR-201 "Review"
  DEPENDS_ON SA-200 "Store"
END

Process PR-201 "Review"
  visibility=backstage
END

SystemAction SA-200 "Store"
END
`);

    expect(middle.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "renderer.scene.service_blueprint_degraded_no_steps"
    );

    const cellByNodeId = new Map(
      middle.cells.flatMap((cell) => cell.nodeIds.map((nodeId) => [nodeId, cell] as const))
    );
    expect(cellByNodeId.get("PR-200")?.bandLabel).toBe("A1");
    expect(cellByNodeId.get("SA-200")?.bandLabel).toBe("A3");
    expect(cellByNodeId.get("PR-201")?.bandLabel).toBe("A2");
  });

  it("assigns disconnected action nodes to per-lane parking bands", async () => {
    const middle = await buildMiddleLayer(`
SDD-TEXT 0.1

Step J-300 "Start"
  REALIZED_BY PR-300 "Handle Request"
END

Process PR-300 "Handle Request"
  visibility=frontstage
END

Process PR-301 "Offline Audit"
  visibility=backstage
END
`);

    expect(middle.columns.filter((column) => column.slotKind === "parking")).toEqual([
      expect.objectContaining({
        id: "band:parking:lane:03:backstage:1",
        ownerLaneId: "lane:03:backstage",
        label: "P1"
      })
    ]);
    const parkingCell = middle.cells.find((cell) =>
      cell.bandKind === "parking" && cell.laneId === "lane:03:backstage"
    );
    expect(parkingCell).toBeDefined();
    expect(parkingCell?.bandLabel).toBe("P1");
    expect(parkingCell?.nodeIds).toEqual(["PR-301"]);
  });
});
