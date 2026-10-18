import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle, validateLoadedBundle } from "../src/index.js";
import type { Bundle } from "../src/bundle/types.js";
import { resolveUiContractsPresentation } from "../src/bundle/uiContractsPresentation.js";
import { prepareCompiledGraphPreview, renderSourcePreview } from "../src/renderer/previewWorkflow.js";
import { renderUiContractsStagedPng, renderUiContractsStagedSvg } from "../src/renderer/staged/uiContracts.js";
import { renderPositionedSceneToPng, renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import { auditUiContractsScene, uiSceneItems } from "../src/renderer/staged/uiContractsAcceptance.js";
import { RendererArtifactError } from "../src/renderer/staged/diagnostics.js";
import type { PositionedScene } from "../src/renderer/staged/contracts.js";
import { testUiRoutingPolicy } from "./uiContractsRoutingTestSupport.js";
import { renderSharedNodesStagedSvg } from "../src/renderer/staged/sharedNodeRenderer.js";

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
let paintedContent: PositionedScene;

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
    const shared = await renderSharedNodesStagedSvg([{ title: "Content card", nodeId: "C-900", nodeType: "Component",
      decoratorMode: settings.nodeDecoratorMode, attributes: [{ groupId: "owner", label: "owner", value: "Design" }] }], { detailId: "detailed" });
    paintedContent = shared.positionedScene;
    paintedContent.uiAcceptancePolicy = structuredClone(testUiRoutingPolicy);
    paintedContent.root.viewMetadata = { uiContracts: { kind: "sheet", routing: structuredClone(testUiRoutingPolicy),
      inventory: { occurrences: [], relationships: [], segments: [] } } };
    expect(auditUiContractsScene(paintedContent)).toEqual([]);
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

  const contentMutations: Array<[string, (scene: PositionedScene) => { blockId: string; ownerId: string; viewport?: boolean }]> = [
    ["header outside its owner inside the viewport", scene => {
      const owner = uiSceneItems(scene.root).find(item => item.kind === "container" && item !== scene.root && item.headerContent.length)!;
      if (owner.kind !== "container") throw new Error("Expected header");
      const block = owner.headerContent[0]!;
      block.x = -2;
      // This fixture's scope starts at the viewport origin. Add room on its
      // left so the mutation isolates owner containment from viewport bounds.
      scene.root.x -= 10; scene.root.width += 10;
      expect(owner.x + block.x).toBeGreaterThanOrEqual(scene.root.x);
      return { blockId: block.id, ownerId: owner.id };
    }],
    ["header outside the viewport", scene => {
      const owner = uiSceneItems(scene.root).find(item => item.kind === "container" && item.headerContent.length)!;
      if (owner.kind !== "container") throw new Error("Expected header");
      const block = owner.headerContent[0]!;
      block.x = scene.root.width + 100;
      return { blockId: block.id, ownerId: owner.id, viewport: true };
    }],
    ...(["decorator", "title", "attribute label", "attribute value", "ordinary node"] as const).map(kind => [kind, (scene: PositionedScene) => {
      const node = uiSceneItems(scene.root).find(item => item.kind === "node" && item.sharedNode?.body.attributeGroups.length)!;
      if (node.kind !== "node" || !node.sharedNode) throw new Error("Expected shared card attributes");
      const shared = node.sharedNode;
      const block = kind === "decorator" ? shared.decorator!.items[0]! : kind === "title" ? shared.body.title
        : kind === "attribute label" ? shared.body.attributeGroups[0]!.label
        : kind === "attribute value" ? shared.body.attributeGroups[0]!.values[0]! : node.content[0]!;
      // Moving the painted shared object must be caught even when node.content
      // is a separate, stale copy and the card rectangle is unchanged.
      node.content = structuredClone(node.content);
      if (kind === "ordinary node") {
        delete node.sharedNode;
        node.content[0]!.x = node.width + 2;
        return { blockId: node.content[0]!.id, ownerId: node.id };
      }
      block.x = node.width + 2;
      return { blockId: block.id, ownerId: node.id };
    }] as [string, (scene: PositionedScene) => { blockId: string; ownerId: string }])
  ];
  it.each(contentMutations)("rejects painted %s at the exact SVG/PNG publication gate", async (_label, mutate) => {
    const scene = structuredClone(_label.startsWith("header") ? accepted : paintedContent), expected = mutate(scene), before = structuredClone(scene);
    const findings = auditUiContractsScene(scene);
    expect(findings).toContainEqual(expect.objectContaining({ code: "renderer.routing.content_owner_bounds", targetId: expected.blockId,
      message: expect.stringContaining(expected.ownerId), severity: "error" }));
    if (expected.viewport) expect(findings).toContainEqual(expect.objectContaining({ code: "renderer.routing.content_viewport_bounds", targetId: expected.blockId }));
    await rejectsArtifact(renderPositionedSceneToSvg(scene));
    await rejectsArtifact(renderPositionedSceneToPng(scene));
    const diagnostic = await renderPositionedSceneToSvg(scene, diagnosticOptions);
    expect(diagnostic.svg).toContain('data-artifact-intent="diagnostic"');
    expect(diagnostic.diagnostics).toEqual(expect.arrayContaining([errorDiagnostic]));
    expect(scene).toEqual(before);
  });

  it.each([NaN, Infinity, -1])("rejects invalid painted content dimensions %s", value => {
    const scene = structuredClone(accepted);
    const owner = uiSceneItems(scene.root).find(item => item.kind === "container" && item.headerContent.length)!;
    if (owner.kind !== "container") throw new Error("Expected header");
    owner.headerContent[0]!.width = value;
    expect(auditUiContractsScene(scene)).toContainEqual(expect.objectContaining({ code: "renderer.routing.content_invalid_bounds", severity: "error" }));
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
