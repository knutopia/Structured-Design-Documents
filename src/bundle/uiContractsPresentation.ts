import type { UiContractsPresentationConfig, ViewSpec } from "./types.js";

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every(text);
const roles = ["component", "place", "primary", "secondary", "support"] as const;
const kinds = ["containment", "composition", "ownership", "transition", "contract"];
const styles = ["solid", "dashed", "dotted"];

function hasKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every(key => expected.includes(key));
}

function routingProblems(value: unknown): string[] {
  if (!isRecord(value)) return ["routing must be an object"];
  const errors: string[] = [];
  if (!hasKeys(value, ["scope", "export_clearance", "capacity", "self_loop"])) errors.push("routing must declare only scope, export_clearance, capacity, and self_loop");
  if (value.scope !== "within_transition_region") errors.push("routing.scope must be within_transition_region");
  if (value.export_clearance !== "readable_gap") errors.push("routing.export_clearance must be readable_gap");
  const capacity = value.capacity;
  if (!isRecord(capacity) || !hasKeys(capacity, ["owner", "node"])
    || capacity.owner !== "fixed" && capacity.owner !== "padding_and_adjacency_gaps"
    || capacity.node !== "fixed" && capacity.node !== "port_minimum") {
    errors.push("routing.capacity must declare owner: fixed | padding_and_adjacency_gaps and node: fixed | port_minimum");
  }
  const loop = value.self_loop;
  if (!isRecord(loop)) return [...errors, "routing.self_loop must be an object"];
  if (!hasKeys(loop, ["shape", "traversal", "side_trials", "label", "selection"])) errors.push("routing.self_loop must declare only shape, traversal, side_trials, label, and selection");
  if (loop.shape !== "compact_same_side") errors.push("routing.self_loop.shape must be compact_same_side");
  if (loop.label !== "external") errors.push("routing.self_loop.label must be external");
  const traversal = loop.traversal;
  const validTraversal = isRecord(traversal) && hasKeys(traversal, ["axis", "direction"])
    && (traversal.axis === "x" || traversal.axis === "y")
    && (traversal.direction === "positive" || traversal.direction === "negative");
  if (!validTraversal) errors.push("routing.self_loop.traversal must declare axis: x | y and direction: positive | negative");
  if (!Array.isArray(loop.side_trials) || loop.side_trials.length === 0) {
    errors.push("routing.self_loop.side_trials must contain at least one trial");
  } else {
    const seen = new Set<string>();
    for (const [index, trial] of loop.side_trials.entries()) {
      const path = `routing.self_loop.side_trials[${index}]`;
      if (!isRecord(trial) || !hasKeys(trial, ["side", "pair_placement"])
        || typeof trial.side !== "string" || !["north", "east", "south", "west"].includes(trial.side)
        || trial.pair_placement !== "before_other_arrivals" && trial.pair_placement !== "nearest_feasible") {
        errors.push(`${path} must declare a supported side and pair_placement`);
        continue;
      }
      if (seen.has(trial.side)) errors.push(`${path}.side must be unique`);
      seen.add(trial.side);
      if (validTraversal && ((trial.side === "north" || trial.side === "south") ? "y" : "x") === traversal.axis) {
        errors.push(`${path}.side must be tangent to traversal`);
      }
    }
  }
  const selection = ["crossings", "bends", "enlargement", "side_order", "length"];
  if (!Array.isArray(loop.selection) || loop.selection.length !== selection.length
    || new Set(loop.selection).size !== selection.length
    || !loop.selection.every(criterion => typeof criterion === "string" && selection.includes(criterion))) {
    errors.push("routing.self_loop.selection must contain crossings, bends, enlargement, side_order, and length exactly once in ranking order");
  }
  return errors;
}

