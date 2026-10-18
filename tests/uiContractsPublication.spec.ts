import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle, validateLoadedBundle } from "../src/index.js";
import type { Bundle } from "../src/bundle/types.js";
import { resolveUiContractsPresentation } from "../src/bundle/uiContractsPresentation.js";
import { prepareCompiledGraphPreview, renderSourcePreview } from "../src/renderer/previewWorkflow.js";
import { renderUiContractsStagedPng, renderUiContractsStagedSvg } from "../src/renderer/staged/uiContracts.js";
import { renderPositionedSceneToPng, renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import { auditUiContractsScene } from "../src/renderer/staged/uiContractsAcceptance.js";
import { RendererArtifactError } from "../src/renderer/staged/diagnostics.js";
import type { PositionedScene } from "../src/renderer/staged/contracts.js";
import { testUiRoutingPolicy } from "./uiContractsRoutingTestSupport.js";

const source = {
  path: "/tmp/ui-contracts-publication.sdd",
  text: `SDD-TEXT 0.2
Diagram DG-900 "Publication loop"
  diagram_type=ui_contracts
END
Place P-900 "Publication page"
  diagrams=DG-900
  route_or_key=/publication
  access=public
  CONTAINS VS-900 "Ready" diagrams=DG-900
END
ViewState VS-900 "Ready"
  diagrams=DG-900
  place_id=P-900
  TRANSITIONS_TO VS-900 "Ready" [E-900] {selected labels remain nonempty} diagrams=DG-900
END
Event E-900 "Refresh item"
END
`
};
const settings = { detailId: "compact", nodeDecoratorMode: { id: "type,id", showNodeType: true, showNodeId: true } };
const diagnosticOptions = { artifactIntent: "diagnostic" as const };
const errorDiagnostic = expect.objectContaining({ severity: "error" });
let enabled: Bundle;
let fixed: Bundle;
let accepted: PositionedScene;

function prepare(bundle: Bundle) {
  const compiled = compileSource(source, bundle);
  expect(compiled.diagnostics).toEqual([]);
  const preview = prepareCompiledGraphPreview(source.path, compiled.graph!, bundle, {
    viewId: "ui_contracts", format: "svg", profileId: "simple", detailId: "compact", nodeDecoratorModeId: "type,id"
  });
  expect(preview.diagnostics).toEqual([]);
  expect(preview.prepared!.presentationModel!.routing).toEqual(resolveUiContractsPresentation(preview.view).routing);
  return { graph: compiled.graph!, view: preview.view, projection: preview.prepared!.projection };
}

async function rejectsArtifact(promise: Promise<unknown>): Promise<void> {
  const error = await promise.then(() => undefined, error => error);
  expect(error).toBeInstanceOf(RendererArtifactError);
  expect(error.diagnostics).toEqual(expect.arrayContaining([errorDiagnostic]));
}

describe("enabled UI publication acceptance", () => {
  beforeAll(async () => {
    enabled = structuredClone(await loadBundle("bundle/v0.2/manifest.yaml"));
    const view = enabled.views.views.find(view => view.id === "ui_contracts")!;
    view.conventions.renderer_defaults!.ui_contracts_presentation!.routing = structuredClone(testUiRoutingPolicy);
    resolveUiContractsPresentation(view);
    validateLoadedBundle(enabled);
    fixed = structuredClone(enabled);
    const fixedView = fixed.views.views.find(view => view.id === "ui_contracts")!;
    fixedView.conventions.renderer_defaults!.ui_contracts_presentation!.routing!.capacity.owner = "fixed";
    resolveUiContractsPresentation(fixedView);
    validateLoadedBundle(fixed);
    const input = prepare(enabled);
    const rendered = await renderUiContractsStagedSvg(input.projection, input.graph, input.view, settings);
    expect(rendered.routingOutcome!.status).toBe("accepted");
    expect(rendered.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
    accepted = rendered.positionedScene;
    expect(auditUiContractsScene(accepted)).toEqual([]);
  });

  it("publishes an accepted revision through public SVG and PNG entrypoints", async () => {
    const input = prepare(enabled);
    const svg = await renderPositionedSceneToSvg(accepted);
    expect(svg.svg).toContain('class="staged-svg');
    expect(svg.svg).not.toContain('data-artifact-intent="diagnostic"');
    const png = await renderUiContractsStagedPng(input.projection, input.graph, input.view, settings);
    expect(png.routingOutcome!.status).toBe("accepted");
    expect(png.diagnostics.filter(diagnostic => diagnostic.severity === "error")).toEqual([]);
    expect([...png.png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it("blocks normal public SVG output when the loaded owner policy cannot fit its loop", async () => {
    const input = prepare(fixed);
    await rejectsArtifact(renderUiContractsStagedSvg(input.projection, input.graph, input.view, settings));
  });

  it("blocks normal public PNG output through the same failed acceptance", async () => {
    const input = prepare(fixed);
    await rejectsArtifact(renderUiContractsStagedPng(input.projection, input.graph, input.view, settings));
  });

  it("exports an explicit diagnostic SVG with a designation and retained error diagnostics", async () => {
    const input = prepare(fixed);
    const rendered = await renderUiContractsStagedSvg(input.projection, input.graph, input.view, { ...settings, ...diagnosticOptions });
    expect(rendered.routingOutcome!.status).toBe("failed");
    expect(rendered.svg).toContain('data-artifact-intent="diagnostic"');
    expect(rendered.diagnostics).toEqual(expect.arrayContaining([errorDiagnostic]));
    expect(auditUiContractsScene(rendered.positionedScene).some(diagnostic => diagnostic.severity === "error")).toBe(true);
  });

  it("derives diagnostic PNG from the same designated SVG while retaining errors", async () => {
    const input = prepare(fixed);
    const rendered = await renderUiContractsStagedPng(input.projection, input.graph, input.view, { ...settings, ...diagnosticOptions });
    expect(rendered.routingOutcome!.status).toBe("failed");
    expect(rendered.svg).toContain('data-artifact-intent="diagnostic"');
    expect(rendered.diagnostics).toEqual(expect.arrayContaining([errorDiagnostic]));
    expect([...rendered.png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  const mutations: Array<[string, (scene: PositionedScene) => void]> = [
    ["endpoint", scene => { scene.edges[0]!.to.x += 1; }],
    ["full label", scene => { scene.edges[0]!.label!.lines[0] = "[Wrong label]"; }],
    ["marker", scene => { scene.edges[0]!.markers!.end = "none"; }],
    ["inventory", scene => { delete scene.root.viewMetadata!.uiContracts!.inventory; }],
    ["root metadata", scene => { delete scene.root.viewMetadata; }]
  ];
  it.each(mutations)("reaudits changed %s on the exact scene before direct SVG serialization", async (_label, mutate) => {
    const scene = structuredClone(accepted);
    mutate(scene);
    const before = structuredClone(scene);
    await rejectsArtifact(renderPositionedSceneToSvg(scene));
    expect(scene).toEqual(before);
  });

  it("applies the final audit to direct PNG export too", async () => {
    const scene = structuredClone(accepted);
    scene.edges[0]!.markers!.end = "none";
    await rejectsArtifact(renderPositionedSceneToPng(scene));
  });

  it("permits explicit diagnostic serialization of a mutated coherent scene", async () => {
    const scene = structuredClone(accepted);
    scene.edges[0]!.markers!.end = "none";
    const before = structuredClone(scene);
    const rendered = await renderPositionedSceneToSvg(scene, diagnosticOptions);
    expect(rendered.svg).toContain('data-artifact-intent="diagnostic"');
    expect(rendered.diagnostics).toEqual(expect.arrayContaining([errorDiagnostic]));
    expect(scene).toEqual(before);
  });

  it.each(["svg", "png"] as const)("suppresses invalid combined %s preview without force", async format => {
    const preview = await renderSourcePreview(source, fixed, {
      viewId: "ui_contracts", format, profileId: "simple", detailId: "compact", nodeDecoratorModeId: "type,id"
    });
    expect(preview.artifact).toBeUndefined();
    expect(preview.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "render", severity: "error", code: expect.stringContaining("renderer.routing.ui_contracts_") })
    ]));
  });

  it.each(["svg", "png"] as const)("retains explicit combined force %s diagnostic output with error status", async format => {
    const preview = await renderSourcePreview(source, fixed, {
      viewId: "ui_contracts", format, profileId: "simple", detailId: "compact", nodeDecoratorModeId: "type,id", force: true
    });
    expect(preview.artifact?.format).toBe(format);
    expect(preview.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "render", severity: "error", code: expect.stringContaining("renderer.routing.ui_contracts_") })
    ]));
    if (preview.artifact?.format === "svg") expect(preview.artifact.text).toContain('data-artifact-intent="diagnostic"');
    if (preview.artifact?.format === "png") expect([...preview.artifact.bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it.each(["svg", "png"] as const)("suppresses invalid named-diagram %s output even with force", async format => {
    const preview = await renderSourcePreview(source, fixed, {
      viewId: "ui_contracts", diagramId: "DG-900", format, profileId: "simple", detailId: "compact", nodeDecoratorModeId: "type,id", force: true
    });
    expect(preview.diagramId).toBe("DG-900");
    expect(preview.artifact).toBeUndefined();
    expect(preview.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "render", severity: "error", code: expect.stringContaining("renderer.routing.ui_contracts_") })
    ]));
  });
});
