import { mkdir, readFile, writeFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { buildUiContractsPresentationModel } from "../src/renderer/uiContractsPresentationModel.js";
import { UiContractsSceneBuilder } from "../src/renderer/staged/uiContractsPresentationScene.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import { renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import { assessUiContractsGeometry, flattenUiContractsItems } from "./uiContractsB5Acceptance.js";

let bundle: Awaited<ReturnType<typeof loadBundle>>;
beforeAll(async () => { bundle = await loadBundle("bundle/v0.1/manifest.yaml"); });
const block = (type: string, id: string, name: string, body = "") => `${type} ${id} "${name}"\n${body}\nEND\n`;
const sdd = (...blocks: string[]) => "SDD-TEXT 0.1\n" + blocks.join("");
const stateGraph = (links: Array<[number, number]>) => sdd(block("Component", "C-100", "Controller"),
  ...[...new Set(links.flat())].map(index => block("State", `ST-${100 + index}`, `State ${index}`, `  scope_id=C-100\n` + links.filter(([from]) => from === index).map(([, to]) => `  TRANSITIONS_TO ST-${100 + to} "State ${to}" {ready_${index}_${to}}`).join("\n"))));
function presentation(text: string, detail = "detailed", metadata = true) {
  const compiled = compileSource({ path: "/tmp/topology.sdd", text }, bundle);
  expect(compiled.diagnostics).toEqual([]);
  const graph = metadata ? compiled.graph! : structuredClone(compiled.graph!);
  const view = bundle.views.views.find(view => view.id === "ui_contracts")!;
  return buildUiContractsPresentationModel(projectView(graph, bundle, view.id).projection!, graph, view, detail);
}

const topologyCases: Record<string, string> = {
  branch: stateGraph([[0, 1], [0, 2]]),
  merge: stateGraph([[0, 2], [1, 2]]),
  diamond: stateGraph([[0, 1], [0, 2], [1, 3], [2, 3]]),
  cycle: stateGraph([[0, 1], [1, 2], [2, 0]]),
  self_loop: stateGraph([[0, 0]]),
  disconnected: stateGraph([[0, 1], [2, 3]]),
  three_parents_children: sdd(...[0, 1, 2].map(i => block("Component", `C-${100+i}`, `Parent ${i}`, '  CONTAINS C-110 "Focal"')),
    block("Component", "C-110", "Focal", [0,1,2].map(i => `  CONTAINS C-${120+i} "Child ${i}"`).join("\n")),
    ...[0,1,2].map(i => block("Component", `C-${120+i}`, `Child ${i}`))),
  composition_fanout: sdd(block("Place", "P-100", "Place", '  COMPOSED_OF C-100 "One"\n  COMPOSED_OF C-101 "Two"\n  COMPOSED_OF C-102 "Three"'),
    ...["One", "Two", "Three"].map((name, i) => block("Component", `C-${100+i}`, name))),
  parallel_bindings: sdd(block("Component", "C-100", "Form", '  BINDS_TO D-100 "Record" field=first\n  BINDS_TO D-100 "Record" field=second'), block("DataEntity", "D-100", "Record")),
  actual_support_sources: sdd(block("Component", "C-100", "Form", '  DEPENDS_ON SA-100 "Action"'), block("SystemAction", "SA-100", "Action", '  EMITS E-100 "Finished"'), block("Event", "E-100", "Finished")),
  empty: sdd(block("Outcome", "O-100", "Outside this view")),
  empty_place: sdd(block("Place", "P-100", "Empty"))
};

describe("B5 topology acceptance", () => {
  for (const [name, text] of Object.entries(topologyCases)) it(name, async () => {
    const model = presentation(text), builder = new UiContractsSceneBuilder("detailed", { id: "type,id", showNodeType: true, showNodeId: true });
    const result = await runStagedRendererPipeline(builder.complete(model));
    const issues = assessUiContractsGeometry(result.positionedScene);
    await mkdir("/tmp/sdd-b5-topology", { recursive: true });
    await writeFile(`/tmp/sdd-b5-topology/${name}.sdd`, text);
    await writeFile(`/tmp/sdd-b5-topology/${name}.json`, JSON.stringify({ model, issues, ...result }, null, 2));
    await writeFile(`/tmp/sdd-b5-topology/${name}.svg`, (await renderPositionedSceneToSvg(result.positionedScene)).svg);
    expect(issues).toEqual([]);
    expect(new Set(builder.occurrenceSemanticIds.values())).toEqual(new Set(model.visibleSemanticNodeIds));
    if (name === "parallel_bindings") expect(model.relationships.map(edge => edge.label)).toEqual(["binds field first", "binds field second"]);
  });

  it("keeps local composition and contracts fixed when sequences grow horizontally", async () => {
    const text = await readFile("docs/hierarchical_ui_contracts/departure_desk.sdd", "utf8");
    const local = [];
    for (const short of [true, false]) {
      const model = presentation(text);
      if (short) for (const scope of model.scopes) for (const seq of scope.sequences) {
        seq.nodes = seq.nodes.filter((_, index) => [0, 1, 5, 6].includes(index));
        const ids = new Set(seq.nodes.map(node => node.id));
        seq.edges = seq.edges.filter(edge => ids.has(edge.from) && ids.has(edge.to));
      }
      const builder = new UiContractsSceneBuilder("detailed", { id: "none", showNodeId: false, showNodeType: false });
      builder.scene.root.children = model.scopes.filter(scope => ["P-410", "C-430"].includes(scope.focal.semanticId)).map(scope => builder.scope(scope, true));
      const scene = (await runStagedRendererPipeline(builder.scene)).positionedScene;
      expect(assessUiContractsGeometry(scene)).toEqual([]);
      local.push(scene.root.children.flatMap(scope => flattenUiContractsItems(scope).filter(item => item.id.includes(":contract:") || item.id.includes(":composition:") || item.id.endsWith(":description"))
        .map(item => ({ id: item.id, x: item.x-scope.x, y: item.y-scope.y, width: item.width, height: item.height }))));
    }
    expect(local[0]).toEqual(local[1]);
  });

  it("keeps duplicate identities separate, expands nested reuse once, and honors source edits and fallback order", () => {
    const shared = block("Component", "C-110", "Same name", '  CONTAINS C-120 "Leaf"') + block("Component", "C-120", "Leaf");
    const a = block("Component", "C-102", "Root", '  CONTAINS C-110 "Same name"');
    const b = block("Component", "C-101", "Root", '  CONTAINS C-110 "Same name"');
    const model = presentation(sdd(a,b,shared));
    expect(model.overview[0].node.semanticId).toBe("C-102");
    expect(model.overview[0].children[0].children).toHaveLength(1);
    expect(model.overview[1].children[0].referenceTo).toBe(model.overview[0].children[0].id);
    expect(presentation(sdd(b,a,shared)).overview[0].node.semanticId).toBe("C-101");
    expect(presentation(sdd(a,b,shared), "detailed", false).overview[0].node.semanticId).toBe("C-101");
  });
});
