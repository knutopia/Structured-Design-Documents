import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { buildJourneyMapRenderModel } from "../src/renderer/journeyMapRenderModel.js";
import { resolveProfileDisplayPolicy } from "../src/renderer/profileDisplay.js";
import type {
  MeasuredScene,
  PositionedContainer,
  PositionedItem,
  PositionedNode,
  PositionedScene
} from "../src/renderer/staged/contracts.js";
import {
  buildJourneyMapRendererSceneFromModel,
  renderJourneyMapRoutingArtifacts
} from "../src/renderer/staged/journeyMap.js";
import {
  buildJourneyMapRoutingStages,
  JOURNEY_MAP_TRACK_SEPARATION,
  validateJourneyMapBasicRoutes,
  validateJourneyMapExpansionBound,
  validateJourneyMapResolvedStages,
  validateJourneyMapRoutes,
  type JourneyMapConnectorPlan,
  type JourneyMapRoutingStages
} from "../src/renderer/staged/journeyMapRouting.js";
import type { RendererDiagnostic } from "../src/renderer/staged/diagnostics.js";
import { renderPositionedSceneToPng } from "../src/renderer/staged/svgBackend.js";
import { validateGraph } from "../src/validator/validateGraph.js";
import {
  expectRendererStageSnapshot,
  expectRendererStageTextSnapshot
} from "./rendererStageSnapshotHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const fixtureRoot = path.join(repoRoot, "tests/fixtures/render");

type JourneyFixtureName =
  | "primary"
  | "ordering_ownership"
  | "topology"
  | "duplicate"
  | "compressed";

async function buildFixture(name: JourneyFixtureName, profileId = "strict") {
  const bundle = await loadBundle(manifestPath);
  const fixturePath = path.join(fixtureRoot, `journey_map_staged_${name}.sdd`);
  const compiled = compileSource({
    path: fixturePath,
    text: await readFile(fixturePath, "utf8")
  }, bundle);
  expect(compiled.diagnostics).toEqual([]);
  expect(compiled.graph).toBeDefined();

  const projected = projectView(compiled.graph!, bundle, "journey_map");
  expect(projected.diagnostics).toEqual([]);
  expect(projected.projection).toBeDefined();
  const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
  expect(view).toBeDefined();

  const rendered = await renderJourneyMapRoutingArtifacts(
    projected.projection!,
    compiled.graph!,
    bundle,
    view!,
    profileId
  );
  return {
    bundle,
    view: view!,
    graph: compiled.graph!,
    projection: projected.projection!,
    rendered,
    validationDiagnostics: validateGraph(compiled.graph!, bundle, profileId).diagnostics
  };
}

function flattenPositionedItems(container: PositionedContainer): PositionedItem[] {
  return container.children.flatMap((item) =>
    item.kind === "container" ? [item, ...flattenPositionedItems(item)] : [item]
  );
}

function findNode(scene: PositionedScene, id: string): PositionedNode {
  const item = flattenPositionedItems(scene.root).find((candidate) => candidate.id === id);
  expect(item?.kind).toBe("node");
  return item as PositionedNode;
}

function findContainer(scene: PositionedScene, id: string): PositionedContainer {
  const item = flattenPositionedItems(scene.root).find((candidate) => candidate.id === id);
  expect(item?.kind).toBe("container");
  return item as PositionedContainer;
}

function canonicalDiagnostics(...groups: readonly RendererDiagnostic[][]): RendererDiagnostic[] {
  const bySignature = new Map<string, RendererDiagnostic>();
  for (const diagnostic of groups.flat()) {
    const signature = JSON.stringify([
      diagnostic.code,
      diagnostic.severity,
      diagnostic.targetId,
      diagnostic.details,
      diagnostic.message
    ]);
    bySignature.set(signature, diagnostic);
  }
  return [...bySignature.values()].sort((left, right) =>
    left.code.localeCompare(right.code)
    || (left.targetId ?? "").localeCompare(right.targetId ?? "")
    || (left.details ?? "").localeCompare(right.details ?? "")
    || left.message.localeCompare(right.message)
  );
}

