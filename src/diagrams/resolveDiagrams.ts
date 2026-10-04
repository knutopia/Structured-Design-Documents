import type { Bundle, ViewSpec } from "../bundle/types.js";
import { getCompiledEdgeSourceSpan, getCompiledNodeSourceSpan, getGraphSourcePath, type CompiledEdge, type CompiledGraph, type CompiledNode } from "../compiler/types.js";
import { sortDiagnostics } from "../diagnostics/types.js";
import { createSourceEdgeIndex, type SourceEdgeIndex } from "../relationships/edgeIdentity.js";
import type { Diagnostic, SourceSpan } from "../types.js";

export interface DiagramInventory {
  diagramId: string;
  diagramName: string;
  viewId?: string;
  nodeCount?: number;
  edgeCount?: number;
  nodeIds: string[];
  edgeIds: string[];
  inclusions: Array<{ nodeId: string; reasons: Array<"explicit_node" | "assigned_edge_endpoint"> }>;
  nodes: CompiledNode[];
  edges: CompiledEdge[];
  diagnostics: Diagnostic[];
}

export interface DocumentDiagrams {
  diagrams: DiagramInventory[];
  diagnostics: Diagnostic[];
  sourceEdgeIndex: SourceEdgeIndex;
}

export interface DiagramSelection {
  viewId: string;
  diagramId?: string;
  diagramName?: string;
  nodes: CompiledNode[];
  edges: CompiledEdge[];
  sourceEdgeIndex: SourceEdgeIndex;
  diagnostics: Diagnostic[];
}

