import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import type { PositionedItem, PositionedScene } from "../src/renderer/staged/contracts.js";
import type { UiContractsSequence } from "../src/renderer/uiContractsPresentationModel.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import { buildUiContractsPresentationModel } from "../src/renderer/uiContractsPresentationModel.js";
import { buildCompactLoopProofScene, capturedProofRelationshipSegments, COMPACT_LOOP_PROOF, normalizeCompactLoopPair,
  prepareCompactLoopProof, proofFile, proofSha256 } from "./uiContractsCompactLoopFixture.js";

const evidenceDirectory = "src/renderer/staged/routing-prototype/";
let proof: Awaited<ReturnType<typeof prepareCompactLoopProof>>;
let captured: { captures: { mixed: { sequence: UiContractsSequence; positioned: PositionedScene }; diagram: { sequence: UiContractsSequence; positioned: PositionedScene } } };
beforeAll(async () => {
  [proof, captured] = await Promise.all([prepareCompactLoopProof(), readFile(proofFile(`${evidenceDirectory}evidence.json`), "utf8").then(JSON.parse)]);
});

const translateItem = (item: PositionedItem, x: number, y: number): void => {
  item.x += x; item.y += y;
  if (item.kind === "container") item.children.forEach(child => translateItem(child, x, y));
};