export function uiContractsPresentationProblems(value: unknown, policies?: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["ui_contracts_presentation must be an object"];
  // A malformed capability is an error; only an absent property selects compatibility.
  if (Object.prototype.hasOwnProperty.call(value, "routing")) errors.push(...routingProblems(value.routing));
  for (const role of roles) {
    if (!isRecord(value.roles) || !stringArray(value.roles[role])) errors.push(`roles.${role} must contain node types`);
    const content = isRecord(value.content) ? value.content[role] : undefined;
    if (!Array.isArray(content) || !content.every(attribute => isRecord(attribute)
      && text(attribute.property) && text(attribute.label) && text(attribute.visible_when))) errors.push(`content.${role} must contain attribute declarations`);
  }
  if (!Array.isArray(value.relationships) || value.relationships.length === 0 || !value.relationships.every(rule =>
    isRecord(rule) && kinds.includes(String(rule.kind)) && text(rule.edge_type) && stringArray(rule.from)
    && stringArray(rule.to) && styles.includes(String(rule.style))
    && (rule.secondary_style === undefined || styles.includes(String(rule.secondary_style)))
    && (rule.label === undefined || text(rule.label))
    && (rule.field_property === undefined || text(rule.field_property) && text(rule.field_label)))) {
    errors.push("relationships must contain valid endpoint selectors and presentation rules");
  }
  if (!isRecord(value.ownership) || !text(value.ownership.primary_property) || !text(value.ownership.secondary_property)) errors.push("ownership must declare both property selectors");
  const scopePolicy = value.scope_policy;
  if (!isRecord(scopePolicy)
    || !Array.isArray(scopePolicy.simple_scope_kinds)
    || scopePolicy.simple_scope_kinds.length === 0
    || !scopePolicy.simple_scope_kinds.every(kind => ["place", "component", "standalone"].includes(String(kind)))
    || scopePolicy.simple_occurrence_count !== 1
    || scopePolicy.simple_connector_count !== 0
    || !text(scopePolicy.retain_component_scopes_when_overview)
    || !text(scopePolicy.omit_simple_scopes)
    || !text(scopePolicy.pack_consecutive_simple_scopes)) {
    errors.push("scope_policy must declare simple scope selectors and detail switches");
  }
  const visibility = value.visibility;
  if (!isRecord(visibility) || !["hierarchy", "secondary", "support", "omit_empty_places"].every(key => text(visibility[key]))) errors.push("visibility must declare detail switches");
  if (!isRecord(value.hierarchy) || value.hierarchy.order !== "source_depth_first" || value.hierarchy.reuse !== "first_expansion" || !text(value.hierarchy.locator_prefix)) errors.push("hierarchy must declare source_depth_first / first_expansion and a locator prefix");
  if (!isRecord(value.hierarchy) || !["grouped", "individual_roots"].includes(String(value.hierarchy.isolated_components))) errors.push("hierarchy.isolated_components must be grouped or individual_roots");
  if (!isRecord(value.place_description) || !text(value.place_description.property) || !text(value.place_description.visible_when)) errors.push("place_description must declare property and visibility");
  if (!isRecord(value.target_register_layout)
    || !["rows_widest_other_section", "column"].includes(String(value.target_register_layout.mode))) errors.push("target_register_layout must declare rows_widest_other_section or column");
  const labels = value.labels;
  if (!isRecord(labels) || !["isolated_components", "hierarchy_root", "hierarchy_expansion", "hierarchy_reference", "component_scope", "place_scope", "standalone_scope", "target_register"].every(key => text(labels[key]))) errors.push("labels must declare all scope and reference templates");
  if (!isRecord(value.transition_label) || typeof value.transition_label.separator !== "string"
    || !Array.isArray(value.transition_label.parts) || !value.transition_label.parts.every(part => isRecord(part)
      && ["event", "guard", "effect"].includes(String(part.field)) && text(part.template) && typeof part.resolve_node_name === "boolean")) errors.push("transition_label must declare annotation templates");
  if (errors.length === 0 && policies !== undefined) {
    const config = value as unknown as UiContractsPresentationConfig;
    const switches = [...Object.values(config.visibility), config.place_description.visible_when,
      config.scope_policy.retain_component_scopes_when_overview,
      config.scope_policy.omit_simple_scopes,
      config.scope_policy.pack_consecutive_simple_scopes,
      ...Object.values(config.content).flatMap(attributes => attributes.map(attribute => attribute.visible_when))];
    if (!isRecord(policies)) errors.push("detail policies are required");
    else for (const [detail, policy] of Object.entries(policies)) for (const key of switches) {
      if (!isRecord(policy) || typeof policy[key] !== "boolean") errors.push(`detail_display.${detail}.${key} must be boolean`);
    }
  }
  return errors;
}

export function resolveUiContractsPresentation(view: ViewSpec): UiContractsPresentationConfig {
  const config = view.conventions.renderer_defaults?.ui_contracts_presentation;
  const errors = uiContractsPresentationProblems(config, view.conventions.renderer_defaults?.detail_display);
  if (errors.length) throw new Error(`View '${view.id}': ${errors.join("; ")}`);
  return config!;
}
