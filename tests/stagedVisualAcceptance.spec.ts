import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectEdgeLabelBoxes,
  collectHeaderBoxes,
  collectVisibleItemBoxes,
  expectLabelsDoNotOverlapEachOther,
  expectLabelsDoNotOverlapHeaders,
  expectLabelsDoNotOverlapBoxes,
  expectLabelsHaveMinimumBoxClearance,
  expectNoForbiddenDiagnostics,
  expectNoRouteIntersectionsWithNonEndpointBoxes,
  expectRoutesDoNotEnterEndpointBoxes,
  expectRoutesDoNotCrossLabels,
  expectSameOrientationSegmentsSeparated,
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

const SCENARIO_FLOW_FORBIDDEN_DIAGNOSTICS = [
  "renderer.routing.scenario_flow_unresolved_port",
  "renderer.routing.unresolved_port",
  "renderer.routing.scenario_flow_node_intersection",
  "renderer.routing.scenario_flow_label_fallback",
  "renderer.routing.scenario_flow_edge_label_omitted",
  "renderer.routing.scenario_flow_edge_label_fallback"
] as const;
const SCENARIO_FLOW_LABEL_CLEARANCE = 12;

function getVisibleNodeBoxes(root: Awaited<ReturnType<typeof renderStagedArtifacts>>["positionedScene"]["root"]) {
  return collectVisibleItemBoxes(root).filter((box) => {
    const item = findPositionedItem(root, box.itemId);
    return item.kind === "node";
  });
}

function expectIaLocalStructureRoute(edge: ReturnType<typeof getEdgeById>): void {
  if (edge.classes.includes("direct_vertical")) {
    expect(edge.route.points).toHaveLength(2);
    const segment = getTerminalSegment(edge);
    expect(segment.start.x).toBe(segment.end.x);
    expect(edge.to.portId).toBe("north_chain");
    expect(getTerminalSegmentLength(edge)).toBeGreaterThanOrEqual(20);
    return;
  }

  if (edge.classes.includes("shared_trunk")) {
    expect(edge.route.points).toHaveLength(3);
    expect(edge.route.points[0]?.x).toBe(edge.route.points[1]?.x);
    expect(edge.route.points[1]?.y).toBe(edge.route.points[2]?.y);
    expect(edge.to.portId).toBe("west");
    const bend = getPenultimatePoint(edge);
    expect(bend.y).toBe(edge.to.y);
    const segment = getTerminalSegment(edge);
    expect(segment.start.y).toBe(segment.end.y);
    expect(getTerminalSegmentLength(edge)).toBeGreaterThanOrEqual(20);
    return;
  }

  throw new Error(`Expected IA local-structure route classes on "${edge.id}".`);
}

describe("staged visual acceptance", () => {
  it("keeps target ia_place_map artifacts free of fallback diagnostics, node-crossing routes, and weak target approaches", async () => {
    const cases = [
      {
        sourcePath: path.join(repoRoot, "real_world_exploration/billSage_example/billSage_structure.sdd"),
        outputArtifactPath: path.join(
          repoRoot,
          "real_world_exploration/billSage_example/reference/billSage_structure.ia_place_map.strict.bottomToLeft_connectors.reference.png"
        ),
        profileId: "strict"
      },
      {
        sourcePath: path.join(repoRoot, "bundle/v0.1/examples/outcome_to_ia_trace.sdd"),
        outputArtifactPath: path.join(repoRoot, "examples/rendered/v0.1/ia_place_map_diagram_type/outcome_to_ia_trace_example/strict_profile/outcome_to_ia_trace.ia_place_map.png"),
        profileId: "strict"
      },
      {
        sourcePath: path.join(repoRoot, "bundle/v0.1/examples/place_viewstate_transition.sdd"),
        outputArtifactPath: path.join(repoRoot, "examples/rendered/v0.1/ia_place_map_diagram_type/place_viewstate_transition_example/strict_profile/place_viewstate_transition.ia_place_map.png"),
        profileId: "strict"
      }
    ] as const;

    for (const testCase of cases) {
      const rendered = await renderStagedArtifacts(testCase.sourcePath, "ia_place_map", testCase.profileId);
      expect(rendered.positionedScene.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expectNoForbiddenDiagnostics(rendered.positionedScene.diagnostics, FORBIDDEN_DIAGNOSTICS);

      const localStructureEdges = rendered.positionedScene.edges.filter((edge) => edge.classes.includes("ia_local_structure"));
      expect(localStructureEdges.length).toBeGreaterThan(0);
      expectNoRouteIntersectionsWithNonEndpointBoxes(localStructureEdges, getVisibleNodeBoxes(rendered.positionedScene.root));
      for (const edge of localStructureEdges) {
        expectIaLocalStructureRoute(edge);
      }

      expect(testCase.outputArtifactPath).toContain(".png");
    }
  });

  it("keeps target ui_contracts support-edge labels clear of headers, node boxes, each other, and route overlap", async () => {
    const cases = [
      {
        sourcePath: path.join(repoRoot, "bundle/v0.1/examples/place_viewstate_transition.sdd"),
        outputArtifactPath: path.join(repoRoot, "examples/rendered/v0.1/ui_contracts_diagram_type/place_viewstate_transition_example/strict_profile/place_viewstate_transition.ui_contracts.png")
      },
      {
        sourcePath: path.join(repoRoot, "bundle/v0.1/examples/ui_state_fallback.sdd"),
        outputArtifactPath: path.join(repoRoot, "examples/rendered/v0.1/ui_contracts_diagram_type/ui_state_fallback_example/strict_profile/ui_state_fallback.ui_contracts.png")
      }
    ] as const;

    for (const testCase of cases) {
      const rendered = await renderStagedArtifacts(testCase.sourcePath, "ui_contracts", "strict");
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

  it("keeps the scenario_flow proof case free of forbidden diagnostics, node-crossing routes, and label collisions", async () => {
    const rendered = await renderStagedArtifacts(
      path.join(repoRoot, "bundle/v0.1/examples/scenario_branching.sdd"),
      "scenario_flow",
      "strict"
    );

    expect(rendered.positionedScene.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expectNoForbiddenDiagnostics(rendered.positionedScene.diagnostics, SCENARIO_FLOW_FORBIDDEN_DIAGNOSTICS);

    const semanticEdges = rendered.positionedScene.edges.filter((edge) =>
      edge.classes.includes("scenario_flow_semantic_edge")
    );
    expect(semanticEdges.length).toBeGreaterThan(0);

    const nodeBoxes = getVisibleNodeBoxes(rendered.positionedScene.root);
    const labelBoxes = collectEdgeLabelBoxes(semanticEdges);

    expect(labelBoxes.map((label) => label.edgeId)).toEqual([
      "J-030__precedes__J-031",
      "J-030__precedes__J-032",
      "J-033__precedes__J-034",
      "J-033__precedes__J-035"
    ]);
    expectNoRouteIntersectionsWithNonEndpointBoxes(semanticEdges, nodeBoxes);
    expectRoutesDoNotEnterEndpointBoxes(semanticEdges, nodeBoxes);
    expectSameOrientationSegmentsSeparated(semanticEdges);
    expectLabelsDoNotOverlapBoxes(labelBoxes, nodeBoxes);
    expectLabelsHaveMinimumBoxClearance(labelBoxes, nodeBoxes, SCENARIO_FLOW_LABEL_CLEARANCE);
    expectLabelsDoNotOverlapEachOther(labelBoxes);
    expectRoutesDoNotCrossLabels(semanticEdges, labelBoxes);
  });
});
