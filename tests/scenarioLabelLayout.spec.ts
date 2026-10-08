import { readFile } from "node:fs/promises";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectDiagram } from "../src/projector/projectView.js";
import { renderScenarioFlowPreRoutingArtifacts, renderScenarioFlowStagedSvg } from "../src/renderer/staged/scenarioFlow.js";
import { buildScenarioFlowRoutingStages } from "../src/renderer/staged/scenarioFlowRouting.js";
import { renderSourcePreview } from "../src/renderer/previewWorkflow.js";
import * as core from "../src/renderer/staged/routingCore/index.js";
import * as labels from "../src/renderer/staged/connectorLabelLayout.js";

const fixture = "tests/fixtures/render/scenario_overlap_reconvergence.sdd";
const settings = { detailId: "detailed" };
async function context(text?: string) {
  const bundle = await loadBundle("bundle/v0.2/manifest.yaml");
  const input = { path: fixture, text: text ?? await readFile(fixture, "utf8") };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics.filter(d => d.severity === "error")).toEqual([]);
  const graph = compiled.graph!;
  const projection = projectDiagram(graph, bundle, "DG-001").projection!;
  return { bundle, input, graph, projection, view: bundle.views.views.find(v => v.id === projection.view_id)! };
}
afterEach(() => vi.restoreAllMocks());

