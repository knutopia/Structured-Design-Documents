import type { UiContractsHierarchy, UiContractsLocalGroup, UiContractsOccurrence, UiContractsPresentationModel, UiContractsScope, UiContractsSequence, UiContractsVisualEdge } from "../uiContractsPresentationModel.js";
import type { NodeDecoratorMode, PortSpec, RendererScene, SceneContainer, SceneEdge, SceneItem, SceneNode } from "./contracts.js";
import { buildCardinalPorts, buildPortSpec, buildSharedNode } from "./sceneBuilders.js";
import { createEdgeLabelMeasurementService, measureRendererScene, type NodeMinimumExtent } from "./microLayout.js";
import { DEFAULT_ROUTING_POLICY } from "./routingCore/contracts.js";
import { buildUiContractsFanout } from "./uiContractsFanout.js";
import { createSceneDiagnostic } from "./diagnostics.js";
import { buildUiContractsTransitionRegion } from "./uiContractsTransitions.js";
import { UiPortCapacityError } from "./uiContractsCapacity.js";
import { allocatePortOffsets } from "./routingCore/portCapacity.js";
import { readablePortPitch } from "./routingCore/bounds.js";
import { resolveRendererTheme } from "./theme.js";

export const UI_CONTRACTS_SPACING = { padding: 16, localGap: 16, siblingGap: 24, sectionGap: 28, layerGap: 24, arrowApproach: 18 } as const;

