import { createHash } from "node:crypto";
import type { Bundle } from "../bundle/types.js";
import { getSourceOrderedStructuralStream, getTopLevelNodeIdsInAuthorOrder } from "../compiler/authorOrder.js";
import { getCompiledEdgeSourceSpan, type CompiledEdge, type CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import type { ResolvedDetailDisplayPolicy } from "./detailDisplay.js";
import { readBooleanDetailDisplaySetting } from "./detailDisplay.js";

export interface JourneyRenderReferenceBadge {
  kind: "reference";
  role: string;
  targetId: string;
  targetType?: string;
  targetName?: string;
  sourceProp?: string;
  label: string;
}

export interface JourneyRenderStep {
  kind: "step";
  id: string;
  labelLines: string[];
  badges: JourneyRenderReferenceBadge[];
  orderAnchorId: string;
}

export interface JourneyRenderStage {
  kind: "stage";
  id: string;
  label: string;
  anchorId: string;
  orderAnchorId: string;
  items: JourneyRenderStep[];
}

export type JourneyRenderItem = JourneyRenderStage | JourneyRenderStep;

export interface JourneyRenderEdge {
  id: string;
  from: string;
  type: string;
  to: string;
  authorOrder: number;
  sameEndpointOrdinal: number;
  semanticIdentityKey: string;
  exactIdentityOrdinal: number;
}

export interface JourneyMapRenderModel {
  rootItems: JourneyRenderItem[];
  edges: JourneyRenderEdge[];
  siblingOrderChains: string[][];
}

interface JourneyMapDisplayOptions {
  showReferenceBadges: boolean;
}

function collectSiblingOrderChains(items: JourneyRenderItem[]): string[][] {
  const chains: string[][] = [];
  const rootAnchors = items.map((item) => item.orderAnchorId);
  if (rootAnchors.length > 1) {
    chains.push(rootAnchors);
  }

  for (const item of items) {
    if (item.kind !== "stage") {
      continue;
    }

    const childAnchors = item.items.map((child) => child.orderAnchorId);
    if (childAnchors.length > 0) {
      chains.push([item.anchorId, ...childAnchors]);
    }
  }

  return chains;
}

function buildReferenceBadge(targetId: string, targetName?: string): string {
  return `[${targetName && targetName.length > 0 ? targetName : targetId}]`;
}

function duplicateEdgeIdentityFields(bundle: Bundle): string[] {
  const rule = bundle.contracts.common_rules.find(
    (candidate) => candidate.rule_logic?.kind === "duplicate_edge_identity"
  );
  const keyFields = rule?.rule_logic?.key_fields;
  if (!Array.isArray(keyFields) || !keyFields.every((field): field is string => typeof field === "string")) {
    throw new Error("Journey render-model construction requires bundle duplicate-edge identity key_fields.");
  }
  return keyFields;
}

function stableProps(props: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(props).sort(([left], [right]) => left.localeCompare(right)));
}

function semanticIdentityKey(edge: CompiledEdge, keyFields: string[]): string {
  return JSON.stringify(
    keyFields.map((field) => [
      field,
      field === "props" ? stableProps(edge.props) : edge[field as keyof CompiledEdge] ?? null
    ])
  );
}

function tripleKey(edge: Pick<CompiledEdge, "from" | "type" | "to">): string {
  return JSON.stringify([edge.from, edge.type, edge.to]);
}

function sourceOrderedEdges(edges: CompiledEdge[]): CompiledEdge[] {
  return edges
    .map((edge, canonicalOrder) => ({ edge, canonicalOrder, offset: getCompiledEdgeSourceSpan(edge)?.startOffset }))
    .sort((left, right) => {
      if (left.offset !== undefined && right.offset !== undefined && left.offset !== right.offset) {
        return left.offset - right.offset;
      }
      if (left.offset !== undefined && right.offset === undefined) {
        return -1;
      }
      if (left.offset === undefined && right.offset !== undefined) {
        return 1;
      }
      return left.canonicalOrder - right.canonicalOrder;
    })
    .map(({ edge }) => edge);
}

function buildJourneyRenderEdges(
  projection: Projection,
  graph: CompiledGraph,
  bundle: Bundle,
  orderingTypeSet: Set<string>,
  visibleNodeIds: Set<string>
): JourneyRenderEdge[] {
  const identityFields = duplicateEdgeIdentityFields(bundle);
  const qualifyingCompiledEdges = sourceOrderedEdges(
    graph.edges.filter(
      (edge) => orderingTypeSet.has(edge.type) && visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)
    )
  );
  const authorOrderByEdge = new Map(qualifyingCompiledEdges.map((edge, authorOrder) => [edge, authorOrder]));
  const compiledByTriple = new Map<string, CompiledEdge[]>();
  for (const edge of qualifyingCompiledEdges) {
    const key = tripleKey(edge);
    const occurrences = compiledByTriple.get(key) ?? [];
    occurrences.push(edge);
    compiledByTriple.set(key, occurrences);
  }

  const sameEndpointCounts = new Map<string, number>();
  const exactIdentityCounts = new Map<string, number>();
  const modelEdges = projection.edges
    .filter(
      (edge) => orderingTypeSet.has(edge.type) && visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)
    )
    .map((projectedEdge) => {
      const endpointKey = tripleKey(projectedEdge);
      const compiledEdge = compiledByTriple.get(endpointKey)?.shift();
      if (!compiledEdge) {
        throw new Error(
          `Journey render-model construction could not match projected edge occurrence ${endpointKey} to compiled semantics.`
        );
      }

      const identityKey = semanticIdentityKey(compiledEdge, identityFields);
      const sameEndpointOrdinal = sameEndpointCounts.get(endpointKey) ?? 0;
      const exactIdentityOrdinal = exactIdentityCounts.get(identityKey) ?? 0;
      sameEndpointCounts.set(endpointKey, sameEndpointOrdinal + 1);
      exactIdentityCounts.set(identityKey, exactIdentityOrdinal + 1);
      const identityHash = createHash("sha256").update(identityKey).digest("hex");

      return {
        id: `${compiledEdge.from}__${compiledEdge.type}__${compiledEdge.to}__${identityHash}__${exactIdentityOrdinal}`,
        from: compiledEdge.from,
        type: compiledEdge.type,
        to: compiledEdge.to,
        authorOrder: authorOrderByEdge.get(compiledEdge)!,
        sameEndpointOrdinal,
        semanticIdentityKey: identityKey,
        exactIdentityOrdinal
      };
    });

  const unmatchedCount = [...compiledByTriple.values()].reduce((sum, occurrences) => sum + occurrences.length, 0);
  if (unmatchedCount > 0) {
    throw new Error(
      `Journey render-model construction left ${unmatchedCount} compiled ordering edge occurrence(s) unmatched.`
    );
  }
  return modelEdges;
}