/** Reads literal metadata only. No graph mutation, reachability, inferred inventory, or semantic validation truncation. */
export function resolveDocumentDiagrams(graph: CompiledGraph, bundle: Bundle): DocumentDiagrams {
  const sourceEdgeIndex = createSourceEdgeIndex(graph, bundle);
  const descriptor = bundle.contracts.diagram_membership;
  if (!descriptor) return { diagrams: [], diagnostics: [], sourceEdgeIndex };
  const diagnostics: Diagnostic[] = [];
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const views = new Map(bundle.views.views.map((view) => [view.id, view]));
  const file = getGraphSourcePath(graph) ?? "<compiled>";
  const add = (code: string, message: string, ids: string[], span?: SourceSpan, severity: "error" | "warn" = descriptor.diagnostics.invalid): Diagnostic => {
    const ruleId = bundle.contracts.common_rules.find((rule) => rule.rule_logic?.kind === "diagram_membership")?.id;
    const diagnostic: Diagnostic = { stage: "validate", code: `validate.diagram_${code}`, severity, message, file, span, relatedIds: ids, ruleId };
    diagnostics.push(diagnostic);
    return diagnostic;
  };
  const diagrams: DiagramInventory[] = graph.nodes.filter((node) => node.type === descriptor.declaration_type).map((node) => {
    const type = node.props[descriptor.type_property];
    const view = type ? views.get(type) : undefined;
    const errors: Diagnostic[] = [];
    if (!view || !view.projection.named_diagrams?.enabled) {
      errors.push(add("invalid_type", `Diagram '${node.id}' requires '${descriptor.type_property}' referencing an enabled view; received '${type ?? ""}'`, [node.id], getCompiledNodeSourceSpan(node)));
    }
    if (Object.prototype.hasOwnProperty.call(node.props, descriptor.membership_property)) {
      errors.push(add("metadata_membership", `Metadata declaration '${node.id}' cannot have '${descriptor.membership_property}' membership`, [node.id], getCompiledNodeSourceSpan(node)));
    }
    return { diagramId: node.id, diagramName: node.name, viewId: view?.projection.named_diagrams?.enabled ? view.id : undefined,
      nodes: [], edges: [], nodeIds: [], edgeIds: [], inclusions: [], diagnostics: errors };
  }).sort((a, b) => a.diagramId.localeCompare(b.diagramId));
  const diagramsById = new Map(diagrams.map((diagram) => [diagram.diagramId, diagram]));
  const reasons = new Map(diagrams.map((diagram) => [diagram.diagramId, new Map<string, Set<"explicit_node" | "assigned_edge_endpoint">>()]));
  const include = (diagram: DiagramInventory, node: CompiledNode, reason: "explicit_node" | "assigned_edge_endpoint"): void => {
    const map = reasons.get(diagram.diagramId)!;
    const values = map.get(node.id) ?? new Set();
    values.add(reason);
    map.set(node.id, values);
  };
  const idPattern = new RegExp(`^(?:${bundle.syntax.lexical.id_pattern})$`);
  const readReferences = (raw: string | undefined, contentIds: string[], span?: SourceSpan): DiagramInventory[] => {
    if (raw === undefined) return [];
    if (typeof raw !== "string") {
      add("invalid_reference", `Property '${descriptor.membership_property}' must contain a string reference list`, contentIds, span);
      return [];
    }
    const refs = raw.split(descriptor.references.delimiter).map((reference) => descriptor.references.trim ? reference.trim() : reference);
    const diagnosticStart = diagnostics.length;
    const seen = new Set<string>();
    const selected: DiagramInventory[] = [];
    for (const reference of refs) {
      if (!reference || !idPattern.test(reference)) {
        add("invalid_reference", `Invalid '${descriptor.membership_property}' reference '${reference}' on '${contentIds.join(" ")}'`, contentIds, span);
        continue;
      }
      if (seen.has(reference)) {
        add("repeated_reference", `Repeated '${descriptor.membership_property}' reference '${reference}' is resolved once`, [...contentIds, reference], span, descriptor.references.repeated);
        continue;
      }
      seen.add(reference);
      const target = nodesById.get(reference);
      const diagram = diagramsById.get(reference);
      if (!target || !diagram) {
        add("unresolved_reference", `Reference '${reference}' must resolve to a '${descriptor.declaration_type}' declaration`, [...contentIds, reference], span);
        continue;
      }
      selected.push(diagram);
    }
    const listDiagnostics = diagnostics.slice(diagnosticStart);
    for (const diagram of selected) diagram.diagnostics.push(...listDiagnostics);
    return selected.sort((a, b) => a.diagramId.localeCompare(b.diagramId));
  };
  for (const node of graph.nodes) {
    if (node.type === descriptor.declaration_type) continue;
    for (const diagram of readReferences(node.props[descriptor.membership_property], [node.id], getCompiledNodeSourceSpan(node))) {
      const view = diagram.viewId ? views.get(diagram.viewId) : undefined;
      if (!view) continue;
      if (!view.projection.include_node_types.includes(node.type)) {
        diagram.diagnostics.push(add("incompatible_node", `Node '${node.id}' (${node.type}) is ineligible for '${diagram.diagramId}' (${view.id})`, [node.id, diagram.diagramId], getCompiledNodeSourceSpan(node)));
      } else include(diagram, node, "explicit_node");
    }
  }
  for (const edge of graph.edges) {
    for (const diagram of readReferences(edge.props[descriptor.membership_property], [edge.from, edge.to], getCompiledEdgeSourceSpan(edge))) {
      const view = diagram.viewId ? views.get(diagram.viewId) : undefined;
      if (!view) continue;
      const from = nodesById.get(edge.from);
      const to = nodesById.get(edge.to);
      const contract = bundle.contracts.relationships.find((relationship) => relationship.type === edge.type);
      const validPair = from && to && contract?.allowed_endpoints.some((pair) => pair.from === from.type && pair.to === to.type);
      if (!from || !to || !validPair || !view.projection.include_edge_types.includes(edge.type)
        || !view.projection.include_node_types.includes(from.type) || !view.projection.include_node_types.includes(to.type)) {
        diagram.diagnostics.push(add("incompatible_edge", `Edge '${edge.from} ${edge.type} ${edge.to}' is ineligible for '${diagram.diagramId}' (${view.id})`, [edge.from, edge.to, diagram.diagramId], getCompiledEdgeSourceSpan(edge)));
      } else {
        diagram.edges.push(edge);
        include(diagram, from, "assigned_edge_endpoint");
        include(diagram, to, "assigned_edge_endpoint");
      }
    }
  }
  for (const diagram of diagrams) {
    const map = reasons.get(diagram.diagramId)!;
    diagram.nodes = graph.nodes.filter((node) => map.has(node.id));
    diagram.nodeIds = diagram.nodes.map((node) => node.id);
    diagram.edgeIds = diagram.edges.map((edge) => sourceEdgeIndex.idFor(edge)!);
    diagram.inclusions = diagram.nodeIds.map((nodeId) => ({ nodeId, reasons: [...map.get(nodeId)!].sort() }));
    diagram.diagnostics = sortDiagnostics(diagram.diagnostics);
    if (diagram.diagnostics.some((diagnostic) => diagnostic.severity === "error")) continue;
    diagram.nodeCount = diagram.nodes.length;
    diagram.edgeCount = diagram.edges.length;
    if (!diagram.nodes.length) {
      const node = nodesById.get(diagram.diagramId)!;
      diagram.diagnostics.push(add("empty", `Diagram '${diagram.diagramId}' has no members`, [diagram.diagramId], getCompiledNodeSourceSpan(node), descriptor.diagnostics.empty));
      diagram.diagnostics = sortDiagnostics(diagram.diagnostics);
    }
  }
  return { diagrams, diagnostics: sortDiagnostics(diagnostics), sourceEdgeIndex };
}

