import type { BundleFingerprint } from "../../../bundle/fingerprint.js";
import { createGuidedOpaqueId } from "../identifiers.js";
import type { GuidedDocumentSnapshot } from "../sharedContracts.js";
import type { ExistingNodeRefV1, MaterialEffectV1, NodeRefV1, RelationshipDraftV1 } from "./contracts.js";

function existingRef(node: GuidedDocumentSnapshot["nodes"][number]): ExistingNodeRefV1 {
  return {
    kind: "existing_node",
    handle: node.handle,
    node_id: node.node_id,
    node_type: node.node_type,
    name: node.name
  };
}

export function relationshipRefs(draft: RelationshipDraftV1): { from: NodeRefV1; to: NodeRefV1 } {
  if (!draft.remote_endpoint) throw new Error("Relationship draft has no remote endpoint");
  return draft.route.direction === "outgoing"
    ? { from: draft.anchor, to: draft.remote_endpoint }
    : { from: draft.remote_endpoint, to: draft.anchor };
}

export function parentRef(snapshot: GuidedDocumentSnapshot, node: ExistingNodeRefV1): ExistingNodeRefV1 | null {
  const record = snapshot.nodes.find((candidate) => candidate.handle === node.handle);
  if (!record?.parent_handle) return null;
  const parent = snapshot.nodes.find((candidate) => candidate.handle === record.parent_handle);
  return parent ? existingRef(parent) : null;
}

export function childrenOf(snapshot: GuidedDocumentSnapshot, parent: ExistingNodeRefV1): ExistingNodeRefV1[] {
  return snapshot.nodes.filter((node) => node.parent_handle === parent.handle).map(existingRef);
}

export function createMoveEffect(
  snapshot: GuidedDocumentSnapshot,
  bundleFingerprint: BundleFingerprint,
  target: ExistingNodeRefV1,
  destinationParent: NodeRefV1,
  order: "only" | "first" | "last"
): MaterialEffectV1 {
  const value = {
    kind: "move_existing_node" as const,
    node: target,
    from_parent: parentRef(snapshot, target),
    destination_parent: destinationParent,
    order,
    accepted: false
  };
  return {
    ...value,
    effect_id: createGuidedOpaqueId("eff", {
      bundle_fingerprint: bundleFingerprint,
      revision: snapshot.revision,
      ...(snapshot.document_precondition ? { document_precondition: snapshot.document_precondition } : {}),
      value
    })
  };
}
