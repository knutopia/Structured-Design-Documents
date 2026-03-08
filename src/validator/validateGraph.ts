import type { ProfileConfig, ProfileRule, RelationshipContract } from "../bundle/types.js";
import { getGraphSourcePath, type CompiledGraph } from "../compiler/types.js";
import { sortDiagnostics } from "../diagnostics/types.js";
import type { Diagnostic, Severity } from "../types.js";
import { getRuleExecutor } from "./ruleRegistry.js";
import type { GraphIndex, ValidationContext, ValidationReport } from "./types.js";

function buildIndex(graph: CompiledGraph): GraphIndex {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoingById = new Map<string, typeof graph.edges>();
  const incomingById = new Map<string, typeof graph.edges>();
  const edgesByType = new Map<string, typeof graph.edges>();

  for (const edge of graph.edges) {
    outgoingById.set(edge.from, [...(outgoingById.get(edge.from) ?? []), edge]);
    incomingById.set(edge.to, [...(incomingById.get(edge.to) ?? []), edge]);
    edgesByType.set(edge.type, [...(edgesByType.get(edge.type) ?? []), edge]);
  }

  return {
    nodesById,
    outgoingById,
    incomingById,
    edgesByType
  };
}

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

function endpointPairsDiagnostics(
  context: ValidationContext,
  severity: Severity,
  relationship: RelationshipContract
): Diagnostic[] {
  const allowedPairs = new Set(relationship.allowed_endpoints.map((pair) => `${pair.from}->${pair.to}`));
  const diagnostics: Diagnostic[] = [];

  for (const edge of context.index.edgesByType.get(relationship.type) ?? []) {
    const fromNode = context.index.nodesById.get(edge.from);
    const toNode = context.index.nodesById.get(edge.to);
    if (!fromNode || !toNode) {
      continue;
    }
    const pairKey = `${fromNode.type}->${toNode.type}`;
    if (!allowedPairs.has(pairKey)) {
      diagnostics.push(
        createDiagnostic(
          context,
          severity,
          "validate.endpoint_pairs_enforced",
          `Edge '${edge.from} ${edge.type} ${edge.to}' is not allowed between '${fromNode.type}' and '${toNode.type}'`,
          "endpoint_pairs_enforced",
          [edge.from, edge.to]
        )
      );
    }
  }

  return diagnostics;
}

function requiredPropsDiagnostics(context: ValidationContext, rule: ProfileRule): Diagnostic[] {
  const requiredPropsByType = rule.required_props ?? {};
  const diagnostics: Diagnostic[] = [];

  for (const node of context.graph.nodes) {
    const requiredProps = requiredPropsByType[node.type] ?? [];
    for (const requiredProp of requiredProps) {
      const value = node.props[requiredProp];
      if (value === undefined || value === "") {
        diagnostics.push(
          createDiagnostic(
            context,
            rule.severity,
            `validate.${rule.id}`,
            `Node '${node.id}' is missing required property '${requiredProp}'`,
            rule.id,
            [node.id]
          )
        );
      }
    }
  }

  return diagnostics;
}

function viewStateParentageDiagnostics(context: ValidationContext, rule: ProfileRule): Diagnostic[] {
  const authoritativeField = typeof rule.authoritative_field === "string" ? rule.authoritative_field : "place_id";
  const diagnostics: Diagnostic[] = [];

  for (const node of context.graph.nodes.filter((candidate) => candidate.type === "ViewState")) {
    const placeId = node.props[authoritativeField];
    if (!placeId) {
      continue;
    }
    const incomingContains = (context.index.incomingById.get(node.id) ?? []).some(
      (edge) => edge.type === "CONTAINS" && edge.from === placeId
    );
    if (!incomingContains) {
      diagnostics.push(
        createDiagnostic(
          context,
          rule.severity,
          `validate.${rule.id}`,
          `ViewState '${node.id}' declares '${authoritativeField}=${placeId}' but lacks matching CONTAINS parentage`,
          rule.id,
          [node.id, placeId]
        )
      );
    }
  }

  return diagnostics;
}

