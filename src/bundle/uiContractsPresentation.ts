import type { UiContractsPresentationConfig, ViewSpec } from "./types.js";

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every(text);
const roles = ["component", "place", "primary", "secondary", "support"] as const;
const kinds = ["containment", "composition", "ownership", "transition", "contract"];
const styles = ["solid", "dashed", "dotted"];

export function uiContractsPresentationProblems(value: unknown, policies?: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["ui_contracts_presentation must be an object"];
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
  const visibility = value.visibility;
  if (!isRecord(visibility) || !["hierarchy", "secondary", "support", "omit_empty_places"].every(key => text(visibility[key]))) errors.push("visibility must declare detail switches");
  if (!isRecord(value.hierarchy) || value.hierarchy.order !== "source_depth_first" || value.hierarchy.reuse !== "first_expansion" || !text(value.hierarchy.locator_prefix)) errors.push("hierarchy must declare source_depth_first / first_expansion and a locator prefix");
  if (!isRecord(value.hierarchy) || !["grouped", "individual_roots"].includes(String(value.hierarchy.isolated_components))) errors.push("hierarchy.isolated_components must be grouped or individual_roots");
  if (!isRecord(value.place_description) || !text(value.place_description.property) || !text(value.place_description.visible_when)) errors.push("place_description must declare property and visibility");
  const labels = value.labels;
  if (!isRecord(labels) || !["isolated_components", "hierarchy_root", "hierarchy_expansion", "hierarchy_reference", "component_scope", "place_scope", "standalone_scope", "target_register"].every(key => text(labels[key]))) errors.push("labels must declare all scope and reference templates");
  if (!isRecord(value.transition_label) || typeof value.transition_label.separator !== "string"
    || !Array.isArray(value.transition_label.parts) || !value.transition_label.parts.every(part => isRecord(part)
      && ["event", "guard", "effect"].includes(String(part.field)) && text(part.template) && typeof part.resolve_node_name === "boolean")) errors.push("transition_label must declare annotation templates");
  if (errors.length === 0 && policies !== undefined) {
    const config = value as unknown as UiContractsPresentationConfig;
    const switches = [...Object.values(config.visibility), config.place_description.visible_when,
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
