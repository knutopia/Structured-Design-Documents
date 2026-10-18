import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compileSource, loadBundle } from "../src/index.js";
import { prepareCompiledGraphPreview } from "../src/renderer/previewWorkflow.js";
import type { UiContractsSequence, UiContractsScope } from "../src/renderer/uiContractsPresentationModel.js";
import type { Point, PositionedEdge, PositionedItem, PositionedScene } from "../src/renderer/staged/contracts.js";
import { UiContractsSceneBuilder } from "../src/renderer/staged/uiContractsPresentationScene.js";

export const COMPACT_LOOP_PROOF = {
  source: "aeb_help_center_de_astra.sdd",
  sourceSha256: "2403cb8aa57b17e54af5e68fe3e908fc3a98d0a9cf84c2098396370f12ae3bf7",
  manifest: "bundle/v0.2/manifest.yaml",
  scopeId: "scope:P-360005333058",
  diagramId: "DG-002",
  detailId: "compact",
  decorators: { id: "type,id", showNodeType: true, showNodeId: true }
} as const;

export const proofFile = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
export const proofSha256 = (text: string) => createHash("sha256").update(text).digest("hex");

async function loadProof() {
  const [bundle, text] = await Promise.all([
    loadBundle(proofFile(COMPACT_LOOP_PROOF.manifest)), readFile(proofFile(COMPACT_LOOP_PROOF.source), "utf8")
  ]);
  if (proofSha256(text) !== COMPACT_LOOP_PROOF.sourceSha256) throw new Error("The original compact-loop proof source changed; reassess its historical evidence explicitly.");
  const compiled = compileSource({ path: proofFile(COMPACT_LOOP_PROOF.source), text }, bundle);
  if (!compiled.graph || compiled.diagnostics.some(d => d.severity === "error")) throw new Error(JSON.stringify(compiled.diagnostics));
  const graph = compiled.graph;
  const prepare = (diagramId?: string) => {
    const preview = prepareCompiledGraphPreview(COMPACT_LOOP_PROOF.source, graph, bundle, {
      viewId: "ui_contracts", diagramId, format: "svg", profileId: "simple", detailId: COMPACT_LOOP_PROOF.detailId,
      nodeDecoratorModeId: COMPACT_LOOP_PROOF.decorators.id
    });
    const model = preview.prepared?.presentationModel;
    if (!model || preview.diagnostics.some(d => d.severity === "error")) throw new Error(JSON.stringify(preview.diagnostics));
    const scope = model.scopes.find(scope => scope.id === COMPACT_LOOP_PROOF.scopeId);
    if (!scope || scope.sequences.length !== 1) throw new Error("Expected one prepared sequence in the actual proof scope.");
    return { preview, model, scope, sequence: scope.sequences[0] };
  };
  return { bundle, graph, text, full: prepare(), diagram: prepare(COMPACT_LOOP_PROOF.diagramId) };
}
let cachedProof: ReturnType<typeof loadProof> | undefined;
/** Compile once per worker. Prepared data is isolated; retain the read-only graph identity
 * because source-edge indexes and author order live in production WeakMaps. */
export async function prepareCompactLoopProof() {
  const proof = await (cachedProof ??= loadProof());
  return { ...proof, bundle: structuredClone(proof.bundle), full: structuredClone(proof.full), diagram: structuredClone(proof.diagram) };
}

/** Keep real owner/siblings, or isolate only its production-prepared transition sequence. */
export function buildCompactLoopProofScene(proof: { scope: UiContractsScope; sequence: UiContractsSequence }, region: "scope" | "sequence" = "sequence") {
  const builder = new UiContractsSceneBuilder(COMPACT_LOOP_PROOF.detailId, COMPACT_LOOP_PROOF.decorators);
  builder.scene.root.children = [region === "scope" ? builder.scope(proof.scope, true) : builder.sequence(proof.sequence)];
  return { scene: builder.scene, relationshipSegments: builder.relationshipSegments, occurrenceSemanticIds: builder.occurrenceSemanticIds };
}

function flatten(item: PositionedItem): PositionedItem[] {
  return [item, ...(item.kind === "container" ? item.children.flatMap(flatten) : [])];
}
const samePoint = (a: Point, b: Point) => Math.abs(a.x - b.x) < 0.0001 && Math.abs(a.y - b.y) < 0.0001;
const sameEndpoint = (a: PositionedEdge["from"], b: PositionedEdge["from"]) => a.itemId === b.itemId && a.portId === b.portId;

/** Historical captures predate persisted inventory. Recover ordered paths by endpoint continuity,
 * then bind them to production-prepared relationship provenance, never edge-ID suffixes. */
