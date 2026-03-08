import type { Bundle, ContractRule, ProfileConfig, ProfileRule, RelationshipContract, RuleLogic } from "../bundle/types.js";
import type { CompiledEdge, CompiledGraph, CompiledNode } from "../compiler/types.js";
import type { Diagnostic, Severity } from "../types.js";

export interface GraphIndex {
  nodesById: Map<string, CompiledNode>;
  outgoingById: Map<string, CompiledEdge[]>;
  incomingById: Map<string, CompiledEdge[]>;
  edgesByType: Map<string, CompiledEdge[]>;
}

export interface ValidationContext {
  bundle: Bundle;
  graph: CompiledGraph;
  file: string;
  profile: ProfileConfig;
  profileId: string;
  index: GraphIndex;
}

export interface ValidationReport {
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
}

export type RuleSource = ContractRule | ProfileRule;

export type RuleExecutor = (
  context: ValidationContext,
  rule: RuleSource,
  ruleLogic: RuleLogic,
  severity: Severity
) => Diagnostic[];

export interface RelationshipRuleContext extends ValidationContext {
  relationship: RelationshipContract;
}

