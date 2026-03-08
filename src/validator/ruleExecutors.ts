import type { CompiledEdge, CompiledNode } from "../compiler/types.js";
import type { Diagnostic, Severity } from "../types.js";
import type { RuleExecutor, RuleSource, ValidationContext } from "./types.js";

function createDiagnostic(
  context: ValidationContext,
  severity: Severity,
  code: string,
  message: string,
  ruleId?: string,
  relatedIds?: string[]
): Diagnostic {
  return {
    stage: "validate",
    code,
    severity,
    message,
    file: context.file,
    ruleId,
    profileId: context.profileId,
    relatedIds
  };
}

function stablePropsKey(props: Record<string, string>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(props).sort(([left], [right]) => left.localeCompare(right))));
}

function edgeIdentity(edge: CompiledEdge, keyFields: string[]): string {
  const parts = keyFields.map((field) => {
    if (field === "props") {
      return stablePropsKey(edge.props);
    }
    const value = edge[field as keyof CompiledEdge];
    return String(value ?? "");
  });
  return parts.join("|");
}

function getRelationshipEdges(context: ValidationContext, relationship: string): CompiledEdge[] {
  return context.index.edgesByType.get(relationship) ?? [];
}

function detectCycleNodeIds(edges: CompiledEdge[]): string[] {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.from) ?? [];
    targets.push(edge.to);
    adjacency.set(edge.from, targets);
  }

  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycleNodes = new Set<string>();

  const visit = (nodeId: string): void => {
    if (stack.has(nodeId)) {
      cycleNodes.add(nodeId);
      return;
    }
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);
    stack.add(nodeId);
    for (const target of adjacency.get(nodeId) ?? []) {
      visit(target);
      if (stack.has(target)) {
        cycleNodes.add(nodeId);
        cycleNodes.add(target);
      }
    }
    stack.delete(nodeId);
  };

  for (const nodeId of adjacency.keys()) {
    visit(nodeId);
  }

  return [...cycleNodes].sort();
}

function nodeProperty(node: CompiledNode | undefined, property: string): string | undefined {
  return node?.props[property];
}

export const allEdgesEndpointsExist: RuleExecutor = (context, rule, _logic, severity) => {
  const diagnostics: Diagnostic[] = [];
  for (const edge of context.graph.edges) {
    if (!context.index.nodesById.has(edge.from) || !context.index.nodesById.has(edge.to)) {
      diagnostics.push(
        createDiagnostic(
          context,
          severity,
          `validate.${rule.id}`,
          `Edge '${edge.from} ${edge.type} ${edge.to}' references a missing node`,
          rule.id,
          [edge.from, edge.to]
        )
      );
    }
  }
  return diagnostics;
};

export const directedEdgesOnly: RuleExecutor = () => [];

export const duplicateEdgeIdentity: RuleExecutor = (context, rule, logic, severity) => {
  const keyFields = Array.isArray(logic.key_fields)
    ? logic.key_fields.filter((value): value is string => typeof value === "string")
    : ["from", "type", "to", "event", "guard", "effect", "props"];
  const seen = new Map<string, CompiledEdge>();
  const diagnostics: Diagnostic[] = [];

  for (const edge of context.graph.edges) {
    const key = edgeIdentity(edge, keyFields);
    if (seen.has(key)) {
      diagnostics.push(
        createDiagnostic(
          context,
          severity,
          `validate.${rule.id}`,
          `Duplicate edge detected for '${edge.from} ${edge.type} ${edge.to}'`,
          rule.id,
          [edge.from, edge.to]
        )
      );
      continue;
    }
    seen.set(key, edge);
  }

  return diagnostics;
};

export const annotationSemanticsScope: RuleExecutor = (context, rule, logic, severity) => {
  const semanticRelationships = new Set(
    Array.isArray(logic.semantic_relationships)
      ? logic.semantic_relationships.filter((value): value is string => typeof value === "string")
      : []
  );
  const diagnostics: Diagnostic[] = [];

  for (const edge of context.graph.edges) {
    if ((edge.event || edge.guard || edge.effect) && !semanticRelationships.has(edge.type)) {
      diagnostics.push(
        createDiagnostic(
          context,
          severity,
          `validate.${rule.id}`,
          `Edge '${edge.from} ${edge.type} ${edge.to}' uses annotations outside the semantic scope for that relationship`,
          rule.id,
          [edge.from, edge.to]
        )
      );
    }
  }

  return diagnostics;
};

