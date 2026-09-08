import { mkdir, readFile, writeFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { buildUiContractsPresentationModel } from "../src/renderer/uiContractsPresentationModel.js";
import { UiContractsSceneBuilder } from "../src/renderer/staged/uiContractsPresentationScene.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import { renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import { assessUiContractsGeometry, flattenUiContractsItems } from "./uiContractsB5Acceptance.js";
import type { PositionedScene, SceneContainer } from "../src/renderer/staged/contracts.js";

let bundle: Awaited<ReturnType<typeof loadBundle>>, graph: NonNullable<ReturnType<typeof compileSource>["graph"]>, evidence: any;
beforeAll(async () => {
  bundle = await loadBundle("bundle/v0.1/manifest.yaml");
  graph = compileSource({ path: "/tmp/departure.sdd", text: await readFile("docs/hierarchical_ui_contracts/departure_desk.sdd", "utf8") }, bundle).graph!;
  evidence = JSON.parse(await readFile("docs/hierarchical_ui_contracts/b5_pipeline_evidence.json", "utf8"));
});
function build(proof: any) {
  const view = bundle.views.views.find(view => view.id === "ui_contracts")!;
  const model = buildUiContractsPresentationModel(projectView(graph, bundle, view.id).projection!, graph, view, proof.detail);
  const id = proof.file.includes("component") ? "C-430" : proof.file.includes("children") ? "C-410" : "P-410";
  let selected = model.scopes.find(scope => scope.focal.semanticId === id);
  // The historical compact child-only scope is now suppressed in complete sheets.
  // Retain its independent neighborhood geometry proof using the detailed scope
  // with the attributes absent from its compact card removed.
  if (!selected && proof.file.includes("children") && proof.detail === "compact") {
    selected = structuredClone(buildUiContractsPresentationModel(projectView(graph, bundle, view.id).projection!, graph, view, "detailed")
      .scopes.find(scope => scope.focal.semanticId === id)!);
    selected.focal.attributes = [];
    selected.sequences = [];
    selected.compositions = [];
    selected.contracts = [];
  }
  const scope = structuredClone(selected!);
  scope.compositions = scope.compositions.filter(group => group.source.id === scope.focal.id);
  if (proof.file.includes(".short.")) {
    scope.sequences[0].nodes = scope.sequences[0].nodes.filter((_, index) => [0, 1, 5, 6].includes(index));
    const ids = new Set(scope.sequences[0].nodes.map(node => node.id));
    scope.sequences[0].edges = scope.sequences[0].edges.filter(edge => ids.has(edge.from) && ids.has(edge.to));
  }
  const builder = new UiContractsSceneBuilder(proof.detail, { id: proof.decorators, showNodeType: proof.decorators.includes("type"), showNodeId: proof.decorators.includes("id") });
  builder.scene.root.children = [builder.scope(scope)];
  return builder;
}
const geometry = (scene: PositionedScene) => ({
  nodes: flattenUiContractsItems(scene.root).filter(item => item.kind === "node" && item.sharedNode).map(item => ({
    semanticId: item.id.startsWith("occurrence:") ? JSON.parse(decodeURIComponent(item.id.slice(11))).at(-1) as string : item.id, x: item.x, y: item.y, width: item.width, height: item.height
  })).sort((a, b) => a.semanticId.localeCompare(b.semanticId)),
  edges: scene.edges.map(edge => ({ route: edge.route.points, label: edge.label, markers: edge.markers, classes: edge.classes }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
});

describe("production scene builders reproduce B5 scopes", () => {
  it("preserves all twelve B5 geometries except the newly approved 18px child-arrow approach", async () => {
    for (const proof of evidence.proofs) {
      const builder = build(proof), result = await runStagedRendererPipeline(builder.scene);
      const issues = assessUiContractsGeometry(result.positionedScene);
      await mkdir("/tmp/sdd-b5-scopes", { recursive: true });
      await writeFile(`/tmp/sdd-b5-scopes/${proof.file}.json`, JSON.stringify({ ...result, geometry: issues, relationships: [...builder.relationshipSegments] }, null, 2));
      await writeFile(`/tmp/sdd-b5-scopes/${proof.file}.svg`, (await renderPositionedSceneToSvg(result.positionedScene)).svg);
      expect(issues, proof.file).toEqual([]);
      const actual = geometry(result.positionedScene);
      // Stage 6 visual guidance explicitly requests breathing room behind child
      // arrowheads. The only geometry change is the 12 -> 18px terminal leg.
      if (proof.file.includes("children")) {
        const childTop = Math.min(...actual.nodes.filter(node => node.semanticId !== "C-410" && node.semanticId.startsWith("C-")).map(node => node.y));
        actual.nodes.forEach(node => { if (node.y >= childTop) node.y -= 6; });
        actual.edges.forEach(edge => {
          edge.route = edge.route.map(point => ({ ...point, y: point.y >= childTop ? point.y - 6 : point.y }));
          if (edge.label && edge.label.y >= childTop) edge.label = { ...edge.label, y: edge.label.y - 6 };
        });
      }
      expect(actual, proof.file).toEqual(geometry(proof.positionedScene));
      expect(result.positionedScene.root.width, proof.file).toBe(proof.width);
    }
  });

  it("continues to reject 33px labeled stems and 11px branch legs", async () => {
    const proof = evidence.proofs.find((proof: any) => proof.file === "b5_component.compact");
    for (const mutation of ["stem", "branch"]) {
      const builder = build(proof);
      const walk = (container: SceneContainer): void => {
        if (mutation === "stem" && container.id.endsWith(":neighborhood")) container.layout.gap = 33;
        if (mutation === "branch" && container.id.includes(":column:")) container.layout.gap = 11;
        for (const child of container.children) if (child.kind === "container") walk(child);
      };
      walk(builder.scene.root);
      const result = await runStagedRendererPipeline(builder.scene);
      const baseline = await runStagedRendererPipeline(build(proof).scene);
      expect(geometry(result.positionedScene)).not.toEqual(geometry(baseline.positionedScene));
      expect(mutation === "stem" ? assessUiContractsGeometry(result.positionedScene).length > 0
        : result.positionedScene.edges.some(edge => edge.route.points.length > 2)).toBe(true);
    }
  });
});
