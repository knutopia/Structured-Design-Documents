import type { UiContractsHierarchy, UiContractsLocalGroup, UiContractsOccurrence, UiContractsPresentationModel, UiContractsScope, UiContractsSequence, UiContractsVisualEdge } from "../uiContractsPresentationModel.js";
import type { NodeDecoratorMode, RendererScene, SceneContainer, SceneEdge, SceneItem, SceneNode } from "./contracts.js";
import { buildCardinalPorts, buildSharedNode } from "./sceneBuilders.js";
import { createEdgeLabelMeasurementService } from "./microLayout.js";
import { measureScene } from "./pipeline.js";
import { DEFAULT_ROUTING_POLICY } from "./routingCore/contracts.js";
import { buildUiContractsFanout } from "./uiContractsFanout.js";
import { createSceneDiagnostic } from "./diagnostics.js";
import { buildUiContractsTransitionRegion } from "./uiContractsTransitions.js";

export const UI_CONTRACTS_SPACING = { padding: 16, localGap: 16, siblingGap: 24, sectionGap: 28, layerGap: 24, arrowApproach: 18 } as const;

export function uiContractsStack(id: string, children: SceneItem[], direction: "horizontal" | "vertical" = "vertical", gap = 0): SceneContainer {
  return { kind: "container", id, role: "ui_contracts_group", primitive: "stack", classes: [],
    layout: { strategy: "stack", direction, gap, crossAlignment: "start" },
    chrome: { padding: { top: 0, right: 0, bottom: 0, left: 0 }, headerBandHeight: 0 }, children, ports: buildCardinalPorts() };
}

export function uiContractsEnclosure(id: string, children: SceneItem[], title?: string): SceneContainer {
  const container = uiContractsStack(id, children, "vertical", UI_CONTRACTS_SPACING.localGap);
  container.primitive = "cluster";
  container.viewMetadata = { uiContracts: { kind: "enclosure", ...(title ? { title } : {}) } };
  const p = UI_CONTRACTS_SPACING.padding;
  container.chrome.padding = { top: p, right: p, bottom: p, left: p };
  return container;
}