export const toNameNonSemantic: RuleExecutor = () => [];

export const noInverseMaterialization: RuleExecutor = () => [];

export const acyclicSubgraph: RuleExecutor = (context, rule, logic, severity) => {
  const relationship = typeof logic.relationship === "string" ? logic.relationship : "";
  const cycleNodes = detectCycleNodeIds(getRelationshipEdges(context, relationship));
  if (cycleNodes.length === 0) {
    return [];
  }

  return [
    createDiagnostic(
      context,
      severity,
      `validate.${rule.id}`,
      `Relationship '${relationship}' must be acyclic`,
      rule.id,
      cycleNodes
    )
  ];
};

export const maxIncomingEdges: RuleExecutor = (context, rule, logic, severity) => {
  const relationship = typeof logic.relationship === "string" ? logic.relationship : "";
  const maxIncoming = typeof logic.max_incoming === "number" ? logic.max_incoming : 0;
  const diagnostics: Diagnostic[] = [];

  for (const node of context.graph.nodes) {
    const incomingCount = (context.index.incomingById.get(node.id) ?? []).filter(
      (edge) => edge.type === relationship
    ).length;
    if (incomingCount > maxIncoming) {
      diagnostics.push(
        createDiagnostic(
          context,
          severity,
          `validate.${rule.id}`,
          `Node '${node.id}' has ${incomingCount} incoming '${relationship}' edges; maximum is ${maxIncoming}`,
          rule.id,
          [node.id]
        )
      );
    }
  }

  return diagnostics;
};

export const cyclicFlowPolicy: RuleExecutor = (context, rule, logic, severity) => {
  const relationship = typeof logic.relationship === "string" ? logic.relationship : "";
  const cycleNodes = detectCycleNodeIds(getRelationshipEdges(context, relationship));
  if (cycleNodes.length === 0) {
    return [];
  }

  const markerProperty = typeof logic.loop_annotation_prop === "string" ? logic.loop_annotation_prop : "kind";
  const markerValue = typeof logic.loop_annotation_value === "string" ? logic.loop_annotation_value : "loop";
  const annotated = cycleNodes.some((nodeId) => nodeProperty(context.index.nodesById.get(nodeId), markerProperty) === markerValue);
  if (annotated) {
    return [];
  }

  return [
    createDiagnostic(
      context,
      severity,
      `validate.${rule.id}`,
      `Relationship '${relationship}' contains a cycle without a '${markerProperty}=${markerValue}' marker`,
      rule.id,
      cycleNodes
    )
  ];
};

export const optionalAnnotations: RuleExecutor = () => [];

export const minOutgoingEdgesByType: RuleExecutor = (context, rule, logic, severity) => {
  const fromType = typeof logic.from_type === "string" ? logic.from_type : "";
  const relationship = typeof logic.relationship === "string" ? logic.relationship : "";
  const minCount = typeof logic.min_count === "number" ? logic.min_count : 0;
  const diagnostics: Diagnostic[] = [];

  for (const node of context.graph.nodes.filter((candidate) => candidate.type === fromType)) {
    const count = (context.index.outgoingById.get(node.id) ?? []).filter((edge) => edge.type === relationship).length;
    if (count < minCount) {
      diagnostics.push(
        createDiagnostic(
          context,
          severity,
          `validate.${rule.id}`,
          `Node '${node.id}' requires at least ${minCount} '${relationship}' edge(s)`,
          rule.id,
          [node.id]
        )
      );
    }
  }

  return diagnostics;
};