describe("Scenario label correction lifecycle", () => {
  let c: Awaited<ReturnType<typeof context>>;
  beforeAll(async () => { c = await context(); });
  const render = () => renderScenarioFlowStagedSvg(c.projection, c.graph, c.view, settings);
  it("resolves measured width and height deficits using a shared expansion owner", async () => {
    const spy = vi.spyOn(core, "runRoutingLifecycle");
    const r = await render();
    expect(r.routingStages.labelLayoutTrace.terminationReason).toBe("resolved");
    expect(r.routingStages.labelLayoutTrace.labelExpansionPasses).toBeGreaterThan(0);
    expect(r.routingStages.globalGutterState.columnExpansions[2]).toBeGreaterThan(0);
    expect(r.routingStages.globalGutterState.laneExpansions[0]).toBeGreaterThan(0);
    expect(r.diagnostics).toEqual([]);
    const trace = r.routingStages.labelLayoutTrace;
    expect(trace.preparationExpansionPasses + trace.routingExpansionPasses + trace.labelExpansionPasses).toBeLessThanOrEqual(8);
    expect(trace.routingTotals.candidates).toBeLessThanOrEqual(core.DEFAULT_FINAL_ROUTING_LIMITS.maxCandidates);
    for (let i = 1; i < spy.mock.calls.length; i++) {
      const prior = spy.mock.results.slice(0, i).reduce((n, call) => n + (call.value as core.FinalRoutingResult).trace.candidates, 0);
      expect(spy.mock.calls[i]![1]!.maxCandidates).toBe(core.DEFAULT_FINAL_ROUTING_LIMITS.maxCandidates - prior);
    }
  });
  it("preserves inherited measurement and layout diagnostics after correction", async () => {
    const pre = await renderScenarioFlowPreRoutingArtifacts(c.projection, c.graph, c.view, settings);
    const diagnostic = { phase: "measure" as const, code: "renderer.measure.test_warning", severity: "warn" as const,
      message: "An inherited measured-scene warning" };
    pre.preRoutingPositionedScene.diagnostics.push(diagnostic);
    const stages = buildScenarioFlowRoutingStages(pre.measuredScene, pre.preRoutingPositionedScene, pre.middleLayer);
    expect(stages.finalPositionedScene.diagnostics.filter(d => d.code === diagnostic.code)).toEqual([diagnostic]);
  });
  it("preserves unlabeled geometry without label expansion", async () => {
    const text = `SDD-TEXT 0.2
ScenarioStep S-001 "Short source"
  PRECEDES S-002 {A clear label} diagrams=DG-001
END
ScenarioStep S-002 "Target"
END
Diagram DG-001 "Simple"
  diagram_type=scenario_flow
END`;
    const simple = await context(text);
    const spy = vi.spyOn(core, "runRoutingLifecycle");
    const r = await renderScenarioFlowStagedSvg(simple.projection, simple.graph, simple.view, settings);
    expect(r.positionedScene.edges.every(edge => !edge.label)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(r.routingStages.labelLayoutTrace.labelExpansionPasses).toBe(0);
    expect(r.routingStages.labelLayoutTrace.unresolvedLabelIds).toEqual([]);
    const original = spy.mock.calls[0]![0];
    expect(r.positionedScene.edges[0]!.route).toEqual(original.connectors[0]!.route);
  });
  it("uses measured wrapped labels with unequal node heights", async () => {
    const simple = await context(`SDD-TEXT 0.2
ScenarioStep S-001 "A source with a longer title that occupies several measured lines in its node"
  kind=decision
  PRECEDES S-002 {A substantially longer connector label with several words to wrap} diagrams=DG-001
  PRECEDES S-003 {Another branch} diagrams=DG-001
END
ScenarioStep S-002 "Target"
END
ScenarioStep S-003 "Another target"
END
Diagram DG-001 "Measured labels"
  diagram_type=scenario_flow
END`);
    const r = await renderScenarioFlowStagedSvg(simple.projection, simple.graph, simple.view, settings);
    expect(r.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    const labeled = r.positionedScene.edges.find(edge => edge.label && edge.label.lines.length > 1)!;
    expect(labeled).toBeDefined();
    expect(labeled.label!.lines).toEqual(r.measuredScene.edges.find(edge => edge.id === labeled.id)!.label!.lines);
  });
  it.each(["no_capacity", "unmovable"])("stops a %s correction and publishes warnings in SVG and PNG", async mode => {
    vi.spyOn(labels, "measureConnectorLabelCapacity").mockReturnValue(mode === "no_capacity" ? [] : [
      { owner: "x:999", axis: "x", availableSize: 1, requiredSize: 100, connectorIds: [] }
    ]);
    const r = await render();
    expect(r.routingStages.labelLayoutTrace.terminationReason).toBe("no_capacity");
    expect(r.routingStages.labelLayoutTrace.labelExpansionPasses).toBe(0);
    expect(r.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    expect(r.diagnostics.some(d => d.code.endsWith("edge_label_unresolved") && d.severity === "warn")).toBe(true);
    for (const format of ["svg", "png"] as const) {
      const preview = await renderSourcePreview(c.input, c.bundle, {
        viewId: c.view.id, diagramId: "DG-001", format, profileId: "simple", detailId: "detailed"
      });
      expect(preview.artifact?.format).toBe(format);
      expect(preview.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    }
  });
  it.each(["candidates", "repairRevisions"] as const)("does not reset exhausted %s across label corrections", async key => {
    const actual = core.runRoutingLifecycle;
    const spy = vi.spyOn(core, "runRoutingLifecycle").mockImplementation((input, options) => {
      const result = actual(input, options);
      return { ...result, trace: { ...result.trace,
        [key]: key === "candidates" ? core.DEFAULT_FINAL_ROUTING_LIMITS.maxCandidates : core.DEFAULT_FINAL_ROUTING_LIMITS.maxRepairRevisions } };
    });
    const r = await render();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(r.routingStages.labelLayoutTrace.terminationReason).toBe("search_exhausted");
    expect(r.routingStages.labelLayoutTrace.unresolvedLabelIds.length).toBeGreaterThan(0);
    expect(r.diagnostics.filter(d => d.severity === "error")).toEqual([]);
  });
  it("restores the complete accepted revision when later routing fails", async () => {
    const actual = core.runRoutingLifecycle;
    const spy = vi.spyOn(core, "runRoutingLifecycle").mockImplementation((input, options) => {
      if (spy.mock.calls.length === 1) return actual(input, options);
      return { status: "failed", reason: "candidate_exhausted", violations: [], debugConnectors: input.connectors,
        trace: { validations: 1, candidates: 1, repairRevisions: 0, expansionPasses: 0, repeatedStates: 0 } };
    });
    const r = await render();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(r.routingStages.labelLayoutTrace.selectedRevision).toBe(0);
    expect(r.routingStages.labelLayoutTrace.terminationReason).toBe("routing_failed");
    expect(r.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    const accepted = spy.mock.results[0]!.value as core.FinalRoutingResult;
    if (accepted.status !== "resolved") throw Error("Expected an accepted baseline");
    const emitted = new Map(r.positionedScene.edges.map(e => [e.id, e.route]));
    expect(core.validateFinalRouteSet({ ...accepted.context,
      connectors: accepted.context.connectors.map(connector => ({ ...connector, route: emitted.get(connector.id)! })) })).toEqual([]);
    expect(r.routingStages.globalGutterState.laneExpansions).toEqual({});
  });
  it("terminates persistent measured corrections within eight effective expansions", async () => {
    const actualAssess = labels.assessConnectorLabels;
    // Fault injection at the label acceptance boundary: the underlying routing
    // remains real, while an external label constraint never becomes satisfiable.
    vi.spyOn(labels, "assessConnectorLabels").mockImplementation(input => {
      const result = actualAssess(input);
      const id = input.expectedLabels.keys().next().value!;
      return { ...result, problems: [{ connectorId: id, kind: "detached" }], comparisonKey: [0, 0, 1, 100, 0] };
    });
    vi.spyOn(labels, "measureConnectorLabelCapacity").mockImplementation(corridors => {
      const corridor = corridors.find(c => c.axis === "y")!;
      return [{ owner: corridor.owner, axis: "y", availableSize: corridor.bounds.height,
        requiredSize: corridor.bounds.height + 16, connectorIds: [...corridor.connectorIds] }];
    });
    const r = await render(), trace = r.routingStages.labelLayoutTrace;
    expect(trace.preparationExpansionPasses + trace.routingExpansionPasses + trace.labelExpansionPasses).toBe(8);
    expect(trace.terminationReason).toBe("expansion_exhausted");
    expect(trace.selectedRevision).toBe(0); // Equal quality retains the earliest complete scene.
    expect(r.diagnostics.filter(d => d.severity === "error")).toEqual([]);
  });
});
