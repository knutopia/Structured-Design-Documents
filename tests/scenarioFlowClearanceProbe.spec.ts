import { readFile, writeFile } from "node:fs/promises";
import { it, vi } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { renderScenarioFlowStagedSvg } from "../src/renderer/staged/scenarioFlow.js";
import * as core from "../src/renderer/staged/routingCore/index.js";

function nearNodes(context: core.FinalRoutingContext) {
  return context.connectors.flatMap(c => c.route.points.slice(1).flatMap((end, i) => {
    const start = c.route.points[i]!;
    return context.boxes.flatMap(b => {
      if ((b.id === c.source.nodeId && i === 0) || (b.id === c.target.nodeId && i === c.route.points.length - 2)) return [];
      const dx = Math.max(b.x - Math.max(start.x, end.x), Math.min(start.x, end.x) - b.x - b.width, 0);
      const dy = Math.max(b.y - Math.max(start.y, end.y), Math.min(start.y, end.y) - b.y - b.height, 0);
      const gap = Math.max(dx, dy);
      return gap < 17.5 ? [{ edge: c.id, node: b.id, i, gap, start, end }] : [];
    });
  }));
}

it("traces Scenario clearance across final routing", async () => {
  const bundle = await loadBundle("bundle/v0.1/manifest.yaml");
  const file = "docs/sdd_app_planning/whiteboarding_diagrams/tmp.sdd";
  const graph = compileSource({ path: file, text: await readFile(file, "utf8") }, bundle).graph!;
  const projection = projectView(graph, bundle, "scenario_flow").projection!;
  const view = bundle.views.views.find(v => v.id === "scenario_flow")!;
  const actual = core.runRoutingLifecycle;
  for (const mode of ["before-placement", "transition-placement"]) {
    const selected = structuredClone(view);
    if (mode === "before-placement") selected.conventions.renderer_defaults!.scenario_flow_layout!.secondary_placement.edge_types = [];
    let initial!: core.FinalRoutingContext;
    let resolution!: core.FinalRoutingResult;
    const spy = vi.spyOn(core, "runRoutingLifecycle").mockImplementation((context, options) => {
      initial = structuredClone(context);
      resolution = actual(context, options);
      return resolution;
    });
    try {
      const rendered = await renderScenarioFlowStagedSvg(projection, graph, selected, { detailId: "detailed", nodeDecoratorMode: { id: "type,id", showNodeType: true, showNodeId: true } });
      const final = resolution.status === "resolved" ? resolution.context : { ...initial, connectors: resolution.debugConnectors };
      const report = { mode, status: resolution.status, trace: resolution.trace, before: nearNodes(initial), after: nearNodes(final), diagnostics: rendered.diagnostics.filter(d => d.severity === "error") };
      await writeFile(`/tmp/scenario-clearance-${mode}.json`, JSON.stringify({ report, initial, final }, null, 2));
      console.log(JSON.stringify(report));
    } finally { spy.mockRestore(); }
  }
}, 120000);