function ruleSeverityByProfile(rule: { severity_by_profile?: Record<string, Severity> }, profileId: string): Severity | undefined {
  return rule.severity_by_profile?.[profileId];
}

function profileRuleForId(profile: ProfileConfig, ruleId: string): ProfileRule | undefined {
  return profile.rules.find((rule) => rule.id === ruleId);
}

export function validateGraph(graph: CompiledGraph, bundle: ValidationContext["bundle"], profileId: string): ValidationReport {
  const profile = bundle.profiles[profileId];
  const file = getGraphSourcePath(graph) ?? "<compiled>";
  const diagnostics: Diagnostic[] = [];

  if (!profile) {
    diagnostics.push({
      stage: "validate",
      code: "validate.unknown_profile",
      severity: "error",
      message: `Unknown profile '${profileId}'`,
      file
    });
    return {
      diagnostics,
      errorCount: 1,
      warningCount: 0
    };
  }

  const context: ValidationContext = {
    bundle,
    graph,
    file,
    profile,
    profileId,
    index: buildIndex(graph)
  };

  for (const rule of bundle.contracts.common_rules) {
    const severity = ruleSeverityByProfile(rule, profileId);
    const ruleLogic = rule.rule_logic;
    if (!severity || !ruleLogic) {
      continue;
    }
    const executor = getRuleExecutor(ruleLogic.kind);
    if (!executor) {
      diagnostics.push(
        createDiagnostic(
          context,
          "error",
          "validate.unknown_rule_logic",
          `Unknown rule_logic.kind '${ruleLogic.kind}'`,
          rule.id
        )
      );
      continue;
    }
    diagnostics.push(...executor(context, rule, ruleLogic, severity));
  }

  const endpointPairsRule = profileRuleForId(profile, "endpoint_pairs_enforced");
  if (endpointPairsRule) {
    for (const relationship of bundle.contracts.relationships) {
      diagnostics.push(...endpointPairsDiagnostics(context, endpointPairsRule.severity, relationship));
    }
  }

  for (const relationship of bundle.contracts.relationships) {
    for (const rule of relationship.constraints) {
      const severity = ruleSeverityByProfile(rule, profileId);
      const ruleLogic = rule.rule_logic;
      if (!severity || !ruleLogic) {
        continue;
      }
      const executor = getRuleExecutor(ruleLogic.kind);
      if (!executor) {
        diagnostics.push(
          createDiagnostic(
            context,
            "error",
            "validate.unknown_rule_logic",
            `Unknown rule_logic.kind '${ruleLogic.kind}'`,
            rule.id
          )
        );
        continue;
      }
      diagnostics.push(...executor(context, rule, ruleLogic, severity));
    }
  }

  for (const rule of profile.rules) {
    if (rule.source === "core/contracts.yaml") {
      continue;
    }

    if (rule.id === "required_props_by_type") {
      diagnostics.push(...requiredPropsDiagnostics(context, rule));
      continue;
    }

    if (rule.id === "viewstate_parentage_policy") {
      diagnostics.push(...viewStateParentageDiagnostics(context, rule));
      continue;
    }

    if (!rule.rule_logic) {
      continue;
    }

    const executor = getRuleExecutor(rule.rule_logic.kind);
    if (!executor) {
      diagnostics.push(
        createDiagnostic(
          context,
          "error",
          "validate.unknown_rule_logic",
          `Unknown rule_logic.kind '${rule.rule_logic.kind}'`,
          rule.id
        )
      );
      continue;
    }
    diagnostics.push(...executor(context, rule, rule.rule_logic, rule.severity));
  }

  const sortedDiagnostics = sortDiagnostics(diagnostics);
  return {
    diagnostics: sortedDiagnostics,
    errorCount: sortedDiagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
    warningCount: sortedDiagnostics.filter((diagnostic) => diagnostic.severity === "warn").length
  };
}
