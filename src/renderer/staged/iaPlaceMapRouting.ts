import type {
  MeasuredEdge,
  MeasuredNode,
  MeasuredPort,
  MeasuredScene,
  Point,
  PortSide,
  PositionedContainer,
  PositionedEdge,
  PositionedItem,
  PositionedNode,
  PositionedScene,
  RendererScene
} from "./contracts.js";
import { createRoutingDiagnostic, hasRendererErrors, sortRendererDiagnostics } from "./diagnostics.js";
import { positionMeasuredEdgesAgainstRoot } from "./macroLayout.js";
import { reflowMeasuredSceneContainers } from "./microLayout.js";
import { getNodePrimitiveTheme } from "./primitives.js";
import { measureScene, positionSceneBeforeRouting, runStagedRendererPipeline, type StagedRendererPipelineResult } from "./pipeline.js";
import {
  DEFAULT_ROUTING_POLICY,
  allocatePortOffsets,
  buildRoutingSegments,
  buildPortCorridorCandidates,
  measureRoutingCorridorDeficits,
  runRoutingLifecycle,
  validateFinalRouteSet,
  type FinalRoutingContext,
  type FinalRoutingConnector,
  type RoutingBox,
  type RoutingViolation
} from "./routingCore/index.js";
import {
  assessConnectorLabels,
  auditConnectorLabels,
  connectorLabelCapacityClaims,
  connectorLabelCapacityAnchors,
  measureConnectorLabelCapacity,
  wrappedLabelPreservesText,
  type ConnectorLabelCorridor,
  type ConnectorLabelLayoutInput,
  type ConnectorLabelProblem
} from "./connectorLabelLayout.js";
import { FIXED_LABEL_DISTANCE } from "./connectorLabelPlacement.js";
import { markerRoutingClearance } from "./markerGeometry.js";
import { auditPositionedSceneMarkers, buildEndpointMarkerRoutingBlockers } from "./markerAudit.js";
import { getRendererTheme } from "./theme.js";
import type { RendererDiagnostic } from "./diagnostics.js";

type IaPlaceMapInventory = NonNullable<NonNullable<RendererScene["root"]["viewMetadata"]>["iaPlaceMap"]>;
type GapKey = string;
type PortRequest = { id: string; edgeId: string; endpoint: "source" | "target"; nodeId: string; side: PortSide; offset: number };
type PortGroup = { node: MeasuredNode; side: PortSide; requestIds: string[]; offsets: ReadonlyMap<string, number> };
type OwnerLineage = { container: PositionedContainer; child: PositionedItem };
type GapCorridor = ConnectorLabelCorridor & { key: GapKey; containerId: string; beforeId: string; afterId: string };

const PORT_REQUEST_PREFIX = "ia_occurrence_port:";
const GEOMETRY_EPSILON = DEFAULT_ROUTING_POLICY.epsilon;

function issue(code: string, message: string, targetId: string, details?: string): RendererDiagnostic {
  return createRoutingDiagnostic(code, message, targetId, "error", details);
}

function inventoryFromScene(scene: RendererScene | PositionedScene): IaPlaceMapInventory | undefined {
  return scene.root.viewMetadata?.iaPlaceMap;
}

function sortBySourceOrder(inventory: IaPlaceMapInventory): IaPlaceMapInventory["expectedNavigationOccurrences"] {
  return [...inventory.expectedNavigationOccurrences].sort((a, b) => a.sourceOrder - b.sourceOrder
    || a.sourceEdgeId.localeCompare(b.sourceEdgeId));
}

function expectedConnectorIds(inventory: IaPlaceMapInventory): Set<string> {
  const ids = new Set(inventory.expectedStructuralEdges.map(edge => edge.id));
  for (const occurrence of inventory.expectedNavigationOccurrences) ids.add(occurrence.connectorId);
  return ids;
}

