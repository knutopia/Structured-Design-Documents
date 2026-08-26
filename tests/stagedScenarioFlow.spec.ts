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
const topologyChallengePath = path.join(repoRoot, "bundle/v0.1/examples/flow_journey_topology_challenge.sdd");

async function resolveScenarioFlowContext(sourcePath: string, profileId: string) {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "scenario_flow");
  if (!view) {
    throw new Error("Could not resolve the scenario_flow view.");
  }

  const input = {
    path: sourcePath,
    text: await readFile(sourcePath, "utf8")
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
  const cases = [
    {
      name: "scenario_branching strict",
      sourcePath: scenarioBranchingPath,
      goldenPrefix: "scenario-flow.branching",
      expectedLabelIds: [
        "J-030__precedes__J-031",
        "J-030__precedes__J-032",
        "J-033__precedes__J-034",
        "J-033__precedes__J-035"
      ]
    },
    {
      name: "flow_journey_topology_challenge strict",
      sourcePath: topologyChallengePath,
      goldenPrefix: "scenario-flow.topology-challenge",
      expectedLabelIds: []
    }
  ] as const;

  for (const testCase of cases) {
    it(`matches committed staged snapshots for ${testCase.name}`, async () => {
      const context = await resolveScenarioFlowContext(testCase.sourcePath, "strict");
      const rendered = await renderScenarioFlowStagedSvg(
        context.projection,
        context.graph,
        context.view,
        { detailId: "detailed" }
      );
      const debug = await renderScenarioFlowRoutingDebugArtifacts(
        context.projection,
        context.graph,
        context.view,
        { detailId: "detailed" }
      );

      expectNoForbiddenDiagnostics(rendered.diagnostics, [
        "renderer.routing.scenario_flow_unresolved_port",
        "renderer.routing.unresolved_port",
        "renderer.routing.scenario_flow_node_intersection",
        "renderer.routing.scenario_flow_label_fallback",
        "renderer.routing.scenario_flow_edge_label_omitted",
        "renderer.routing.scenario_flow_edge_label_fallback"
      ]);
      expect(debug.diagnostics).toEqual(rendered.diagnostics);
      expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(rendered.positionedScene.edges.filter((edge) => edge.label).map((edge) => edge.id))
        .toEqual(testCase.expectedLabelIds);

      await expectRendererStageSnapshot(`${testCase.goldenPrefix}.renderer-scene.json`, rendered.rendererScene);
      await expectRendererStageSnapshot(`${testCase.goldenPrefix}.measured-scene.json`, rendered.measuredScene);
      await expectRendererStageSnapshot(`${testCase.goldenPrefix}.positioned-scene.json`, rendered.positionedScene);
      await expectRendererStageSnapshot(
        `${testCase.goldenPrefix}.step-2.positioned-scene.json`,
        debug.step2PositionedScene
      );
      await expectRendererStageSnapshot(
        `${testCase.goldenPrefix}.step-3.positioned-scene.json`,
        debug.step3PositionedScene
      );
      await expectRendererStageTextSnapshot(`${testCase.goldenPrefix}.svg`, rendered.svg);
      await expectRendererStageTextSnapshot(`${testCase.goldenPrefix}.step-2.svg`, debug.step2Svg);
      await expectRendererStageTextSnapshot(`${testCase.goldenPrefix}.step-3.svg`, debug.step3Svg);
    });
  }
});
