import { mkdir, readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import type { SceneEdge } from "../src/renderer/staged/contracts.js";
import { buildSharedNode } from "../src/renderer/staged/sceneBuilders.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import { renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import { assessUiContractsCoverage, assessUiContractsGeometry } from "./uiContractsB5Acceptance.js";
import { buildFanoutProof } from "./uiContractsFanoutProof.js";

const fixture = "docs/hierarchical_ui_contracts/departure_desk.sdd";
const cases = ["C-430", "C-420", "C-450", "long-binding", "eight-targets"];

describe("single-source contract fan-out feasibility", () => {
  for (const decoratorId of ["none", "type,id"]) for (const testCase of cases) {
    it(`${testCase}, decorators ${decoratorId}`, async () => {
      const bundle = await loadBundle("bundle/v0.1/manifest.yaml");
      const stressText = `SDD-TEXT 0.1\nComponent C-900 "Contract source"\n${Array.from({ length: 8 }, (_, i) => `  EMITS E-90${i} "Event ${i}"`).join("\n")}\nEND\n${Array.from({ length: 8 }, (_, i) => `Event E-90${i} "Event ${i}"\nEND`).join("\n")}\n`;
      const compiled = compileSource({ path: fixture, text: testCase === "eight-targets" ? stressText : await readFile(fixture, "utf8") }, bundle);
      expect(compiled.diagnostics).toEqual([]);
      const graph = compiled.graph!, byId = new Map(graph.nodes.map(node => [node.id, node]));
      const sourceId = testCase === "eight-targets" ? "C-900" : testCase.startsWith("C-") ? testCase : "C-430";
      const contracts = graph.edges.filter(edge => edge.from === sourceId && ["EMITS", "BINDS_TO", "DEPENDS_ON"].includes(edge.type));
      const entries = contracts;
      const node = (id: string, occurrence: string) => ({ ...buildSharedNode({ nodeId: id, nodeType: byId.get(id)!.type,
        title: byId.get(id)!.name, decoratorMode: { id: decoratorId, showNodeType: decoratorId !== "none", showNodeId: decoratorId !== "none" }, attributes: [] }), id: occurrence });
      const source = node(sourceId, "source"), targets = entries.map((edge, i) => node(edge.to, `target:${i}`));
      const edges: SceneEdge[] = entries.map((edge, index) => ({ id: `contract:${index}`, role: edge.type.toLowerCase(),
        classes: edge.type === "EMITS" ? ["edge-dashed"] : edge.type === "BINDS_TO" ? ["edge-dotted"] : [],
        from: { itemId: source.id }, to: { itemId: targets[index].id }, routing: { style: "orthogonal" },
        label: { text: edge.type === "EMITS" ? "emits" : edge.type === "DEPENDS_ON" ? "depends on"
          : testCase === "long-binding" ? "binds field departure_manifest_verification_confirmation_status" : `binds field ${edge.props.field}`, textStyleRole: "edge_label" }, markers: { end: "arrow" } }));
      const input = buildFanoutProof(source, targets, edges);
      const result = await runStagedRendererPipeline(input);
      const geometry = assessUiContractsGeometry(result.positionedScene);
      const occurrences = new Map([[source.id, sourceId], ...targets.map((target, i) => [target.id, entries[i].to])]);
      const relationships = new Map(edges.map((edge, i) => [edge.id, i === 0 ? [edge.id] : [edge.id + ":lead", edge.id]]));
      expect(assessUiContractsCoverage({ expectedNodeIds: [...new Set(occurrences.values())], occurrences,
        expectedRelationshipIds: edges.map(edge => edge.id), relationshipSegments: relationships, scene: result.positionedScene })).toEqual([]);
      const rendered = await renderPositionedSceneToSvg(result.positionedScene);
      const directory = process.env.SDD_B5_PROOF_DIR ?? "/tmp/sdd-b5-fanout-proofs";
      await mkdir(directory, { recursive: true });
      const name = `${testCase}.${decoratorId.replace(",", "-")}`;
      await writeFile(`${directory}/${name}.svg`, rendered.svg + "\n");
      await writeFile(`${directory}/${name}.json`, JSON.stringify({ testCase, decorators: decoratorId, geometry,
        occurrences: [...occurrences], relationships: [...relationships], ...result }, null, 2) + "\n");
      expect(geometry).toEqual([]);
      expect(rendered.diagnostics).toEqual([]);
      expect(rendered.svg).not.toContain("<circle");
      expect([...occurrences.values()].filter(id => id === sourceId)).toHaveLength(1);
    });
  }
});