function portableValidationDiagnostics<T extends { file?: string }>(diagnostics: readonly T[]): T[] {
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    ...(diagnostic.file
      ? { file: path.relative(repoRoot, diagnostic.file).split(path.sep).join("/") }
      : {})
  }));
}

async function expectFinalPngUsesExactSvg(
  rendered: Awaited<ReturnType<typeof renderJourneyMapRoutingArtifacts>>
): Promise<void> {
  const rerendered = await renderPositionedSceneToPng(rendered.routingStages.finalPositionedScene);
  expect(rerendered.svg).toBe(rendered.finalSvg);
  expect(rerendered.png).toEqual(rendered.finalPng);
}

describe("journey map accepted renderer-stage goldens", () => {
  it("locks primary strict step-2, step-3, final, diagnostics, and SVG-derived PNG", async () => {
    const { rendered } = await buildFixture("primary");
    await expectRendererStageSnapshot(
      "journey-map.primary.step-2.positioned-scene.json",
      rendered.routingStages.step2PositionedScene
    );
    await expectRendererStageTextSnapshot("journey-map.primary.step-2.svg", rendered.step2Svg);
    await expectRendererStageSnapshot(
      "journey-map.primary.step-3.positioned-scene.json",
      rendered.routingStages.step3PositionedScene
    );
    await expectRendererStageTextSnapshot("journey-map.primary.step-3.svg", rendered.step3Svg);
    await expectRendererStageSnapshot(
      "journey-map.primary.positioned-scene.json",
      rendered.routingStages.finalPositionedScene
    );
    await expectRendererStageTextSnapshot("journey-map.primary.svg", rendered.finalSvg);
    await expectRendererStageSnapshot(
      "journey-map.primary.diagnostics.json",
      rendered.routingStages.diagnostics
    );
    expect(rendered.step2Svg).toBe(rendered.step3Svg);
    expect(rendered.step3Svg).toBe(rendered.finalSvg);
    await expectFinalPngUsesExactSvg(rendered);
  });

  for (const profileId of ["simple", "permissive"] as const) {
    it(`locks the primary ${profileId} badge-profile final evidence`, async () => {
      const { rendered } = await buildFixture("primary", profileId);
      await expectRendererStageSnapshot(
        `journey-map.badges.${profileId}.positioned-scene.json`,
        rendered.routingStages.finalPositionedScene
      );
      await expectRendererStageTextSnapshot(
        `journey-map.badges.${profileId}.svg`,
        rendered.finalSvg
      );
      if (profileId === "permissive") {
        expect(rendered.finalSvg).not.toContain('<rect class="scene-badge__chrome"');
        expect(rendered.finalSvg).toContain("block-kind-metadata block-region-secondary");
      }
      await expectFinalPngUsesExactSvg(rendered);
    });
  }

  it("locks ordering, ownership, validation, and renderer diagnostics", async () => {
    const { rendered, validationDiagnostics } = await buildFixture("ordering_ownership");
    await expectRendererStageSnapshot(
      "journey-map.ordering-ownership.positioned-scene.json",
      rendered.routingStages.finalPositionedScene
    );
    await expectRendererStageTextSnapshot(
      "journey-map.ordering-ownership.svg",
      rendered.finalSvg
    );
    await expectRendererStageSnapshot(
      "journey-map.ordering-ownership.validation-diagnostics.json",
      portableValidationDiagnostics(validationDiagnostics)
    );
    await expectRendererStageSnapshot(
      "journey-map.ordering-ownership.diagnostics.json",
      rendered.routingStages.diagnostics
    );
    await expectFinalPngUsesExactSvg(rendered);
  });

  for (const fixture of ["topology", "duplicate"] as const) {
    it(`locks ${fixture} step progression and diagnostics`, async () => {
      const { rendered, validationDiagnostics } = await buildFixture(fixture);
      await expectRendererStageSnapshot(
        `journey-map.${fixture}.step-2.positioned-scene.json`,
        rendered.routingStages.step2PositionedScene
      );
      await expectRendererStageTextSnapshot(
        `journey-map.${fixture}.step-2.svg`,
        rendered.step2Svg
      );
      await expectRendererStageSnapshot(
        `journey-map.${fixture}.step-3.positioned-scene.json`,
        rendered.routingStages.step3PositionedScene
      );
      await expectRendererStageTextSnapshot(
        `journey-map.${fixture}.step-3.svg`,
        rendered.step3Svg
      );
      await expectRendererStageSnapshot(
        `journey-map.${fixture}.positioned-scene.json`,
        rendered.routingStages.finalPositionedScene
      );
      await expectRendererStageTextSnapshot(
        `journey-map.${fixture}.svg`,
        rendered.finalSvg
      );
      await expectRendererStageSnapshot(
        `journey-map.${fixture}.validation-diagnostics.json`,
        portableValidationDiagnostics(validationDiagnostics)
      );
      await expectRendererStageSnapshot(
        `journey-map.${fixture}.diagnostics.json`,
        rendered.routingStages.diagnostics
      );
      expect(rendered.step2Svg).not.toBe(rendered.step3Svg);
      // These accepted fixtures have no residual perpendicular crossing, so the
      // final-only continuity-mark pass is deliberately a byte-preserving no-op.
      expect(rendered.step3Svg).toBe(rendered.finalSvg);
      await expectFinalPngUsesExactSvg(rendered);
    });
  }

  it("withholds compressed visual evidence while the dense acceptance gate is rejected", async () => {
    const { rendered } = await buildFixture("compressed");
    const stage900 = findContainer(rendered.routingStages.finalPositionedScene, "G-900");
    expect(rendered.routingStages.residualCrossings).toHaveLength(58);
    expect(rendered.routingStages.finalPositionedScene.root).toMatchObject({
      width: 2064,
      height: 400
    });
    expect(stage900).toMatchObject({ width: 856, height: 224 });
    expect(rendered.routingStages.finalPositionedScene.root.height).toBeGreaterThan(384);
    expect(rendered.routingStages.connectorPlans.some((plan) =>
      plan.routeFamily === "early_south_egress"
    )).toBe(false);
  });
});

