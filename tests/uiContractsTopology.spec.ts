import { mkdir, readFile, writeFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { buildUiContractsPresentationModel } from "../src/renderer/uiContractsPresentationModel.js";
import { UiContractsSceneBuilder } from "../src/renderer/staged/uiContractsPresentationScene.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import { renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import { assessUiContractsCoverage, assessUiContractsGeometry, flattenUiContractsItems } from "./uiContractsB5Acceptance.js";

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
  parallel_bindings: sdd(block("Component", "C-100", "Form", '  BINDS_TO D-100 "Record" field=first\n  BINDS_TO D-100 "Record" field=second'), block("DataEntity", "D-100", "Record"), block("State", "ST-100", "Ready", '  scope_id=C-100')),
  actual_support_sources: sdd(block("Component", "C-100", "Form", '  DEPENDS_ON SA-100 "Action"'), block("SystemAction", "SA-100", "Action", '  EMITS E-100 "Finished"'), block("Event", "E-100", "Finished")),
  empty: sdd(block("Outcome", "O-100", "Outside this view")),
  empty_place: sdd(block("Place", "P-100", "Empty")),
  long_ids: sdd(block("Component", "C-123456789012345678901234567890", "Long decorated identity", '  CONTAINS C-123456789012345678901234567891 "Child"'), block("Component", "C-123456789012345678901234567891", "Child")),
  nested_reuse: sdd(
    block("Component", "C-100", "Root", '  CONTAINS C-110 "Reusable"\n  CONTAINS C-120 "Second branch"'),
    block("Component", "C-101", "Disconnected root"),
    block("Component", "C-110", "Reusable", '  CONTAINS C-130 "Nested reusable"'),
    block("Component", "C-120", "Second branch", '  CONTAINS C-110 "Reusable"\n  CONTAINS C-130 "Nested reusable"'),
    block("Component", "C-130", "Nested reusable", '  CONTAINS C-140 "Deep leaf"'), block("Component", "C-140", "Deep leaf")),
  long_content: sdd(
    block("Place", "P-100", "A long place title that must expand its container title bar without widening any semantic node", '  description="A detailed description that remains constrained to the native semantic node width even when the transition sequence is considerably wider."\n  route_or_key=/some/very/long/route/for/this/place\n  access=auth\n  entry_points="link:/some/very/long/route"\n  primary_nav=true\n  CONTAINS VS-100 "Review"\n  CONTAINS VS-101 "Ready"'),
    block("ViewState", "VS-100", "A deliberately long view state name that wraps across several native lines", '  place_id=P-100\n  data_required="First record, second record, third record, fourth record"\n  COMPOSED_OF C-100 "Form"\n  TRANSITIONS_TO VS-101 "Ready" [E-100] {all_records_confirmed_and_review_completed} / SA-100'),
    block("ViewState", "VS-101", "Ready", '  place_id=P-100\n  COMPOSED_OF C-100 "Form"'),
    block("Component", "C-100", "Form with a long descriptive name that wraps", '  description="Review all fields and update the complete form before committing the changes."\n  inputs="First record, second record, third record"\n  outputs="Validated first record, validated second record"\n  BINDS_TO D-100 "Record" field=a_long_nested_field_name_used_for_binding\n  EMITS E-100 "A long event name used in complete transition annotations"'),
    block("DataEntity", "D-100", "Record"), block("Event", "E-100", "A long event name used in complete transition annotations"), block("SystemAction", "SA-100", "Commit all changes"))
};

describe("B5 topology acceptance", () => {
  for (const [name, text] of Object.entries(topologyCases)) for (const detail of ["compact", "detailed"]) for (const decorators of ["none", "type", "id", "type,id"]) it(`${name} / ${detail} / ${decorators}`, async () => {
    const model = presentation(text, detail), builder = new UiContractsSceneBuilder(detail, { id: decorators, showNodeType: decorators.includes("type"), showNodeId: decorators.includes("id") });
    const result = await runStagedRendererPipeline(builder.complete(model));
    const issues = assessUiContractsGeometry(result.positionedScene);
    await mkdir("/tmp/sdd-b5-topology", { recursive: true });
    await writeFile(`/tmp/sdd-b5-topology/${name}.sdd`, text);
    const coverage = assessUiContractsCoverage({ expectedNodeIds: model.visibleSemanticNodeIds, occurrences: builder.occurrenceSemanticIds,
      expectedRelationshipIds: model.relationships.filter(edge => !model.structuralRelationshipIds.includes(edge.id)).map(edge => edge.id),
      relationshipSegments: builder.relationshipSegments, scene: result.positionedScene });
    const stem = `${name}.${detail}.${decorators.replace(",", "-")}`;
    await writeFile(`/tmp/sdd-b5-topology/${stem}.json`, JSON.stringify({ detail, decorators, model, issues, coverage,
      occurrences: [...builder.occurrenceSemanticIds], relationships: [...builder.relationshipSegments], ...result }, null, 2));
    const rendered = await renderPositionedSceneToSvg(result.positionedScene);
    await writeFile(`/tmp/sdd-b5-topology/${stem}.svg`, rendered.svg);
    // User accepted this inherited limitation for the current port. Keep the
    // raw evidence and native warning; a future shared-node change will replace
    // oversized IDs with '(long ID)'. No other geometry failure is exempted.
    if (name === "long_ids" && decorators.includes("id")) {
      expect(issues.some(issue => issue.startsWith("renderer.measure.shared_node_decorator_overflow:"))).toBe(true);
      expect(issues.filter(issue => !issue.startsWith("renderer.measure.shared_node_decorator_overflow:") && !issue.startsWith("semantic decorator bounds:"))).toEqual([]);
    } else expect(issues).toEqual([]);
    expect(coverage).toEqual([]);
    expect(rendered.svg).not.toMatch(/marker-(?:start|end)=/);
    const expectedArrows = result.positionedScene.edges.reduce((count, edge) => count + Number(edge.markers?.start === "arrow") + Number(edge.markers?.end === "arrow"), 0);
    expect(rendered.svg.match(/class="ui-contracts-arrowhead"/g) ?? []).toHaveLength(expectedArrows);
    expect(new Set(builder.occurrenceSemanticIds.values())).toEqual(new Set(model.visibleSemanticNodeIds));
    if (name === "parallel_bindings") expect(model.relationships.map(edge => edge.label)).toEqual(["binds field first", "binds field second"]);
    if (name === "three_parents_children") {
      const enclosures = flattenUiContractsItems(result.positionedScene.root).filter(item => item.kind === "container" && item.viewMetadata?.uiContracts?.kind === "enclosure");
      expect(enclosures.some(item => item.kind === "container" && item.children.filter(child => child.kind === "node" && builder.occurrenceSemanticIds.get(child.id)?.startsWith("C-12")).length === 3)).toBe(true);
    }
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