export const eventAnnotationReference: RuleExecutor = (context, rule, logic, severity) => {
  const relationship = typeof logic.relationship === "string" ? logic.relationship : "";
  const eventNodeType = typeof logic.event_node_type === "string" ? logic.event_node_type : "Event";
  const idPattern = new RegExp(context.bundle.syntax.lexical.id_pattern);
  const diagnostics: Diagnostic[] = [];

  for (const edge of getRelationshipEdges(context, relationship)) {
    if (!edge.event) {
      continue;
    }

    if (!idPattern.test(edge.event)) {
      diagnostics.push(
        createDiagnostic(
          context,
          severity,
          `validate.${rule.id}`,
          `Edge '${edge.from} ${edge.type} ${edge.to}' must reference an Event node id in its event annotation`,
          rule.id,
          [edge.from, edge.to]
        )
      );
      continue;
    }

    const targetNode = context.index.nodesById.get(edge.event);
    if (!targetNode || targetNode.type !== eventNodeType) {
      diagnostics.push(
        createDiagnostic(
          context,
          severity,
          `validate.${rule.id}`,
          `Event annotation '${edge.event}' must resolve to an '${eventNodeType}' node`,
          rule.id,
          [edge.event]
        )
      );
    }
  }

  return diagnostics;
};

export const policyEnforcementCoverage: RuleExecutor = (context, rule, logic, severity) => {
  const relationship = typeof logic.relationship === "string" ? logic.relationship : "";
  const policyType = typeof logic.policy_type === "string" ? logic.policy_type : "Policy";
  const policyField = typeof logic.policy_field === "string" ? logic.policy_field : "enforcement_point";
  const diagnostics: Diagnostic[] = [];

  for (const node of context.graph.nodes.filter((candidate) => candidate.type === policyType)) {
    if (!node.props[policyField]) {
      continue;
    }
    const incoming = (context.index.incomingById.get(node.id) ?? []).filter((edge) => edge.type === relationship);
    if (incoming.length === 0) {
      diagnostics.push(
        createDiagnostic(
          context,
          severity,
          `validate.${rule.id}`,
          `Policy '${node.id}' declares '${policyField}' but has no incoming '${relationship}' edge`,
          rule.id,
          [node.id]
        )
      );
    }
  }

  return diagnostics;
};

export const requiredEdgeProperty: RuleExecutor = (context, rule, logic, severity) => {
  const relationship = typeof logic.relationship === "string" ? logic.relationship : "";
  const property = typeof logic.property === "string" ? logic.property : "";
  const diagnostics: Diagnostic[] = [];

  for (const edge of getRelationshipEdges(context, relationship)) {
    if (!edge.props[property]) {
      diagnostics.push(
        createDiagnostic(
          context,
          severity,
          `validate.${rule.id}`,
          `Edge '${edge.from} ${edge.type} ${edge.to}' requires edge property '${property}'`,
          rule.id,
          [edge.from, edge.to]
        )
      );
    }
  }

  return diagnostics;
};

export const delimitedNodeReferences: RuleExecutor = (context, rule, logic, severity) => {
  const nodeType = typeof logic.node_type === "string" ? logic.node_type : "";
  const property = typeof logic.property === "string" ? logic.property : "";
  const delimiter = typeof logic.delimiter === "string" ? logic.delimiter : ",";
  const targetType = typeof logic.target_type === "string" ? logic.target_type : "";
  const idPattern = new RegExp(typeof logic.id_pattern === "string" ? logic.id_pattern : context.bundle.syntax.lexical.id_pattern);
  const diagnostics: Diagnostic[] = [];

  for (const node of context.graph.nodes.filter((candidate) => candidate.type === nodeType)) {
    const value = node.props[property];
    if (!value) {
      continue;
    }
    const parts = value
      .split(delimiter)
      .map((part) => part.trim())
      .filter(Boolean);
    for (const part of parts) {
      const referencedNode = context.index.nodesById.get(part);
      if (!idPattern.test(part) || !referencedNode || referencedNode.type !== targetType) {
        diagnostics.push(
          createDiagnostic(
            context,
            severity,
            `validate.${rule.id}`,
            `Node '${node.id}' has invalid reference '${part}' in '${property}'`,
            rule.id,
            [node.id, part]
          )
        );
      }
    }
  }

  return diagnostics;
};