export function listDiagrams(graph: CompiledGraph, bundle: Bundle): DiagramInventory[] {
  return resolveDocumentDiagrams(graph, bundle).diagrams;
}

export function resolveDiagramSelection(graph: CompiledGraph, bundle: Bundle, options: { viewId?: string; diagramId?: string }): DiagramSelection {
  const document = resolveDocumentDiagrams(graph, bundle);
  const result: DiagramSelection = { viewId: options.viewId ?? "", nodes: [], edges: [], sourceEdgeIndex: document.sourceEdgeIndex, diagnostics: [...document.diagnostics] };
  const fail = (code: string, message: string): DiagramSelection => {
    result.diagnostics.push({ stage: "project", code: `project.${code}`, severity: "error", message, file: getGraphSourcePath(graph) ?? "<compiled>", relatedIds: options.diagramId ? [options.diagramId] : undefined });
    return result;
  };
  if (options.diagramId !== undefined) {
    if (!bundle.contracts.diagram_membership) return fail("named_diagrams_unsupported", "Loaded bundle does not support named diagrams");
    const diagram = document.diagrams.find((entry) => entry.diagramId === options.diagramId);
    if (!diagram) return fail("unknown_diagram", `Unknown Diagram ID '${options.diagramId}'`);
    if (!diagram.viewId) return fail("invalid_diagram", `Diagram '${options.diagramId}' has no valid view type`);
    if (options.viewId !== undefined && options.viewId !== diagram.viewId) return fail("diagram_view_mismatch", `Diagram '${options.diagramId}' has view '${diagram.viewId}', not '${options.viewId}'`);
    result.viewId = diagram.viewId;
    result.diagramId = diagram.diagramId;
    result.diagramName = diagram.diagramName;
    if (!result.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      result.nodes = diagram.nodes;
      result.edges = diagram.edges;
    }
    return result;
  }
  const view: ViewSpec | undefined = bundle.views.views.find((entry) => entry.id === options.viewId);
  if (!view) return fail(options.viewId === undefined ? "missing_selector" : "unknown_view", options.viewId === undefined ? "A view or Diagram selector is required" : `Unknown view '${options.viewId}'`);
  const metadataType = bundle.contracts.diagram_membership?.declaration_type;
  result.nodes = graph.nodes.filter((node) => node.type !== metadataType && view.projection.include_node_types.includes(node.type));
  const nodeIds = new Set(result.nodes.map((node) => node.id));
  result.edges = graph.edges.filter((edge) => view.projection.include_edge_types.includes(edge.type) && nodeIds.has(edge.from) && nodeIds.has(edge.to));
  return result;
}
