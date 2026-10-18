import { mkdir, writeFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import type { Bundle } from "../src/bundle/types.js";
import { resolveUiContractsPresentation } from "../src/bundle/uiContractsPresentation.js";
import { projectView } from "../src/projector/projectView.js";
import { buildUiContractsPresentationModel } from "../src/renderer/uiContractsPresentationModel.js";
import { auditUiContractsScene, uiSceneItems } from "../src/renderer/staged/uiContractsAcceptance.js";
import { runUiContractsRendererPipeline } from "../src/renderer/staged/uiContractsPipeline.js";
import { testUiRoutingPolicy } from "./uiContractsRoutingTestSupport.js";

let bundle: Bundle;
beforeAll(async () => { bundle = await loadBundle("bundle/v0.2/manifest.yaml"); });

// These topology builders and relationships preserve the real existing fixtures
// in uiContractsTopology.spec.ts; only their authored format version is current.
const block = (type: string, id: string, name: string, body = "") => `${type} ${id} "${name}"\n${body}\nEND\n`;
const sdd = (...blocks: string[]) => "SDD-TEXT 0.2\n" + blocks.join("");
const stateGraph = (links: Array<[number, number]>) => sdd(block("Component", "C-100", "Controller"),
  ...[...new Set(links.flat())].map(index => block("State", `ST-${100 + index}`, `State ${index}`, `  scope_id=C-100\n`
    + links.filter(([from]) => from === index).map(([, to]) => `  TRANSITIONS_TO ST-${100 + to} "State ${to}" {ready_${index}_${to}}`).join("\n"))));
const viewStateGraph = (links: Array<[number, number]>) => sdd(
  ...[...new Set(links.flat())].map(index => block("ViewState", `VS-${100 + index}`, `View State ${index}`,
    links.filter(([from]) => from === index).map(([, to]) => `  TRANSITIONS_TO VS-${100 + to} "View State ${to}"`).join("\n"))));

const fixtures = {
  fork: stateGraph([[0, 1], [0, 2]]),
  merge: stateGraph([[0, 2], [1, 2]]),
  diamond: stateGraph([[0, 1], [0, 2], [1, 3], [2, 3]]),
  cycle: stateGraph([[0, 1], [1, 2], [2, 0]]),
  disconnected: stateGraph([[0, 1], [2, 3]]),
  general_fanout: viewStateGraph([[0, 1], [0, 2], [0, 3]]),
  multi_fanout_chain: viewStateGraph([[0, 1], [0, 2], [1, 3], [1, 4]]),
  composition_fanout: sdd(block("Place", "P-100", "Place", '  COMPOSED_OF C-100 "One"\n  COMPOSED_OF C-101 "Two"\n  COMPOSED_OF C-102 "Three"'),
    ...["One", "Two", "Three"].map((name, index) => block("Component", `C-${100 + index}`, name))),
  parallel_bindings: sdd(block("Component", "C-100", "Form", '  BINDS_TO D-100 "Record" field=first\n  BINDS_TO D-100 "Record" field=second'),
    block("DataEntity", "D-100", "Record"), block("State", "ST-100", "Ready", "  scope_id=C-100")),
  contract_fanout: sdd(block("Component", "C-100", "Form", '  EMITS E-100 "First"\n  EMITS E-101 "Second"\n  EMITS E-102 "Third"'),
    ...["First", "Second", "Third"].map((name, index) => block("Event", `E-${100 + index}`, name))),
  containment: sdd(...[0, 1, 2].map(index => block("Component", `C-${100 + index}`, `Parent ${index}`, '  CONTAINS C-110 "Focal"')),
    block("Component", "C-110", "Focal", [0, 1, 2].map(index => `  CONTAINS C-${120 + index} "Child ${index}"`).join("\n")),
    ...[0, 1, 2].map(index => block("Component", `C-${120 + index}`, `Child ${index}`))),
  nested_reuse: sdd(
    block("Component", "C-100", "Root", '  CONTAINS C-110 "Reusable"\n  CONTAINS C-120 "Second branch"'),
    block("Component", "C-101", "Disconnected root"),
    block("Component", "C-110", "Reusable", '  CONTAINS C-130 "Nested reusable"'),
    block("Component", "C-120", "Second branch", '  CONTAINS C-110 "Reusable"\n  CONTAINS C-130 "Nested reusable"'),
    block("Component", "C-130", "Nested reusable", '  CONTAINS C-140 "Deep leaf"'), block("Component", "C-140", "Deep leaf")),
  secondary: sdd(block("Component", "C-100", "Controller"),
    block("ViewState", "VS-100", "Primary ready", '  TRANSITIONS_TO VS-101 "Primary done"'), block("ViewState", "VS-101", "Primary done"),
    block("State", "ST-100", "Secondary ready", '  scope_id=C-100\n  TRANSITIONS_TO ST-101 "Secondary done" {ready}'),
    block("State", "ST-101", "Secondary done", "  scope_id=C-100")),
  separate_owners: sdd(...[0, 1].flatMap(index => [
    block("Place", `P-${100 + index}`, `Place ${index}`, `  CONTAINS VS-${100 + index} "View ${index}"`),
    block("ViewState", `VS-${100 + index}`, `View ${index}`, `  place_id=P-${100 + index}\n  TRANSITIONS_TO VS-${100 + index} "View ${index}" {repeat_${index}}`)
  ]))
};

function prepare(name: keyof typeof fixtures, detail: string) {
  const view = structuredClone(bundle.views.views.find(view => view.id === "ui_contracts")!);
  view.conventions.renderer_defaults!.ui_contracts_presentation!.routing = structuredClone(testUiRoutingPolicy);
  const policy = resolveUiContractsPresentation(view).routing;
  const compiled = compileSource({ path: `/tmp/ui-enabled-${name}.sdd`, text: fixtures[name] }, bundle);
  expect(compiled.diagnostics).toEqual([]);
  const projected = projectView(compiled.graph!, bundle, view.id);
  expect(projected.diagnostics).toEqual([]);
  const model = buildUiContractsPresentationModel(projected.projection!, compiled.graph!, view, detail);
  expect(model.routing).toEqual(policy);
  expect(model.routing!.capacity.node).toBe("fixed");
  expect(model.diagnostics).toEqual([]);
  return model;
}

const cases: Array<{ name: keyof typeof fixtures; detail: "compact" | "detailed"; decorators: string }> = [
  { name: "fork", detail: "compact", decorators: "none" },
  { name: "merge", detail: "detailed", decorators: "type" },
  { name: "diamond", detail: "compact", decorators: "type,id" },
  { name: "diamond", detail: "detailed", decorators: "none" },
  { name: "cycle", detail: "compact", decorators: "type" },
  { name: "disconnected", detail: "detailed", decorators: "none" },
  { name: "general_fanout", detail: "compact", decorators: "type,id" },
  { name: "multi_fanout_chain", detail: "detailed", decorators: "none" },
  { name: "composition_fanout", detail: "compact", decorators: "type" },
  { name: "parallel_bindings", detail: "detailed", decorators: "type,id" },
  { name: "contract_fanout", detail: "detailed", decorators: "none" },
  { name: "containment", detail: "compact", decorators: "type,id" },
  { name: "containment", detail: "detailed", decorators: "none" },
  { name: "nested_reuse", detail: "detailed", decorators: "type" },
  { name: "secondary", detail: "detailed", decorators: "type,id" },
  { name: "separate_owners", detail: "compact", decorators: "none" }
];

describe("enabled UI routing on established topology builders", () => {
  for (const { name, detail, decorators } of cases) it(`${name} / ${detail} / ${decorators}`, async () => {
    const model = prepare(name, detail);
    const inputBefore = structuredClone(model);
    const settings = { detailId: detail, nodeDecoratorMode: { id: decorators, showNodeType: decorators.includes("type"), showNodeId: decorators.includes("id") } };
    // Exercise ordinary recovery for this existing general graph; the other
    // representative fixtures should pass without route repairs.
    const outcome = await runUiContractsRendererPipeline(model, settings,
      name === "multi_fanout_chain" ? {} : { candidates: 64, repairs: 0 });
    if (outcome.status !== "accepted") {
      await mkdir("/tmp/sdd-enabled-topology", { recursive: true });
      await writeFile(`/tmp/sdd-enabled-topology/${name}.${detail}.${decorators.replace(",", "-")}.json`, JSON.stringify({ model, outcome }, null, 2));
    }
    expect(outcome.status, JSON.stringify(outcome.status === "failed" ? { reason: outcome.reason, findings: outcome.violations } : outcome.evidence)).toBe("accepted");
    if (outcome.status !== "accepted") return;
    expect(model).toEqual(inputBefore);
    const scene = outcome.revision.positionedScene, inventory = scene.root.viewMetadata!.uiContracts!.inventory!;
    expect(auditUiContractsScene(scene)).toEqual([]);
    expect(inventory.relationships.map(relationship => relationship.id).sort()).toEqual(model.relationships.map(relationship => relationship.id).sort());
    expect(new Set(inventory.occurrences.map(occurrence => occurrence.semanticId))).toEqual(new Set(model.visibleSemanticNodeIds));
    const itemIds = new Set(uiSceneItems(scene.root).map(item => item.id));
    for (const occurrence of inventory.occurrences) expect(itemIds.has(occurrence.id), occurrence.id).toBe(true);
    expect(new Set(scene.edges.map(edge => edge.id)).size).toBe(scene.edges.length);
    expect(new Set(inventory.segments.map(segment => segment.id))).toEqual(new Set(scene.edges.map(edge => edge.id)));
    for (const relationship of inventory.relationships.filter(relationship => !relationship.structural)) {
      expect(relationship.paths!.length, relationship.id).toBeGreaterThan(0);
      for (const path of relationship.paths!) expect(path.segments.length, relationship.id).toBeGreaterThan(0);
      for (const id of relationship.segmentIds) expect(inventory.segments.find(segment => segment.id === id)!.relationshipIds).toContain(relationship.id);
    }
    if (["fork", "merge", "diamond", "general_fanout"].includes(name)) {
      expect(inventory.segments.some(segment => segment.junction !== undefined)).toBe(true);
      expect(inventory.segments.some(segment => segment.relationshipIds.length > 1)).toBe(true);
    }
    if (name === "parallel_bindings") expect(model.relationships.map(edge => edge.label)).toEqual(["binds field first", "binds field second"]);
    if (name === "secondary") expect(model.scopes.flatMap(scope => scope.sequences.flatMap(sequence => sequence.nodes)).map(node => node.semanticId)).toEqual(expect.arrayContaining(["ST-100", "ST-101", "VS-100", "VS-101"]));
    if (name === "nested_reuse") expect(inventory.occurrences.length).toBeGreaterThan(new Set(inventory.occurrences.map(occurrence => occurrence.semanticId)).size);
    if (name === "separate_owners") {
      const loops = scene.edges.filter(edge => edge.viewMetadata?.uiTransition?.kind === "loop");
      expect(loops).toHaveLength(2);
      expect(new Set(loops.map(edge => edge.ownerContainerId)).size).toBe(2);
    }
    if (name === "diamond" && detail === "compact") {
      const repeat = await runUiContractsRendererPipeline(model, settings, { candidates: 64, repairs: 0 });
      expect(repeat.status).toBe("accepted");
      if (repeat.status === "accepted") {
        expect(repeat.revision).toEqual(outcome.revision);
        expect(repeat.evidence).toEqual(outcome.evidence);
      }
    }
  });
});