export const enumProperty: RuleExecutor = (context, rule, logic, severity) => {
  const nodeType = typeof logic.node_type === "string" ? logic.node_type : "";
  const property = typeof logic.property === "string" ? logic.property : "";
  const allowedValues = new Set(
    Array.isArray(logic.allowed_values)
      ? logic.allowed_values.filter((value): value is string => typeof value === "string")
      : []
  );
  const acceptedAliases =
    logic.accepted_aliases && typeof logic.accepted_aliases === "object"
      ? Object.entries(logic.accepted_aliases as Record<string, unknown>).reduce<Record<string, string>>((aliases, [key, value]) => {
          if (typeof value === "string") {
            aliases[key] = value;
          }
          return aliases;
        }, {})
      : {};
  const diagnostics: Diagnostic[] = [];

  for (const node of context.graph.nodes.filter((candidate) => candidate.type === nodeType)) {
    const value = node.props[property];
    if (value === undefined) {
      continue;
    }
    if (allowedValues.has(value)) {
      continue;
    }
    if (acceptedAliases[value] && allowedValues.has(acceptedAliases[value])) {
      continue;
    }
    diagnostics.push(
      createDiagnostic(
        context,
        severity,
        `validate.${rule.id}`,
        `Node '${node.id}' has invalid value '${value}' for '${property}'`,
        rule.id,
        [node.id]
      )
    );
  }

  return diagnostics;
};

export const patternProperty: RuleExecutor = (context, rule, logic, severity) => {
  const nodeType = typeof logic.node_type === "string" ? logic.node_type : "";
  const property = typeof logic.property === "string" ? logic.property : "";
  const pattern = new RegExp(typeof logic.pattern === "string" ? logic.pattern : ".*");
  const diagnostics: Diagnostic[] = [];

  for (const node of context.graph.nodes.filter((candidate) => candidate.type === nodeType)) {
    const value = node.props[property];
    if (value === undefined) {
      continue;
    }
    if (!pattern.test(value)) {
      diagnostics.push(
        createDiagnostic(
          context,
          severity,
          `validate.${rule.id}`,
          `Node '${node.id}' has invalid value '${value}' for '${property}'`,
          rule.id,
          [node.id]
        )
      );
    }
  }

  return diagnostics;
};

export const delimitedKeyValueProperty: RuleExecutor = (context, rule, logic, severity) => {
  const nodeType = typeof logic.node_type === "string" ? logic.node_type : "";
  const property = typeof logic.property === "string" ? logic.property : "";
  const delimiter = typeof logic.delimiter === "string" ? logic.delimiter : ",";
  const entryDelimiter = typeof logic.entry_delimiter === "string" ? logic.entry_delimiter : ":";
  const keyPattern = new RegExp(typeof logic.key_pattern === "string" ? logic.key_pattern : ".*");
  const valuePattern = new RegExp(typeof logic.value_pattern === "string" ? logic.value_pattern : ".*");
  const diagnostics: Diagnostic[] = [];

  for (const node of context.graph.nodes.filter((candidate) => candidate.type === nodeType)) {
    const value = node.props[property];
    if (value === undefined) {
      continue;
    }

    const entries = value
      .split(delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean);
    for (const entry of entries) {
      const splitIndex = entry.indexOf(entryDelimiter);
      if (splitIndex === -1) {
        diagnostics.push(
          createDiagnostic(
            context,
            severity,
            `validate.${rule.id}`,
            `Node '${node.id}' has malformed '${property}' entry '${entry}'`,
            rule.id,
            [node.id]
          )
        );
        continue;
      }
      const key = entry.slice(0, splitIndex).trim();
      const entryValue = entry.slice(splitIndex + entryDelimiter.length).trim();
      if (!keyPattern.test(key) || !valuePattern.test(entryValue)) {
        diagnostics.push(
          createDiagnostic(
            context,
            severity,
            `validate.${rule.id}`,
            `Node '${node.id}' has invalid '${property}' entry '${entry}'`,
            rule.id,
            [node.id]
          )
        );
      }
    }
  }

  return diagnostics;
};

