import { stringifyCanonicalJson } from "../../bundle/fingerprint.js";
import type { GuidanceCatalog, GuidanceRelationshipRecord } from "./catalog.js";
import type {
  ExistingNodeRef,
  ExistingOrNewNodeRef,
  GuidedDocumentSnapshot,
  PlacementRecommendation,
  ProposedConfirmableEffect,
  ProposedPlacement,
  SelectedPlacement
} from "./contracts.js";
import { createGuidedOpaqueId } from "./identifiers.js";

export interface GuidedPlacementContext {
  relationship?: GuidanceRelationshipRecord;
  direction?: "outgoing" | "incoming";
  anchor?: ExistingNodeRef;
  new_node?: Extract<ExistingOrNewNodeRef, { kind: "new_node" }>;
  from?: ExistingOrNewNodeRef;
  to?: ExistingOrNewNodeRef;
}

export interface GuidedPlacementRecommendationRecord {
  recommendation: PlacementRecommendation;
  selected_target:
    | { kind: "node"; node: ExistingOrNewNodeRef }
    | { kind: "edge"; local_id: "edge_1" };
}

function existingRef(snapshot: GuidedDocumentSnapshot, nodeId: string): ExistingNodeRef | undefined {
  const node = snapshot.nodes.find((candidate) => candidate.node_id === nodeId);
  return node
    ? {
        kind: "existing_node",
        handle: node.handle,
        node_id: node.node_id,
        node_type: node.node_type
      }
    : undefined;
}

function parentRef(snapshot: GuidedDocumentSnapshot, parentHandle: string | null): ExistingNodeRef | undefined {
  const parent = parentHandle === null ? undefined : snapshot.nodes.find((node) => node.handle === parentHandle);
  return parent
    ? { kind: "existing_node", handle: parent.handle, node_id: parent.node_id, node_type: parent.node_type }
    : undefined;
}

function placementAtExistingLevel(
  snapshot: GuidedDocumentSnapshot,
  node: ExistingNodeRef,
  mode: ProposedPlacement["mode"],
  anchor = false
): ProposedPlacement {
  const current = snapshot.nodes.find((candidate) => candidate.handle === node.handle)!;
  const parent = parentRef(snapshot, current.parent_handle);
  return parent
    ? { stream: "body", mode, parent, ...(anchor ? { anchor: node } : {}) }
    : { stream: "top_level", mode, ...(anchor ? { anchor: node } : {}) };
}

function placementKey(placement: ProposedPlacement): string {
  return stringifyCanonicalJson(placement);
}

function orderedPlacements(recommended: ProposedPlacement, candidates: ProposedPlacement[]): ProposedPlacement[] {
  const seen = new Set([placementKey(recommended)]);
  const alternatives: ProposedPlacement[] = [];
  for (const candidate of candidates) {
    const key = placementKey(candidate);
    if (!seen.has(key)) {
      seen.add(key);
      alternatives.push(candidate);
    }
  }
  return alternatives;
}

function currentLevelAlternatives(
  snapshot: GuidedDocumentSnapshot,
  levelNode: ExistingNodeRef,
  recommended: ProposedPlacement,
  includeRelativeAnchor: boolean
): ProposedPlacement[] {
  return orderedPlacements(recommended, [
    placementAtExistingLevel(snapshot, levelNode, "last"),
    placementAtExistingLevel(snapshot, levelNode, "first"),
    ...(includeRelativeAnchor
      ? [
          placementAtExistingLevel(snapshot, levelNode, "before", true),
          placementAtExistingLevel(snapshot, levelNode, "after", true)
        ]
      : [])
  ]);
}

function makeRecommendation(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  purpose: "node" | "edge",
  target: ExistingOrNewNodeRef,
  selectedTarget: GuidedPlacementRecommendationRecord["selected_target"],
  recommended: ProposedPlacement,
  alternatives: ProposedPlacement[],
  reasonCode: PlacementRecommendation["reason_code"],
  relationship: GuidanceRelationshipRecord | undefined,
  requiredEffect?: ProposedConfirmableEffect
): GuidedPlacementRecommendationRecord {
  const recommendation_id = createGuidedOpaqueId("plc", {
    bundle_fingerprint: catalog.bundle_fingerprint,
    document_revision: snapshot.revision,
    purpose,
    target,
    relationship: relationship
      ? { from: relationship.from, type: relationship.type, to: relationship.to }
      : null,
    recommended,
    alternatives
  });
  return {
    recommendation: {
      recommendation_id,
      target,
      recommended,
      alternatives,
      reason_code: reasonCode,
      ...(requiredEffect ? { required_effect: requiredEffect } : {})
    },
    selected_target: selectedTarget
  };
}