describe("actual UI Contracts compact-loop proof baseline", () => {
  it("prepares the full three-transition scope and authored DG-002 two-transition selection independently", () => {
    expect(proof.full.sequence.nodes.map(node => node.semanticId)).toEqual(["VS-001", "VS-002"]);
    expect(proof.diagram.sequence.nodes.map(node => node.semanticId)).toEqual(["VS-001", "VS-002"]);
    expect(proof.full.sequence.edges).toHaveLength(3);
    expect(proof.diagram.sequence.edges).toHaveLength(2);
    expect(proof.full.sequence.edges.filter(edge => edge.from === edge.to)).toHaveLength(1);
    expect(proof.diagram.sequence.edges.every(edge => edge.from !== edge.to)).toBe(true);
    expect(proof.diagram.preview.diagramId).toBe(COMPACT_LOOP_PROOF.diagramId);
    expect(proof.diagram.preview.prepared!.projection.diagram_id).toBe(COMPACT_LOOP_PROOF.diagramId);
    expect(proof.full.sequence.edges.map(edge => edge.label)).toEqual(captured.captures.mixed.sequence.edges.map(edge => edge.label));
    expect(proof.diagram.sequence.edges.map(edge => edge.label)).toEqual(captured.captures.diagram.sequence.edges.map(edge => edge.label));
    expect(proof.diagram.preview.diagnostics).toEqual([]);
    expect(proof.full.preview.diagnostics).toEqual([]);
    expect(buildUiContractsPresentationModel(proof.diagram.preview.prepared!.projection, proof.graph, proof.diagram.preview.view,
      COMPACT_LOOP_PROOF.detailId).scopes.find(scope => scope.id === COMPACT_LOOP_PROOF.scopeId)!.sequences[0].edges).toEqual(proof.diagram.sequence.edges);
  });

  it("preserves the working production-prepared pair up to translation", async () => {
    const fixture = buildCompactLoopProofScene(proof.diagram);
    const actual = await runStagedRendererPipeline(fixture.scene);
    const historical = captured.captures.diagram;
    expect(actual.positionedScene.diagnostics.filter(d => d.severity === "error")).toEqual([]);
    expect(normalizeCompactLoopPair(actual.positionedScene, proof.diagram.sequence, fixture.relationshipSegments))
      .toEqual(normalizeCompactLoopPair(historical.positioned, historical.sequence,
        capturedProofRelationshipSegments(historical.positioned, historical.sequence)));
  });

  it("compares relationship provenance across changed physical edge IDs and whole-region translation", () => {
    const historical = captured.captures.diagram;
    const paths = capturedProofRelationshipSegments(historical.positioned, historical.sequence);
    const expected = normalizeCompactLoopPair(historical.positioned, historical.sequence, paths);
    const changed = structuredClone(historical.positioned);
    const renamed = new Map(changed.edges.map((edge, index) => [edge.id, `replacement-edge-${index}`]));
    changed.edges.forEach(edge => { edge.id = renamed.get(edge.id)!; });
    const translatedPaths = new Map([...paths].map(([relationship, segments]) => [relationship, segments.map(id => renamed.get(id)!)]));
    translateItem(changed.root, 73, -241);
    for (const edge of changed.edges) {
      for (const p of [edge.from, edge.to, ...edge.route.points, ...(edge.label ? [edge.label] : [])]) { p.x += 73; p.y -= 241; }
    }
    expect(normalizeCompactLoopPair(changed, historical.sequence, translatedPaths)).toEqual(expected);
  });

  it("detects changed pair routing, labels, dimensions, and markers", () => {
    const historical = captured.captures.diagram;
    const paths = capturedProofRelationshipSegments(historical.positioned, historical.sequence);
    const expected = normalizeCompactLoopPair(historical.positioned, historical.sequence, paths);
    const firstSegment = paths.values().next().value![0];
    const rerouted = structuredClone(historical.positioned), route = rerouted.edges.find(edge => edge.id === firstSegment)!.route.points;
    route.splice(1, 0, { x: route[0].x + 20, y: route[0].y - 20 });
    expect(normalizeCompactLoopPair(rerouted, historical.sequence, paths)).not.toEqual(expected);
    const relabeled = structuredClone(historical.positioned);
    relabeled.edges.find(edge => edge.id === firstSegment)!.label!.lines = ["Truncated label"];
    expect(normalizeCompactLoopPair(relabeled, historical.sequence, paths)).not.toEqual(expected);
    const remarked = structuredClone(historical.positioned);
    remarked.edges.find(edge => edge.id === firstSegment)!.markers = {};
    expect(normalizeCompactLoopPair(remarked, historical.sequence, paths)).not.toEqual(expected);
    const resized = structuredClone(historical.positioned);
    const visit = (item: PositionedItem): void => {
      if (item.id === historical.sequence.nodes[0].id) item.width += 10;
      if (item.kind === "container") item.children.forEach(visit);
    };
    visit(resized.root);
    expect(normalizeCompactLoopPair(resized, historical.sequence, paths)).not.toEqual(expected);
  });

  it("allows complete connectors to replace fragments without changing visual geometry", () => {
    const historical = captured.captures.diagram;
    const paths = capturedProofRelationshipSegments(historical.positioned, historical.sequence);
    const expected = normalizeCompactLoopPair(historical.positioned, historical.sequence, paths);
    const complete = structuredClone(historical.positioned);
    complete.edges = [];
    const completePaths = new Map<string, string[]>();
    for (const [relationship, ids] of paths) {
      const fragments = ids.map(id => historical.positioned.edges.find(edge => edge.id === id)!);
      const first = structuredClone(fragments[0]), last = fragments.at(-1)!;
      first.id = `complete-${complete.edges.length}`;
      first.to = structuredClone(last.to);
      first.route.points = structuredClone(fragments.flatMap(edge => edge.route.points));
      first.label = structuredClone(fragments.find(edge => edge.label)?.label);
      first.markers = structuredClone(last.markers);
      complete.edges.push(first);
      completePaths.set(relationship, [first.id]);
    }
    expect(normalizeCompactLoopPair(complete, historical.sequence, completePaths)).toEqual(expected);
  });

  it("retains the exact source, captured failure, successful named output, and accepted local exemplar", async () => {
    const focused = JSON.parse(await readFile(proofFile(`${evidenceDirectory}focused-comparison-evidence.json`), "utf8"));
    for (const source of [focused.sources.captures, focused.sources.namedSvg]) {
      expect(proofSha256(await readFile(proofFile(`${evidenceDirectory}${source.path}`), "utf8"))).toBe(source.sha256);
    }
    expect(proofSha256(proof.text)).toBe(focused.sources.documentSha256);
    const reference = focused.sources.visualReference;
    expect(proofSha256(await readFile(proofFile(reference.path), "utf8"))).toBe(reference.sha256);
    expect(proofSha256(await readFile(proofFile(reference.path.replace(/\.svg$/, ".json")), "utf8"))).toBe(reference.positionedSceneSha256);
    expect(focused.selectedSide).toBe("south");
    expect(focused.pitch).toBe(23);
    expect(focused.depth).toBe(17);
    expect(focused.enlargement).toBe(80);
    expect(captured.captures.mixed.positioned.diagnostics.some(d => d.severity === "error")).toBe(true);
  });
});
