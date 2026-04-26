import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import {
  renderScenarioFlowRoutingDebugArtifacts,
  renderScenarioFlowStagedSvg
} from "../src/renderer/staged/scenarioFlow.js";
import {
  expectRendererStageSnapshot,
  expectRendererStageTextSnapshot
} from "./rendererStageSnapshotHarness.js";
import { expectNoForbiddenDiagnostics } from "./stagedVisualHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const scenarioBranchingPath = path.join(repoRoot, "bundle/v0.1/examples/scenario_branching.sdd");

async function resolveScenarioFlowContext(profileId: string) {
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
    view,
    profileId
  };
}

describe("staged scenario_flow", () => {
  it("matches committed staged snapshots for scenario_branching strict", async () => {
    const context = await resolveScenarioFlowContext("strict");
    const rendered = await renderScenarioFlowStagedSvg(
      context.projection,
      context.graph,
      context.view,
      context.profileId
    );
    const debug = await renderScenarioFlowRoutingDebugArtifacts(
      context.projection,
      context.graph,
      context.view,
      context.profileId
    );

    expectNoForbiddenDiagnostics(rendered.diagnostics, [
      "renderer.routing.scenario_flow_unresolved_port",
      "renderer.routing.unresolved_port",
      "renderer.routing.scenario_flow_node_intersection",
      "renderer.routing.scenario_flow_label_fallback"
    ]);
    expect(debug.diagnostics).toEqual(rendered.diagnostics);
    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendered.positionedScene.edges.filter((edge) => edge.label).map((edge) => edge.id)).toEqual([
      "J-030__precedes__J-031",
      "J-030__precedes__J-032",
      "J-033__precedes__J-034",
      "J-033__precedes__J-035"
    ]);

    await expectRendererStageSnapshot("scenario-flow.branching.renderer-scene.json", rendered.rendererScene);
    await expectRendererStageSnapshot("scenario-flow.branching.measured-scene.json", rendered.measuredScene);
    await expectRendererStageSnapshot("scenario-flow.branching.positioned-scene.json", rendered.positionedScene);
    await expectRendererStageSnapshot(
      "scenario-flow.branching.step-2.positioned-scene.json",
      debug.step2PositionedScene
    );
    await expectRendererStageSnapshot(
      "scenario-flow.branching.step-3.positioned-scene.json",
      debug.step3PositionedScene
    );
    await expectRendererStageTextSnapshot("scenario-flow.branching.svg", rendered.svg);
    await expectRendererStageTextSnapshot("scenario-flow.branching.step-2.svg", debug.step2Svg);
    await expectRendererStageTextSnapshot("scenario-flow.branching.step-3.svg", debug.step3Svg);
  });
});