export const nodeReferenceProperty: RuleExecutor = (context, rule, logic, severity) => {
  const nodeType = typeof logic.node_type === "string" ? logic.node_type : "";
  const property = typeof logic.property === "string" ? logic.property : "";
  const allowedTargetTypes = new Set(
    Array.isArray(logic.allowed_target_types)
      ? logic.allowed_target_types.filter((value): value is string => typeof value === "string")
      : []
  );
  const diagnostics: Diagnostic[] = [];

  for (const node of context.graph.nodes.filter((candidate) => candidate.type === nodeType)) {
    const value = node.props[property];
    if (value === undefined) {
      continue;
    }
    const referencedNode = context.index.nodesById.get(value);
    if (!referencedNode || !allowedTargetTypes.has(referencedNode.type)) {
      diagnostics.push(
        createDiagnostic(
          context,
          severity,
          `validate.${rule.id}`,
          `Node '${node.id}' has invalid reference '${value}' for '${property}'`,
          rule.id,
          [node.id, value]
        )
      );
    }
  }

  return diagnostics;
};

export const branchingStepMarker: RuleExecutor = (context, rule, logic, severity) => {
  const nodeType = typeof logic.node_type === "string" ? logic.node_type : "";
  const relationship = typeof logic.relationship === "string" ? logic.relationship : "";
  const markerProperty = typeof logic.marker_property === "string" ? logic.marker_property : "";
  const requiredValue = typeof logic.required_value === "string" ? logic.required_value : "";
  const diagnostics: Diagnostic[] = [];

  for (const node of context.graph.nodes.filter((candidate) => candidate.type === nodeType)) {
    const outgoing = (context.index.outgoingById.get(node.id) ?? []).filter((edge) => edge.type === relationship);
    if (outgoing.length > 1 && node.props[markerProperty] !== requiredValue) {
      diagnostics.push(
        createDiagnostic(
          context,
          severity,
          `validate.${rule.id}`,
          `Node '${node.id}' branches via '${relationship}' and should set '${markerProperty}=${requiredValue}'`,
          rule.id,
          [node.id]
        )
      );
    }
  }

  return diagnostics;
};

export const idPrefixTypeCoupling: RuleExecutor = (context, rule, _logic, severity) => {
  const prefixMap =
    "prefix_map" in rule && rule.prefix_map && typeof rule.prefix_map === "object"
      ? (rule.prefix_map as Record<string, string>)
      : {};
  const diagnostics: Diagnostic[] = [];

  for (const node of context.graph.nodes) {
    const expectedPrefix = prefixMap[node.type];
    if (!expectedPrefix) {
      continue;
    }
    const actualPrefix = node.id.split("-", 1)[0];
    if (actualPrefix !== expectedPrefix) {
      diagnostics.push(
        createDiagnostic(
          context,
          severity,
          `validate.${rule.id}`,
          `Node '${node.id}' has prefix '${actualPrefix}', expected '${expectedPrefix}' for type '${node.type}'`,
          rule.id,
          [node.id]
        )
      );
    }
  }

  return diagnostics;
};

export const ruleExecutors: Record<string, RuleExecutor> = {
  all_edges_endpoints_exist: allEdgesEndpointsExist,
  directed_edges_only: directedEdgesOnly,
  duplicate_edge_identity: duplicateEdgeIdentity,
  annotation_semantics_scope: annotationSemanticsScope,
  to_name_non_semantic: toNameNonSemantic,
  no_inverse_materialization: noInverseMaterialization,
  acyclic_subgraph: acyclicSubgraph,
  max_incoming_edges: maxIncomingEdges,
  cyclic_flow_policy: cyclicFlowPolicy,
  optional_annotations: optionalAnnotations,
  min_outgoing_edges_by_type: minOutgoingEdgesByType,
  event_annotation_reference: eventAnnotationReference,
  policy_enforcement_coverage: policyEnforcementCoverage,
  required_edge_property: requiredEdgeProperty,
  delimited_node_references: delimitedNodeReferences,
  enum_property: enumProperty,
  pattern_property: patternProperty,
  delimited_key_value_property: delimitedKeyValueProperty,
  node_reference_property: nodeReferenceProperty,
  branching_step_marker: branchingStepMarker,
  id_prefix_type_coupling: idPrefixTypeCoupling
};

