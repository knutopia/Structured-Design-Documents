import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { renderScenarioFlowStagedSvg } from "../src/renderer/staged/scenarioFlow.js";
import * as core from "../src/renderer/staged/routingCore/index.js";

function routeLength(points: readonly { x: number; y: number }[]): number {
  return points.slice(1).reduce((total, point, index) => total
    + Math.abs(point.x - points[index]!.x) + Math.abs(point.y - points[index]!.y), 0);
}

describe("Scenario Flow optional bottom exits", () => {
  it("shortens the backward View State transition in tmp.sdd without routing regressions", async () => {
    const bundle = await loadBundle("bundle/v0.1/manifest.yaml");
    const path = "docs/sdd_app_planning/whiteboarding_diagrams/tmp.sdd";
    const graph = compileSource({ path, text: await readFile(path, "utf8") }, bundle).graph!;
    const projection = projectView(graph, bundle, "scenario_flow").projection!;
    const view = bundle.views.views.find(candidate => candidate.id === "scenario_flow")!;
    const spy = vi.spyOn(core, "runRoutingLifecycle");
    try {
      const rendered = await renderScenarioFlowStagedSvg(projection, graph, view, {
        detailId: "detailed", nodeDecoratorMode: { id: "type,id", showNodeType: true, showNodeId: true }
      });
      expect(rendered.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
      expect(spy).toHaveBeenCalledTimes(1);
      const result = spy.mock.results[0]!.value as core.FinalRoutingResult;
      expect(result.status).toBe("resolved");
      if (result.status !== "resolved") throw new Error(result.reason);
      const edges = new Map(rendered.positionedScene.edges.map(edge => [edge.id, edge]));
      const transition = edges.get("VS-006__transitions_to__VS-050")!;
      expect(transition.from.portId).toBe("mirror_out_south");
      expect(transition.to.portId).toBe("mirror_in");
      expect(routeLength(transition.route.points)).toBeLessThan(1008);
      expect(rendered.routingStages.gutterOccupancy).toEqual(expect.arrayContaining([
        expect.objectContaining({ connectorId: transition.id, kind: "node_bottom", endpointRole: "source", side: "south" })
      ]));
      expect(rendered.routingStages.gutterOccupancy.some(entry =>
        entry.connectorId === transition.id && entry.endpointRole === "source" && entry.kind === "node_right"
      )).toBe(false);
      // The other leftward route cannot use the same simple bottom corridor;
      // its unchanged right attachment is a deliberate fallback.
      expect(edges.get("VS-006__transitions_to__VS-010")!.from.portId).toBe("mirror_out");
      const downward = edges.get("VS-010__transitions_to__VS-040")!;
      expect(downward.from.portId).toBe("mirror_out_south");
      expect(downward.route.points[1]!.y).toBeGreaterThan(downward.route.points[0]!.y);
      const stepBranch = edges.get("J-040__precedes__J-042")!;
      const realization = edges.get("J-040__realized_by__VS-010")!;
      expect(stepBranch.from.portId).toBe("flow_out_south");
      expect(realization.from.portId).toBe("realization_out");
      expect(Math.abs(stepBranch.from.x - realization.from.x)).toBeGreaterThanOrEqual(16);
      const emitted = { ...result.context, connectors: result.context.connectors.map(connector => ({
        ...connector, route: edges.get(connector.id)!.route
      })) };
      expect(core.validateFinalRouteSet(emitted)).toEqual([]);
      const divider = rendered.positionedScene.decorations.find(decoration =>
        decoration.kind === "line" && decoration.id === "lane-place__separator");
      expect(divider?.kind).toBe("line");
      if (divider?.kind === "line") {
        for (const edge of rendered.positionedScene.edges.filter(edge => edge.classes.includes("edge-channel-view_transition"))) {
          expect(Math.min(...edge.route.points.map(point => point.y)), edge.id)
            .toBeGreaterThanOrEqual(divider.from.y + 15.5);
        }
      }
    } finally {
      spy.mockRestore();
    }
  });
});
