import { mkdir, readFile, writeFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { buildUiContractsPresentationModel } from "../src/renderer/uiContractsPresentationModel.js";
import { UiContractsSceneBuilder } from "../src/renderer/staged/uiContractsPresentationScene.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import { renderPositionedSceneToPng } from "../src/renderer/staged/svgBackend.js";
import { assessUiContractsCoverage, assessUiContractsGeometry, flattenUiContractsItems } from "./uiContractsB5Acceptance.js";

let bundle: Awaited<ReturnType<typeof loadBundle>>, graph: NonNullable<ReturnType<typeof compileSource>["graph"]>;
beforeAll(async () => {
  bundle = await loadBundle("bundle/v0.1/manifest.yaml");
  graph = compileSource({ path: "/tmp/departure.sdd", text: await readFile("docs/hierarchical_ui_contracts/departure_desk.sdd", "utf8") }, bundle).graph!;
});

describe("complete native B5 sheet", () => {
  for (const detail of ["compact", "detailed"]) for (const decorators of ["none", "type", "id", "type,id"]) it(`${detail} / ${decorators}`, async () => {
    const view = bundle.views.views.find(view => view.id === "ui_contracts")!;
    const projection = projectView(graph, bundle, view.id).projection!;
    const model = buildUiContractsPresentationModel(projection, graph, view, detail);
    const builder = new UiContractsSceneBuilder(detail, { id: decorators, showNodeType: decorators.includes("type"), showNodeId: decorators.includes("id") });
    const result = await runStagedRendererPipeline(builder.complete(model));
    const geometry = assessUiContractsGeometry(result.positionedScene);
    const structural = new Set(model.structuralRelationshipIds);
    const coverage = assessUiContractsCoverage({ expectedNodeIds: model.visibleSemanticNodeIds,
      occurrences: builder.occurrenceSemanticIds, expectedRelationshipIds: model.relationships.filter(edge => !structural.has(edge.id)).map(edge => edge.id),
      relationshipSegments: builder.relationshipSegments, scene: result.positionedScene });
    for (const edge of model.relationships.filter(edge => structural.has(edge.id))) {
      expect(model.scopes.some(scope => scope.focal.semanticId === edge.from && scope.sequences.some(sequence => sequence.nodes.some(node => node.semanticId === edge.to)))).toBe(true);
    }
    const expectedNodes = detail === "detailed" ? projection.nodes.map(node => node.id)
      : projection.nodes.filter(node => ["Place", "ViewState", "Component"].includes(node.type)).map(node => node.id);
    expect(new Set(builder.occurrenceSemanticIds.values())).toEqual(new Set(expectedNodes));
    const expectedEdges = projection.edges.filter(edge => expectedNodes.includes(edge.from) && expectedNodes.includes(edge.to));
    const triple = (edge: { from: string; type: string; to: string }) => JSON.stringify([edge.from, edge.type, edge.to]);
    expect(model.relationships.map(triple).sort()).toEqual(expectedEdges.map(triple).sort());
    expect(expectedNodes).toHaveLength(detail === "detailed" ? 51 : 17);
    expect(expectedEdges).toHaveLength(detail === "detailed" ? 45 : 24);
    const rendered = await renderPositionedSceneToPng(result.positionedScene);
    const directory = "/tmp/sdd-b5-complete", name = `${detail}.${decorators.replace(",", "-")}`;
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/${name}.svg`, rendered.svg + "\n");
    await writeFile(`${directory}/${name}.png`, rendered.png);
    await writeFile(`${directory}/${name}.json`, JSON.stringify({ detail, decorators, model, geometry, coverage,
      occurrences: [...builder.occurrenceSemanticIds], relationships: [...builder.relationshipSegments], ...result }, null, 2) + "\n");
    expect(geometry).toEqual([]);
    expect(coverage).toEqual([]);
    expect(rendered.diagnostics).toEqual([]);
    expect(rendered.svg).not.toContain("<circle");
    const sceneItems = flattenUiContractsItems(result.positionedScene.root);
    expect(sceneItems.filter(item => item.kind === "node" && item.role === "ui_contracts_description").every(item => item.width === 224)).toBe(true);
    expect(sceneItems.filter(item => item.kind === "container" && item.viewMetadata?.uiContracts?.title === "H1 · Repeated hierarchy")).toHaveLength(1);
    expect(sceneItems.filter(item => item.kind === "container" && item.viewMetadata?.uiContracts?.title === "H1 · See Cargo Sheet")).toHaveLength(1);
  });
});