export function capturedProofRelationshipSegments(scene: PositionedScene, sequence: UiContractsSequence): Map<string, string[]> {
  const paths = new Map<string, string[]>();
  for (const relationship of sequence.edges) {
    const possibilities: PositionedEdge[][] = [];
    const visit = (path: PositionedEdge[]) => {
      const last = path.at(-1)!;
      if (last.to.itemId === relationship.to) { possibilities.push(path); return; }
      if (path.length > scene.edges.length) return;
      for (const next of scene.edges) if (!path.includes(next) && sameEndpoint(last.to, next.from)) visit([...path, next]);
    };
    for (const edge of scene.edges) if (edge.from.itemId === relationship.from) visit([edge]);
    const matching = possibilities.filter(path => path.flatMap(edge => edge.label?.lines ?? []).join("").replace(/\s/g, "") === (relationship.label ?? "").replace(/\s/g, ""));
    if (matching.length !== 1) throw new Error(`Expected one continuous captured path for ${relationship.relationshipId}; found ${matching.length}.`);
    paths.set(relationship.relationshipId, matching[0].map(edge => edge.id));
  }
  return paths;
}

/** Visual preservation comparison: semantic nodes and prepared relationship provenance survive
 * edge-fragment replacement. Only translation and redundant collinear route vertices are ignored. */
export function normalizeCompactLoopPair(scene: PositionedScene, sequence: UiContractsSequence, relationshipSegments: ReadonlyMap<string, readonly string[]>) {
  const items = new Map(flatten(scene.root).map(item => [item.id, item]));
  const nodes = sequence.nodes.map(node => {
    const item = items.get(node.id);
    if (!item || item.kind !== "node") throw new Error(`Missing proof node ${node.semanticId}.`);
    return { occurrence: node, item };
  });
  const origin = nodes[0]?.item;
  if (!origin) throw new Error("Empty proof sequence.");
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const point = (p: Point) => ({ x: round(p.x - origin.x), y: round(p.y - origin.y) });
  const semanticIds = new Map(sequence.nodes.map(node => [node.id, node.semanticId]));
  const relationships = sequence.edges.filter(edge => edge.from !== edge.to).map(relationship => {
    const segmentIds = relationshipSegments.get(relationship.relationshipId);
    if (!segmentIds?.length) throw new Error(`Missing relationship path ${relationship.relationshipId}.`);
    const edges = segmentIds.map(id => {
      const edge = scene.edges.find(edge => edge.id === id);
      if (!edge) throw new Error(`Missing path segment ${id}.`);
      return edge;
    });
    const points: Point[] = [];
    for (const [index, edge] of edges.entries()) {
      if (index && !samePoint(edges[index - 1].route.points.at(-1)!, edge.route.points[0])) throw new Error("Disconnected relationship path.");
      for (const p of edge.route.points) {
        if (points.length && samePoint(points.at(-1)!, p)) continue;
        while (points.length > 1) {
          const a = points[points.length - 2], b = points.at(-1)!;
          if ((a.x === b.x && b.x === p.x && (b.y - a.y) * (p.y - b.y) >= 0) || (a.y === b.y && b.y === p.y && (b.x - a.x) * (p.x - b.x) >= 0)) points.pop();
          else break;
        }
        points.push(p);
      }
    }
    const first = edges[0], last = edges.at(-1)!;
    return {
      provenance: { from: semanticIds.get(relationship.from), to: semanticIds.get(relationship.to), kind: relationship.kind, label: relationship.label },
      from: { semanticId: semanticIds.get(first.from.itemId), ...point(first.from) },
      to: { semanticId: semanticIds.get(last.to.itemId), ...point(last.to) },
      points: points.map(point),
      labels: edges.flatMap(edge => edge.label ? [{ ...edge.label, ...point(edge.label) }] : []),
      markers: edges.flatMap(edge => [
        ...(edge.markers?.start ? [{ type: edge.markers.start, end: "start", ...point(edge.route.points[0]) }] : []),
        ...(edge.markers?.end ? [{ type: edge.markers.end, end: "end", ...point(edge.route.points.at(-1)!) }] : [])
      ]),
      styles: [...new Set(edges.map(edge => JSON.stringify({ role: edge.role, classes: edge.classes, route: edge.route.style, paintGroup: edge.paintGroup })))].sort()
    };
  });
  return { nodes: nodes.map(({ occurrence, item }) => ({ semanticId: occurrence.semanticId, ...point(item), width: item.width, height: item.height,
    primitive: item.primitive, classes: item.classes, content: item.content, sharedNode: item.sharedNode })), relationships };
}
