import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { renderUiContractsStagedSvg } from "../src/renderer/staged/uiContracts.js";
import { validateUiContractsRoutes } from "../src/renderer/staged/uiContractsRouting.js";
import { resolveHorizontalSharedY } from "../src/renderer/staged/routingCore/optimization.js";

const fixture = `SDD-TEXT 0.1
ViewState UX-100 "Source"
  TRANSITIONS_TO UX-110 "Right"
  TRANSITIONS_TO UX-120 "Down"
END
ViewState UX-110 "Right"
END
ViewState UX-120 "Down"
  TRANSITIONS_TO UX-100 "Return"
END
`;

async function render() {
  const bundle = await loadBundle("bundle/v0.1/manifest.yaml");
  const compiled = compileSource({ path: "/tmp/ui-contract-routing-optimization.sdd", text: fixture }, bundle);
  expect(compiled.diagnostics).toEqual([]);
  const graph = compiled.graph!;
  const view = bundle.views.views.find((candidate) => candidate.id === "ui_contracts")!;
  const projection = projectView(graph, bundle, view.id).projection!;
  return renderUiContractsStagedSvg(projection, graph, view, { detailId: "detailed" });
}

function findEdge(edges: readonly { id: string }[], from: string, to: string) {
  return edges.find((edge) => edge.id.includes("%5B%22" + from + "%22%2C%22TRANSITIONS_TO%22%2C%22" + to));
}

describe("UI Contracts routing optimization", () => {
  it("aligns a fan-out singleton horizontally and selects a safe bottom exit", async () => {
    const rendered = await render();
    const right = findEdge(rendered.positionedScene.edges, "UX-100", "UX-110");
    const down = findEdge(rendered.positionedScene.edges, "UX-100", "UX-120");
    expect(right).toBeDefined();
    expect(down).toBeDefined();
    if (!right || !down) throw new Error("Expected optimized transition edges.");
    expect(right.route.points).toHaveLength(2);
    expect(right.route.points[0]!.y).toBe(right.route.points[1]!.y);
    expect(right.from.portId).toContain(":east:0");
    expect(right.to.portId).toBe("west");
    expect(down.from.portId).toBe("south");
    expect(down.route.points).toHaveLength(3);
    expect(down.route.points[0]!.x).toBe(down.route.points[1]!.x);
    expect(down.route.points[1]!.y).toBe(down.route.points[2]!.y);
    expect(validateUiContractsRoutes(rendered.positionedScene)).toEqual([]);
    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  });

  it("rejects blocked or clamped horizontal alignment candidates", () => {
    const base = {
      source: { x: 0, y: 0, width: 100, height: 40 },
      target: { x: 140, y: 8, width: 100, height: 40 },
      sourcePoint: { x: 100, y: 16 },
      targetPoint: { x: 140, y: 28 },
      sourceCount: 2,
      targetCount: 1
    };
    expect(resolveHorizontalSharedY(base)).toBe(16);
    expect(resolveHorizontalSharedY({ ...base, blocked: () => true })).toBeUndefined();
    expect(resolveHorizontalSharedY({
      ...base,
      sourcePoint: { x: 100, y: 4 }
    })).toBeUndefined();
  });

  it("is deterministic across repeated renders", async () => {
    const first = await render();
    const second = await render();
    expect(first.svg).toBe(second.svg);
    expect(first.positionedScene.edges).toEqual(second.positionedScene.edges);
  });
});
