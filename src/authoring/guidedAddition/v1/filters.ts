import type { GuidanceCatalog, GuidanceRelationshipRecord } from "../catalog.js";
import type { ExistingNodeRefV1, RelationshipRouteV1 } from "./contracts.js";

const roleOrder = { primary: 0, supporting: 1, bridge: 2 } as const;

export function relationshipBrowseId(route: RelationshipRouteV1): string {
  return `${route.direction}.${route.selection_order}`;
}

export function typesForDiagram(catalog: GuidanceCatalog, diagramId: string | null): Set<string> | undefined {
  return diagramId ? new Set(catalog.getView(diagramId)!.included_node_types) : undefined;
}

export function orderedTypesForDiagram(catalog: GuidanceCatalog, diagramId: string | null): string[] {
  return diagramId
    ? [...catalog.getView(diagramId)!.included_node_types]
    : catalog.node_types.map((nodeType) => nodeType.node_type);
}

export function relationshipCandidates(
  catalog: GuidanceCatalog,
  route: RelationshipRouteV1,
  anchor: ExistingNodeRefV1
): GuidanceRelationshipRecord[] {
  return catalog.relationships.filter((record) =>
    route.direction === "outgoing" ? record.from === anchor.node_type : record.to === anchor.node_type
  );
}

export function relationshipsForEndpoint(
  catalog: GuidanceCatalog,
  route: RelationshipRouteV1,
  anchor: ExistingNodeRefV1,
  endpoint: ExistingNodeRefV1
): GuidanceRelationshipRecord[] {
  return catalog.relationships.filter((record) => route.direction === "outgoing"
    ? record.from === anchor.node_type && record.to === endpoint.node_type
    : record.from === endpoint.node_type && record.to === anchor.node_type);
}

export function rankRelationshipsForDiagram(
  catalog: GuidanceCatalog,
  records: GuidanceRelationshipRecord[],
  diagramId: string | null
): Array<{ record: GuidanceRelationshipRecord; bridge: boolean }> {
  return records.map((record) => {
    const viewRecord = diagramId ? catalog.getViewRelationship(diagramId, record) : undefined;
    return { record, bridge: viewRecord?.role === "bridge", role: viewRecord?.role ?? "primary" };
  }).sort((left, right) => {
    const role = roleOrder[left.role] - roleOrder[right.role];
    return role !== 0
      ? role
      : left.record.relationship_order - right.record.relationship_order ||
          left.record.endpoint_order - right.record.endpoint_order;
  }).map(({ record, bridge }) => ({ record, bridge }));
}
