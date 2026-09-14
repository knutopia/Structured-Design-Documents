import { afterEach, describe, expect, it, vi } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { renderOutcomeOpportunityMapStagedSvg } from "../src/renderer/staged/outcomeOpportunityMap.js";
import { registerRendererTheme, resolveRendererTheme } from "../src/renderer/staged/theme.js";
import * as core from "../src/renderer/staged/routingCore/index.js";
import { independentParallelConflicts } from "./routingHardeningOracle.js";
import { routeIntersectsRect } from "./stagedVisualHarness.js";

async function renderWithArrowSize(arrowSize: number) {
  const bundle = await loadBundle("bundle/v0.1/manifest.yaml");
  const graph = compileSource({ path: "outcome-expansion.sdd", text: `SDD-TEXT 0.1
Opportunity OP-100 "Useful opportunity"
END
Initiative I-100 "Useful initiative"
  ADDRESSES OP-100 "Useful opportunity"
END
` }, bundle).graph!;
  const projection = projectView(graph, bundle, "outcome_opportunity_map").projection!;
  const view = bundle.views.views.find(candidate => candidate.id === "outcome_opportunity_map")!;
  const theme = structuredClone(resolveRendererTheme("default").theme);
  theme.id = `outcome-expansion-arrow-${arrowSize}`;
  theme.paint.arrowSize = arrowSize;
  registerRendererTheme(theme);
  return renderOutcomeOpportunityMapStagedSvg(projection, graph, view, { themeId: theme.id, detailId: "compact", nodeDecoratorMode: { id: "none", showNodeType: false, showNodeId: false } });
}

afterEach(() => vi.restoreAllMocks());

describe("Outcome final-validation expansion owner", () => {
  it("expands a real undersized marker gap from the stable layout and accepts rebuilt geometry", async () => {
    const spy = vi.spyOn(core, "runRoutingLifecycle");
    const result = await renderWithArrowSize(240);
    const initial = spy.mock.calls[0]![0];
    const resolution = spy.mock.results[0]!.value as core.FinalRoutingResult;
    expect(core.validateFinalRouteSet(initial).some(violation => violation.kind === "terminal_leg_too_short")).toBe(true);
    expect(resolution.status, JSON.stringify({ resolution, policy: initial.policy, gutter: result.routingStages.globalGutterState })).toBe("resolved");
    if (resolution.status !== "resolved") throw new Error(JSON.stringify(resolution));
    expect(resolution.trace.expansionPasses).toBeGreaterThan(0);
    expect(result.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
    expect(core.validateFinalRouteSet(resolution.context)).toEqual([]);
    expect(independentParallelConflicts(resolution.context.connectors)).toBe(0);
    for (const connector of resolution.context.connectors) {
      const points = connector.route.points;
      expect(points[0]).toEqual(connector.source.point);
      expect(points.at(-1)).toEqual(connector.target.point);
      const end = points.at(-1)!, before = points.at(-2)!;
      expect(Math.abs(end.x - before.x) + Math.abs(end.y - before.y)).toBeGreaterThanOrEqual(connector.target.minLeg - 0.5);
      for (const box of resolution.context.boxes) expect(routeIntersectsRect(connector.route, box)).toBe(false);
    }
    const prepExpansions = 4 - initial.policy!.maxExpansionPasses!;
    expect(prepExpansions + resolution.trace.expansionPasses).toBeLessThanOrEqual(4);
    expect(resolution.context.bounds.maxX).toBeGreaterThan(initial.bounds.maxX);
    // The adapter's emitted scene is the accepted geometry revision, not the pre-expansion context.
    expect(result.positionedScene.root.width).toBe(resolution.context.bounds.maxX - resolution.context.bounds.minX);
    const again = await renderWithArrowSize(240);
    expect(again.positionedScene).toEqual(result.positionedScene);
    expect(again.routingStages.globalGutterState).toEqual(result.routingStages.globalGutterState);
  });
});
