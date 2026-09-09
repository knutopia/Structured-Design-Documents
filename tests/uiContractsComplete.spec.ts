import { mkdir, readFile, writeFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { buildUiContractsPresentationModel, type UiContractsHierarchy } from "../src/renderer/uiContractsPresentationModel.js";
import { UiContractsSceneBuilder } from "../src/renderer/staged/uiContractsPresentationScene.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import type { PositionedItem, SceneItem } from "../src/renderer/staged/contracts.js";
import { renderPositionedSceneToPng } from "../src/renderer/staged/svgBackend.js";
import { assessUiContractsCoverage, assessUiContractsGeometry, flattenUiContractsItems } from "./uiContractsB5Acceptance.js";

let bundle: Awaited<ReturnType<typeof loadBundle>>, graph: NonNullable<ReturnType<typeof compileSource>["graph"]>;
beforeAll(async () => {
  bundle = await loadBundle("bundle/v0.1/manifest.yaml");
  graph = compileSource({ path: "/tmp/departure.sdd", text: await readFile("docs/hierarchical_ui_contracts/departure_desk.sdd", "utf8") }, bundle).graph!;
});

describe("complete native B5 sheet", () => {
  for (const detail of ["compact", "detailed"]) it(`preserves scene nesting for a suppressed chain with siblings / ${detail}`, async () => {
    const compiled = compileSource({ path: "/tmp/suppressed-chain.sdd", text: `SDD-TEXT 0.1
Component C-001 "Root"
  CONTAINS C-002 "Branch"
  CONTAINS C-003 "Root sibling"
END
Component C-002 "Branch"
  CONTAINS C-004 "Twig"
END
Component C-003 "Root sibling"
END
Component C-004 "Twig"
  CONTAINS C-005 "First leaf"
  CONTAINS C-006 "Second leaf"
END
Component C-005 "First leaf"
END
Component C-006 "Second leaf"
END
` }, bundle);
    expect(compiled.diagnostics).toEqual([]);
    const view = bundle.views.views.find(view => view.id === "ui_contracts")!;
    const projection = projectView(compiled.graph!, bundle, view.id).projection!;
    const model = buildUiContractsPresentationModel(projection, compiled.graph!, view, detail);
    expect(model.scopes).toEqual([]);
    const builder = new UiContractsSceneBuilder(detail, { id: "none", showNodeType: false, showNodeId: false });
    const { positionedScene } = await runStagedRendererPipeline(builder.complete(model));

    // Inspect actual enclosure membership and bounds, independently of model.overview
    // and structuralRelationshipIds. Flattening or reparenting cards must fail even
    // when every semantic identity still has a scene occurrence.
    const nesting = (item: PositionedItem): unknown => {
      if (item.kind === "node") return builder.occurrenceSemanticIds.get(item.id);
      expect(item.viewMetadata?.uiContracts?.kind).toBe("enclosure");
      for (const child of item.children) {
        expect(child.x).toBeGreaterThanOrEqual(item.x);
        expect(child.y).toBeGreaterThanOrEqual(item.y);
        expect(child.x + child.width).toBeLessThanOrEqual(item.x + item.width);
        expect(child.y + child.height).toBeLessThanOrEqual(item.y + item.height);
      }
      return item.children.map(nesting);
    };
    expect(positionedScene.root.children.map(nesting)).toEqual([
      ["C-001", ["C-002", ["C-004", ["C-005", "C-006"]], "C-003"]]
    ]);
    expect(positionedScene.edges).toEqual([]);
    expect(assessUiContractsGeometry(positionedScene)).toEqual([]);
  });

  for (const detail of ["compact", "detailed"]) for (const decorators of ["none", "type", "id", "type,id"]) it(`${detail} / ${decorators}`, async () => {
    const view = bundle.views.views.find(view => view.id === "ui_contracts")!;
    const projection = projectView(graph, bundle, view.id).projection!;
    const model = buildUiContractsPresentationModel(projection, graph, view, detail);
    const builder = new UiContractsSceneBuilder(detail, { id: decorators, showNodeType: decorators.includes("type"), showNodeId: decorators.includes("id") });
    const result = await runStagedRendererPipeline(builder.complete(model));
    const emphasizedIds = new Set([
      ...model.overview.map(item => item.node.id),
      ...model.scopes.filter(scope => scope.kind !== "standalone").map(scope => scope.focal.id)
    ]);
    expect(model.scopes.some(scope => scope.kind === "place" && scope.focal.title === "Departure Desk")).toBe(true);
    expect(model.overview.some(item => item.node.title === "Load Workbench")).toBe(true);
    const checkEmphasis = (item: SceneItem): void => {
      if (item.kind === "container") item.children.forEach(checkEmphasis);
      else if (item.sharedNode) expect(item.sharedNode.emphasized === true, item.id).toBe(emphasizedIds.has(item.id));
    };
    checkEmphasis(builder.scene.root);
    for (const scene of [result.measuredScene, result.positionedScene]) {
      const visit = (item: typeof scene.root | (typeof scene.root.children)[number]): void => {
        if (item.kind === "container") item.children.forEach(visit);
        else if (item.sharedNode) expect(item.sharedNode.emphasized === true, item.id).toBe(emphasizedIds.has(item.id));
      };
      visit(scene.root);
    }
    // Reusing the builder outside an enclosure must not retain its focal emphasis.
    expect(builder.node(model.scopes[0].focal).sharedNode?.emphasized).toBeUndefined();
    const geometry = assessUiContractsGeometry(result.positionedScene);
    const structural = new Set(model.structuralRelationshipIds);
    const coverage = assessUiContractsCoverage({ expectedNodeIds: model.visibleSemanticNodeIds,
      occurrences: builder.occurrenceSemanticIds, expectedRelationshipIds: model.relationships.filter(edge => !structural.has(edge.id)).map(edge => edge.id),
      relationshipSegments: builder.relationshipSegments, scene: result.positionedScene });
    const walk = (item: UiContractsHierarchy): UiContractsHierarchy[] => [item, ...item.children.flatMap(walk)];
    const hierarchy = model.overview.flatMap(walk);
    for (const edge of model.relationships.filter(edge => structural.has(edge.id) && edge.kind === "containment")) {
      expect(hierarchy.some(item => item.node.semanticId === edge.from
        && item.children.some(child => child.node.semanticId === edge.to))).toBe(true);
    }
    expect(new Set(builder.occurrenceSemanticIds.keys())).toEqual(new Set(model.occurrences.map(node => node.id)));
    for (const edge of model.relationships.filter(edge => edge.kind === "ownership")) {
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
