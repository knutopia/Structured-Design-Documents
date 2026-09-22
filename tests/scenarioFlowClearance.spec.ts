import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { renderScenarioFlowStagedSvg } from "../src/renderer/staged/scenarioFlow.js";
import * as core from "../src/renderer/staged/routingCore/index.js";
import { independentParallelConflicts } from "./routingHardeningOracle.js";

afterEach(() => vi.restoreAllMocks());

describe("Scenario transition placement retains obstacle clearance through repair", () => {
  for (const detailId of ["compact", "detailed"]) for (const mode of ["none", "type", "id", "type,id"]) {
    it(`${detailId}/${mode}`, async () => {
      const bundle = await loadBundle("bundle/v0.1/manifest.yaml");
      const path = "tests/fixtures/render/scenario_transition_clearance.sdd";
      const graph = compileSource({ path, text: await readFile(path, "utf8") }, bundle).graph!;
      const projection = projectView(graph, bundle, "scenario_flow").projection!;
      const view = bundle.views.views.find(v => v.id === "scenario_flow")!;
      const spy = vi.spyOn(core, "runRoutingLifecycle");
      const rendered = await renderScenarioFlowStagedSvg(projection, graph, view, {
        detailId, nodeDecoratorMode: { id: mode, showNodeType: mode.includes("type"), showNodeId: mode.includes("id") }
      });
      expect(rendered.diagnostics.filter(d => d.severity === "error")).toEqual([]);
      const result = spy.mock.results.at(-1)!.value as core.FinalRoutingResult;
      expect(result.status).toBe("resolved");
      if (result.status !== "resolved") throw new Error(result.reason);
      const edges = new Map(rendered.positionedScene.edges.map(e => [e.id, e]));
      const emitted = { ...result.context, connectors: result.context.connectors.map(c => ({ ...c, route: edges.get(c.id)!.route })) };
      expect(core.validateFinalRouteSet(emitted)).toEqual([]);
      expect(independentParallelConflicts(emitted.connectors)).toBe(0);
      // Independent rectangle-distance oracle, including nonincident runs beside
      // their own endpoint nodes. The attachment leg is the only exception.
      for (const c of emitted.connectors) for (let i = 0; i < c.route.points.length - 1; i++) {
        const a = c.route.points[i]!, b = c.route.points[i + 1]!;
        for (const box of emitted.boxes) {
          if (box.id === c.source.nodeId && i === 0 || box.id === c.target.nodeId && i === c.route.points.length - 2) continue;
          const dx = Math.max(box.x - Math.max(a.x, b.x), Math.min(a.x, b.x) - box.x - box.width, 0);
          const dy = Math.max(box.y - Math.max(a.y, b.y), Math.min(a.y, b.y) - box.y - box.height, 0);
          expect(Math.max(dx, dy), `${c.id}/${i}/${box.id}`).toBeGreaterThanOrEqual(15.5);
        }
      }
      const placements = new Map(rendered.middleLayer.placements.map(p => [p.nodeId, p]));
      expect(placements.get("VS-060")!.bandId).toBe("band:3");
      expect(placements.get("VS-004")!.bandId).toBe("band:5");
    });
  }
});
