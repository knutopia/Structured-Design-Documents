import type { CompiledGraph } from "../compiler/types.js";
import { getCompiledEdgeSourceSpan, getGraphAuthorOrder } from "../compiler/types.js";
import { getSourceOrderedStructuralStream } from "../compiler/authorOrder.js";
import type { Projection } from "../projector/types.js";
import type { UiContractsPresentationRole, UiContractsRelationshipKind, ViewSpec } from "../bundle/types.js";
import { resolveUiContractsPresentation } from "../bundle/uiContractsPresentation.js";
import { readBooleanDetailDisplaySetting, resolveDetailDisplayPolicy } from "./detailDisplay.js";
import type { SharedNodeAttribute } from "./staged/contracts.js";
import { createSceneDiagnostic, type RendererDiagnostic } from "./staged/diagnostics.js";

export interface UiContractsOccurrence {
  id: string; semanticId: string; role: string; scopeId: string; path: string[];
  title: string; nodeType: string; attributes: SharedNodeAttribute[];
}
export interface UiContractsRelationship {
  id: string; from: string; to: string; type: string; kind: UiContractsRelationshipKind;
  label?: string; style: string; sourceOrder: number;
}
export interface UiContractsVisualEdge {
  id: string; relationshipId: string; from: string; to: string;
  kind: UiContractsRelationshipKind; label?: string; style: string;
}
export interface UiContractsLocalGroup {
  id: string; source: UiContractsOccurrence; targets: UiContractsOccurrence[]; edges: UiContractsVisualEdge[];
}
export interface UiContractsSequence {
  id: string; nodes: UiContractsOccurrence[]; edges: UiContractsVisualEdge[];
}
export interface UiContractsHierarchy {
  id: string; node: UiContractsOccurrence; children: UiContractsHierarchy[];
  title?: string; locator?: string; referenceTo?: string;
}
export interface UiContractsScope {
  id: string; kind: "place" | "component" | "standalone"; title: string;
  focal: UiContractsOccurrence; parents: UiContractsOccurrence[]; children: UiContractsOccurrence[];
  containment: UiContractsVisualEdge[];
  sequences: UiContractsSequence[]; compositions: UiContractsLocalGroup[]; contracts: UiContractsLocalGroup[];
  description?: string;
}
export interface UiContractsPresentationModel {
  overview: UiContractsHierarchy[]; scopes: UiContractsScope[];
  register: { id: string; title: string; nodes: UiContractsOccurrence[] };
  occurrences: UiContractsOccurrence[]; relationships: UiContractsRelationship[];
  /** Relationships represented by scope ownership or actual overview nesting rather than requiring arrows. */
  structuralRelationshipIds: string[]; visibleSemanticNodeIds: string[];
  omissions: Array<{ id: string; reason: string }>; omittedPlaceIds: string[];
  notes: string[]; diagnostics: RendererDiagnostic[];
}

function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(name|parent|locator|value)\}/g, (_, key: string) => values[key] ?? "");
}
function triple(edge: { from: string; type: string; to: string }): string {
  return JSON.stringify([edge.from, edge.type, edge.to]);
}

