import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import type { Bundle, ViewSpec } from "../src/bundle/types.js";
import { projectView } from "../src/projector/projectView.js";
import {
  buildOutcomeOpportunityMapRenderModel,
  readOutcomeOpportunityRendererDefaults
} from "../src/renderer/outcomeOpportunityMapRenderModel.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

function cloneView(view: ViewSpec): ViewSpec {
  return structuredClone(view) as ViewSpec;
}

function getOutcomeOpportunityView(bundle: Bundle): ViewSpec {
  const view = bundle.views.views.find((candidate) => candidate.id === "outcome_opportunity_map");
  if (!view) {
    throw new Error("Missing outcome_opportunity_map view in test bundle");
  }
  return view;
}

async function buildCanonicalModel(viewOverride?: ViewSpec) {
  const bundle = await loadBundle(manifestPath);
  const examplePath = path.join(bundle.rootDir, "examples", "outcome_to_ia_trace.sdd");
  const input = {
    path: examplePath,
    text: await readFile(examplePath, "utf8")
  };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  expect(compiled.graph).toBeDefined();

  const projected = projectView(compiled.graph!, bundle, "outcome_opportunity_map");
  expect(projected.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  expect(projected.projection).toBeDefined();

  return buildOutcomeOpportunityMapRenderModel(
    projected.projection!,
    compiled.graph!,
    viewOverride ?? getOutcomeOpportunityView(bundle)
  );
}

describe("outcome-opportunity render-model bundle authority", () => {
  it("drives columns, chrome, and connector metadata from bundle renderer defaults", async () => {
    const bundle = await loadBundle(manifestPath);
    const view = cloneView(getOutcomeOpportunityView(bundle));
    const semanticColumns = view.conventions.renderer_defaults?.semantic_columns;
    const nodeChrome = view.conventions.renderer_defaults?.node_chrome;
    const connectors = view.conventions.renderer_defaults?.connectors;

    expect(semanticColumns?.fixed_order?.[0]).toBeDefined();
    expect(nodeChrome?.Opportunity).toBeDefined();
    expect(connectors?.edge_type_channels?.MEASURED_BY).toBeDefined();

    semanticColumns!.fixed_order![0].label = "Workstreams";
    nodeChrome!.Opportunity!.visual_role = "mutated_opportunity_role";
    nodeChrome!.Opportunity!.legacy_dot_shape = "box";
    connectors!.edge_type_channels!.MEASURED_BY!.channel = "mutated_measurement_channel";
    connectors!.edge_type_channels!.MEASURED_BY!.label = {
      visible: true,
      text: "tracked by"
    };
    connectors!.priority_order = ["MEASURED_BY", "SUPPORTS", "ADDRESSES", "IMPLEMENTED_BY", "INSTRUMENTED_AT"];

    const model = await buildCanonicalModel(view);

    expect(model.lanes[0].label).toBe("Workstreams");
    expect(model.nodes.find((node) => node.id === "OP-001")).toMatchObject({
      visualRole: "mutated_opportunity_role",
      shape: "box"
    });
    expect(model.edges.find((edge) => edge.type === "MEASURED_BY")).toMatchObject({
      channel: "mutated_measurement_channel",
      label: "tracked by",
      priority: 0
    });
    expect(model.connectorPriorityOrder[0]).toBe("MEASURED_BY");
  });

  it("rejects missing, extra, or reordered fixed semantic columns explicitly", async () => {
    const bundle = await loadBundle(manifestPath);
    const baseView = getOutcomeOpportunityView(bundle);

    const missingColumnView = cloneView(baseView);
    missingColumnView.conventions.renderer_defaults!.semantic_columns!.fixed_order =
      missingColumnView.conventions.renderer_defaults!.semantic_columns!.fixed_order!.slice(0, 3);
    expect(() => readOutcomeOpportunityRendererDefaults(missingColumnView)).toThrow(
      /expected 4 columns/
    );

    const extraColumnView = cloneView(baseView);
    extraColumnView.conventions.renderer_defaults!.semantic_columns!.fixed_order!.push({
      id: "extra",
      label: "Extra"
    });
    expect(() => readOutcomeOpportunityRendererDefaults(extraColumnView)).toThrow(
      /expected 4 columns/
    );

    const reorderedColumnView = cloneView(baseView);
    const fixedOrder = reorderedColumnView.conventions.renderer_defaults!.semantic_columns!.fixed_order!;
    [fixedOrder[0], fixedOrder[1]] = [fixedOrder[1], fixedOrder[0]];
    expect(() => readOutcomeOpportunityRendererDefaults(reorderedColumnView)).toThrow(
      /semantic column contract at position 1/
    );
  });
});
