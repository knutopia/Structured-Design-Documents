import { semanticEdgeIdentity } from "../relationships/edgeIdentity.js";
import { graphForProjection, resolveProjectionEdge, projectionEdgeRenderId } from "../projector/edgeOccurrences.js";
import { createHash } from "node:crypto";
import { resolveHierarchyRoles } from "../bundle/viewRoles.js";
import type { Bundle } from "../bundle/types.js";
import { getSourceOrderedStructuralStream, getTopLevelNodeIdsInAuthorOrder } from "../compiler/authorOrder.js";
import { getCompiledEdgeSourceSpan, type CompiledEdge, type CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import type { ResolvedDetailDisplayPolicy } from "./detailDisplay.js";
import { readBooleanDetailDisplaySetting } from "./detailDisplay.js";

export interface JourneyRenderReference {
  kind: "reference";
  role: string;
  targetId: string;
  targetType?: string;
  targetName?: string;
  sourceProp?: string;
  groupId: string;
  label: string;
  value: string;
  relationshipReference?: boolean;
}

export interface JourneyRenderStep {
  kind: "step";
  id: string;
  title: string;
  type: string;
  references: JourneyRenderReference[];
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

export function journeyReferenceRoleToAttributeLabel(role: string): string {
  return role.trim().split("_").filter((part) => part.length > 0).join(" ");
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
      const compiledEdge = projectedEdge.source_edge_id
        ? resolveProjectionEdge(projectedEdge, graph, !!projection.diagram_id)
        : compiledByTriple.get(endpointKey)?.shift();
      if (projectedEdge.source_edge_id && compiledEdge) {
        const queue = compiledByTriple.get(endpointKey);
        const index = queue?.indexOf(compiledEdge) ?? -1;
        if (index >= 0) queue!.splice(index, 1);
      }
      if (!compiledEdge) {
        throw new Error(
          `Journey render-model construction could not match projected edge occurrence ${endpointKey} to compiled semantics.`
        );
      }

      const identityKey = semanticEdgeIdentity(compiledEdge, bundle);
      const sameEndpointOrdinal = sameEndpointCounts.get(endpointKey) ?? 0;
      const exactIdentityOrdinal = exactIdentityCounts.get(identityKey) ?? 0;
      sameEndpointCounts.set(endpointKey, sameEndpointOrdinal + 1);
      exactIdentityCounts.set(identityKey, exactIdentityOrdinal + 1);
      const identityHash = createHash("sha256").update(identityKey).digest("hex");

      return {
        id: projectionEdgeRenderId(projectedEdge, `${compiledEdge.from}__${compiledEdge.type}__${compiledEdge.to}__${identityHash}__${exactIdentityOrdinal}`),
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
  graph = graphForProjection(projection, graph);
  const displayOptions = readJourneyMapDisplayOptions(displayPolicy);
  const view = bundle.views.views.find((candidate) => candidate.id === projection.view_id)!;
  const roles = resolveHierarchyRoles(bundle, view);
  const projectionNodesById = new Map(projection.nodes.map((node) => [node.id, node]));
  const annotationsByNodeId = new Map(
    projection.derived.node_annotations.map((annotation) => [annotation.node_id, annotation])
  );
  const visibleNodeIds = new Set(projection.nodes.map((node) => node.id));
  const visibleStepIds = new Set(
    projection.nodes.filter((candidate) => roles.childTypes.has(candidate.type)).map((node) => node.id)
  );
  const hierarchyTypeSet = new Set(hierarchyEdgeTypes);
  const orderingTypeSet = new Set(orderingEdgeTypes);
  const structuralParentByStepId = new Map<string, string>();

  for (const edge of projection.edges.filter((candidate) => hierarchyTypeSet.has(candidate.type))) {
    const parentNode = projectionNodesById.get(edge.from);
    const childNode = projectionNodesById.get(edge.to);
    if (!parentNode || !roles.parentTypes.has(parentNode.type) || !childNode || !roles.childTypes.has(childNode.type) || structuralParentByStepId.has(childNode.id)) {
      continue;
    }
    structuralParentByStepId.set(childNode.id, parentNode.id);
  }

  const buildStepItem = (stepId: string): JourneyRenderStep | undefined => {
    const projectionNode = projectionNodesById.get(stepId);
    if (!projectionNode || !roles.childTypes.has(projectionNode.type)) {
      return undefined;
    }

    const references: JourneyRenderReference[] = [];
    for (const reference of annotationsByNodeId.get(stepId)?.references ?? []) {
      const visible = reference.detail_setting
        ? readBooleanDetailDisplaySetting(displayPolicy, reference.detail_setting)
        : displayOptions.showReferenceBadges;
      if (visible) {
        references.push({
          kind: "reference",
          ...(reference.detail_setting ? { relationshipReference: true } : {}),
          role: reference.role,
          targetId: reference.target_id,
          targetType: reference.target_type,
          targetName: reference.target_name,
          sourceProp: reference.source_prop,
          groupId: reference.group ?? reference.role,
          label: reference.label ?? journeyReferenceRoleToAttributeLabel(reference.role),
          value: reference.target_name && reference.target_name.length > 0
            ? reference.detail_setting ? `${reference.target_name} (${reference.target_id})` : reference.target_name
            : reference.target_id
        });
      }
    }

    return {
      kind: "step",
      id: stepId,
      title: projectionNode.name,
      type: projectionNode.type,
      references,
      orderAnchorId: stepId
    };
  };

  const buildStageItem = (stageId: string): JourneyRenderStage | undefined => {
    const projectionNode = projectionNodesById.get(stageId);
    if (!projectionNode || !roles.parentTypes.has(projectionNode.type)) {
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
    .filter((node) => (roles.parentTypes.has(node.type) || roles.childTypes.has(node.type)) && !structuralParentByStepId.has(node.id))
    .map((node) => node.id);
  const rootItems = getTopLevelNodeIdsInAuthorOrder(graph, rootNodeIds)
    .map((nodeId) => {
      const node = projectionNodesById.get(nodeId);
      if (node && roles.parentTypes.has(node.type)) {
        return buildStageItem(nodeId);
      }
      if (node && roles.childTypes.has(node.type)) {
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
