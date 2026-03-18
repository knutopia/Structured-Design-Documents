import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectEdgeLabelBoxes,
  collectHeaderBoxes,
  collectVisibleItemBoxes,
  expectLabelsDoNotOverlapEachOther,
  expectLabelsDoNotOverlapHeaders,
  expectLabelsDoNotOverlapBoxes,
  expectNoForbiddenDiagnostics,
  expectNoRouteIntersectionsWithNonEndpointBoxes,
  expectRoutesDoNotCrossLabels,
  findPositionedItem,
  getEdgeById,
  getPenultimatePoint,
  getTerminalSegment,
  getTerminalSegmentLength,
  renderStagedArtifacts,
  repoRoot
} from "./stagedVisualHarness.js";

const FORBIDDEN_DIAGNOSTICS = [
  "renderer.routing.ia_branch_elk_layout_rejected",
  "renderer.routing.ia_branch_elk_fixed_fallback",
  "renderer.routing.target_approach_unmet",
  "renderer.routing.edge_label_lane_fallback",
  "renderer.routing.edge_label_segment_fallback"
] as const;

function getVisibleNodeBoxes(root: Awaited<ReturnType<typeof renderStagedArtifacts>>["positionedScene"]["root"]) {
  return collectVisibleItemBoxes(root).filter((box) => {
    const item = findPositionedItem(root, box.itemId);
    return item.kind === "node";
  });
}

function expectVerticalTargetApproach(edge: ReturnType<typeof getEdgeById>): void {
  const segment = getTerminalSegment(edge);
  expect(segment.start.x).toBe(segment.end.x);
  expect(getTerminalSegmentLength(edge)).toBeGreaterThanOrEqual(20);

  const bend = getPenultimatePoint(edge);
  if (edge.to.portId === "north_chain") {
    expect(bend.y).toBeLessThanOrEqual(edge.to.y - 24);
  } else if (edge.to.portId === "south_chain") {
    expect(bend.y).toBeGreaterThanOrEqual(edge.to.y + 24);
  } else {
    throw new Error(`Expected a north/south chain target port for "${edge.id}".`);
  }
}

describe("staged visual acceptance", () => {
  it("keeps target ia_place_map artifacts free of fallback diagnostics, node-crossing routes, and weak target approaches", async () => {
    const cases = [
      {
        sourcePath: path.join(repoRoot, "real_world_exploration/billSage_simple_structure.sdd"),
        outputArtifactPath: path.join(repoRoot, "real_world_exploration/billSage_simple_structure.ia_place_map.simple.png"),
        profileId: "simple"
      },
      {
        sourcePath: path.join(repoRoot, "bundle/v0.1/examples/outcome_to_ia_trace.sdd"),
        outputArtifactPath: path.join(repoRoot, "examples/rendered/v0.1/ia_place_map_diagram_type/outcome_to_ia_trace_example/recommended_profile/outcome_to_ia_trace.ia_place_map.png"),
        profileId: "recommended"
      },
      {
        sourcePath: path.join(repoRoot, "bundle/v0.1/examples/place_viewstate_transition.sdd"),
        outputArtifactPath: path.join(repoRoot, "examples/rendered/v0.1/ia_place_map_diagram_type/place_viewstate_transition_example/recommended_profile/place_viewstate_transition.ia_place_map.png"),
        profileId: "recommended"
      }
    ] as const;

    for (const testCase of cases) {
      const rendered = await renderStagedArtifacts(testCase.sourcePath, "ia_place_map", testCase.profileId);
      expect(rendered.positionedScene.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expectNoForbiddenDiagnostics(rendered.positionedScene.diagnostics, FORBIDDEN_DIAGNOSTICS);

      const sameChainEdges = rendered.positionedScene.edges.filter((edge) => edge.classes.includes("within_chain"));
      expect(sameChainEdges.length).toBeGreaterThan(0);
      expectNoRouteIntersectionsWithNonEndpointBoxes(sameChainEdges, getVisibleNodeBoxes(rendered.positionedScene.root));
      for (const edge of sameChainEdges) {
        expectVerticalTargetApproach(edge);
      }

      expect(testCase.outputArtifactPath).toContain(".png");
    }
  });

  it("keeps target ui_contracts support-edge labels clear of headers, node boxes, each other, and route overlap", async () => {
    const cases = [
      {
        sourcePath: path.join(repoRoot, "bundle/v0.1/examples/place_viewstate_transition.sdd"),
        outputArtifactPath: path.join(repoRoot, "examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/recommended_profile/place_viewstate_transition.ui_contracts.png")
      },
      {
        sourcePath: path.join(repoRoot, "bundle/v0.1/examples/ui_state_fallback.sdd"),
        outputArtifactPath: path.join(repoRoot, "examples/rendered/v0.1/ui_contracts_diagram_type/ui_state_fallback_example/recommended_profile/ui_state_fallback.ui_contracts.png")
      }
    ] as const;

    for (const testCase of cases) {
      const rendered = await renderStagedArtifacts(testCase.sourcePath, "ui_contracts", "recommended");
      expect(rendered.positionedScene.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expectNoForbiddenDiagnostics(rendered.positionedScene.diagnostics, FORBIDDEN_DIAGNOSTICS);

      const supportEdges = rendered.positionedScene.edges.filter((edge) =>
        edge.role === "emits" || edge.role === "depends_on" || edge.role === "binds_to"
      );
      expect(supportEdges.length).toBeGreaterThan(0);

      const headers = collectHeaderBoxes(rendered.positionedScene.root);
      const nodeBoxes = getVisibleNodeBoxes(rendered.positionedScene.root);
      const labelBoxes = collectEdgeLabelBoxes(supportEdges);

      expectLabelsDoNotOverlapHeaders(labelBoxes, headers);
      expectLabelsDoNotOverlapEachOther(labelBoxes);
      expectLabelsDoNotOverlapBoxes(labelBoxes, nodeBoxes);
      expectRoutesDoNotCrossLabels(supportEdges, labelBoxes);
      expectNoRouteIntersectionsWithNonEndpointBoxes(supportEdges, nodeBoxes);

      expect(testCase.outputArtifactPath).toContain(".png");
    }
  });
});