function structuralNewTargetRecommendation(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  context: Required<Pick<GuidedPlacementContext, "relationship" | "anchor" | "new_node">>
): GuidedPlacementRecommendationRecord {
  const recommended: ProposedPlacement = {
    stream: "body",
    mode: catalog.placement_policy.structural_new_target === "nested_last" ? "last" : "first",
    parent: context.anchor
  };
  const alternatives = currentLevelAlternatives(snapshot, context.anchor, recommended, true);
  return makeRecommendation(
    catalog,
    snapshot,
    "node",
    context.new_node,
    { kind: "node", node: context.new_node },
    recommended,
    alternatives,
    "structural_nesting",
    context.relationship
  );
}

function structuralExistingTargetRecommendation(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  context: Required<Pick<GuidedPlacementContext, "relationship" | "anchor" | "new_node" | "from" | "to">>
): GuidedPlacementRecommendationRecord {
  const recommended = placementAtExistingLevel(snapshot, context.anchor, "before", true);
  const alternatives = currentLevelAlternatives(snapshot, context.anchor, recommended, true);
  const target = context.to.kind === "existing_node" ? context.to : context.anchor;
  const effectPlacement: ProposedPlacement = {
    stream: "body",
    mode: "last",
    parent: context.new_node
  };
  const effectWithoutId = {
    kind: "reparent_existing_node" as const,
    document_revision: snapshot.revision,
    target,
    old_parent_handle: snapshot.nodes.find((node) => node.handle === target.handle)?.parent_handle ?? null,
    new_parent: { kind: "new_node" as const, local_id: context.new_node.local_id },
    placement: effectPlacement,
    relationship: { from: context.from, type: context.relationship.type, to: context.to }
  };
  const requiredEffect: ProposedConfirmableEffect = {
    ...effectWithoutId,
    effect_id: createGuidedOpaqueId("eff", {
      bundle_fingerprint: catalog.bundle_fingerprint,
      ...effectWithoutId
    })
  };
  return makeRecommendation(
    catalog,
    snapshot,
    "node",
    context.new_node,
    { kind: "node", node: context.new_node },
    recommended,
    alternatives,
    "structural_nesting",
    context.relationship,
    requiredEffect
  );
}

function orderingRecommendation(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  context: Required<Pick<GuidedPlacementContext, "relationship" | "direction" | "anchor" | "new_node">>
): GuidedPlacementRecommendationRecord {
  const configured = context.direction === "outgoing"
    ? catalog.placement_policy.outgoing_sequence
    : catalog.placement_policy.incoming_sequence;
  const mode: ProposedPlacement["mode"] = configured === "after_anchor" ? "after" : "before";
  const recommended = placementAtExistingLevel(snapshot, context.anchor, mode, true);
  return makeRecommendation(
    catalog,
    snapshot,
    "node",
    context.new_node,
    { kind: "node", node: context.new_node },
    recommended,
    currentLevelAlternatives(snapshot, context.anchor, recommended, true),
    context.direction === "outgoing" ? "outgoing_graph_sequence" : "incoming_graph_sequence",
    context.relationship
  );
}

function sameSourceTargetRecommendation(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  context: Required<Pick<GuidedPlacementContext, "relationship" | "anchor" | "new_node" | "from">>
): GuidedPlacementRecommendationRecord | undefined {
  if (context.from.kind !== "existing_node") {
    return undefined;
  }
  const source = context.from;
  const sourceNode = snapshot.nodes.find((node) => node.handle === source.handle);
  if (!sourceNode) {
    return undefined;
  }
  const targets = snapshot.edges
    .filter((edge) => edge.from === sourceNode.node_id)
    .sort((left, right) => left.source_order - right.source_order)
    .map((edge) => snapshot.nodes.find((node) => node.node_id === edge.to))
    .filter((node): node is GuidedDocumentSnapshot["nodes"][number] =>
      Boolean(node && node.parent_handle === sourceNode.parent_handle)
    );
  const last = targets.at(-1);
  if (!last) {
    return undefined;
  }
  const lastRef = existingRef(snapshot, last.node_id)!;
  const recommended = placementAtExistingLevel(snapshot, lastRef, "after", true);
  return makeRecommendation(
    catalog,
    snapshot,
    "node",
    context.new_node,
    { kind: "node", node: context.new_node },
    recommended,
    currentLevelAlternatives(snapshot, context.anchor, recommended, true),
    "same_source_target_order",
    context.relationship
  );
}