export function uiContractsStack(id: string, children: SceneItem[], direction: "horizontal" | "vertical" = "vertical", gap = 0): SceneContainer {
  return { kind: "container", id, role: "ui_contracts_group", primitive: "stack", classes: [],
    layout: { strategy: "stack", direction, gap, crossAlignment: "start", sizing: "intrinsic" },
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
  constructor(detailId: string, readonly decorators: NodeDecoratorMode, themeId = "default",
    readonly minimumNodeExtents: ReadonlyMap<string, NodeMinimumExtent> = new Map()) {
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
    const result = measureRendererScene({ ...this.scene, root: uiContractsStack("measurement", items), edges: [] }, { minimumNodeExtents: this.minimumNodeExtents });
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
  private branch(id: string, from: string, fromPort: string, to: string, toPort: string, vertical: boolean, arrow: boolean, relationships: string[], label?: string, junctionGroupId?: string): void {
    this.add({ id, role: label ? "containment" : "relationship_branch", classes: [], from: { itemId: from, portId: fromPort }, to: { itemId: to, portId: toPort },
      routing: { style: "orthogonal", preferAxis: vertical ? "vertical" : "horizontal" }, markers: arrow ? { end: "arrow" } : {},
      ...(junctionGroupId && this.scene.root.viewMetadata?.uiContracts?.routing ? { viewMetadata: { uiJunction: {
        groupId: junctionGroupId,
        ...(!this.occurrenceSemanticIds.has(from) ? { sourceSide: vertical ? "south" as const : "east" as const } : {}),
        ...(!this.occurrenceSemanticIds.has(to) ? { targetSide: vertical ? "north" as const : "west" as const } : {})
      } } } : {}),
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
        this.branch(`${id}:leg:${index}`, incoming ? node.id : anchors[index].id, "south", incoming ? anchors[index].id : node.id, "north", true, !incoming, relations, undefined, id);
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
        this.branch(`${id}:bar:${index}`, left.id, left.port ?? "east", right.id, right.port ?? "west", false, false, traversing, undefined, id);
      }
      this.branch(`${id}:stem`, incoming ? middle : focal.id, incoming ? middlePort : "south", incoming ? focal.id : middle,
        "north", true, incoming, selected.map(edge => edge.relationshipId), selected[0]?.label, id);
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
    const nodes = sequence.nodes.map(node => this.node(node));
    const sizes = new Map(this.measure(nodes).map(node => [node.id, node]));
    const alignedOffset = Math.min(...[...sizes.values()].map(node => node.height)) / 2;
    const theme = resolveRendererTheme(this.scene.themeId).theme;
    const separation = this.scene.root.viewMetadata?.uiContracts?.routing
      ? readablePortPitch(theme.paint.arrowSize, theme.paint.edgeStrokeWidth) : DEFAULT_ROUTING_POLICY.minSeparation;
    const heightsDiffer = new Set([...sizes.values()].map(node => node.height)).size > 1;

    // Bucket edges by source (outgoing/east) and target (incoming/west).
    const nodeIndex = new Map(sequence.nodes.map((node, index) => [node.id, index]));
    const outgoingByNode = new Map<string, UiContractsVisualEdge[]>();
    const incomingByNode = new Map<string, UiContractsVisualEdge[]>();
    for (const edge of sequence.edges) {
      const outgoing = outgoingByNode.get(edge.from) ?? [];
      outgoing.push(edge);
      outgoingByNode.set(edge.from, outgoing);
      const incoming = incomingByNode.get(edge.to) ?? [];
      incoming.push(edge);
      incomingByNode.set(edge.to, incoming);
    }

    // Order outgoing edges by target source order (proxy for target Y within a rank),
    // so the lowest target receives the lowest start point and crossings are avoided.
    const orderByTarget = (edges: UiContractsVisualEdge[]): UiContractsVisualEdge[] =>
      [...edges].sort((a, b) => (nodeIndex.get(a.to) ?? 0) - (nodeIndex.get(b.to) ?? 0));

    if (this.scene.root.viewMetadata?.uiContracts?.routing) {
      const demands = nodes.flatMap(node => {
        const count = Math.max(outgoingByNode.get(node.id)?.length ?? 0, incomingByNode.get(node.id)?.length ?? 0);
        const required = 2 * DEFAULT_ROUTING_POLICY.minTerminalLeg + Math.max(0, count - 1) * separation;
        return count > 1 && sizes.get(node.id)!.height < required ? [{ resource: { kind: "node_extent" as const, nodeId: node.id, axis: "y" as const },
          minimumExtent: required, reason: "port_capacity" as const,
          connectorIds: sequence.edges.filter(edge => edge.from === node.id || edge.to === node.id).map(edge => edge.id) }] : [];
      });
      if (demands.length) throw new UiPortCapacityError(demands, new Map(), new Map([...sizes].map(([id, node]) => [id, { width: node.width, height: node.height }])));
    }

    // Assign distinct ports per node side, centered on the aligned offset. The default
    // "east"/"west" ports are always retained (return-edge routing and single-connector
    // forward edges rely on them); multi-connector forward edges get additional ports.
    const portByEdge = new Map<string, { fromPort: string; toPort: string }>();
    for (const node of nodes) {
      const outgoing = orderByTarget(outgoingByNode.get(node.id) ?? []);
      const incoming = incomingByNode.get(node.id) ?? [];
      const offsetsFor = (edges: UiContractsVisualEdge[]) => this.scene.root.viewMetadata?.uiContracts?.routing
        ? allocatePortOffsets({ sideLength: sizes.get(node.id)!.height, minInset: DEFAULT_ROUTING_POLICY.minTerminalLeg,
          minSeparation: separation, requestIds: edges.map(edge => edge.id) }) : undefined;
      const outgoingOffsets = offsetsFor(outgoing), incomingOffsets = offsetsFor(incoming);
      const northSouth = node.ports.filter(port => port.side === "north" || port.side === "south");
      const defaultOffset = heightsDiffer ? { offset: alignedOffset } : {};
      const eastPorts: PortSpec[] = [
        buildPortSpec("east", "east", "east", defaultOffset),
        ...(outgoing.length > 1
          ? outgoing.map((_, index) => buildPortSpec(`${node.id}:east:${index}`, "east", "east", {
            offset: outgoingOffsets?.status === "allocated" ? outgoingOffsets.offsets.get(outgoing[index].id)! : alignedOffset + (index - (outgoing.length - 1) / 2) * separation
          }))
          : [])
      ];
      const westPorts: PortSpec[] = [
        buildPortSpec("west", "west", "west", defaultOffset),
        ...(incoming.length > 1
          ? incoming.map((_, index) => buildPortSpec(`${node.id}:west:${index}`, "west", "west", {
            offset: incomingOffsets?.status === "allocated" ? incomingOffsets.offsets.get(incoming[index].id)! : alignedOffset + (index - (incoming.length - 1) / 2) * separation
          }))
          : [])
      ];
      node.ports = [...northSouth, ...eastPorts, ...westPorts];
      outgoing.forEach((edge, index) => {
        const existing = portByEdge.get(edge.id) ?? { fromPort: "east", toPort: "west" };
        portByEdge.set(edge.id, { ...existing, fromPort: outgoing.length > 1 ? `${node.id}:east:${index}` : "east" });
      });
      incoming.forEach((edge, index) => {
        const existing = portByEdge.get(edge.id) ?? { fromPort: "east", toPort: "west" };
        portByEdge.set(edge.id, { ...existing, toPort: incoming.length > 1 ? `${node.id}:west:${index}` : "west" });
      });
    }

    const edges = sequence.edges.map(edge => {
      const ports = portByEdge.get(edge.id) ?? { fromPort: "east", toPort: "west" };
      return this.edge(edge, ports.fromPort, ports.toPort);
    });
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
    const result = buildUiContractsFanout(group.id, source, targets, edges, this.scene.themeId, {
      minimumNodeExtents: this.minimumNodeExtents, negotiatePortCapacity: !!this.scene.root.viewMetadata?.uiContracts?.routing
    });
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
    if (model.routing) this.scene.root.viewMetadata!.uiContracts!.routing = structuredClone(model.routing);
    this.scene.diagnostics.push(...model.diagnostics);
    if (model.diagnostics.some(d => d.severity === "error")) return this.scene;
    this.scene.root.children = [...model.overview.map(item => this.hierarchy(item)),
      ...(model.isolatedComponents.nodes.length ? [uiContractsEnclosure(model.isolatedComponents.id,
        model.isolatedComponents.nodes.map(node => this.node(node)), model.isolatedComponents.title)] : []), ...model.scopes.map(scope => this.scope(scope, true))];
    const components = this.scene.root.children.find(child => child.id === model.isolatedComponents.id);
    if (components?.kind === "container" && components.children.length >= 2) components.layout.pack = {
      eligibleItemIds: components.children.map(node => node.id),
      gap: UI_CONTRACTS_SPACING.localGap,
      widthSource: "widest_sibling",
      fitContent: true
    };
    if (model.register.nodes.length) {
      const register = uiContractsEnclosure(model.register.id, model.register.nodes.map(node => this.node(node)), model.register.title);
      if (model.register.layout.mode === "rows_widest_other_section") register.layout.pack = {
        eligibleItemIds: register.children.map(node => node.id),
        gap: UI_CONTRACTS_SPACING.localGap,
        widthSource: "widest_sibling",
        fitContent: true
      };
      this.scene.root.children.push(register);
    }
    this.scene.root.layout.pack = model.packSimpleScopeIds.length > 0
      ? { eligibleItemIds: [...model.packSimpleScopeIds], gap: UI_CONTRACTS_SPACING.sectionGap }
      : undefined;
    const represented = new Set(this.occurrenceSemanticIds.values());
    for (const id of model.visibleSemanticNodeIds) if (!represented.has(id)) this.scene.diagnostics.push(createSceneDiagnostic(
      "renderer.scene.ui_contracts_missing_identity", `Visible identity '${id}' has no scene occurrence.`, { targetId: id, severity: "error" }));
    const structural = new Set(model.structuralRelationshipIds);
    for (const edge of model.relationships) if (!this.relationshipSegments.has(edge.id) && !structural.has(edge.id)) this.scene.diagnostics.push(createSceneDiagnostic(
      "renderer.scene.ui_contracts_missing_relationship", `Visible relationship '${edge.id}' has no scene representation.`, { targetId: edge.id, severity: "error" }));
    if (model.routing) {
      const ancestors = new Map<string, string[]>();
      const visit = (item: SceneItem, parents: string[]) => {
        ancestors.set(item.id, parents);
        if (item.kind === "container") item.children.forEach(child => visit(child, [...parents, item.id]));
      };
      visit(this.scene.root, []);
      for (const edge of this.scene.edges) if (!edge.ownerContainerId) {
        const source = ancestors.get(edge.from.itemId) ?? [], target = ancestors.get(edge.to.itemId) ?? [];
        edge.ownerContainerId = this.scene.root.id;
        for (let index = 0; index < Math.min(source.length, target.length) && source[index] === target[index]; index++) edge.ownerContainerId = source[index];
      }
    }
    if (model.routing) this.scene.root.viewMetadata!.uiContracts!.inventory = {
      occurrences: [...this.occurrenceSemanticIds].map(([id, semanticId]) => ({ id, semanticId })),
      relationships: model.relationships.map(edge => ({ id: edge.id, from: edge.from, to: edge.to,
        sourceOrder: edge.sourceOrder, structural: structural.has(edge.id), segmentIds: [...(this.relationshipSegments.get(edge.id) ?? [])],
        paths: this.relationshipPaths(edge.id, edge.from, edge.to) })),
      segments: this.scene.edges.map(edge => ({ id: edge.id,
        relationshipIds: [...this.relationshipSegments].filter(([, ids]) => ids.includes(edge.id)).map(([id]) => id),
        from: { ...edge.from }, to: { ...edge.to }, ...(edge.label ? { label: edge.label.text } : {}),
        ...(edge.markers ? { markers: { ...edge.markers } } : {}), classes: [...edge.classes],
        ...(edge.viewMetadata?.uiTransition ? { transition: { ...edge.viewMetadata.uiTransition } } : {}),
        ...(edge.viewMetadata?.uiJunction ? { junction: { ...edge.viewMetadata.uiJunction } } : {}),
        ...(edge.ownerContainerId ? { ownerContainerId: edge.ownerContainerId } : {}) }))
    };
    return this.scene;
  }
  /** Builders register physical membership explicitly; resolve its declared topology
   * without interpreting generated edge IDs or inferring it from routed points. */
  private relationshipPaths(relationshipId: string, from: string, to: string) {
    const selected = new Set(this.relationshipSegments.get(relationshipId) ?? []);
    const segments = this.scene.edges.filter(edge => selected.has(edge.id));
    const sources = [...this.occurrenceSemanticIds].filter(([, id]) => id === from).map(([id]) => id);
    const paths: Array<{ from: string; to: string; segments: Array<{ id: string; reverse: boolean }> }> = [];
    for (const source of sources) {
      const queue = [{ itemId: source, path: [] as Array<{ id: string; reverse: boolean }> }];
      const visited = new Set<string>();
      while (queue.length) {
        const current = queue.shift()!;
        if (current.path.length && this.occurrenceSemanticIds.get(current.itemId) === to) {
          paths.push({ from: source, to: current.itemId, segments: current.path }); break;
        }
        if (visited.has(current.itemId)) continue;
        visited.add(current.itemId);
        // A semantic card cannot serve as an undeclared interior junction.
        if (current.path.length && this.occurrenceSemanticIds.has(current.itemId)) continue;
        for (const segment of segments) for (const reverse of [false, true]) {
          const start = reverse ? segment.to : segment.from, end = reverse ? segment.from : segment.to;
          if (start.itemId === current.itemId && !current.path.some(ref => ref.id === segment.id))
            queue.push({ itemId: end.itemId, path: [...current.path, { id: segment.id, reverse }] });
        }
      }
    }
    return paths;
  }
}