function normalizeLabel(lines: readonly string[]): string {
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

function validateIndependentInventory(scene: RendererScene, measured: MeasuredScene, inventory: IaPlaceMapInventory): RendererDiagnostic[] {
  const diagnostics: RendererDiagnostic[] = [];
  const sceneEdges = new Map(scene.edges.map(edge => [edge.id, edge]));
  const measuredEdges = new Map(measured.edges.map(edge => [edge.id, edge]));
  const expected = expectedConnectorIds(inventory);
  const actualIds = scene.edges.map(edge => edge.id);
  const duplicates = actualIds.filter((id, index) => actualIds.indexOf(id) !== index);
  for (const id of duplicates) diagnostics.push(issue("renderer.routing.ia_duplicate_connector_id",
    `IA connector inventory contains duplicate scene edge id "${id}".`, id));
  for (const id of expected) if (!sceneEdges.has(id)) diagnostics.push(issue("renderer.routing.ia_missing_expected_connector",
    `IA expected connector "${id}" is missing from the renderer scene.`, id));
  for (const id of actualIds) if (!expected.has(id)) diagnostics.push(issue("renderer.routing.ia_unexpected_connector",
    `IA renderer scene contains unowned connector "${id}".`, id));

  const occurrencesByConnector = new Map<string, IaPlaceMapInventory["expectedNavigationOccurrences"]>();
  const expectedSourceIdsByConnector = new Map<string, Set<string>>();
  const addExpectedSource = (connectorId: string, sourceId: string): void => {
    const ids = expectedSourceIdsByConnector.get(connectorId) ?? new Set<string>();
    ids.add(sourceId);
    expectedSourceIdsByConnector.set(connectorId, ids);
  };
  for (const occurrence of inventory.expectedNavigationOccurrences) {
    const records = occurrencesByConnector.get(occurrence.connectorId) ?? [];
    records.push(occurrence);
    occurrencesByConnector.set(occurrence.connectorId, records);
    const edge = sceneEdges.get(occurrence.connectorId);
    const sources = edge?.viewMetadata?.sourceEdgeIds ?? [];
    if (!edge || !sources.includes(occurrence.sourceEdgeId)) diagnostics.push(issue("renderer.routing.ia_occurrence_association",
      `Navigation occurrence "${occurrence.sourceEdgeId}" is not associated with its declared connector "${occurrence.connectorId}".`, occurrence.connectorId));
    addExpectedSource(occurrence.connectorId, occurrence.sourceEdgeId);
  }
  for (const [connectorId, occurrences] of occurrencesByConnector) {
    if (occurrences.length > 1) diagnostics.push(issue("renderer.routing.ia_occurrence_identity_collision",
      `Distinct navigation occurrences map to the same connector "${connectorId}".`, connectorId,
      occurrences.map(occurrence => occurrence.sourceEdgeId).join(", ")));
  }
  for (const structural of inventory.expectedStructuralEdges) {
    const edge = sceneEdges.get(structural.id);
    if (!edge || edge.from.itemId !== structural.from || edge.to.itemId !== structural.to || edge.role !== structural.role) {
      diagnostics.push(issue("renderer.routing.ia_structural_inventory_mismatch",
        `Structural connector "${structural.id}" does not match the independent containment inventory.`, structural.id));
      continue;
    }
    const actualSourceIds = edge.viewMetadata?.sourceEdgeIds ?? [];
    if (structural.sourceEdgeIds.some(id => !actualSourceIds.includes(id))) diagnostics.push(issue("renderer.routing.ia_structural_source_association",
      `Structural connector "${structural.id}" is missing one or more projected source associations.`, structural.id));
    for (const sourceId of structural.sourceEdgeIds) addExpectedSource(structural.id, sourceId);
  }
  for (const [connectorId, expectedSources] of expectedSourceIdsByConnector) {
    const actualSources = new Set(sceneEdges.get(connectorId)?.viewMetadata?.sourceEdgeIds ?? []);
    if (actualSources.size !== expectedSources.size || [...actualSources].some(sourceId => !expectedSources.has(sourceId))) {
      diagnostics.push(issue("renderer.routing.ia_source_association_inventory_mismatch",
        `Connector "${connectorId}" source associations do not exactly match the independent occurrence and structural inventory.`, connectorId,
        `expected=${[...expectedSources].sort().join(",")} actual=${[...actualSources].sort().join(",")}`));
    }
  }
  for (const [connectorId, occurrences] of occurrencesByConnector) {
    const edge = measuredEdges.get(connectorId);
    const labelled = occurrences.filter(occurrence => occurrence.label !== undefined);
    if (labelled.length && !edge?.label) diagnostics.push(issue("renderer.routing.ia_required_label_unmeasured",
      `IA navigation connector "${connectorId}" has required presentation text but no measured label.`, connectorId));
    if (labelled.length > 1) diagnostics.push(issue("renderer.routing.ia_multiple_labels_one_connector",
      `IA connector "${connectorId}" is assigned multiple distinct navigation label records.`, connectorId));
    if (labelled.length === 1 && edge?.label && !wrappedLabelPreservesText(edge.label.lines, labelled[0]!.label!)) {
      diagnostics.push(issue("renderer.routing.ia_measured_label_mismatch",
        `Measured IA label for "${connectorId}" differs from the independent authored label inventory.`, connectorId,
        `expected=${JSON.stringify(labelled[0]!.label)} actual=${JSON.stringify(normalizeLabel(edge.label.lines))}`));
    }
    if (!labelled.length && edge?.label) diagnostics.push(issue("renderer.routing.ia_unexpected_label",
      `IA connector "${connectorId}" has a measured label absent from the independent label inventory.`, connectorId));
  }
  return diagnostics;
}

function indexMeasuredNodes(root: MeasuredScene["root"], result = new Map<string, MeasuredNode>()): Map<string, MeasuredNode> {
  for (const child of root.children) {
    if (child.kind === "container") indexMeasuredNodes(child, result);
    else result.set(child.id, child);
  }
  return result;
}

function indexPositionedItems(root: PositionedContainer): Map<string, PositionedItem> {
  const result = new Map<string, PositionedItem>();
  const visit = (item: PositionedItem): void => {
    result.set(item.id, item);
    if (item.kind === "container") item.children.forEach(visit);
  };
  visit(root);
  return result;
}

function endpointOffset(port: MeasuredPort): number {
  return port.side === "north" || port.side === "south" ? port.x : port.y;
}

function sideLength(node: MeasuredNode, side: PortSide): number {
  return side === "north" || side === "south" ? node.width : node.height;
}

function sideVector(side: PortSide): Point {
  switch (side) {
    case "north": return { x: 0, y: -1 };
    case "south": return { x: 0, y: 1 };
    case "east": return { x: 1, y: 0 };
    case "west": return { x: -1, y: 0 };
  }
}

function orderedSidePairs(delta: Point): Array<[PortSide, PortSide]> {
  const sides: PortSide[] = ["east", "west", "north", "south"];
  const pairs: Array<[PortSide, PortSide]> = [];
  for (const source of sides) for (const target of sides) pairs.push([source, target]);
  return pairs.sort((left, right) => {
    const score = ([source, target]: [PortSide, PortSide]) => {
      const sourceVector = sideVector(source), targetVector = sideVector(target);
      return sourceVector.x * delta.x + sourceVector.y * delta.y
        + targetVector.x * -delta.x + targetVector.y * -delta.y;
    };
    return score(right) - score(left) || sides.indexOf(left[0]) - sides.indexOf(right[0])
      || sides.indexOf(left[1]) - sides.indexOf(right[1]);
  });
}

function reserveForSide(node: MeasuredNode, side: PortSide, usedPortIds: ReadonlySet<string>): number[] {
  return node.ports.filter(port => port.side === side && usedPortIds.has(port.id)).map(endpointOffset);
}

function sidePortRequest(nodeId: string, occurrenceId: string, endpoint: "source" | "target"): string {
  return `${PORT_REQUEST_PREFIX}${encodeURIComponent(occurrenceId)}:${endpoint}:${encodeURIComponent(nodeId)}`;
}

function allocateOccurrencePorts(
  measured: MeasuredScene,
  seedScene: PositionedScene,
  inventory: IaPlaceMapInventory
): { measured: MeasuredScene; diagnostics: RendererDiagnostic[] } {
  const nodes = indexMeasuredNodes(measured.root);
  const positioned = indexPositionedItems(seedScene.root);
  const edgeById = new Map(measured.edges.map(edge => [edge.id, edge]));
  const structuralIds = new Set(inventory.expectedStructuralEdges.map(edge => edge.id));
  const usedStructuralPorts = new Map<string, Set<string>>();
  for (const edge of measured.edges) {
    if (!structuralIds.has(edge.id)) continue;
    for (const endpoint of [edge.from, edge.to]) {
      if (!endpoint.portId) continue;
      const ids = usedStructuralPorts.get(endpoint.itemId) ?? new Set<string>();
      ids.add(endpoint.portId);
      usedStructuralPorts.set(endpoint.itemId, ids);
    }
  }
  const occurrences = sortBySourceOrder(inventory).filter(occurrence => !structuralIds.has(occurrence.connectorId));
  const groups = new Map<string, PortGroup>();
  const assignments = new Map<string, PortRequest>();
  const labelDimensionsByRequestId = new Map<string, { width: number; height: number }>();
  const diagnostics: RendererDiagnostic[] = [];
  const theme = getRendererTheme(measured.themeId, "routing");
  const geometry = collectRoutingGeometry(seedScene);
  const allocationFor = (node: MeasuredNode, side: PortSide, requestIds: string[]): PortOffsetAllocationResult => {
    const primitive = getNodePrimitiveTheme(theme, node.primitive);
    const labelExtent = side === "east" || side === "west" ? "height" : "width";
    const separation = Math.max(DEFAULT_ROUTING_POLICY.minSeparation,
      ...requestIds.map(id => (labelDimensionsByRequestId.get(id)?.[labelExtent] ?? 0) + FIXED_LABEL_DISTANCE));
    return allocatePortOffsets({ sideLength: sideLength(node, side), minInset: primitive.portInset,
      minSeparation: separation, reservedOffsets: reserveForSide(node, side, usedStructuralPorts.get(node.id) ?? new Set()), requestIds });
  };

  for (const occurrence of occurrences) {
    const edge = edgeById.get(occurrence.connectorId);
    const sourceNode = nodes.get(occurrence.from);
    const targetNode = nodes.get(occurrence.to);
    const sourcePosition = positioned.get(occurrence.from);
    const targetPosition = positioned.get(occurrence.to);
    if (!edge || !sourceNode || !targetNode || sourcePosition?.kind !== "node" || targetPosition?.kind !== "node") {
      diagnostics.push(issue("renderer.routing.ia_port_endpoint_unavailable",
        `Navigation occurrence "${occurrence.sourceEdgeId}" cannot resolve both measured Place endpoints.`, occurrence.connectorId));
      continue;
    }
    const sourceRequestId = sidePortRequest(occurrence.from, occurrence.id, "source");
    const targetRequestId = sidePortRequest(occurrence.to, occurrence.id, "target");
    const labelDimensions = edge.label ? { width: edge.label.width, height: edge.label.height } : { width: 0, height: 0 };
    labelDimensionsByRequestId.set(sourceRequestId, labelDimensions);
    labelDimensionsByRequestId.set(targetRequestId, labelDimensions);
    const sourceCenter = { x: sourcePosition.x + sourcePosition.width / 2, y: sourcePosition.y + sourcePosition.height / 2 };
    const targetCenter = { x: targetPosition.x + targetPosition.width / 2, y: targetPosition.y + targetPosition.height / 2 };
    const delta = { x: targetCenter.x - sourceCenter.x, y: targetCenter.y - sourceCenter.y };
    let chosen: { sourceSide: PortSide; targetSide: PortSide; trial: Map<string, PortGroup> } | undefined;
    let firstCapacityPair: typeof chosen;

    for (const [sourceSide, targetSide] of orderedSidePairs(delta)) {
      const trial = new Map([...groups].map(([key, group]) => [key, { ...group, requestIds: [...group.requestIds] }]));
      const add = (node: MeasuredNode, side: PortSide, requestId: string): boolean => {
        const key = `${node.id}\0${side}`;
        const old = trial.get(key) ?? { node, side, requestIds: [], offsets: new Map<string, number>() };
        const requestIds = [...old.requestIds, requestId];
        const allocation = allocationFor(node, side, requestIds);
        if (allocation.status !== "allocated") return false;
        trial.set(key, { ...old, requestIds, offsets: allocation.offsets });
        return true;
      };
      if (!add(sourceNode, sourceSide, sourceRequestId) || !add(targetNode, targetSide, targetRequestId)) continue;
      const pair = { sourceSide, targetSide, trial };
      firstCapacityPair ??= pair;
      const sourceOffset = trial.get(`${sourceNode.id}\0${sourceSide}`)!.offsets.get(sourceRequestId)!;
      const targetOffset = trial.get(`${targetNode.id}\0${targetSide}`)!.offsets.get(targetRequestId)!;
      const point = (node: PositionedNode, side: PortSide, offset: number): Point => ({
        x: node.x + (side === "east" ? node.width : side === "west" ? 0 : offset),
        y: node.y + (side === "south" ? node.height : side === "north" ? 0 : offset)
      });
      const sourcePoint = point(sourcePosition, sourceSide, sourceOffset), targetPoint = point(targetPosition, targetSide, targetOffset);
      const connector: FinalRoutingConnector = { id: occurrence.connectorId, priority: occurrence.sourceOrder,
        route: { style: "orthogonal", points: [sourcePoint, targetPoint] },
        source: { nodeId: sourceNode.id, side: sourceSide, point: sourcePoint,
          minLeg: markerRoutingClearance(edge.markers?.start, theme.paint.arrowSize, theme.paint.edgeStrokeWidth) },
        target: { nodeId: targetNode.id, side: targetSide, point: targetPoint,
          minLeg: markerRoutingClearance(edge.markers?.end, theme.paint.arrowSize, theme.paint.edgeStrokeWidth) } };
      const context: FinalRoutingContext = { connectors: [connector], ...geometry, corridorSearch: "obstacle_aware",
        bounds: { minX: seedScene.root.x, minY: seedScene.root.y,
          maxX: seedScene.root.x + seedScene.root.width, maxY: seedScene.root.y + seedScene.root.height } };
      if ([...buildPortCorridorCandidates(connector, context)].some(points =>
        !validateFinalRouteSet({ ...context, connectors: [{ ...connector, route: { style: "orthogonal", points } }] }).length)) {
        chosen = pair;
        break;
      }
    }
    // A capacity-valid pair may need owned spacing before a viable corridor
    // exists. Keep that preferred pair for the bounded geometry reflow.
    chosen ??= firstCapacityPair;
    if (!chosen) {
      diagnostics.push(issue("renderer.routing.ia_port_capacity_exhausted",
        `No legal bounded port pair can be allocated for navigation occurrence "${occurrence.sourceEdgeId}".`, occurrence.connectorId,
        `source=${occurrence.from} target=${occurrence.to} tried=16 side pairs`));
      continue;
    }
    groups.clear();
    chosen.trial.forEach((group, key) => groups.set(key, group));
    assignments.set(sourceRequestId, { id: sourceRequestId, edgeId: occurrence.connectorId, endpoint: "source",
      nodeId: occurrence.from, side: chosen.sourceSide, offset: 0 });
    assignments.set(targetRequestId, { id: targetRequestId, edgeId: occurrence.connectorId, endpoint: "target",
      nodeId: occurrence.to, side: chosen.targetSide, offset: 0 });
  }
  if (diagnostics.length) return { measured, diagnostics };

  for (const group of groups.values()) {
    for (const requestId of group.requestIds) {
      const request = assignments.get(requestId);
      const offset = group.offsets.get(requestId);
      if (request && offset !== undefined) assignments.set(requestId, { ...request, offset });
    }
  }

  const portsByNode = new Map<string, MeasuredPort[]>();
  for (const request of assignments.values()) {
    const node = nodes.get(request.nodeId)!;
    const port: MeasuredPort = { id: request.id, role: request.id, side: request.side, offset: request.offset,
      x: request.side === "east" ? node.width : request.side === "west" ? 0 : request.offset,
      y: request.side === "south" ? node.height : request.side === "north" ? 0 : request.offset };
    const ports = portsByNode.get(node.id) ?? [];
    ports.push(port);
    portsByNode.set(node.id, ports);
  }
  const rewriteItems = (container: MeasuredScene["root"]): MeasuredScene["root"] => ({
    ...container,
    children: container.children.map(child => child.kind === "container"
      ? rewriteItems(child)
      : { ...child, ports: [...child.ports, ...(portsByNode.get(child.id) ?? [])] })
  });
  const rewrittenEdges = measured.edges.map(edge => {
    const source = [...assignments.values()].find(request => request.edgeId === edge.id && request.endpoint === "source");
    const target = [...assignments.values()].find(request => request.edgeId === edge.id && request.endpoint === "target");
    return { ...edge,
      from: source ? { ...edge.from, portId: source.id } : { ...edge.from },
      to: target ? { ...edge.to, portId: target.id } : { ...edge.to }
    };
  });
  return { measured: { ...measured, root: rewriteItems(measured.root), edges: rewrittenEdges }, diagnostics };
}

type PortOffsetAllocationResult = ReturnType<typeof allocatePortOffsets>;

function collectRoutingGeometry(scene: PositionedScene): { boxes: RoutingBox[]; blockers: RoutingBox[] } {
  const boxes: RoutingBox[] = [];
  const blockers: RoutingBox[] = [];
  const clearance = getRendererTheme(scene.themeId, "routing").paint.edgeStrokeWidth / 2 + DEFAULT_ROUTING_POLICY.epsilon;
  const visit = (item: PositionedItem): void => {
    if (item.kind === "node") {
      boxes.push({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height, clearance });
      return;
    }
    if (item.chrome.headerBandHeight && item.chrome.headerBandHeight > 0) blockers.push({
      id: `${item.id}:header-band`, x: item.x, y: item.y, width: item.width, height: item.chrome.headerBandHeight
    });
    for (const block of item.headerContent) blockers.push({ id: block.id,
      x: item.x + block.x, y: item.y + block.y, width: block.width, height: block.height });
    item.children.forEach(visit);
  };
  visit(scene.root);
  return { boxes, blockers };
}

function portByEndpoint(scene: PositionedScene, itemId: string, portId: string | undefined): { node: PositionedItem; port: MeasuredPort } | undefined {
  if (!portId) return undefined;
  const item = indexPositionedItems(scene.root).get(itemId);
  const port = item?.ports.find(candidate => candidate.id === portId);
  return item && port ? { node: item, port } : undefined;
}

function buildStructuralSharing(scene: PositionedScene, inventory: IaPlaceMapInventory): Map<string, string> {
  const structuralById = new Map(inventory.expectedStructuralEdges.map(edge => [edge.id, edge]));
  const candidates = scene.edges.filter(edge => structuralById.has(edge.id) && edge.classes.includes("shared_trunk"));
  const groups = new Map<string, PositionedEdge[]>();
  for (const edge of candidates) {
    const first = buildRoutingSegments(edge.id, edge.route)[0];
    if (!first) continue;
    const key = `${edge.from.itemId}\0${first.axis}\0${first.coordinate.toFixed(3)}`;
    const group = groups.get(key) ?? [];
    group.push(edge);
    groups.set(key, group);
  }
  const shared = new Map<string, string>();
  for (const [key, edges] of groups) {
    if (edges.length < 2) continue;
    const groupId = `ia-structural-trunk:${key}`;
    for (const edge of edges) shared.set(`${edge.id}\0${0}`, groupId);
  }
  return shared;
}

function buildFinalRoutingContext(scene: PositionedScene, inventory: IaPlaceMapInventory): { context?: FinalRoutingContext; diagnostics: RendererDiagnostic[] } {
  const diagnostics: RendererDiagnostic[] = [];
  const { boxes, blockers } = collectRoutingGeometry(scene);
  const itemIndex = indexPositionedItems(scene.root);
  const theme = getRendererTheme(scene.themeId, "routing");
  const navigationOrder = new Map(sortBySourceOrder(inventory).map(item => [item.connectorId, item.sourceOrder]));
  const structuralOrder = new Map(inventory.expectedStructuralEdges.map((item, index) => [item.id, index]));
  const sharedBySegmentKey = buildStructuralSharing(scene, inventory);
  const connectors: FinalRoutingConnector[] = [];
  for (const [index, edge] of scene.edges.entries()) {
    const source = portByEndpoint(scene, edge.from.itemId, edge.from.portId);
    const target = portByEndpoint(scene, edge.to.itemId, edge.to.portId);
    if (!source || !target || ![edge.from.x, edge.from.y, edge.to.x, edge.to.y].every(Number.isFinite)) {
      diagnostics.push(issue("renderer.routing.ia_endpoint_port_missing",
        `Connector "${edge.id}" does not resolve both endpoints to positioned node ports.`, edge.id));
      continue;
    }
    const sourcePoint = { x: source.node.x + source.port.x, y: source.node.y + source.port.y };
    const targetPoint = { x: target.node.x + target.port.x, y: target.node.y + target.port.y };
    if (Math.hypot(sourcePoint.x - edge.from.x, sourcePoint.y - edge.from.y) > GEOMETRY_EPSILON
      || Math.hypot(targetPoint.x - edge.to.x, targetPoint.y - edge.to.y) > GEOMETRY_EPSILON) {
      diagnostics.push(issue("renderer.routing.ia_endpoint_port_mismatch",
        `Connector "${edge.id}" endpoint coordinates do not equal the referenced positioned port anchors.`, edge.id));
      continue;
    }
    const sourceNode = itemIndex.get(edge.from.itemId), targetNode = itemIndex.get(edge.to.itemId);
    if (!sourceNode || !targetNode || sourceNode.kind !== "node" || targetNode.kind !== "node") {
      diagnostics.push(issue("renderer.routing.ia_endpoint_not_place",
        `IA connector "${edge.id}" must attach to two Place nodes.`, edge.id));
      continue;
    }
    const structural = structuralOrder.has(edge.id);
    const sharedTrackGroupBySegmentIndex = new Map<number, string>();
    const shared = sharedBySegmentKey.get(`${edge.id}\0${0}`);
    if (shared && structural) sharedTrackGroupBySegmentIndex.set(0, shared);
    connectors.push({ id: edge.id, route: edge.route,
      source: { point: { x: edge.from.x, y: edge.from.y }, side: source.port.side, nodeId: source.node.id,
        minLeg: markerRoutingClearance(edge.markers?.start, theme.paint.arrowSize, theme.paint.edgeStrokeWidth) },
      target: { point: { x: edge.to.x, y: edge.to.y }, side: target.port.side, nodeId: target.node.id,
        minLeg: markerRoutingClearance(edge.markers?.end, theme.paint.arrowSize, theme.paint.edgeStrokeWidth) },
      priority: navigationOrder.get(edge.id) ?? (1_000_000 + (structuralOrder.get(edge.id) ?? index)),
      ...(sharedTrackGroupBySegmentIndex.size ? { sharedTrackGroupBySegmentIndex } : {})
    });
  }
  if (diagnostics.length) return { diagnostics };
  return { context: {
    connectors, boxes, corridorSearch: "obstacle_aware", blockers: [...blockers, ...buildEndpointMarkerRoutingBlockers(connectors,
      new Map(scene.edges.map(edge => [edge.id, edge.markers])), theme.paint.arrowSize, theme.paint.edgeStrokeWidth)],
    bounds: { minX: scene.root.x + theme.paint.edgeStrokeWidth / 2, minY: scene.root.y + theme.paint.edgeStrokeWidth / 2,
      maxX: scene.root.x + scene.root.width - theme.paint.edgeStrokeWidth / 2,
      maxY: scene.root.y + scene.root.height - theme.paint.edgeStrokeWidth / 2 }
  }, diagnostics };
}

function applyFinalRoutes(scene: PositionedScene, context: FinalRoutingContext): PositionedScene {
  const routeById = new Map(context.connectors.map(connector => [connector.id, connector.route]));
  return { ...scene, edges: scene.edges.map(edge => ({ ...edge, route: routeById.get(edge.id) ?? edge.route })) };
}

function expectedLabelMap(measured: MeasuredScene, inventory: IaPlaceMapInventory): Map<string, NonNullable<MeasuredEdge["label"]>> {
  const measuredEdges = new Map(measured.edges.map(edge => [edge.id, edge]));
  return new Map(sortBySourceOrder(inventory).flatMap(occurrence => {
    if (occurrence.label === undefined) return [];
    const label = measuredEdges.get(occurrence.connectorId)?.label;
    return label ? [[occurrence.connectorId, label] as const] : [];
  }));
}

function routeViolationsAsDiagnostics(violations: readonly RoutingViolation[], edgeIds: readonly string[]): RendererDiagnostic[] {
  return violations.map(violation => issue(`renderer.routing.ia_place_map_${violation.kind}`,
    violation.message, violation.connectorIds[0] ?? edgeIds[0] ?? "ia_place_map",
    violation.segmentIds.length ? `segments=${violation.segmentIds.join(",")}` : undefined));
}

function siblingGapCorridors(scene: PositionedScene): GapCorridor[] {
  const corridors: GapCorridor[] = [];
  const routeIntersects = (edge: PositionedEdge, bounds: { x: number; y: number; width: number; height: number }): boolean => {
    const right = bounds.x + bounds.width, bottom = bounds.y + bounds.height;
    return edge.route.points.slice(1).some((end, index) => {
      const start = edge.route.points[index]!;
      if (Math.abs(start.y - end.y) <= GEOMETRY_EPSILON) {
        return start.y >= bounds.y - GEOMETRY_EPSILON && start.y <= bottom + GEOMETRY_EPSILON
          && Math.min(start.x, end.x) < right - GEOMETRY_EPSILON && Math.max(start.x, end.x) > bounds.x + GEOMETRY_EPSILON;
      }
      if (Math.abs(start.x - end.x) <= GEOMETRY_EPSILON) {
        return start.x >= bounds.x - GEOMETRY_EPSILON && start.x <= right + GEOMETRY_EPSILON
          && Math.min(start.y, end.y) < bottom - GEOMETRY_EPSILON && Math.max(start.y, end.y) > bounds.y + GEOMETRY_EPSILON;
      }
      return false;
    });
  };
  const visit = (container: PositionedContainer): void => {
    const direction = container.layout.direction;
    for (let index = 1; index < container.children.length; index += 1) {
      const before = container.children[index - 1]!, after = container.children[index]!;
      let bounds: { x: number; y: number; width: number; height: number };
      if (direction === "horizontal") {
        const x = before.x + before.width;
        const y = container.y + container.chrome.padding.top + (container.chrome.headerBandHeight ?? 0);
        bounds = { x, y, width: Math.max(0, after.x - x),
          height: Math.max(0, container.y + container.height - container.chrome.padding.bottom - y) };
      } else {
        const y = before.y + before.height;
        const x = container.x + container.chrome.padding.left;
        bounds = { x, y, width: Math.max(0, container.x + container.width - container.chrome.padding.right - x),
          height: Math.max(0, after.y - y) };
      }
      const key = gapKey(container.id, before.id, after.id);
      const axis = direction === "horizontal" ? "x" : "y";
      const connectorIds = scene.edges.filter(edge => routeIntersects(edge, bounds)).map(edge => edge.id);
      corridors.push({ owner: key, key, containerId: container.id, beforeId: before.id, afterId: after.id,
        axis, bounds, connectorIds, margin: DEFAULT_ROUTING_POLICY.minTerminalLeg });
    }
    for (const child of container.children) if (child.kind === "container") visit(child);
  };
  visit(scene.root);
  return corridors;
}

function gapKey(containerId: string, beforeId: string, afterId: string): GapKey {
  return `${containerId}\0${beforeId}\0${afterId}`;
}

function ownerLineages(root: PositionedContainer, nodeIds: readonly string[]): Map<string, OwnerLineage[]> {
  const wanted = new Set(nodeIds);
  const result = new Map<string, OwnerLineage[]>([...wanted].map(id => [id, []]));
  const visit = (container: PositionedContainer, inherited: OwnerLineage[]): void => {
    for (const child of container.children) {
      const line = [...inherited, { container, child }];
      if (child.kind === "node" && wanted.has(child.id)) result.set(child.id, line);
      if (child.kind === "container") visit(child, line);
    }
  };
  visit(root, []);
  return result;
}

function resolveOwnerGap(
  scene: PositionedScene,
  beforeId: string,
  afterId: string,
  segmentAxis: "horizontal" | "vertical"
): GapCorridor | undefined {
  const lineages = ownerLineages(scene.root, [beforeId, afterId]);
  const before = lineages.get(beforeId) ?? [], after = lineages.get(afterId) ?? [];
  const expectedDirection = segmentAxis === "vertical" ? "horizontal" : "vertical";
  for (let index = Math.min(before.length, after.length) - 1; index >= 0; index -= 1) {
    const left = before[index]!, right = after[index]!;
    if (left.container.id !== right.container.id || left.child.id === right.child.id
      || left.container.layout.direction !== expectedDirection) continue;
    const siblings = left.container.children;
    const leftIndex = siblings.findIndex(item => item.id === left.child.id);
    const rightIndex = siblings.findIndex(item => item.id === right.child.id);
    if (leftIndex < 0 || rightIndex < 0) continue;
    const gapIndex = Math.min(leftIndex, rightIndex) + 1;
    if (gapIndex <= 0 || gapIndex >= siblings.length) continue;
    const beforeChild = siblings[gapIndex - 1]!, afterChild = siblings[gapIndex]!;
    return siblingGapCorridors(scene).find(corridor => corridor.containerId === left.container.id
      && corridor.beforeId === beforeChild.id && corridor.afterId === afterChild.id);
  }
  return undefined;
}

function routeGapDemands(
  scene: PositionedScene,
  context: FinalRoutingContext,
  violations: readonly RoutingViolation[]
): { demands: Map<GapKey, number>; unowned: string[] } {
  const routeById = new Map(context.connectors.map(connector => [connector.id, connector]));
  const segments = violations.flatMap(violation => violation.connectorIds.flatMap((id, connectorIndex) => {
    const connector = routeById.get(id);
    if (!connector) return [];
    const segments = buildRoutingSegments(id, connector.route);
    // Geometry failures identify their actual runs. Capacity-level failures without
    // segment attribution may claim the whole implicated connector component.
    const indexes = violation.routeSegmentIndexes;
    if (indexes?.length) {
      const relevantIndexes = violation.connectorIds.length > 1 && indexes.length === violation.connectorIds.length
        ? [indexes[connectorIndex]!] : indexes;
      return segments.filter(segment => relevantIndexes.includes(segment.routeSegmentIndex));
    }
    // Validation can use a different candidate identity for the same logical run.
    const runs = violation.segmentIds.filter(segmentId => String(segmentId).startsWith(`${id}\0`))
      .map(segmentId => String(segmentId).split("\0").at(-1));
    return runs.length ? segments.filter(segment => runs.includes(segment.logicalRunId)) : segments;
  }));
  const deficits = measureRoutingCorridorDeficits(segments, context.boxes, DEFAULT_ROUTING_POLICY);
  const demands = new Map<GapKey, number>();
  const unowned: string[] = [];
  for (const deficit of deficits) {
    const corridor = resolveOwnerGap(scene, deficit.beforeBoxId, deficit.afterBoxId, deficit.axis);
    if (!corridor) {
      unowned.push(`${deficit.beforeBoxId}->${deficit.afterBoxId} (${deficit.axis}, deficit ${Math.max(0, deficit.requiredSize - deficit.availableSize)}px)`);
      continue;
    }
    const amount = Math.max(0, deficit.requiredSize - deficit.availableSize);
    demands.set(corridor.key, Math.max(demands.get(corridor.key) ?? 0, amount));
  }
  return { demands, unowned };
}

/** Facing endpoint ports consume real terminal channels even before a legal route exists. */
function endpointChannelGapDemands(scene: PositionedScene, context: FinalRoutingContext,
  failedIds: ReadonlySet<string>): Map<GapKey, number> {
  const corridors = siblingGapCorridors(scene);
  const items = indexPositionedItems(scene.root);
  const claims: Array<{ owner: string; connectorId: string; priority: number; spanStart: number; spanEnd: number; thickness: number }> = [];
  const structural = new Set(inventoryFromScene(scene)!.expectedStructuralEdges.map(edge => edge.id));
  for (const corridor of corridors) {
    let margin = corridor.margin;
    for (const connector of context.connectors) {
      if (structural.has(connector.id)) continue;
      for (const endpoint of [connector.source, connector.target]) {
        const node = items.get(endpoint.nodeId);
        if (!node || node.kind !== "node") continue;
        const vertical = corridor.axis === "y";
        if (vertical ? endpoint.side !== "north" && endpoint.side !== "south"
          : endpoint.side !== "east" && endpoint.side !== "west") continue;
        const position = vertical ? endpoint.point.y : endpoint.point.x;
        const low = vertical ? corridor.bounds.y : corridor.bounds.x;
        const high = low + (vertical ? corridor.bounds.height : corridor.bounds.width);
        const towardHigh = endpoint.side === "south" || endpoint.side === "east";
        if (Math.abs(position - (towardHigh ? low : high)) > GEOMETRY_EPSILON) continue;
        const start = vertical ? node.x : node.y, end = start + (vertical ? node.width : node.height);
        const corridorStart = vertical ? corridor.bounds.x : corridor.bounds.y;
        const corridorEnd = corridorStart + (vertical ? corridor.bounds.width : corridor.bounds.height);
        if (Math.min(end, corridorEnd) <= Math.max(start, corridorStart) + GEOMETRY_EPSILON) continue;
        claims.push({ owner: corridor.owner, connectorId: connector.id, priority: connector.priority,
          spanStart: start, spanEnd: end, thickness: 0 });
        margin = Math.max(margin, endpoint.minLeg);
      }
    }
    corridor.margin = margin;
  }
  const active = corridors.filter(corridor => claims.some(claim => claim.owner === corridor.owner && failedIds.has(claim.connectorId)));
  const byOwner = new Map(corridors.map(corridor => [corridor.owner, corridor]));
  return new Map(measureConnectorLabelCapacity(active, claims, DEFAULT_ROUTING_POLICY.minSeparation)
    .map(request => [byOwner.get(request.owner)!.key, request.requiredSize - request.availableSize]));
}

function labelGapDemands(scene: PositionedScene,
  expectedLabels: ConnectorLabelLayoutInput["expectedLabels"], assessment: ReturnType<typeof assessConnectorLabels>): Map<GapKey, number> {
  const corridors = siblingGapCorridors(scene);
  const claims = connectorLabelCapacityClaims({ scene, expectedLabels, rejectAmbiguousAssociation: true }, assessment, corridors);
  const requests = measureConnectorLabelCapacity(corridors, claims, DEFAULT_ROUTING_POLICY.minSeparation);
  const corridorByOwner = new Map(corridors.map(corridor => [corridor.owner, corridor]));
  const demands = new Map<GapKey, number>();
  for (const request of requests) {
    const corridor = corridorByOwner.get(request.owner);
    if (!corridor) continue;
    const increment = Math.max(0, request.requiredSize - request.availableSize);
    demands.set(corridor.key, Math.max(demands.get(corridor.key) ?? 0, increment));
  }
  return demands;
}

/** The Area's top padding owns the channel between its header and first Place. */
function headerPaddingDemands(
  scene: PositionedScene,
  expectedLabels: ConnectorLabelLayoutInput["expectedLabels"],
  implicatedIds: ReadonlySet<string>
): Map<string, number> {
  const items = indexPositionedItems(scene.root);
  const lineages = ownerLineages(scene.root, scene.edges.flatMap(edge => [edge.from.itemId, edge.to.itemId]));
  const byArea = new Map<string, { area: PositionedContainer; ids: Set<string>; implicated: boolean }>();
  for (const edge of scene.edges) for (const endpoint of [edge.from, edge.to]) {
    const node = items.get(endpoint.itemId);
    if (node?.ports.find(port => port.id === endpoint.portId)?.side !== "north") continue;
    const area = [...(lineages.get(endpoint.itemId) ?? [])].reverse().find(entry => entry.container.role === "area")?.container;
    if (!area || !(area.chrome.headerBandHeight ?? 0)) continue;
    const nodeTops = (item: PositionedItem): number[] => item.kind === "node" ? [item.y] : item.children.flatMap(nodeTops);
    if (endpoint.y > Math.min(...nodeTops(area)) + GEOMETRY_EPSILON) continue;
    const record = byArea.get(area.id) ?? { area, ids: new Set<string>(), implicated: false };
    record.ids.add(edge.id);
    record.implicated ||= implicatedIds.has(edge.id);
    byArea.set(area.id, record);
  }
  const demands = new Map<string, number>();
  for (const { area, ids, implicated } of byArea.values()) {
    if (!implicated) continue;
    const corridor: ConnectorLabelCorridor = { owner: area.id, axis: "y",
      bounds: { x: area.x, y: area.y + (area.chrome.headerBandHeight ?? 0), width: area.width, height: area.chrome.padding.top },
      connectorIds: [...ids], margin: DEFAULT_ROUTING_POLICY.minTerminalLeg };
    const claims = [...ids].map((connectorId, priority) => ({ owner: area.id, connectorId, priority,
      spanStart: area.x, spanEnd: area.x + area.width,
      thickness: expectedLabels.has(connectorId) ? expectedLabels.get(connectorId)!.height + FIXED_LABEL_DISTANCE : 0 }));
    const request = measureConnectorLabelCapacity([corridor], claims, DEFAULT_ROUTING_POLICY.minSeparation)[0];
    if (request) demands.set(`${area.id}\0top`, request.requiredSize - request.availableSize);
  }
  return demands;
}

function commonLabelOwner(scene: PositionedScene, edge: PositionedEdge): PositionedContainer {
  const lineages = ownerLineages(scene.root, [edge.from.itemId, edge.to.itemId]);
  const targetAreas = new Set((lineages.get(edge.to.itemId) ?? [])
    .filter(entry => entry.container.role === "area").map(entry => entry.container.id));
  return [...(lineages.get(edge.from.itemId) ?? [])].reverse()
    .find(entry => entry.container.role === "area" && targetAreas.has(entry.container.id))?.container ?? scene.root;
}

/** Padding creates an owned exterior channel; it also reflows ancestors and later siblings. */
function exteriorLabelPaddingDemands(scene: PositionedScene,
  expectedLabels: ConnectorLabelLayoutInput["expectedLabels"],
  assessment: ReturnType<typeof assessConnectorLabels>): Map<string, number> {
  const unresolved = new Set(assessment.problems.map(problem => problem.connectorId));
  const anchors = connectorLabelCapacityAnchors(buildLabelInput(scene, expectedLabels), assessment);
  const corridors: ConnectorLabelCorridor[] = [];
  const claims: Array<{ owner: string; connectorId: string; priority: number; spanStart: number; spanEnd: number; thickness: number }> = [];
  const nodes = (item: PositionedItem): PositionedNode[] => item.kind === "node" ? [item] : item.children.flatMap(nodes);
  for (const [priority, edge] of scene.edges.entries()) {
    const label = expectedLabels.get(edge.id);
    if (!label || !unresolved.has(edge.id)) continue;
    const anchor = anchors.get(edge.id);
    if (!anchor) continue;
    const owner = commonLabelOwner(scene, edge);
    const ownerNodes = nodes(owner);
    const vertical = anchor.orientation === "vertical";
    const axis = vertical ? "x" : "y";
    const highContent = Math.max(...ownerNodes.map(node => vertical ? node.x + node.width : node.y + node.height));
    const lowContent = Math.min(...ownerNodes.map(node => vertical ? node.x : node.y));
    const side = anchor.coordinate >= highContent - GEOMETRY_EPSILON ? (vertical ? "right" : "bottom")
      : anchor.coordinate <= lowContent + GEOMETRY_EPSILON ? (vertical ? "left" : "top") : undefined;
    if (!side) continue;
    const key = `${owner.id}\0${side}`;
    const farSide = side === "right" || side === "bottom";
    const low = farSide ? highContent : owner[axis];
    const high = farSide ? owner[axis] + (vertical ? owner.width : owner.height) : lowContent;
    corridors.push({ owner: key, axis,
      bounds: vertical ? { x: low, y: owner.y, width: high - low, height: owner.height }
        : { x: owner.x, y: low, width: owner.width, height: high - low },
      connectorIds: [edge.id], margin: DEFAULT_ROUTING_POLICY.minTerminalLeg });
    claims.push({ owner: key, connectorId: edge.id, priority,
      spanStart: Math.min(vertical ? anchor.start.y : anchor.start.x, vertical ? anchor.end.y : anchor.end.x),
      spanEnd: Math.max(vertical ? anchor.start.y : anchor.start.x, vertical ? anchor.end.y : anchor.end.x),
      thickness: (vertical ? label.width : label.height) + FIXED_LABEL_DISTANCE });
  }
  return new Map(measureConnectorLabelCapacity(corridors, claims, DEFAULT_ROUTING_POLICY.minSeparation)
    .map(request => [request.owner, request.requiredSize - request.availableSize]));
}

function cloneMeasuredWithGapDemands(scene: MeasuredScene, demands: ReadonlyMap<GapKey, number>,
  paddingDemands: ReadonlyMap<string, number>): MeasuredScene {
  const rewrite = (container: MeasuredScene["root"]): MeasuredScene["root"] => {
    const children = container.children.map(child => child.kind === "container" ? rewrite(child) : child);
    const next = { ...container, children };
    const original = container.layout.gap ?? container.chrome.gutter ?? 0;
    for (let index = 0; index < children.length - 1; index++) {
      const before = children[index]!, after = children[index + 1]!;
      const increment = demands.get(`${container.id}\0${before.id}\0${after.id}`) ?? 0;
      if (increment > 0) next.layout = { ...next.layout, gapAfter: { ...next.layout.gapAfter,
        [before.id]: (container.layout.gapAfter?.[before.id] ?? original) + increment } };
    }
    for (const side of ["left", "right", "top", "bottom"] as const) {
      const amount = paddingDemands.get(`${container.id}\0${side}`) ?? 0;
      if (amount > 0) next.chrome = { ...next.chrome, padding: { ...next.chrome.padding,
        [side]: container.chrome.padding[side] + amount } };
    }
    return next;
  };
  return reflowMeasuredSceneContainers({ ...scene, root: rewrite(scene.root) });
}

function mergeDemands(target: Map<GapKey, number>, additions: ReadonlyMap<GapKey, number>): boolean {
  let changed = false;
  for (const [key, amount] of additions) {
    if (amount <= 0) continue;
    const current = target.get(key) ?? 0;
    target.set(key, current + amount);
    changed = true;
  }
  return changed;
}

function appendDiagnostics(scene: PositionedScene, diagnostics: readonly RendererDiagnostic[]): PositionedScene {
  return { ...scene, diagnostics: sortRendererDiagnostics([...scene.diagnostics, ...diagnostics]) };
}

function buildLabelInput(scene: PositionedScene, labels: ConnectorLabelLayoutInput["expectedLabels"]): ConnectorLabelLayoutInput {
  return { scene, expectedLabels: labels, rejectAmbiguousAssociation: true, eventBasedHorizontalSearch: true,
    scopeByConnectorId: new Map(scene.edges.map(edge => [edge.id, commonLabelOwner(scene, edge)])) };
}

function auditPortAttachments(scene: PositionedScene): RendererDiagnostic[] {
  const diagnostics: RendererDiagnostic[] = [];
  const items = indexPositionedItems(scene.root);
  for (const edge of scene.edges) {
    for (const [endpoint, reference] of [["source", edge.from], ["target", edge.to]] as const) {
      const item = items.get(reference.itemId);
      const port = item?.ports.find(candidate => candidate.id === reference.portId);
      if (!item || item.kind !== "node" || !port || !reference.portId) {
        diagnostics.push(issue("renderer.routing.ia_final_endpoint_missing",
          `Final ${endpoint} endpoint of "${edge.id}" has no node port reference.`, edge.id));
        continue;
      }
      const expected = { x: item.x + port.x, y: item.y + port.y };
      if (Math.hypot(expected.x - reference.x, expected.y - reference.y) > GEOMETRY_EPSILON) {
        diagnostics.push(issue("renderer.routing.ia_final_endpoint_mismatch",
          `Final ${endpoint} endpoint of "${edge.id}" is detached from its referenced port.`, edge.id));
      }
      const onSide = port.side === "north" ? Math.abs(port.y) <= GEOMETRY_EPSILON
        : port.side === "south" ? Math.abs(port.y - item.height) <= GEOMETRY_EPSILON
          : port.side === "west" ? Math.abs(port.x) <= GEOMETRY_EPSILON
            : Math.abs(port.x - item.width) <= GEOMETRY_EPSILON;
      const onSideSpan = port.side === "north" || port.side === "south"
        ? port.x >= -GEOMETRY_EPSILON && port.x <= item.width + GEOMETRY_EPSILON
        : port.y >= -GEOMETRY_EPSILON && port.y <= item.height + GEOMETRY_EPSILON;
      if (!onSide || !onSideSpan) diagnostics.push(issue("renderer.routing.ia_final_port_outside_node",
        `Final port "${port.id}" for "${edge.id}" is outside the declared node side.`, edge.id));
      if (item.kind === "node") {
        const inset = getNodePrimitiveTheme(getRendererTheme(scene.themeId, "routing"), item.primitive).portInset;
        const offset = endpointOffset(port);
        const limit = port.side === "north" || port.side === "south" ? item.width : item.height;
        if (offset < inset - GEOMETRY_EPSILON || offset > limit - inset + GEOMETRY_EPSILON) {
          diagnostics.push(issue("renderer.routing.ia_final_port_capacity",
            `Final port "${port.id}" for "${edge.id}" violates the node's bounded side capacity.`, edge.id,
            `offset=${offset} sideLength=${limit} inset=${inset}`));
        }
      }
    }
  }
  return diagnostics;
}

/** Independent final-scene acceptance for the exact positioned IA scene handed to SVG. */
export function auditIaPlaceMapFinalScene(scene: PositionedScene): RendererDiagnostic[] {
  const inventory = inventoryFromScene(scene);
  if (!inventory) return [];
  const diagnostics = auditPortAttachments(scene);
  const expectedIds = expectedConnectorIds(inventory);
  const actualIds = scene.edges.map(edge => edge.id);
  const seenIds = new Set<string>();
  for (const id of actualIds) {
    if (seenIds.has(id)) diagnostics.push(issue("renderer.routing.ia_final_connector_duplicate",
      `Final IA scene repeats connector id "${id}".`, id));
    seenIds.add(id);
  }
  for (const id of expectedIds) if (!actualIds.includes(id)) diagnostics.push(issue("renderer.routing.ia_final_connector_missing",
    `Final IA scene omitted expected connector "${id}".`, id));
  for (const id of actualIds) if (!expectedIds.has(id)) diagnostics.push(issue("renderer.routing.ia_final_connector_unexpected",
    `Final IA scene contains unowned connector "${id}".`, id));
  const expectedMarkers = new Map([
    ...inventory.expectedStructuralEdges.map(edge => [edge.id, edge.markers] as const),
    ...inventory.expectedNavigationOccurrences.map(edge => [edge.connectorId, edge.markers] as const)
  ]);
  for (const [id, markers] of expectedMarkers) {
    const edge = scene.edges.find(candidate => candidate.id === id);
    if (edge && (edge.markers?.start !== markers?.start || edge.markers?.end !== markers?.end)) {
      diagnostics.push(issue("renderer.routing.ia_final_marker_mismatch",
        `Final connector "${id}" changed its required marker payload.`, id));
    }
  }
  for (const expected of inventory.expectedStructuralEdges) {
    const edge = scene.edges.find(candidate => candidate.id === expected.id);
    if (edge && (edge.from.itemId !== expected.from || edge.to.itemId !== expected.to || edge.role !== expected.role)) {
      diagnostics.push(issue("renderer.routing.ia_final_structural_mismatch",
        `Final connector "${expected.id}" changed its containment association.`, expected.id));
    }
  }
  for (const occurrence of inventory.expectedNavigationOccurrences) {
    const edge = scene.edges.find(candidate => candidate.id === occurrence.connectorId);
    if (!edge) continue;
    if (edge.from.itemId !== occurrence.from || edge.to.itemId !== occurrence.to) diagnostics.push(issue(
      "renderer.routing.ia_final_occurrence_endpoint_mismatch",
      `Final connector "${edge.id}" does not retain the endpoints of navigation occurrence "${occurrence.sourceEdgeId}".`, edge.id,
      `expected=${occurrence.from}->${occurrence.to} actual=${edge.from.itemId}->${edge.to.itemId}`));
    const expectedText = occurrence.label?.replace(/\s+/g, " ").trim();
    const actualText = edge.label ? normalizeLabel(edge.label.lines) : undefined;
    if (occurrence.label === undefined ? edge.label !== undefined
      : !edge.label || !wrappedLabelPreservesText(edge.label.lines, occurrence.label)) diagnostics.push(issue("renderer.routing.ia_final_label_mismatch",
      `Final label for occurrence "${occurrence.sourceEdgeId}" does not match its required presentation text.`, edge.id,
      `expected=${JSON.stringify(expectedText)} actual=${JSON.stringify(actualText)}`));
  }
  const labels = expectedLabelMapFromFinalScene(scene, inventory);
  const labelAudit = auditConnectorLabels(buildLabelInput(scene, labels));
  diagnostics.push(...labelProblemsToDiagnostics(labelAudit.problems));
  const context = buildFinalRoutingContext(scene, inventory);
  diagnostics.push(...context.diagnostics);
  if (context.context) diagnostics.push(...routeViolationsAsDiagnostics(validateFinalRouteSet(context.context), actualIds));
  diagnostics.push(...auditPositionedSceneMarkers(scene));
  return sortRendererDiagnostics(diagnostics);
}

function expectedLabelMapFromFinalScene(scene: PositionedScene, inventory: IaPlaceMapInventory): Map<string, NonNullable<MeasuredEdge["label"]>> {
  const labels = new Map<string, NonNullable<MeasuredEdge["label"]>>();
  const edges = new Map(scene.edges.map(edge => [edge.id, edge]));
  const measuredLookalike = (edge: PositionedEdge): NonNullable<MeasuredEdge["label"]> | undefined => edge.label
    ? { lines: [...edge.label.lines], width: edge.label.width, height: edge.label.height, lineHeight: edge.label.lineHeight,
      textStyleRole: edge.label.textStyleRole } : undefined;
  for (const occurrence of inventory.expectedNavigationOccurrences) {
    if (occurrence.label === undefined) continue;
    const label = edges.get(occurrence.connectorId) && measuredLookalike(edges.get(occurrence.connectorId)!);
    if (label) labels.set(occurrence.connectorId, label);
  }
  return labels;
}

function labelProblemsToDiagnostics(problems: readonly ConnectorLabelProblem[]): RendererDiagnostic[] {
  return problems.map(problem => issue(`renderer.routing.ia_label_${problem.kind}`,
    `Final IA label for "${problem.connectorId}" failed the ${problem.kind} audit${problem.obstacleId ? ` against "${problem.obstacleId}"` : ""}.`,
    problem.connectorId, problem.obstacleId));
}

/**
 * IA-specific ownership adapter over shared measurement, root layout, routing and label
 * geometry. Every reflow is rebuilt from the measured baseline plus absolute sibling-gap
 * demands; the shared lifecycle remains the sole route repair engine.
 */
export async function runIaPlaceMapRendererPipeline(scene: RendererScene): Promise<StagedRendererPipelineResult> {
  const inventory = inventoryFromScene(scene);
  if (!inventory) return runStagedRendererPipeline(scene);
  const measuredBaseline = measureScene(scene);
  const diagnostics = validateIndependentInventory(scene, measuredBaseline, inventory);
  if (diagnostics.length) {
    const positioned = await positionSceneBeforeRouting(measuredBaseline);
    return { rendererScene: scene, measuredScene: measuredBaseline,
      positionedScene: appendDiagnostics(positioned, diagnostics) };
  }

  const seedRoot = await positionSceneBeforeRouting(measuredBaseline);
  const seedScene = positionMeasuredEdgesAgainstRoot(measuredBaseline, seedRoot);
  const allocated = allocateOccurrencePorts(measuredBaseline, seedScene, inventory);
  if (allocated.diagnostics.length) return { rendererScene: scene, measuredScene: measuredBaseline,
    positionedScene: appendDiagnostics(seedScene, allocated.diagnostics) };

  const portMeasuredBaseline = allocated.measured;
  const absoluteGapIncrements = new Map<GapKey, number>();
  const absolutePaddingIncrements = new Map<string, number>();
  const seenRevisions = new Set<string>();
  const expectedLabels = expectedLabelMap(portMeasuredBaseline, inventory);
  let finalPositioned = seedScene;
  let lastUnresolvedLabels: ConnectorLabelProblem[] = [];
  let lastRouteViolations: RoutingViolation[] = [];
  let pass = 0;
  while (pass <= DEFAULT_ROUTING_POLICY.maxExpansionPasses) {
    const revisionKey = JSON.stringify([
      [...absoluteGapIncrements].sort(([a], [b]) => a.localeCompare(b)),
      [...absolutePaddingIncrements].sort(([a], [b]) => a.localeCompare(b))
    ]);
    if (seenRevisions.has(revisionKey)) {
      finalPositioned = appendDiagnostics(finalPositioned, [issue("renderer.routing.ia_repeated_reflow_state",
        "IA route and label reflow repeated a prior absolute sibling-gap state.", "ia_place_map")]);
      break;
    }
    seenRevisions.add(revisionKey);
    const measuredRevision = cloneMeasuredWithGapDemands(portMeasuredBaseline, absoluteGapIncrements, absolutePaddingIncrements);
    const root = await positionSceneBeforeRouting(measuredRevision);
    let positioned = positionMeasuredEdgesAgainstRoot(measuredRevision, root);
    const contextResult = buildFinalRoutingContext(positioned, inventory);
    if (!contextResult.context) {
      finalPositioned = appendDiagnostics(positioned, contextResult.diagnostics);
      return { rendererScene: scene, measuredScene: measuredRevision, positionedScene: finalPositioned };
    }
    const routed = runRoutingLifecycle(contextResult.context);
    if (routed.status === "failed") {
      lastRouteViolations = routed.violations;
      const failedContext: FinalRoutingContext = { ...contextResult.context, connectors: routed.debugConnectors };
      const routeDemand = routeGapDemands(positioned, failedContext, routed.violations);
      const failedIds = new Set(routed.violations.flatMap(violation => violation.connectorIds));
      for (const [key, amount] of endpointChannelGapDemands(positioned, failedContext, failedIds)) {
        routeDemand.demands.set(key, Math.max(routeDemand.demands.get(key) ?? 0, amount));
      }
      const gapChanged = mergeDemands(absoluteGapIncrements, routeDemand.demands);
      const paddingChanged = mergeDemands(absolutePaddingIncrements,
        headerPaddingDemands(positioned, expectedLabels, new Set(routed.violations.flatMap(violation => violation.connectorIds))));
      const changed = gapChanged || paddingChanged;
      if (changed && pass < DEFAULT_ROUTING_POLICY.maxExpansionPasses) {
        pass += 1;
        continue;
      }
      const details = routeDemand.unowned.length ? `No justified sibling-gap owner for: ${routeDemand.unowned.join("; ")}`
        : `shared lifecycle status=${routed.reason}; candidates=${routed.trace.candidates}; repairs=${routed.trace.repairRevisions}`;
      finalPositioned = appendDiagnostics(positioned, [
        ...routeViolationsAsDiagnostics(routed.violations, positioned.edges.map(edge => edge.id)),
        issue("renderer.routing.ia_route_capacity_exhausted",
          "IA routing could not find a legal route set within the bounded route and reflow budget.", "ia_place_map", details)
      ]);
      return { rendererScene: scene, measuredScene: measuredRevision, positionedScene: finalPositioned };
    }

    positioned = applyFinalRoutes(positioned, routed.context);
    if (expectedLabels.size) {
      const labelInput = buildLabelInput(positioned, expectedLabels);
      const assessment = assessConnectorLabels(labelInput);
      positioned = { ...positioned, edges: positioned.edges.map(edge => ({ ...edge,
        label: assessment.labels.get(edge.id) ?? edge.label })) };
      const audited = auditConnectorLabels(buildLabelInput(positioned, expectedLabels));
      lastUnresolvedLabels = [...audited.problems];
      if (!audited.problems.length) {
        positioned = { ...positioned, diagnostics: positioned.diagnostics.filter(diagnostic =>
          diagnostic.code !== "renderer.routing.edge_label_segment_fallback"
          || !diagnostic.targetId || !expectedLabels.has(diagnostic.targetId)) };
        const finalAudit = auditIaPlaceMapFinalScene(positioned);
        finalPositioned = appendDiagnostics(positioned, finalAudit);
        return { rendererScene: scene, measuredScene: measuredRevision, positionedScene: finalPositioned };
      }
      const labelDemands = labelGapDemands(positioned, expectedLabels, audited);
      const gapChanged = mergeDemands(absoluteGapIncrements, labelDemands);
      const paddingRequests = headerPaddingDemands(positioned, expectedLabels, new Set(audited.problems.map(problem => problem.connectorId)));
      for (const [key, amount] of exteriorLabelPaddingDemands(positioned, expectedLabels, audited)) {
        paddingRequests.set(key, Math.max(paddingRequests.get(key) ?? 0, amount));
      }
      const paddingChanged = mergeDemands(absolutePaddingIncrements, paddingRequests);
      const changed = gapChanged || paddingChanged;
      if (changed && pass < DEFAULT_ROUTING_POLICY.maxExpansionPasses) {
        pass += 1;
        continue;
      }
    } else {
      const finalAudit = auditIaPlaceMapFinalScene(positioned);
      finalPositioned = appendDiagnostics(positioned, finalAudit);
      return { rendererScene: scene, measuredScene: measuredRevision, positionedScene: finalPositioned };
    }
    const reasons = lastUnresolvedLabels.map(problem => `${problem.connectorId}:${problem.kind}${problem.obstacleId ? `:${problem.obstacleId}` : ""}`);
    finalPositioned = appendDiagnostics(positioned, [
      ...labelProblemsToDiagnostics(lastUnresolvedLabels),
      issue("renderer.routing.ia_label_capacity_exhausted",
        "IA labels remain unresolved after the shared bounded reflow budget.", "ia_place_map",
        `unresolved=${reasons.join(", ")}; reflowPasses=${pass}; routeFailures=${lastRouteViolations.length}`)
    ]);
    return { rendererScene: scene, measuredScene: measuredRevision, positionedScene: finalPositioned };
  }
  return { rendererScene: scene, measuredScene: portMeasuredBaseline,
    positionedScene: appendDiagnostics(finalPositioned, [issue("renderer.routing.ia_expansion_exhausted",
      "IA route and label layout exceeded the shared expansion budget.", "ia_place_map")]) };
}
