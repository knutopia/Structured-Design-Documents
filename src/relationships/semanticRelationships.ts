import type { Bundle } from "../bundle/types.js";
import type { CompiledEdge, CompiledGraph } from "../compiler/types.js";

export interface SemanticRelationship {
  identity: string;
  from: string;
  type: string;
  to: string;
  directionality: "directed" | "symmetric";
  declarations: CompiledEdge[];
}

export type RelationshipLookupDirection = "outgoing" | "incoming" | "incident";

/** Reads authored declarations through loaded contracts; never expands the graph. */
export function createSemanticRelationshipReader(graph: CompiledGraph, bundle: Bundle) {
  const contracts = new Map(bundle.contracts.relationships.map((contract) => [contract.type, contract]));
  const defaultIdentity = bundle.contracts.common_rules.find(
    (rule) => rule.rule_logic?.kind === "duplicate_edge_identity"
  )?.rule_logic?.key_fields;
  if (!Array.isArray(defaultIdentity) || !defaultIdentity.every((field): field is string => typeof field === "string")) {
    throw new Error("Semantic relationship lookup requires bundle duplicate-edge identity key_fields.");
  }
  const relationships: SemanticRelationship[] = [];
  const coalesced = new Map<string, SemanticRelationship>();
  for (const edge of graph.edges) {
    const contract = contracts.get(edge.type);
    if (!contract) throw new Error(`Missing relationship contract '${edge.type}'.`);
    const semantics = contract.semantics;
    const directionality = semantics?.directionality ?? "directed";
    const [from, to] = directionality === "symmetric"
      ? [edge.from, edge.to].sort((a, b) => a.localeCompare(b))
      : [edge.from, edge.to];
    const fields = semantics?.identity_fields ?? defaultIdentity;
    const identity = JSON.stringify(fields.map((field) => [field,
      field === "from" ? from : field === "to" ? to : field === "props"
        ? Object.fromEntries(Object.entries(edge.props).sort(([a], [b]) => a.localeCompare(b)))
        : edge[field as keyof CompiledEdge] ?? null
    ]));
    const existing = semantics?.reciprocal_declarations === "coalesce" ? coalesced.get(identity) : undefined;
    if (existing) {
      existing.declarations.push(edge);
    } else {
      const relationship = { identity, from, type: edge.type, to, directionality, declarations: [edge] };
      relationships.push(relationship);
      if (semantics?.reciprocal_declarations === "coalesce") coalesced.set(identity, relationship);
    }
  }
  relationships.sort((a, b) => a.identity.localeCompare(b.identity));
  return {
    relationships,
    lookup(nodeId: string, direction: RelationshipLookupDirection = "incident", type?: string): SemanticRelationship[] {
      return relationships.filter((relationship) => (!type || relationship.type === type) && (
        relationship.directionality === "symmetric" || direction === "incident"
          ? relationship.from === nodeId || relationship.to === nodeId
          : direction === "outgoing" ? relationship.from === nodeId : relationship.to === nodeId
      ));
    }
  };
}