/** Scene construction supplies dimensions, ports, and reservations, never coordinates or routes. */
export class UiContractsSceneBuilder {
  private emphasizedOccurrenceId?: string;
  readonly scene: RendererScene;
  readonly relationshipSegments = new Map<string, string[]>();
  readonly occurrenceSemanticIds = new Map<string, string>();
  readonly labelMeasure: ReturnType<typeof createEdgeLabelMeasurementService>;
  constructor(detailId: string, readonly decorators: NodeDecoratorMode, themeId = "default") {
    this.scene = { viewId: "ui_contracts", detailId, themeId, root: uiContractsStack("root", [], "vertical", UI_CONTRACTS_SPACING.sectionGap), edges: [], diagnostics: [] };
    this.scene.root.viewMetadata = { uiContracts: { kind: "sheet" } };
    const p = UI_CONTRACTS_SPACING.padding;
    this.scene.root.chrome.padding = { top: p, right: p, bottom: p, left: p };
    this.labelMeasure = createEdgeLabelMeasurementService(themeId, this.scene.diagnostics);
  }
  node(occurrence: UiContractsOccurrence): SceneNode {
    this.occurrenceSemanticIds.set(occurrence.id, occurrence.semanticId);
    return { ...buildSharedNode({ nodeId: occurrence.semanticId, nodeType: occurrence.nodeType, title: occurrence.title,
      decoratorMode: this.decorators, attributes: occurrence.attributes,
      emphasized: occurrence.id === this.emphasizedOccurrenceId }, { ports: buildCardinalPorts() }), id: occurrence.id };
  }
  private withEmphasizedOccurrence<T>(id: string | undefined, build: () => T): T {
    const previous = this.emphasizedOccurrenceId;
    this.emphasizedOccurrenceId = id;
    try { return build(); }
    finally { this.emphasizedOccurrenceId = previous; }
  }
  measure(items: SceneItem[]) {
    const result = measureScene({ ...this.scene, root: uiContractsStack("measurement", items), edges: [] });
    this.scene.diagnostics.push(...result.diagnostics);
    return result.root.children;
  }
  add(edge: SceneEdge, relationshipIds: string[]): void {
    this.scene.edges.push(edge);
    for (const id of relationshipIds) this.relationshipSegments.set(id, [...(this.relationshipSegments.get(id) ?? []), edge.id]);
  }
  edge(edge: UiContractsVisualEdge, fromPort = "east", toPort = "west"): SceneEdge {
    return { id: edge.id, role: edge.kind, classes: edge.style === "solid" ? [] : [`edge-${edge.style}`],
      from: { itemId: edge.from, portId: fromPort }, to: { itemId: edge.to, portId: toPort },
      routing: { style: "orthogonal", preferAxis: fromPort === "south" ? "vertical" : "horizontal" },
      ...(edge.label ? { label: { text: edge.label, textStyleRole: "edge_label" } } : {}), markers: { end: "arrow" } };
  }
  private branch(id: string, from: string, fromPort: string, to: string, toPort: string, vertical: boolean, arrow: boolean, relationships: string[], label?: string): void {
    this.add({ id, role: label ? "containment" : "relationship_branch", classes: [], from: { itemId: from, portId: fromPort }, to: { itemId: to, portId: toPort },
      routing: { style: "orthogonal", preferAxis: vertical ? "vertical" : "horizontal" }, markers: arrow ? { end: "arrow" } : {},
      ...(label ? { label: { text: label, textStyleRole: "edge_label" } } : {}) }, relationships);
  }
  neighborhood(scope: UiContractsScope): SceneContainer {
    const focal = this.node(scope.focal);
    const labels = scope.containment.flatMap(edge => edge.label ? [this.labelMeasure({ text: edge.label, textStyleRole: "edge_label" }, edge.id).height] : []);
    const stem = Math.max(DEFAULT_ROUTING_POLICY.minTerminalLeg, ...labels.map(height => height + DEFAULT_ROUTING_POLICY.minTerminalLeg));
    const group = uiContractsStack(`${scope.id}:neighborhood`, [], "vertical", stem);
    group.layout.crossAlignment = "center";
    const row = (refs: UiContractsOccurrence[], incoming: boolean): SceneItem | undefined => {
      if (!refs.length) return undefined;
      const selected = scope.containment.filter(edge => incoming ? edge.to === focal.id : edge.from === focal.id);
      if (refs.length === 1) {
        const node = this.node(refs[0]);
        selected.forEach(edge => this.add(this.edge(edge, "south", "north"), [edge.relationshipId]));
        return node;
      }
      const id = `${scope.id}:${incoming ? "parents" : "children"}`, nodes = refs.map(ref => this.node(ref));
      const sizes = this.measure(nodes), maxHeight = Math.max(...sizes.map(item => item.height));
      const anchors = nodes.map((_, index) => {
        const anchor = uiContractsStack(`${id}:junction:${index}`, []);
        anchor.ports = buildCardinalPorts().map(port => ({ ...port, offset: 0 }));
        return anchor;
      });
      const columns = nodes.map((node, index) => {
        const column = uiContractsStack(`${id}:column:${index}`, incoming ? [node, anchors[index]] : [anchors[index], node], "vertical", incoming ? DEFAULT_ROUTING_POLICY.minTerminalLeg : UI_CONTRACTS_SPACING.arrowApproach);
        column.layout.crossAlignment = "center";
        if (incoming) column.chrome.padding.top = maxHeight - sizes[index].height;
        const relations = selected.filter(edge => incoming ? edge.from === node.id : edge.to === node.id).map(edge => edge.relationshipId);
        this.branch(`${id}:leg:${index}`, incoming ? node.id : anchors[index].id, "south", incoming ? anchors[index].id : node.id, "north", true, !incoming, relations);
        return column;
      });
      const result = uiContractsStack(id, columns, "horizontal", UI_CONTRACTS_SPACING.siblingGap);
      const center = (nodes.length - 1) / 2, middle = Number.isInteger(center) ? anchors[center].id : id, middlePort = incoming ? "south" : "north";
      const bar = anchors.map((anchor, index) => ({ id: anchor.id, position: index, port: undefined as string | undefined }));
      if (!Number.isInteger(center)) bar.splice(Math.ceil(center), 0, { id, position: center, port: middlePort });
      for (let index = 1; index < bar.length; index++) {
        const left = bar[index - 1], right = bar[index];
        const traversing = selected.filter(edge => {
          const neighbor = refs.findIndex(ref => ref.id === (incoming ? edge.from : edge.to));
          return right.position <= center ? neighbor <= left.position : neighbor >= right.position;
        }).map(edge => edge.relationshipId);
        this.branch(`${id}:bar:${index}`, left.id, left.port ?? "east", right.id, right.port ?? "west", false, false, traversing);
      }
      this.branch(`${id}:stem`, incoming ? middle : focal.id, incoming ? middlePort : "south", incoming ? focal.id : middle,
        "north", true, incoming, selected.map(edge => edge.relationshipId), selected[0]?.label);
      return result;
    };
    const parents = row(scope.parents, true), children = row(scope.children, false);
    group.children = [...(parents ? [parents] : []), focal, ...(children ? [children] : [])];
    return group;
  }
  sequence(sequence: UiContractsSequence): SceneContainer {
    return buildUiContractsTransitionRegion(this, sequence) ?? this.layeredSequence(sequence);
  }
  layeredSequence(sequence: UiContractsSequence): SceneContainer {
    const nodes = sequence.nodes.map(node => this.node(node)), edges = sequence.edges.map(edge => this.edge(edge));
    const sizes = new Map(this.measure(nodes).map(node => [node.id, node]));
    const alignedOffset = Math.min(...[...sizes.values()].map(node => node.height)) / 2;
    if (new Set([...sizes.values()].map(node => node.height)).size > 1) {
      for (const node of nodes) for (const port of node.ports) if (port.side === "east" || port.side === "west") port.offset = alignedOffset;
    }
    const outsets = edges.map(edge => edge.label ? this.labelMeasure(edge.label, edge.id).height + DEFAULT_ROUTING_POLICY.minTerminalLeg
      - alignedOffset : 0);
    const group = uiContractsStack(sequence.id, nodes, "horizontal", UI_CONTRACTS_SPACING.layerGap);
    group.layout.strategy = "layered";
    group.chrome.padding.top = Math.max(0, ...outsets) + UI_CONTRACTS_SPACING.padding;
    edges.forEach((edge, index) => this.add(edge, [sequence.edges[index].relationshipId]));
    return group;
  }
  composition(group: UiContractsLocalGroup): SceneContainer {
    if (group.targets.length !== 1) return this.fanout(group);
    const source = this.node(group.source), target = this.node(group.targets[0]);
    const [sourceSize, targetSize] = this.measure([source, target]);
    const offset = Math.min(sourceSize.height, targetSize.height) / 2;
    source.ports.find(port => port.id === "east")!.offset = offset;
    target.ports.find(port => port.id === "west")!.offset = offset;
    const edge = this.edge(group.edges[0]);
    const labelHeight = edge.label ? this.labelMeasure(edge.label, edge.id).height : 0;
    const result = uiContractsStack(group.id, [source, target], "horizontal", UI_CONTRACTS_SPACING.layerGap);
    result.layout.strategy = "layered";
    result.chrome.padding.top = Math.max(0, labelHeight + DEFAULT_ROUTING_POLICY.minTerminalLeg - offset);
    this.add(edge, [group.edges[0].relationshipId]);
    return result;
  }
  fanout(group: UiContractsLocalGroup): SceneContainer {
    const source = this.node(group.source), targets = group.targets.map(target => this.node(target));
    const edges = group.edges.map(edge => this.edge(edge));
    const result = buildUiContractsFanout(group.id, source, targets, edges, this.scene.themeId);
    this.scene.diagnostics.push(...result.diagnostics);
    for (const edge of result.edges) {
      const original = group.edges.find(original => edge.id === original.id || edge.id === `${original.id}:lead`)!;
      this.add(edge, [original.relationshipId]);
    }
    return result.root.children[0] as SceneContainer;
  }
  scope(scope: UiContractsScope, complete = false): SceneContainer {
    return this.withEmphasizedOccurrence(scope.kind === "standalone" ? undefined : scope.focal.id,
      () => this.scopeContent(scope, complete));
  }
  private scopeContent(scope: UiContractsScope, complete: boolean): SceneContainer {
    const ownComposition = scope.compositions.find(group => group.source.id === scope.focal.id);
    const first = scope.kind === "component" ? this.neighborhood(scope) : ownComposition ? this.composition(ownComposition) : this.node(scope.focal);
    const sequenceIds = new Set(scope.sequences.flatMap(sequence => sequence.nodes.map(node => node.id)));
    const firstAlreadyPresent = sequenceIds.has(scope.focal.id) || scope.contracts.some(group => group.source.id === scope.focal.id);
    const content: SceneItem[] = firstAlreadyPresent ? [] : [first];
    if (complete && scope.description) content.push({ kind: "node", id: `${scope.id}:description`, role: "ui_contracts_description", primitive: "label", classes: [],
      content: [{ id: `${scope.id}:description:text`, kind: "text", text: scope.description, textStyleRole: "label" }],
      widthPolicy: { preferred: "standard", allowed: ["standard"] }, overflowPolicy: { kind: "grow_height" }, ports: [] });
    content.push(...scope.sequences.map(sequence => this.sequence(sequence)),
      ...scope.compositions.filter(group => group !== ownComposition).map(group => this.composition(group)));
    if (complete) content.push(...scope.contracts.map(group => this.fanout(group)));
    return uiContractsEnclosure(scope.id, content, scope.title);
  }
  private hierarchyChildren(parent: UiContractsHierarchy, depth: number): SceneContainer | undefined {
    if (!parent.children.length) return undefined;
    if (parent.children.length === 1 && parent.children[0].title) return this.hierarchy(parent.children[0], depth);
    const content: SceneItem[] = [];
    for (const child of parent.children) {
      if (child.title) content.push(this.hierarchy(child, depth + 1));
      else {
        content.push(this.node(child.node));
        const descendants = this.hierarchyChildren(child, depth + 1);
        if (descendants) content.push(descendants);
      }
    }
    const enclosure = uiContractsEnclosure(`${parent.id}:siblings`, content);
    enclosure.viewMetadata!.uiContracts!.tone = depth % 2 ? "inset" : "hierarchy";
    return enclosure;
  }
  hierarchy(item: UiContractsHierarchy, depth = 0): SceneContainer {
    const descendants = this.hierarchyChildren(item, depth + 1);
    const root = this.withEmphasizedOccurrence(depth === 0 ? item.node.id : undefined, () => this.node(item.node));
    const enclosure = uiContractsEnclosure(item.id, [root, ...(descendants ? [descendants] : [])], item.title);
    enclosure.viewMetadata!.uiContracts!.tone = depth % 2 ? "inset" : "hierarchy";
    return enclosure;
  }
  complete(model: UiContractsPresentationModel): RendererScene {
    this.scene.diagnostics.push(...model.diagnostics);
    if (model.diagnostics.some(d => d.severity === "error")) return this.scene;
    this.scene.root.children = [...model.overview.map(item => this.hierarchy(item)), ...model.scopes.map(scope => this.scope(scope, true))];
    if (model.register.nodes.length) this.scene.root.children.push(uiContractsEnclosure(model.register.id, model.register.nodes.map(node => this.node(node)), model.register.title));
    const represented = new Set(this.occurrenceSemanticIds.values());
    for (const id of model.visibleSemanticNodeIds) if (!represented.has(id)) this.scene.diagnostics.push(createSceneDiagnostic(
      "renderer.scene.ui_contracts_missing_identity", `Visible identity '${id}' has no scene occurrence.`, { targetId: id, severity: "error" }));
    const structural = new Set(model.structuralRelationshipIds);
    for (const edge of model.relationships) if (!this.relationshipSegments.has(edge.id) && !structural.has(edge.id)) this.scene.diagnostics.push(createSceneDiagnostic(
      "renderer.scene.ui_contracts_missing_relationship", `Visible relationship '${edge.id}' has no scene representation.`, { targetId: edge.id, severity: "error" }));
    return this.scene;
  }
}
