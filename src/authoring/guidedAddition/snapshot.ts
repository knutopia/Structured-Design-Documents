import { computeBundleFingerprint } from "../../bundle/fingerprint.js";
import { hasGuidedAdditionSupport } from "../../bundle/guidedAuthoring.js";
import type { Bundle } from "../../bundle/types.js";
import { compileSource } from "../../compiler/compileSource.js";
import { sortDiagnostics } from "../../diagnostics/types.js";
import type { Diagnostic } from "../../types.js";
import { inspectDocumentText, type InspectedDocument } from "../inspect.js";
import type { Handle } from "../contracts.js";
import {
  GuidedAdditionDomainError,
  type GuidedDocumentSnapshot,
  type GuidedDocumentSnapshotInput,
  type GuidedExistingEdge,
  type GuidedExistingNode
} from "./contracts.js";
import { deepFreeze } from "./immutability.js";

interface GuidedDocumentSnapshotIndexes {
  nodesByHandle: Map<Handle, GuidedExistingNode>;
  nodesById: Map<string, GuidedExistingNode>;
  nodesByType: Map<string, GuidedExistingNode[]>;
  incomingByNodeId: Map<string, GuidedExistingEdge[]>;
  outgoingByNodeId: Map<string, GuidedExistingEdge[]>;
  childrenByParent: Map<Handle | null, GuidedExistingNode[]>;
  bodyOrderByParent: Map<Handle, Handle[]>;
  usedNodeIds: Set<string>;
}

const snapshotIndexes = new WeakMap<GuidedDocumentSnapshot, GuidedDocumentSnapshotIndexes>();

function authoringDiagnostic(code: string, message: string, file: string): Diagnostic {
  return {
    stage: "authoring",
    code,
    severity: "error",
    message,
    file
  };
}

function throwUnavailable(file: string, diagnostics: Diagnostic[], message: string): never {
  const code = "guided_addition.document_unavailable";
  throw new GuidedAdditionDomainError(
    code,
    message,
    sortDiagnostics([...diagnostics, authoringDiagnostic(code, message, file)])
  );
}

function edgeKey(from: string, type: string, to: string): string {
  return `${from}\u0000${type}\u0000${to}`;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function consume(map: Map<string, number>, key: string): boolean {
  const remaining = map.get(key) ?? 0;
  if (remaining < 1) {
    return false;
  }
  map.set(key, remaining - 1);
  return true;
}

function createNodes(inspected: InspectedDocument): GuidedExistingNode[] {
  return inspected.resource.nodes.map((node, sourceOrder) => ({
    handle: node.handle,
    node_id: node.node_id,
    node_type: node.node_type,
    name: node.name,
    parent_handle: node.parent_handle,
    source_order: sourceOrder
  }));
}

function createEdges(inspected: InspectedDocument): GuidedExistingEdge[] {
  const nodesByHandle = new Map(inspected.resource.nodes.map((node) => [node.handle, node]));
  return inspected.resource.body_items
    .filter((item) => item.kind === "edge_line" && item.edge)
    .map((item, sourceOrder) => {
      const parent = nodesByHandle.get(item.parent_handle);
      if (!parent || !item.edge) {
        throw new Error(`Inspect edge '${item.handle}' has no parent node`);
      }
      return {
        handle: item.handle,
        parent_handle: item.parent_handle,
        from: parent.node_id,
        type: item.edge.rel_type,
        to: item.edge.to,
        source_order: sourceOrder
      };
    });
}

function verifyCompiledSemantics(
  inspected: InspectedDocument,
  nodes: GuidedExistingNode[],
  edges: GuidedExistingEdge[],
  graph: NonNullable<ReturnType<typeof compileSource>["graph"]>,
  file: string,
  diagnostics: Diagnostic[]
): void {
  const graphNodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    const compiled = graphNodesById.get(node.node_id);
    if (!compiled || compiled.type !== node.node_type || compiled.name !== node.name) {
      throwUnavailable(file, diagnostics, `Compiled node semantics do not match inspected node '${node.node_id}'`);
    }
  }

  const compiledEdgeCounts = new Map<string, number>();
  for (const edge of graph.edges) {
    increment(compiledEdgeCounts, edgeKey(edge.from, edge.type, edge.to));
  }
  for (const edge of edges) {
    if (!consume(compiledEdgeCounts, edgeKey(edge.from, edge.type, edge.to))) {
      throwUnavailable(
        file,
        diagnostics,
        `Compiled edge semantics do not match inspected edge '${edge.from} ${edge.type} ${edge.to}'`
      );
    }
  }
  if ([...compiledEdgeCounts.values()].some((remaining) => remaining !== 0)) {
    throwUnavailable(file, diagnostics, "Compiled edge semantics contain edges that are absent from the inspected source");
  }

  if (inspected.resource.nodes.length !== graph.nodes.length) {
    throwUnavailable(file, diagnostics, "Compiled node semantics contain nodes that are absent from the inspected source");
  }
}

