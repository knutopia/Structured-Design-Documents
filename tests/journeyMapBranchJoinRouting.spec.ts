import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type { PositionedNode } from "../src/renderer/staged/contracts.js";
import { renderJourneyMapRoutingArtifacts } from "../src/renderer/staged/journeyMap.js";
import { renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import {
  expectNoRouteIntersectionsWithNonEndpointBoxes,
  expectRoutesDoNotEnterEndpointBoxes,
  expectSameOrientationSegmentsSeparated,
  flattenPositionedItems
} from "./stagedVisualHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const bundlePromise = loadBundle(manifestPath);

type EdgePair = readonly [from: string, to: string];

function inlineJourneySource(
  stepIds: readonly string[],
  edges: readonly EdgePair[],
  contained = true
): string {
  const outgoing = new Map<string, string[]>();
  for (const [from, to] of edges) {
    outgoing.set(from, [...(outgoing.get(from) ?? []), to]);
  }
  const stepBlock = (stepId: string): string => {
    const outerIndent = contained ? "  " : "";
    const propertyIndent = contained ? "    " : "  ";
    return [
      `${outerIndent}${contained ? "+ " : ""}Step ${stepId} "${stepId}"`,
      `${propertyIndent}owner=Product`,
      `${propertyIndent}description="Complete ${stepId}"`,
      `${propertyIndent}actor=Customer`,
      `${propertyIndent}intent="Continue the journey"`,
      `${propertyIndent}success_criteria="${stepId} is complete"`,
      ...(outgoing.get(stepId) ?? []).map((targetId) =>
        `${propertyIndent}PRECEDES ${targetId} "${targetId}"`),
      `${outerIndent}END`
    ].join("\n");
  };
  if (!contained) {
    return ["SDD-TEXT 0.1", ...stepIds.map(stepBlock)].join("\n\n");
  }
  return [
    "SDD-TEXT 0.1",
    "Stage G-100 \"Journey\"",
    "  owner=Product",
    "  description=\"Complete a branching journey\"",
    "  order_index=10",
    ...stepIds.map((stepId) => `  CONTAINS ${stepId} "${stepId}"`),
    "",
    ...stepIds.flatMap((stepId) => [stepBlock(stepId), ""]),
    "END"
  ].join("\n");
}

async function renderInline(
  name: string,
  stepIds: readonly string[],
  edges: readonly EdgePair[],
  detailId: "compact" | "detailed" = "compact",
  contained = true
) {
  const bundle = await bundlePromise;
  const source = inlineJourneySource(stepIds, edges, contained);
  const compiled = compileSource({ path: `${name}.sdd`, text: source }, bundle);
  expect(compiled.diagnostics).toEqual([]);
  expect(compiled.graph).toBeDefined();
  const projected = projectView(compiled.graph!, bundle, "journey_map");
  expect(projected.diagnostics).toEqual([]);
  expect(projected.projection).toBeDefined();
  const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
  expect(view).toBeDefined();
  return renderJourneyMapRoutingArtifacts(
    projected.projection!,
    compiled.graph!,
    bundle,
    view!,
    { detailId }
  );
}

function expectCleanBranchRouting(
  rendered: Awaited<ReturnType<typeof renderInline>>
): void {
  const scene = rendered.routingStages.finalPositionedScene;
  const nodes = flattenPositionedItems(scene.root)
    .filter((item): item is PositionedNode => item.kind === "node");
  const nodeBoxes = nodes.map((node) => ({
    itemId: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height
  }));
  expectNoRouteIntersectionsWithNonEndpointBoxes(scene.edges, nodeBoxes);
  expectRoutesDoNotEnterEndpointBoxes(scene.edges, nodeBoxes);
  expectSameOrientationSegmentsSeparated(scene.edges);
  expect(rendered.routingStages.failedConnectorIds).toEqual([]);
  expect(rendered.routingStages.residualCrossings).toEqual([]);
  expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity !== "info")).toEqual([]);
}