function fallbackNodeRecommendation(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  context: Pick<GuidedPlacementContext, "relationship" | "anchor" | "new_node">
): GuidedPlacementRecommendationRecord {
  const target = context.new_node!;
  const levelNode = context.anchor;
  const mode: ProposedPlacement["mode"] = catalog.placement_policy.fallback === "last" ? "last" : "first";
  const recommended = levelNode
    ? placementAtExistingLevel(snapshot, levelNode, mode)
    : { stream: "top_level" as const, mode };
  const alternatives = levelNode
    ? currentLevelAlternatives(snapshot, levelNode, recommended, true)
    : orderedPlacements(recommended, [
        { stream: "top_level", mode: "last" },
        { stream: "top_level", mode: "first" }
      ]);
  return makeRecommendation(
    catalog,
    snapshot,
    "node",
    target,
    { kind: "node", node: target },
    recommended,
    alternatives,
    "fallback_append",
    context.relationship
  );
}

export function createPlacementRecommendations(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  context: GuidedPlacementContext
): GuidedPlacementRecommendationRecord[] {
  const records: GuidedPlacementRecommendationRecord[] = [];
  if (context.new_node) {
    if (
      context.relationship?.authoring.graph_role === "structural" &&
      context.relationship.authoring.source_organization === "nest_target_under_source" &&
      context.direction === "outgoing" &&
      context.anchor &&
      catalog.placement_policy.structural_new_target === "nested_last"
    ) {
      records.push(
        structuralNewTargetRecommendation(catalog, snapshot, {
          relationship: context.relationship,
          anchor: context.anchor,
          new_node: context.new_node
        })
      );
    } else if (
      context.relationship?.authoring.graph_role === "structural" &&
      context.relationship.authoring.source_organization === "nest_target_under_source" &&
      context.direction === "incoming" &&
      context.anchor &&
      context.from &&
      context.to &&
      catalog.placement_policy.structural_existing_target === "reparent_with_confirmation"
    ) {
      records.push(
        structuralExistingTargetRecommendation(catalog, snapshot, {
          relationship: context.relationship,
          anchor: context.anchor,
          new_node: context.new_node,
          from: context.from,
          to: context.to
        })
      );
    } else if (
      context.relationship?.authoring.graph_role === "ordering" &&
      context.direction &&
      context.anchor
    ) {
      records.push(
        orderingRecommendation(catalog, snapshot, {
          relationship: context.relationship,
          direction: context.direction,
          anchor: context.anchor,
          new_node: context.new_node
        })
      );
    } else {
      const sameSource =
        context.relationship && context.anchor && context.from
          ? sameSourceTargetRecommendation(catalog, snapshot, {
              relationship: context.relationship,
              anchor: context.anchor,
              new_node: context.new_node,
              from: context.from
            })
          : undefined;
      records.push(sameSource ?? fallbackNodeRecommendation(catalog, snapshot, context));
    }
  }
  return records;
}

export function selectPlacement(
  records: GuidedPlacementRecommendationRecord[],
  recommendationId: string,
  selected: ProposedPlacement
): SelectedPlacement | undefined {
  const record = records.find((candidate) => candidate.recommendation.recommendation_id === recommendationId);
  if (!record) {
    return undefined;
  }
  const offered = [record.recommendation.recommended, ...record.recommendation.alternatives];
  const match = offered.find((candidate) => placementKey(candidate) === placementKey(selected));
  if (!match) {
    return undefined;
  }
  return {
    recommendation_id: recommendationId,
    selected: match,
    target: record.selected_target,
    selected_by:
      placementKey(match) === placementKey(record.recommendation.recommended) ? "recommended_default" : "user"
  };
}

export function effectForSelections(
  records: GuidedPlacementRecommendationRecord[],
  selections: SelectedPlacement[]
): ProposedConfirmableEffect | undefined {
  for (const record of records) {
    const selection = selections.find(
      (candidate) => candidate.recommendation_id === record.recommendation.recommendation_id
    );
    if (
      selection &&
      record.recommendation.required_effect &&
      placementKey(selection.selected) === placementKey(record.recommendation.recommended)
    ) {
      return record.recommendation.required_effect;
    }
  }
  return undefined;
}