function append<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

function buildIndexes(snapshot: GuidedDocumentSnapshot): GuidedDocumentSnapshotIndexes {
  const nodesByHandle = new Map<Handle, GuidedExistingNode>();
  const nodesById = new Map<string, GuidedExistingNode>();
  const nodesByType = new Map<string, GuidedExistingNode[]>();
  const incomingByNodeId = new Map<string, GuidedExistingEdge[]>();
  const outgoingByNodeId = new Map<string, GuidedExistingEdge[]>();
  const childrenByParent = new Map<Handle | null, GuidedExistingNode[]>();

  for (const node of snapshot.nodes) {
    nodesByHandle.set(node.handle, node);
    nodesById.set(node.node_id, node);
    append(nodesByType, node.node_type, node);
    append(childrenByParent, node.parent_handle, node);
  }
  for (const edge of snapshot.edges) {
    append(outgoingByNodeId, edge.from, edge);
    append(incomingByNodeId, edge.to, edge);
  }

  return {
    nodesByHandle,
    nodesById,
    nodesByType,
    incomingByNodeId,
    outgoingByNodeId,
    childrenByParent,
    bodyOrderByParent: new Map(Object.entries(snapshot.body_order_by_parent)),
    usedNodeIds: new Set(snapshot.nodes.map((node) => node.node_id))
  };
}

export function createGuidedDocumentSnapshot(bundle: Bundle, input: GuidedDocumentSnapshotInput): GuidedDocumentSnapshot {
  const file = input.path ?? input.document_ref;
  if (!hasGuidedAdditionSupport(bundle)) {
    const code = "guided_addition.unsupported_bundle";
    const message = "The loaded bundle does not declare guided authoring metadata";
    throw new GuidedAdditionDomainError(code, message, [authoringDiagnostic(code, message, file)]);
  }

  const inspected = inspectDocumentText(bundle, file, input.text);
  if (inspected.kind === "sdd-inspect-load-failure") {
    throwUnavailable(file, inspected.diagnostics, "Parse errors prevent creation of a guided document snapshot");
  }

  const compiled = compileSource({ path: file, text: inspected.source.text }, bundle);
  if (!compiled.graph || compiled.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throwUnavailable(file, compiled.diagnostics, "Compile errors prevent creation of a guided document snapshot");
  }

  const nodes = createNodes(inspected);
  const edges = createEdges(inspected);
  verifyCompiledSemantics(inspected, nodes, edges, compiled.graph, file, compiled.diagnostics);

  const snapshot: GuidedDocumentSnapshot = {
    kind: "sdd-guided-document-snapshot",
    document_ref: input.document_ref,
    ...(input.path === undefined ? {} : { path: input.path }),
    revision: inspected.resource.revision,
    bundle_fingerprint: computeBundleFingerprint(bundle),
    effective_version: inspected.resource.effective_version,
    nodes,
    edges,
    top_level_order: [...inspected.resource.top_level_order],
    body_order_by_parent: Object.fromEntries(
      inspected.resource.nodes.map((node) => [node.handle, [...node.body_stream]])
    ),
    diagnostics: structuredClone(compiled.diagnostics)
  };
  deepFreeze(snapshot);
  snapshotIndexes.set(snapshot, buildIndexes(snapshot));
  return snapshot;
}