describe("journey map degraded diagnostic goldens", () => {
  it("locks constructed structural failures", async () => {
    const duplicate = await buildFixture("duplicate");
    const model = structuredClone(buildJourneyMapRenderModel(
      duplicate.projection,
      duplicate.graph,
      duplicate.bundle,
      duplicate.view.projection.hierarchy_edges,
      duplicate.view.projection.ordering_edges,
      resolveProfileDisplayPolicy(duplicate.view, "strict")
    ));
    model.edges[1]!.id = model.edges[0]!.id;
    const duplicateScene = buildJourneyMapRendererSceneFromModel(model, "strict");

    const primary = await buildFixture("primary");
    const missingEndpointScene = structuredClone(primary.rendered.measuredScene) as MeasuredScene;
    missingEndpointScene.edges[0]!.from.itemId = "J-missing";
    const missingEndpoint = buildJourneyMapRoutingStages(
      missingEndpointScene,
      primary.rendered.preRoutingPositionedScene
    );
    const duplicateEdgeScene = structuredClone(primary.rendered.measuredScene) as MeasuredScene;
    duplicateEdgeScene.edges.push(structuredClone(duplicateEdgeScene.edges[0]!));
    const duplicateEdge = buildJourneyMapRoutingStages(
      duplicateEdgeScene,
      primary.rendered.preRoutingPositionedScene
    );
    const missingPortScene = structuredClone(
      primary.rendered.preRoutingPositionedScene
    ) as PositionedScene;
    findNode(missingPortScene, "J-101").ports = [];
    const missingPort = buildJourneyMapRoutingStages(
      primary.rendered.measuredScene,
      missingPortScene
    );

    const diagnostics = canonicalDiagnostics(
      duplicateScene.diagnostics,
      missingEndpoint.diagnostics,
      duplicateEdge.diagnostics,
      missingPort.diagnostics
    );
    expect(new Set(diagnostics.map((diagnostic) => diagnostic.code))).toEqual(new Set([
      "renderer.scene.journey_map_duplicate_edge_id",
      "renderer.scene.journey_map_disconnected_chain",
      "renderer.routing.journey_map_edge_duplicated",
      "renderer.routing.journey_map_edge_omitted",
      "renderer.routing.journey_map_unresolved_endpoint"
    ]));
    await expectRendererStageSnapshot(
      "journey-map.degraded.structural.diagnostics.json",
      diagnostics
    );
  });

  it("locks constructed geometry failures", async () => {
    const { rendered } = await buildFixture("primary");
    const positioned = rendered.preRoutingPositionedScene;
    const measured = rendered.measuredScene;
    const base = rendered.routingStages.connectorPlans.find((plan) =>
      plan.from === "J-204" && plan.to === "J-401"
    )!;
    const routeVia = (x: number, y: number): JourneyMapConnectorPlan => {
      const candidate = structuredClone(base) as JourneyMapConnectorPlan;
      candidate.finalBasicRoute.points = [
        { ...candidate.sourceEndpoint },
        { x: candidate.sourceEndpoint.x, y },
        { x, y },
        { x, y: candidate.targetEndpoint.y },
        { ...candidate.targetEndpoint }
      ];
      return candidate;
    };

    const diagonal = structuredClone(base) as JourneyMapConnectorPlan;
    diagonal.finalBasicRoute.points = [
      { ...diagonal.sourceEndpoint },
      { x: diagonal.sourceEndpoint.x + 7, y: diagonal.sourceEndpoint.y + 5 },
      { ...diagonal.targetEndpoint }
    ];

    const unrelatedNode = findNode(positioned, "J-250");
    const throughNode = routeVia(
      unrelatedNode.x + unrelatedNode.width / 2,
      unrelatedNode.y + unrelatedNode.height / 2
    );
    const unrelatedStage = findContainer(positioned, "G-300");
    const throughStageHeader = routeVia(
      unrelatedStage.x + unrelatedStage.width / 2,
      unrelatedStage.y + (unrelatedStage.chrome.headerBandHeight ?? 0) / 2
    );
    const secondaryNode = findNode(positioned, "J-201");
    const secondaryContent = secondaryNode.content.find((block) => block.region === "secondary")!;
    const throughSecondaryContent = routeVia(
      secondaryNode.x + secondaryContent.x + secondaryContent.width / 2,
      secondaryNode.y + secondaryContent.y + secondaryContent.height / 2
    );
    const empty = structuredClone(base) as JourneyMapConnectorPlan;
    empty.finalBasicRoute.points = [];

    const validate = (plan: JourneyMapConnectorPlan) => validateJourneyMapBasicRoutes(
      [plan],
      positioned,
      "final_basic",
      measured
    );
    const diagnostics = canonicalDiagnostics(
      validate(diagonal),
      validate(throughNode),
      validate(throughStageHeader),
      validate(throughSecondaryContent),
      validate(empty)
    );
    const codes = new Set(diagnostics.map((diagnostic) => diagnostic.code));
    for (const code of [
      "renderer.routing.journey_map_non_orthogonal_route",
      "renderer.routing.journey_map_node_intersection",
      "renderer.routing.journey_map_endpoint_intrusion",
      "renderer.routing.journey_map_stage_header_intersection",
      "renderer.routing.journey_map_secondary_content_intersection",
      "renderer.routing.journey_map_unrelated_stage_intersection"
    ]) {
      expect(codes.has(code), code).toBe(true);
    }
    await expectRendererStageSnapshot(
      "journey-map.degraded.geometry.diagnostics.json",
      diagnostics
    );
  });

  it("locks constructed capacity, fallback, marker, and residual-crossing diagnostics", async () => {
    const primary = await buildFixture("primary");
    const longPlan = primary.rendered.routingStages.connectorPlans.find((plan) =>
      plan.from === "J-204" && plan.to === "J-401"
    )!;
    const malformedGate = structuredClone(longPlan) as JourneyMapConnectorPlan;
    malformedGate.stageGates[0]!.side = "east";
    const malformedControls = structuredClone(longPlan) as JourneyMapConnectorPlan;
    malformedControls.rootOuterBypass!.obstacleControls[0]!.entryX += 1;
    const empty = structuredClone(longPlan) as JourneyMapConnectorPlan;
    empty.finalBasicRoute.points = [];

    const request = {
      kind: "root_outer_gutter" as const,
      ownerContainerId: "root",
      amount: JOURNEY_MAP_TRACK_SEPARATION
    };
    const expansionDiagnostics = validateJourneyMapExpansionBound(
      Array.from({ length: 4 }, (_, index) => ({ attempt: index + 1, requests: [request] })),
      [request]
    );

    const compressed = await buildFixture("compressed");
    const separation = structuredClone(
      compressed.rendered.routingStages
    ) as JourneyMapRoutingStages;
    const directPlan = separation.connectorPlans.find((plan) =>
      plan.from === "J-903" && plan.to === "J-950"
    )!;
    const directState = separation.resolvedConnectors.find((state) =>
      state.connectorId === directPlan.id
    )!;
    directState.finalRoute.points[1]!.x = 938;
    directState.finalRoute.points[2]!.x = 938;
    directState.segmentCoordinates[1]!.resolvedCoordinate = 938;
    separation.finalPositionedScene.edges.find((edge) => edge.id === directPlan.id)!.route =
      structuredClone(directState.finalRoute);
    const separationDiagnostics = validateJourneyMapResolvedStages(
      separation.connectorPlans,
      separation.nominalOccupancy,
      separation.occupancy,
      separation.resolvedConnectors,
      separation.expansionAttempts,
      compressed.rendered.preRoutingPositionedScene,
      separation.finalPositionedScene
    );
    const residualCrossingDiagnostic = compressed.rendered.routingStages.diagnostics.find(
      (diagnostic) => diagnostic.code === "renderer.routing.journey_map_unavoidable_crossing"
    );
    const preferredLegDiagnostic = compressed.rendered.routingStages.diagnostics.find(
      (diagnostic) =>
        diagnostic.code === "renderer.routing.journey_map_preferred_terminal_leg_unmet"
    );
    expect(residualCrossingDiagnostic).toBeDefined();
    expect(preferredLegDiagnostic).toBeDefined();

    const diagnostics = canonicalDiagnostics(
      validateJourneyMapRoutes(
        [malformedGate],
        primary.rendered.preRoutingPositionedScene,
        "provisional",
        primary.rendered.measuredScene
      ),
      validateJourneyMapRoutes(
        [malformedControls],
        primary.rendered.preRoutingPositionedScene,
        "provisional",
        primary.rendered.measuredScene
      ),
      validateJourneyMapBasicRoutes(
        [empty],
        primary.rendered.preRoutingPositionedScene,
        "final_basic",
        primary.rendered.measuredScene
      ),
      expansionDiagnostics,
      separationDiagnostics,
      [residualCrossingDiagnostic!],
      [preferredLegDiagnostic!]
    );
    const codes = new Set(diagnostics.map((diagnostic) => diagnostic.code));
    for (const code of [
      "renderer.routing.journey_map_archetype_fallback",
      "renderer.routing.journey_map_boundary_gate_fallback",
      "renderer.routing.journey_map_gutter_expansion_exhausted",
      "renderer.routing.journey_map_track_separation_unmet",
      "renderer.routing.journey_map_unavoidable_crossing",
      "renderer.routing.journey_map_preferred_terminal_leg_unmet",
      "renderer.routing.marker_leg_minimum_unmet"
    ]) {
      expect(codes.has(code), code).toBe(true);
    }
    await expectRendererStageSnapshot(
      "journey-map.degraded.capacity.diagnostics.json",
      diagnostics
    );
  }, 10_000);
});
