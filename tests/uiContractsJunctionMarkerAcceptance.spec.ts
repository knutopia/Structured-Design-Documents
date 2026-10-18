import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle, validateLoadedBundle } from "../src/index.js";
import { resolveUiContractsPresentation } from "../src/bundle/uiContractsPresentation.js";
import { prepareCompiledGraphPreview } from "../src/renderer/previewWorkflow.js";
import type { PositionedScene } from "../src/renderer/staged/contracts.js";
import { RendererArtifactError } from "../src/renderer/staged/diagnostics.js";
import { auditPositionedSceneMarkers } from "../src/renderer/staged/markerAudit.js";
import { auditUiContractsScene, uiRelatedPhysicalSegments } from "../src/renderer/staged/uiContractsAcceptance.js";
import { runUiContractsRendererPipeline } from "../src/renderer/staged/uiContractsPipeline.js";
import { renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import { testUiRoutingPolicy } from "./uiContractsRoutingTestSupport.js";

const source = {
  path: "ui_contracts_junction_marker.sdd",
  text: `SDD-TEXT 0.2
Place P-900 "Fork"
  route_or_key=/fork
  access=public
  CONTAINS VS-900 "A"
  CONTAINS VS-901 "B"
  CONTAINS VS-902 "C"
END
ViewState VS-900 "A"
  place_id=P-900
  TRANSITIONS_TO VS-901 "B"
  TRANSITIONS_TO VS-902 "C"
END
ViewState VS-901 "B"
  place_id=P-900
END
ViewState VS-902 "C"
  place_id=P-900
END
`
};

describe("UI junction marker acceptance", () => {
  let accepted: PositionedScene;
  beforeAll(async () => {
    const bundle = structuredClone(await loadBundle("bundle/v0.2/manifest.yaml"));
    const view = bundle.views.views.find(view => view.id === "ui_contracts")!;
    view.conventions.renderer_defaults!.ui_contracts_presentation!.routing = structuredClone(testUiRoutingPolicy);
    validateLoadedBundle(bundle);
    resolveUiContractsPresentation(view);
    const compiled = compileSource(source, bundle);
    expect(compiled.diagnostics).toEqual([]);
    const prepared = prepareCompiledGraphPreview(source.path, compiled.graph!, bundle, {
      viewId: "ui_contracts", format: "svg", profileId: "simple", detailId: "compact", nodeDecoratorModeId: "type,id"
    });
    expect(prepared.diagnostics).toEqual([]);
    const outcome = await runUiContractsRendererPipeline(prepared.prepared!.presentationModel!, {
      detailId: "compact", nodeDecoratorMode: { id: "type,id", showNodeType: true, showNodeId: true }
    }, { candidates: 64 });
    expect(outcome.status, JSON.stringify(outcome.status === "failed" ? outcome.violations : outcome.evidence)).toBe("accepted");
    if (outcome.status !== "accepted") throw new Error("Expected accepted production fork");
    accepted = outcome.revision.positionedScene;
    expect(auditUiContractsScene(accepted)).toEqual([]);
  });

  async function rejectsCrossedMarker(scene: PositionedScene, markerEdgeId: string, crossingEdgeId: string) {
    const expected = expect.objectContaining({ code: "renderer.routing.marker_connector", severity: "error", targetId: markerEdgeId,
      message: expect.stringContaining(crossingEdgeId) });
    expect(auditPositionedSceneMarkers(scene)).toContainEqual(expected);
    expect(auditUiContractsScene(scene)).toContainEqual(expected);
    const before = structuredClone(scene);
    const error = await renderPositionedSceneToSvg(scene).then(() => undefined, error => error);
    expect(error).toBeInstanceOf(RendererArtifactError);
    expect(error.diagnostics).toContainEqual(expected);
    expect(scene).toEqual(before);
  }

  it("publishes the unmodified fork with its existing shared physical stem", async () => {
    const rendered = await renderPositionedSceneToSvg(accepted);
    expect(rendered.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    expect(accepted.root.viewMetadata!.uiContracts!.inventory!.segments.some(segment => segment.relationshipIds.length > 1)).toBe(true);
  });

  it("rejects a sibling branch crossing another target marker within the same junction group", async () => {
    const scene = structuredClone(accepted);
    const [upper, lower] = scene.edges.filter(edge => edge.markers?.end === "arrow").sort((a, b) => a.to.y - b.to.y);
    expect(upper!.viewMetadata!.uiJunction!.groupId).toBe(lower!.viewMetadata!.uiJunction!.groupId);
    expect(uiRelatedPhysicalSegments(scene).get(upper!.id)!.has(lower!.id)).toBe(false);
    const { x, y } = upper!.to;
    lower!.route.points = [
      { x: lower!.from.x, y: lower!.from.y }, { x: x - 20, y: lower!.from.y },
      { x: x - 20, y: y - 20 }, { x: x - 8, y: y - 20 },
      { x: x - 8, y: y + 29 }, { x: x - 12, y: y + 29 },
      { x: x - 12, y: lower!.to.y }, { x: lower!.to.x, y: lower!.to.y }
    ];
    await rejectsCrossedMarker(scene, upper!.id, lower!.id);
  });

  it("rejects painted intersection even when a shared stem belongs to the marker's own declared path", async () => {
    const scene = structuredClone(accepted);
    const upper = scene.edges.filter(edge => edge.markers?.end === "arrow").sort((a, b) => a.to.y - b.to.y)[0]!;
    const inventory = scene.root.viewMetadata!.uiContracts!.inventory!;
    const shared = inventory.segments.find(segment => segment.relationshipIds.length > 1)!;
    const stem = scene.edges.find(edge => edge.id === shared.id)!;
    expect(uiRelatedPhysicalSegments(scene).get(upper.id)!.has(stem.id)).toBe(true);
    const { x, y } = upper.to;
    stem.route.points = [
      { x: stem.from.x, y: stem.from.y }, { x: stem.from.x + 12, y: stem.from.y },
      { x: stem.from.x + 12, y: y - 41 }, { x: x - 8, y: y - 41 },
      { x: x - 8, y: y + 29 }, { x: stem.to.x - 16, y: y + 29 },
      { x: stem.to.x - 16, y: stem.to.y }, { x: stem.to.x, y: stem.to.y }
    ];
    await rejectsCrossedMarker(scene, upper.id, stem.id);
  });
});
