import { resolveDiagramSelection } from "../diagrams/resolveDiagrams.js";
import type { Bundle } from "../bundle/types.js";
import type { Diagnostic } from "../types.js";
import {
  attachGraphAuthorOrder, attachGraphSourcePath, getGraphAuthorOrder, getGraphSourcePath, getCompiledEdgeSourceSpan,
  type CompiledEdge, type CompiledGraph
} from "../compiler/types.js";
import { createSourceEdgeIndex, type SourceEdgeIndex } from "../relationships/edgeIdentity.js";
import type { Projection, ProjectionEdge } from "./types.js";

const indexes = new WeakMap<CompiledGraph, SourceEdgeIndex>();

/** Keep exact document associations outside serialized graph/projection state. */
export function attachProjectionSourceEdgeIndex(graph: CompiledGraph, index: SourceEdgeIndex): void {
  indexes.set(graph, index);
}

export function copySelectedGraphContext(document: CompiledGraph, selected: CompiledGraph, index?: SourceEdgeIndex): void {
  const sourcePath = getGraphSourcePath(document);
  if (sourcePath) attachGraphSourcePath(selected, sourcePath);
  const authorOrder = getGraphAuthorOrder(document);
  if (authorOrder) {
    const nodeIds = new Set(selected.nodes.map(node => node.id));
    attachGraphAuthorOrder(selected, {
      topLevelNodeIds: authorOrder.topLevelNodeIds.filter(id => nodeIds.has(id)),
      edgeLineOrderByParentId: new Map([...authorOrder.edgeLineOrderByParentId]
        .filter(([id]) => nodeIds.has(id))
        .map(([id]) => [id, selected.edges.filter(edge => edge.from === id)
          .map((edge, index) => ({ edge, index, offset: getCompiledEdgeSourceSpan(edge)?.startOffset }))
          .sort((a, b) => (a.offset ?? a.index) - (b.offset ?? b.index) || a.index - b.index)
          .map(({ edge }) => ({ type: edge.type, to: edge.to }))]))
    });
  }
  const inherited = index ?? indexes.get(document);
  if (inherited) indexes.set(selected, inherited);
}

export function resolveProjectionEdge(edge: ProjectionEdge, graph: CompiledGraph, named = false): CompiledEdge | undefined {
  if (edge.source_edge_id) {
    const resolved = indexes.get(graph)?.resolve(edge.source_edge_id, { from: edge.from, type: edge.type, to: edge.to });
    if (!resolved) throw new Error(`Unresolved source edge '${edge.source_edge_id}' for ${edge.from} ${edge.type} ${edge.to}.`);
    return resolved;
  }
  if (named) throw new Error(`Named projected edge ${edge.from} ${edge.type} ${edge.to} has no source_edge_id.`);
  return graph.edges.find(candidate => candidate.from === edge.from && candidate.type === edge.type && candidate.to === edge.to);
}

/** Renderer structural scans may use only selected occurrences; node lookup stays document-wide. */
export function graphForProjection(projection: Projection, document: CompiledGraph): CompiledGraph {
  if (!projection.diagram_id) return document;
  const graph = { ...document, edges: projection.edges.map(edge => resolveProjectionEdge(edge, document, true)!) };
  copySelectedGraphContext(document, graph);
  return graph;
}

export function projectionEdgeRenderId(edge: ProjectionEdge, legacyId: string): string {
  return edge.source_edge_id ? `${legacyId}__${edge.source_edge_id}` : legacyId;
}

export function ensureProjectionSourceEdgeIndex(graph: CompiledGraph, bundle: Bundle): void {
  if (!indexes.has(graph)) indexes.set(graph, createSourceEdgeIndex(graph, bundle));
}

export function projectionOccurrenceDiagnostics(
  projection: Projection, graph: CompiledGraph, bundle: Bundle, trustedSelectedEdgeIds?: ReadonlySet<string>
): Diagnostic[] {
  if (!projection.diagram_id) return [];
  const diagnostics: Diagnostic[] = [];
  const fail = (message: string) => diagnostics.push({ stage: "project", code: "project.invalid_source_edge_reference",
    severity: "error", message, file: getGraphSourcePath(graph) ?? "<compiled>", relatedIds: [projection.diagram_id!] });
  let selectedEdgeIds = trustedSelectedEdgeIds;
  if (!selectedEdgeIds) {
    const selection = resolveDiagramSelection(graph, bundle, { viewId: projection.view_id, diagramId: projection.diagram_id });
    const selectionErrors = selection.diagnostics.filter(diagnostic => diagnostic.severity === "error");
    if (selectionErrors.length) return selectionErrors;
    attachProjectionSourceEdgeIndex(graph, selection.sourceEdgeIndex);
    selectedEdgeIds = new Set(selection.edges.map(edge => selection.sourceEdgeIndex.idFor(edge)!));
  }
  const edgeIds = new Set<string>();
  for (const edge of projection.edges) {
    try { resolveProjectionEdge(edge, graph, true); } catch (error) { fail(error instanceof Error ? error.message : String(error)); }
    if (edge.source_edge_id) {
      if (!selectedEdgeIds.has(edge.source_edge_id)) fail(`Source edge '${edge.source_edge_id}' is not assigned to Diagram '${projection.diagram_id}'.`);
      if (edgeIds.has(edge.source_edge_id)) fail(`Source edge '${edge.source_edge_id}' is projected more than once.`);
      edgeIds.add(edge.source_edge_id);
    }
  }
  for (const id of selectedEdgeIds) {
    if (!edgeIds.has(id)) fail(`Selected source edge '${id}' is missing from Diagram '${projection.diagram_id}' projection.`);
  }
  for (const annotation of projection.derived.edge_annotations) {
    try { resolveProjectionEdge(annotation, graph, true); } catch (error) { fail(error instanceof Error ? error.message : String(error)); }
    if (annotation.source_edge_id && !selectedEdgeIds.has(annotation.source_edge_id)) fail(`Annotation source edge '${annotation.source_edge_id}' is not assigned to Diagram '${projection.diagram_id}'.`);
    if (!annotation.source_edge_id || !edgeIds.has(annotation.source_edge_id)) fail("Edge annotation has no associated selected source occurrence.");
  }
  return diagnostics;
}