/** Rendering occurrences are distinct from semantic identities; raw projection is never changed. */
export function buildUiContractsPresentationModel(projection: Projection, graph: CompiledGraph, view: ViewSpec, detailId: string): UiContractsPresentationModel {
  const config = resolveUiContractsPresentation(view), policy = resolveDetailDisplayPolicy(view, detailId);
  const enabled = (key: string) => readBooleanDetailDisplaySetting(policy, key);
  const graphNodes = new Map(graph.nodes.map(node => [node.id, node]));
  const nodes = new Map(projection.nodes.map(node => [node.id, node]));
  const roleOf = (id: string): UiContractsPresentationRole | undefined => {
    const type = nodes.get(id)?.type;
    return (Object.entries(config.roles) as Array<[UiContractsPresentationRole, string[]]>).find(([, types]) => type !== undefined && types.includes(type))?.[0];
  };
  // buildGraph records this map while walking authored blocks in declaration
  // order, including nested blocks. Following references here would let an
  // earlier composition reference reorder a later Component declaration.
  const authorOrder = getGraphAuthorOrder(graph);
  const authoredIds = [...new Set([
    ...(authorOrder?.edgeLineOrderByParentId.keys() ?? []),
    ...graph.nodes.map(node => node.id)
  ])];
  const order = (ids: Iterable<string>) => {
    const selected = new Set(ids);
    return authoredIds.filter(id => selected.has(id));
  };
  const priority = projection.derived.view_metadata.transition_graph_priority as Record<string, unknown> | undefined;
  const hasPrimary = projection.nodes.some(node => node.type === priority?.primary_node_type);
  const fallback = !hasPrimary && priority?.fallback_to_secondary_when_primary_absent === true
    && projection.nodes.some(node => node.type === priority?.secondary_node_type);
  const showSecondary = fallback || enabled(config.visibility.secondary);
  const showSupport = fallback || enabled(config.visibility.support);
  const showHierarchy = enabled(config.visibility.hierarchy);
  const diagnostics: RendererDiagnostic[] = [], omissions: UiContractsPresentationModel["omissions"] = [];
  const visible = new Set(projection.nodes.filter(node => roleOf(node.id) !== "secondary" || showSecondary)
    .filter(node => roleOf(node.id) !== "support" || showSupport).map(node => node.id));
  for (const node of projection.nodes) {
    if (!visible.has(node.id)) omissions.push({ id: node.id, reason: "detail_policy" });
    if (!roleOf(node.id)) diagnostics.push(createSceneDiagnostic("renderer.scene.ui_contracts_unclassified_node", `No presentation role selects '${node.id}'.`, { targetId: node.id, severity: "error" }));
  }

  // Match projected relationship multiplicity before consulting compiled annotation/property data.
  const projectedCounts = new Map<string, number>();
  for (const edge of projection.edges) projectedCounts.set(triple(edge), (projectedCounts.get(triple(edge)) ?? 0) + 1);
  const orderedEdges = graph.edges.map((edge, index) => ({ edge, index, offset: getCompiledEdgeSourceSpan(edge)?.startOffset }))
    .sort((a, b) => (a.offset ?? a.index) - (b.offset ?? b.index) || a.index - b.index);
  const relationships: UiContractsRelationship[] = [], occurrenceCounts = new Map<string, number>();
  for (const { edge } of orderedEdges) {
    const key = triple(edge), remaining = projectedCounts.get(key) ?? 0;
    if (!remaining) continue;
    projectedCounts.set(key, remaining - 1);
    const ordinal = occurrenceCounts.get(key) ?? 0;
    occurrenceCounts.set(key, ordinal + 1);
    const id = `relationship:${encodeURIComponent(key)}:${ordinal}`;
    const selectors = config.relationships.filter(rule => rule.edge_type === edge.type && rule.from.includes(nodes.get(edge.from)!.type) && rule.to.includes(nodes.get(edge.to)!.type));
    if (selectors.length > 1) {
      diagnostics.push(createSceneDiagnostic("renderer.scene.ui_contracts_ambiguous_relationship", `More than one presentation rule selects '${id}'.`, { targetId: id, severity: "error" }));
      continue;
    }
    const rule = selectors[0];
    if (!rule || !visible.has(edge.from) || !visible.has(edge.to) || rule.kind === "containment" && !showHierarchy) {
      omissions.push({ id, reason: !rule ? "relationship_not_presented" : "detail_policy" });
      continue;
    }
    let label = rule.label;
    if (rule.field_property && edge.props[rule.field_property]) label = format(rule.field_label!, { value: edge.props[rule.field_property] });
    if (rule.kind === "transition") {
      label = config.transition_label.parts.flatMap(part => {
        const value = edge[part.field];
        if (!value) return [];
        return [format(part.template, { value: part.resolve_node_name ? graphNodes.get(value)?.name ?? value : value })];
      }).join(config.transition_label.separator) || undefined;
    }
    relationships.push({ id, from: edge.from, to: edge.to, type: edge.type, kind: rule.kind, label,
      style: !fallback && rule.secondary_style ? rule.secondary_style : rule.style, sourceOrder: relationships.length });
  }
  for (const [key, remaining] of projectedCounts) if (remaining) diagnostics.push(createSceneDiagnostic(
    "renderer.scene.ui_contracts_missing_relationship_lookup", `Projected relationship '${key}' has no matching compiled occurrence.`, { severity: "error" }));
  const componentIds = order([...visible].filter(id => roleOf(id) === "component"));
  const placeIds = order([...visible].filter(id => roleOf(id) === "place"));
  const hierarchyEdges = relationships.filter(edge => edge.kind === "containment");
  const parentsOf = (id: string) => [...new Set(hierarchyEdges.filter(edge => edge.to === id).map(edge => edge.from))];
  const childrenOf = (id: string) => {
    const candidates = new Set(hierarchyEdges.filter(edge => edge.from === id).map(edge => edge.to));
    return [...new Set(getSourceOrderedStructuralStream(graph, id, config.relationships.filter(rule => rule.kind === "containment").map(rule => rule.edge_type), candidates).map(edge => edge.to))];
  };
  // Detect cycles over the entire selected graph, including components without roots.
  const active = new Set<string>(), complete = new Set<string>();
  const checkCycle = (id: string): void => {
    if (active.has(id)) {
      diagnostics.push(createSceneDiagnostic("renderer.scene.ui_contracts_containment_cycle", `Component containment cycles through '${id}'.`, { targetId: id, severity: "error" }));
      return;
    }
    if (complete.has(id)) return;
    active.add(id); childrenOf(id).forEach(checkCycle); active.delete(id); complete.add(id);
  };
  componentIds.forEach(checkCycle);
  const occurrences: UiContractsOccurrence[] = [];
  const occurrence = (semanticId: string, scopeId: string, role: string, path: string[], detailed = false): UiContractsOccurrence => {
    const node = nodes.get(semanticId)!;
    const attributes = detailed ? (config.content[roleOf(semanticId)!] ?? []).flatMap(attribute => {
      const value = graphNodes.get(semanticId)?.props[attribute.property];
      return value && enabled(attribute.visible_when) ? [{ groupId: attribute.property, label: attribute.label, value }] : [];
    }) : [];
    const result = { id: `occurrence:${encodeURIComponent(JSON.stringify([scopeId, role, ...path, semanticId]))}`,
      semanticId, scopeId, role, path, title: node.name, nodeType: node.type, attributes };
    occurrences.push(result); return result;
  };
  const visualEdge = (edge: UiContractsRelationship, from: UiContractsOccurrence, to: UiContractsOccurrence, groupId: string): UiContractsVisualEdge => ({
    id: `${groupId}:${edge.id}`, relationshipId: edge.id, from: from.id, to: to.id, kind: edge.kind, label: edge.label, style: edge.style
  });
  const expanded = new Map<string, UiContractsHierarchy>();
  const expansionParent = new Map<string, string>();
  let locatorIndex = 0;
  const overviewOccurrence = (id: string, parent: string | undefined, path: string[]): UiContractsHierarchy => {
    const node = occurrence(id, "overview", "hierarchy", path), children = childrenOf(id), previous = expanded.get(id);
    const item: UiContractsHierarchy = { id: `enclosure:${node.id}`, node, children: [] };
    if (children.length && previous) {
      if (!previous.locator) {
        previous.locator = `${config.hierarchy.locator_prefix}${++locatorIndex}`;
        previous.title = format(config.labels.hierarchy_expansion, { locator: previous.locator });
      }
      item.referenceTo = previous.id;
      item.locator = previous.locator;
      item.title = format(config.labels.hierarchy_reference, { locator: previous.locator, parent: nodes.get(expansionParent.get(id) ?? id)!.name });
      return item;
    }
    expanded.set(id, item);
    if (parent) expansionParent.set(id, parent);
    if (!parent) item.title = format(config.labels.hierarchy_root, { name: node.title });
    item.children = children.map(child => overviewOccurrence(child, id, [...path, id]));
    return item;
  };
  const overview = showHierarchy && !diagnostics.some(d => d.severity === "error")
    ? componentIds.filter(id => !parentsOf(id).length).map(id => overviewOccurrence(id, undefined, [])) : [];
  // Reuse may be discovered in a different order than first expansion.
  [...expanded.values()].filter(item => item.locator).forEach((item, index) => {
    item.locator = `${config.hierarchy.locator_prefix}${index + 1}`;
    item.title = format(config.labels.hierarchy_expansion, { locator: item.locator });
  });
  const updateReferences = (item: UiContractsHierarchy): void => {
    if (item.referenceTo) {
      item.locator = expanded.get(item.node.semanticId)!.locator!;
      item.title = format(config.labels.hierarchy_reference, { locator: item.locator,
        parent: nodes.get(expansionParent.get(item.node.semanticId) ?? item.node.semanticId)!.name });
    }
    item.children.forEach(updateReferences);
  };
  overview.forEach(updateReferences);

  // Only actual overview nesting supplies structural containment coverage.
  const overviewById = new Map<string, UiContractsHierarchy[]>();
  const overviewContainmentIds = new Set<string>();
  const indexOverview = (item: UiContractsHierarchy): void => {
    overviewById.set(item.node.semanticId, [...(overviewById.get(item.node.semanticId) ?? []), item]);
    for (const child of item.children) {
      hierarchyEdges.filter(edge => edge.from === item.node.semanticId && edge.to === child.node.semanticId)
        .forEach(edge => overviewContainmentIds.add(edge.id));
      indexOverview(child);
    }
  };
  overview.forEach(indexOverview);

  const ownerOf = (id: string): string | undefined => {
    if (roleOf(id) === "primary") return relationships.find(edge => edge.kind === "ownership" && edge.to === id)?.from
      ?? graphNodes.get(id)?.props[config.ownership.primary_property];
    if (roleOf(id) === "secondary") return graphNodes.get(id)?.props[config.ownership.secondary_property];
    return undefined;
  };
  const makeGroup = (ownerId: string, kind: "composition" | "contract", scopeId: string, useFocal?: UiContractsOccurrence): UiContractsLocalGroup | undefined => {
    const selected = relationships.filter(edge => edge.kind === kind && edge.from === ownerId);
    if (!selected.length) return undefined;
    const id = `${scopeId}:${kind}:${ownerId}`, source = useFocal ?? occurrence(ownerId, scopeId, `${kind}_source`, [id]);
    const targets = selected.map(edge => occurrence(edge.to, scopeId, `${kind}_target`, [id, edge.id]));
    return { id, source, targets, edges: selected.map((edge, i) => visualEdge(edge, source, targets[i], id)) };
  };
  const sequenceRelationships = new Set<string>();
  const makeSequences = (ownerId: string, scopeId: string): UiContractsSequence[] => (["primary", "secondary"] as const).flatMap(role => {
    const ids = order([...visible].filter(id => roleOf(id) === role && ownerOf(id) === ownerId));
    if (!ids.length) return [];
    const id = `${scopeId}:sequence:${role}`, references = ids.map(nodeId => occurrence(nodeId, scopeId, "sequence", [id], true));
    const bySemanticId = new Map(references.map(node => [node.semanticId, node]));
    const selected = relationships.filter(edge => edge.kind === "transition" && bySemanticId.has(edge.from) && bySemanticId.has(edge.to));
    selected.forEach(edge => sequenceRelationships.add(edge.id));
    return [{ id, nodes: references, edges: selected.map(edge => visualEdge(edge, bySemanticId.get(edge.from)!, bySemanticId.get(edge.to)!, id)) }];
  });
  const scopes: UiContractsScope[] = [], omittedPlaceIds: string[] = [];
  for (const ownerId of [...placeIds, ...componentIds]) {
    const kind = roleOf(ownerId) === "place" ? "place" : "component", id = `scope:${ownerId}`;
    const hasContent = relationships.some(edge => edge.from === ownerId && ["composition", "contract"].includes(edge.kind))
      || [...visible].some(nodeId => ownerOf(nodeId) === ownerId);
    if (kind === "place" && enabled(config.visibility.omit_empty_places) && !hasContent) {
      omittedPlaceIds.push(ownerId); visible.delete(ownerId); omissions.push({ id: ownerId, reason: "empty_place" }); continue;
    }
    const occurrenceStart = occurrences.length;
    const focal = occurrence(ownerId, id, "focal", [], true);
    const parents = kind === "component" ? parentsOf(ownerId).map(parent => occurrence(parent, id, "parent", [])) : [];
    const children = kind === "component" ? childrenOf(ownerId).map(child => occurrence(child, id, "child", [])) : [];
    const containment = [
      ...parents.flatMap(parent => hierarchyEdges.filter(edge => edge.from === parent.semanticId && edge.to === ownerId).map(edge => visualEdge(edge, parent, focal, id))),
      ...children.flatMap(child => hierarchyEdges.filter(edge => edge.from === ownerId && edge.to === child.semanticId).map(edge => visualEdge(edge, focal, child, id)))
    ];
    const sequences = makeSequences(ownerId, id);
    const compositions = [makeGroup(ownerId, "composition", id, kind === "place" ? focal : undefined),
      ...sequences.flatMap(sequence => sequence.nodes.filter(node => roleOf(node.semanticId) === "primary").map(node => makeGroup(node.semanticId, "composition", id)))].filter((group): group is UiContractsLocalGroup => group !== undefined);
    const contracts = [makeGroup(ownerId, "contract", id), ...sequences.flatMap(sequence => sequence.nodes.map(node => makeGroup(node.semanticId, "contract", id)))].filter((group): group is UiContractsLocalGroup => group !== undefined);
    const overviewCoversFocal = (overviewById.get(ownerId) ?? []).some(item => !item.referenceTo
      && focal.attributes.every(attribute => item.node.attributes.some(other => other.groupId === attribute.groupId
        && other.label === attribute.label && other.value === attribute.value))
      && children.every(child => item.children.some(other => other.node.semanticId === child.semanticId)));
    if (kind === "component" && !sequences.length && !contracts.length && !compositions.length
      && parents.length <= 1 && overviewCoversFocal
      && containment.every(edge => overviewContainmentIds.has(edge.relationshipId))) {
      occurrences.splice(occurrenceStart);
      continue;
    }
    scopes.push({ id, kind, title: format(config.labels[kind === "place" ? "place_scope" : "component_scope"], { name: focal.title }), focal,
      parents, children, containment, sequences, compositions, contracts,
      ...(kind === "place" && enabled(config.place_description.visible_when) ? { description: graphNodes.get(ownerId)?.props[config.place_description.property] } : {}) });
  }
  const represented = new Set(occurrences.map(node => node.semanticId));
  const orphanIds = order([...visible].filter(id => !represented.has(id) && roleOf(id) !== "support"));
  for (const ownerId of orphanIds) {
    if (represented.has(ownerId)) continue;
    const id = `standalone:${ownerId}`, focal = occurrence(ownerId, id, "focal", [], true);
    const compositions = [makeGroup(ownerId, "composition", id, focal)].filter((g): g is UiContractsLocalGroup => Boolean(g));
    const contracts = [makeGroup(ownerId, "contract", id)].filter((g): g is UiContractsLocalGroup => Boolean(g));
    scopes.push({ id, kind: "standalone", title: format(config.labels.standalone_scope, { name: focal.title }), focal,
      parents: [], children: [], containment: [], sequences: [], compositions, contracts });
    represented.add(ownerId);
  }
  // Cross-scope/unowned transitions get explicit reference context rather than disappearing.
  const remainingTransitions = relationships.filter(edge => edge.kind === "transition" && !sequenceRelationships.has(edge.id));
  if (remainingTransitions.length) {
    const id = "standalone:transitions", ids = order(new Set(remainingTransitions.flatMap(edge => [edge.from, edge.to])));
    const refs = ids.map(nodeId => occurrence(nodeId, id, "sequence", [], true)), lookup = new Map(refs.map(node => [node.semanticId, node]));
    const focal = refs[0];
    scopes.push({ id, kind: "standalone", title: format(config.labels.standalone_scope, { name: focal.title }), focal,
      parents: [], children: [], containment: [], compositions: [], contracts: [],
      sequences: [{ id: `${id}:sequence`, nodes: refs, edges: remainingTransitions.map(edge => visualEdge(edge, lookup.get(edge.from)!, lookup.get(edge.to)!, id)) }] });
  }
  const supportIds = order([...visible].filter(id => roleOf(id) === "support"));
  for (const ownerId of supportIds) {
    const id = `standalone:${ownerId}`, group = makeGroup(ownerId, "contract", id);
    if (group) scopes.push({ id, kind: "standalone", title: format(config.labels.standalone_scope, { name: group.source.title }), focal: group.source,
      parents: [], children: [], containment: [], sequences: [], compositions: [], contracts: [group] });
  }
  const register = { id: "target-register", title: config.labels.target_register,
    nodes: supportIds.map(id => occurrence(id, "target-register", "register", [])) };
  const notes = omittedPlaceIds.length ? [`Omitted empty ui_contracts containers in compact detail: ${omittedPlaceIds.map(id => nodes.get(id)!.name).join(", ")}.`] : [];
  const localContainmentIds = new Set(scopes.flatMap(scope => scope.containment.map(edge => edge.relationshipId)));
  return { overview, scopes, register, occurrences, relationships,
    structuralRelationshipIds: relationships.filter(edge => edge.kind === "ownership" || overviewContainmentIds.has(edge.id) && !localContainmentIds.has(edge.id)).map(edge => edge.id),
    visibleSemanticNodeIds: order(visible), omittedPlaceIds, omissions, notes, diagnostics };
}