function readJourneyMapDisplayOptions(policy: ResolvedDetailDisplayPolicy): JourneyMapDisplayOptions {
  return {
    showReferenceBadges: readBooleanDetailDisplaySetting(policy, "show_reference_badges")
  };
}

export function buildJourneyMapRenderModel(
  projection: Projection,
  graph: CompiledGraph,
  bundle: Bundle,
  hierarchyEdgeTypes: string[],
  orderingEdgeTypes: string[],
  displayPolicy: ResolvedDetailDisplayPolicy
): JourneyMapRenderModel {
  const displayOptions = readJourneyMapDisplayOptions(displayPolicy);
  const projectionNodesById = new Map(projection.nodes.map((node) => [node.id, node]));
  const annotationsByNodeId = new Map(
    projection.derived.node_annotations.map((annotation) => [annotation.node_id, annotation])
  );
  const visibleNodeIds = new Set(projection.nodes.map((node) => node.id));
  const visibleStepIds = new Set(
    projection.nodes.filter((candidate) => candidate.type === "Step").map((node) => node.id)
  );
  const hierarchyTypeSet = new Set(hierarchyEdgeTypes);
  const orderingTypeSet = new Set(orderingEdgeTypes);
  const structuralParentByStepId = new Map<string, string>();

  for (const edge of projection.edges.filter((candidate) => hierarchyTypeSet.has(candidate.type))) {
    const parentNode = projectionNodesById.get(edge.from);
    const childNode = projectionNodesById.get(edge.to);
    if (parentNode?.type !== "Stage" || childNode?.type !== "Step" || structuralParentByStepId.has(childNode.id)) {
      continue;
    }
    structuralParentByStepId.set(childNode.id, parentNode.id);
  }

  const buildStepItem = (stepId: string): JourneyRenderStep | undefined => {
    const projectionNode = projectionNodesById.get(stepId);
    if (!projectionNode || projectionNode.type !== "Step") {
      return undefined;
    }

    const labelLines = [projectionNode.name];
    const badges: JourneyRenderReferenceBadge[] = [];
    if (displayOptions.showReferenceBadges) {
      for (const reference of annotationsByNodeId.get(stepId)?.references ?? []) {
        const label = buildReferenceBadge(reference.target_id, reference.target_name);
        labelLines.push(label);
        badges.push({
          kind: "reference",
          role: reference.role,
          targetId: reference.target_id,
          targetType: reference.target_type,
          targetName: reference.target_name,
          sourceProp: reference.source_prop,
          label
        });
      }
    }

    return {
      kind: "step",
      id: stepId,
      labelLines,
      badges,
      orderAnchorId: stepId
    };
  };

  const buildStageItem = (stageId: string): JourneyRenderStage | undefined => {
    const projectionNode = projectionNodesById.get(stageId);
    if (!projectionNode || projectionNode.type !== "Stage") {
      return undefined;
    }

    const items = getSourceOrderedStructuralStream(graph, stageId, hierarchyEdgeTypes, visibleStepIds)
      .filter((entry) => structuralParentByStepId.get(entry.to) === stageId)
      .map((entry) => buildStepItem(entry.to))
      .filter((item): item is JourneyRenderStep => item !== undefined);

    return {
      kind: "stage",
      id: stageId,
      label: projectionNode.name,
      anchorId: `${stageId}__anchor`,
      orderAnchorId: `${stageId}__anchor`,
      items
    };
  };

  const rootNodeIds = projection.nodes
    .filter((node) => (node.type === "Stage" || node.type === "Step") && !structuralParentByStepId.has(node.id))
    .map((node) => node.id);
  const rootItems = getTopLevelNodeIdsInAuthorOrder(graph, rootNodeIds)
    .map((nodeId) => {
      const node = projectionNodesById.get(nodeId);
      if (node?.type === "Stage") {
        return buildStageItem(nodeId);
      }
      if (node?.type === "Step") {
        return buildStepItem(nodeId);
      }
      return undefined;
    })
    .filter((item): item is JourneyRenderItem => item !== undefined);

  const edges = buildJourneyRenderEdges(projection, graph, bundle, orderingTypeSet, visibleNodeIds);

  return {
    rootItems,
    edges,
    siblingOrderChains: collectSiblingOrderChains(rootItems)
  };
}