function planFor(
  rendered: Awaited<ReturnType<typeof renderInline>>,
  from: string,
  to: string
) {
  return rendered.routingStages.connectorPlans.find((plan) => plan.from === from && plan.to === to);
}

describe("journey-map branch-join lineage routing", () => {
  it.each(["compact", "detailed"] as const)(
    "routes three unequal arms through ordered pre-join tracks in %s detail",
    async (detailId) => {
      const stepIds = [
        "J-100", "J-110", "J-111", "J-112", "J-120",
        "J-121", "J-130", "J-131", "J-190"
      ];
      const edges: EdgePair[] = [
        ["J-100", "J-110"], ["J-100", "J-120"], ["J-100", "J-130"],
        ["J-110", "J-111"], ["J-111", "J-112"], ["J-112", "J-190"],
        ["J-120", "J-121"], ["J-121", "J-190"],
        ["J-130", "J-131"], ["J-131", "J-190"]
      ];
      const rendered = await renderInline("three-unequal-arms", stepIds, edges, detailId);
      const canonical = planFor(rendered, "J-112", "J-190")!;
      const returns = [
        planFor(rendered, "J-121", "J-190")!,
        planFor(rendered, "J-131", "J-190")!
      ];

      expect(canonical.routeFamily).toBe("direct_horizontal");
      expect(canonical.finalBasicRoute.points).toHaveLength(2);
      expect(returns.map((plan) => plan.routeFamily)).toEqual([
        "branch_join_return",
        "branch_join_return"
      ]);
      expect(returns.map((plan) => plan.branchJoinCorridor?.armOrdinal)).toEqual([1, 2]);
      expect(returns.map((plan) => plan.branchJoinCorridor?.nominalCoordinate)).toEqual(
        [...returns.map((plan) => plan.branchJoinCorridor!.nominalCoordinate)]
          .sort((left, right) => left - right)
      );
      expect(returns.map((plan) => plan.targetEndpoint.y)).toEqual(
        [...returns.map((plan) => plan.targetEndpoint.y)].sort((left, right) => left - right)
      );
      expect(rendered.routingStages.nominalOccupancy.filter((record) =>
        record.resource.kind === "branch_join_track")).toHaveLength(2);
      expectCleanBranchRouting(rendered);

      const firstSvg = await renderPositionedSceneToSvg(rendered.routingStages.finalPositionedScene);
      const repeated = await renderInline("three-unequal-arms", stepIds, edges, detailId);
      const secondSvg = await renderPositionedSceneToSvg(repeated.routingStages.finalPositionedScene);
      expect(secondSvg.svg).toBe(firstSvg.svg);
    }
  );

  it("returns nested joins to the correct parent lineage and expands the outer join gap", async () => {
    const rendered = await renderInline(
      "nested-joins",
      ["J-200", "J-210", "J-220", "J-221", "J-222", "J-223", "J-290"],
      [
        ["J-200", "J-210"], ["J-200", "J-220"],
        ["J-210", "J-290"],
        ["J-220", "J-221"], ["J-220", "J-222"],
        ["J-221", "J-223"], ["J-222", "J-223"],
        ["J-223", "J-290"]
      ]
    );
    const outerCanonical = planFor(rendered, "J-210", "J-290")!;
    const innerReturn = planFor(rendered, "J-222", "J-223")!;
    const outerReturn = planFor(rendered, "J-223", "J-290")!;
    const outerReturnSceneEdge = rendered.rendererScene.edges.find((edge) =>
      edge.from.itemId === "J-223" && edge.to.itemId === "J-290")!;
    const rendererRootMetadata = rendered.rendererScene.root.viewMetadata?.journeyMap;
    const measuredRootMetadata = rendered.measuredScene.root.viewMetadata?.journeyMap;
    const positionedRootMetadata = rendered.routingStages.finalPositionedScene.root
      .viewMetadata?.journeyMap;

    expect(outerCanonical.routeFamily).toBe("direct_horizontal");
    expect(innerReturn.routeFamily).toBe("minimal_l");
    expect(outerReturn.routeFamily).toBe("branch_join_return");
    expect(outerReturn.branchGroupId).not.toBe(innerReturn.branchGroupId);
    expect(outerReturnSceneEdge.viewMetadata?.journeyMap).toMatchObject({
      branchRouteRole: "join_return",
      branchArmOrdinal: 1,
      sourceLineageId: "G-100__lineage__1",
      targetLineageId: "G-100__lineage__entry"
    });
    expect(rendererRootMetadata?.kind).toBe("root");
    expect(measuredRootMetadata?.kind).toBe("root");
    expect(positionedRootMetadata?.kind).toBe("root");
    if (rendererRootMetadata?.kind === "root"
      && measuredRootMetadata?.kind === "root"
      && positionedRootMetadata?.kind === "root") {
      expect(rendererRootMetadata.branchGroups).toEqual(measuredRootMetadata.branchGroups);
      expect(rendererRootMetadata.branchGroups).not.toBe(measuredRootMetadata.branchGroups);
      expect(rendererRootMetadata.branchGroups?.[0]?.arms).not.toBe(
        measuredRootMetadata.branchGroups?.[0]?.arms
      );
      expect(measuredRootMetadata.branchLineages).toEqual(positionedRootMetadata.branchLineages);
      expect(measuredRootMetadata.branchLineages).not.toBe(positionedRootMetadata.branchLineages);
      expect(positionedRootMetadata.branchGroups).toEqual(expect.arrayContaining([
        expect.objectContaining({
          splitStepId: "J-200",
          joinStepId: "J-290",
          entryLineageId: "G-100__lineage__entry",
          returnLineageId: "G-100__lineage__entry",
          arms: expect.arrayContaining([
            expect.objectContaining({ ordinal: 0, branchPath: [] }),
            expect.objectContaining({ ordinal: 1, branchPath: [1] })
          ])
        })
      ]));
    }
    expect(rendered.routingStages.expansionAttempts).toEqual([
      expect.objectContaining({
        attempt: 1,
        requests: [expect.objectContaining({ kind: "stage_progression_gap" })]
      })
    ]);
    expectCleanBranchRouting(rendered);
  });

  it("routes sequential generic joins independently", async () => {
    const rendered = await renderInline(
      "sequential-joins",
      ["J-300", "J-310", "J-320", "J-390", "J-400", "J-410", "J-490"],
      [
        ["J-300", "J-310"], ["J-300", "J-320"],
        ["J-310", "J-390"], ["J-320", "J-390"],
        ["J-390", "J-400"], ["J-390", "J-410"],
        ["J-400", "J-490"], ["J-410", "J-490"]
      ],
      "detailed"
    );
    expect(rendered.routingStages.connectorPlans.filter((plan) =>
      plan.routeFamily === "branch_join_return")).toHaveLength(2);
    expect(new Set(rendered.routingStages.connectorPlans.flatMap((plan) =>
      plan.branchJoinCorridor ? [plan.branchJoinCorridor.branchGroupId] : []
    )).size).toBe(2);
    expectCleanBranchRouting(rendered);
  });

  it("supports a root-level two-way join without inventing a diagram instance", async () => {
    const rendered = await renderInline(
      "root-level-join",
      ["J-500", "J-510", "J-520", "J-590"],
      [
        ["J-500", "J-510"], ["J-500", "J-520"],
        ["J-510", "J-590"], ["J-520", "J-590"]
      ],
      "compact",
      false
    );
    expect(planFor(rendered, "J-510", "J-590")?.routeFamily).toBe("direct_horizontal");
    expect(planFor(rendered, "J-520", "J-590")?.routeFamily).toBe("branch_join_return");
    expect(rendered.rendererScene.root.layout.strategy).toBe("grid");
    expectCleanBranchRouting(rendered);
  });
});
