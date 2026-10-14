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
  RendererRoutingPortGroupEvidence,
  RendererRoutingRevisionEvidence,
  RendererScene
} from "./contracts.js";
import { createRoutingDiagnostic, sortRendererDiagnostics } from "./diagnostics.js";
import { positionMeasuredEdgesAgainstRoot } from "./macroLayout.js";
import { reflowMeasuredSceneContainers } from "./microLayout.js";
import { getNodePrimitiveTheme } from "./primitives.js";
import { measureScene, positionSceneBeforeRouting, runStagedRendererPipeline, type StagedRendererPipelineResult } from "./pipeline.js";
import {
  DEFAULT_ROUTING_POLICY,
  DEFAULT_FINAL_ROUTING_LIMITS,
  READABLE_ROUTING_GEOMETRY,
  readableRoutingClearance,
  readablePortPitch,
  compareRouteCosts,
  routeCost,
  resolveFacingSideSharedCoordinate,
  selectRoutingQuality,
  generateRoutingQualityCandidates,
  routingEndpointEnvelopeExhausted,
  withRoutingQualityBudgetAllowance,
  buildPortCorridorSeed,
  allocatePortOffsets,
  buildRoutingSegments,
  measureRoutingCorridorDeficits,
  measureExteriorRoutingCorridorDeficit,
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
  measureConnectorLabelScopeDeficits,
  measureConnectorLabelMinimumScopeDeficits,
  measureConnectorLabelRelativeClearanceDeficits,
  coalesceConnectorLabelPhysicalRails,
  wrappedLabelPreservesText,
  type ConnectorLabelCorridor,
  type ConnectorLabelLayoutInput,
  type ConnectorLabelProblem
} from "./connectorLabelLayout.js";
import { FIXED_LABEL_DISTANCE, FIXED_LABEL_CLEARANCE, buildRouteSegmentDetails } from "./connectorLabelPlacement.js";
import { measureEndpointBypassPadding } from "./routingCore/endpointBypassCapacity.js";
import { auditPaintedExportClearance, measurePaintedExportDeficits } from "./exportPaint.js";
import { markerRoutingClearance } from "./markerGeometry.js";
import { auditPositionedSceneMarkers, buildEndpointMarkerRoutingBlockers } from "./markerAudit.js";
import { getRendererTheme } from "./theme.js";
import type { RendererDiagnostic } from "./diagnostics.js";
import { allocateOrderedPortPair, orderedPortPairHasTraversal } from "./routingCore/orderedPortPair.js";
import { finalizeIaForwardShortcuts, auditIaForwardShortcutScene, type IaForwardShortcutCallbacks } from "./iaPlaceMapForwardRouting.js";

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
  inventory: IaPlaceMapInventory,
  returnSide?: PortSide,
  budget?: { candidates: number },
  reverseReturnPorts = false,
  forwardFlank?: PortSide,
  loopSide?: PortSide,
  parallelSide?: PortSide,
  forcedPairs?: ReadonlyMap<string, readonly [PortSide, PortSide]>,
  movableSourceIds: ReadonlySet<string> = new Set(forcedPairs?.keys())
): { measured: MeasuredScene; diagnostics: RendererDiagnostic[]; portGroups?: RendererRoutingPortGroupEvidence[]; portDisplacement?: number } {
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
  const loopPolicy = inventory.routingPreferences?.self_loop;
  // Ordinary arrivals reserve their balanced slots before a loop pair is placed.
  if (loopPolicy) occurrences.sort((a, b) => Number(a.from === a.to) - Number(b.from === b.to) || a.sourceOrder - b.sourceOrder);
  const groups = new Map<string, PortGroup>();
  const ordinaryIndexByEndpointPair = new Map<string, number>();
  const assignments = new Map<string, PortRequest>();
  const diagnostics: RendererDiagnostic[] = [];
  const theme = getRendererTheme(measured.themeId, "routing");
  const allocationFor = (node: MeasuredNode, side: PortSide, requestIds: string[]): PortOffsetAllocationResult => {
    const primitive = getNodePrimitiveTheme(theme, node.primitive);
    // Labels reserve corridor space independently of attachment capacity.
    const separation = readablePortPitch(theme.paint.arrowSize, theme.paint.edgeStrokeWidth);
    const fixedRequestIds = requestIds.filter(id => ![...movableSourceIds].some(edgeId =>
      id === sidePortRequest(node.id, occurrences.find(occurrence => occurrence.connectorId === edgeId)!.id, "source")));
    const allocation = allocatePortOffsets({ sideLength: sideLength(node, side), minInset: primitive.portInset,
      minSeparation: separation, reservedOffsets: reserveForSide(node, side, usedStructuralPorts.get(node.id) ?? new Set()), requestIds: fixedRequestIds });
    return allocation.status === "allocated" ? { ...allocation, offsets: new Map([...allocation.offsets,
      ...requestIds.filter(id => !fixedRequestIds.includes(id)).map(id => [id, sideLength(node, side) / 2] as const)]) } : allocation;
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
    const sourceCenter = { x: sourcePosition.x + sourcePosition.width / 2, y: sourcePosition.y + sourcePosition.height / 2 };
    const targetCenter = { x: targetPosition.x + targetPosition.width / 2, y: targetPosition.y + targetPosition.height / 2 };
    const delta = { x: targetCenter.x - sourceCenter.x, y: targetCenter.y - sourceCenter.y };
    let chosen: { sourceSide: PortSide; targetSide: PortSide; trial: Map<string, PortGroup> } | undefined;
    let firstCapacityPair: typeof chosen;

    const endpointPair = JSON.stringify([occurrence.from, occurrence.to]);
    const ordinaryIndex = ordinaryIndexByEndpointPair.get(endpointPair) ?? 0;
    ordinaryIndexByEndpointPair.set(endpointPair, ordinaryIndex + 1);
    const backwards = Math.abs(delta.x) >= Math.abs(delta.y) ? delta.x < 0 : delta.y < 0;
    // Fixed legal attachment pitch does not grow with annotation dimensions.
    // A complete-scene alternative may move later parallel occurrences to a
    // perpendicular corridor, leaving the first facing pair balanced and giving
    // the additional measured labels their own readable route space.
    const alternateParallel = inventory.routingScope && parallelSide && ordinaryIndex >= 2
      && occurrence.from !== occurrence.to && !backwards && Math.abs(delta.x) >= Math.abs(delta.y);
    const obstructedForward = forwardFlank && !backwards && Math.abs(delta.y) > Math.abs(delta.x)
      && collectRoutingGeometry(seedScene).boxes.some(box => box.id !== occurrence.from && box.id !== occurrence.to
        && box.y > sourcePosition.y + sourcePosition.height - GEOMETRY_EPSILON
        && box.y + box.height < targetPosition.y + GEOMETRY_EPSILON
        && Math.max(sourceCenter.x, targetCenter.x) >= box.x && Math.min(sourceCenter.x, targetCenter.x) <= box.x + box.width);
    // A same-node occurrence needs two distinct attachments on one side.
    // Opposing sides create a seed through the node itself and cannot represent
    // a bounded external loop. Reuse the complete-scene side trials; shared
    // corridor generation remains responsible for the loop geometry.
    const selectedLoopSide = loopSide ?? returnSide;
    const loopSides: PortSide[] = selectedLoopSide ? [selectedLoopSide]
      : loopPolicy ? loopPolicy.side_trials.map(trial => trial.side) : ["north", "south", "west", "east"];
    const seedEdge = seedScene.edges.find(candidate => candidate.id === occurrence.connectorId);
    const owner = seedEdge && inventory.routingScope ? commonLabelOwner(seedScene, seedEdge) : undefined;
    const labelledVerticalReturn = !!edge.label && backwards && Math.abs(delta.y) > Math.abs(delta.x)
      && owner && owner.id !== seedScene.root.id;
    // A readable label beside an internal vertical return needs horizontal
    // capacity. Facing north/south anchors inside the node envelope cannot claim
    // an exterior channel. Compare perpendicular attachments using the measured
    // text deficit and the actual selected owner's available side space.
    const perpendicularSides: PortSide[] = ["east", "west"];
    if (labelledVerticalReturn) {
      const required = edge.label!.width + FIXED_LABEL_DISTANCE
        + readableRoutingClearance(theme.paint.edgeStrokeWidth);
      const available = (side: PortSide): number => side === "east"
        ? owner.x + owner.width - Math.max(sourcePosition.x + sourcePosition.width, targetPosition.x + targetPosition.width)
        : Math.min(sourcePosition.x, targetPosition.x) - owner.x;
      perpendicularSides.sort((a, b) => Math.max(0, required - available(a)) - Math.max(0, required - available(b)));
    }
    const pairs = forcedPairs?.has(occurrence.connectorId) ? [forcedPairs.get(occurrence.connectorId)!]
      : inventory.routingScope && occurrence.from === occurrence.to
      ? loopSides.map(side => [side, side] as [PortSide, PortSide])
      : alternateParallel ? [[parallelSide!, parallelSide!] as [PortSide, PortSide]]
      : labelledVerticalReturn && returnSide !== "east" && returnSide !== "west"
        ? perpendicularSides.map(side => [side, side] as [PortSide, PortSide])
      : obstructedForward ? [[forwardFlank!, forwardFlank!] as [PortSide, PortSide]]
      : returnSide && backwards ? [[returnSide, returnSide] as [PortSide, PortSide]] : orderedSidePairs(delta);
    for (const [sourceSide, targetSide] of pairs) {
      if (budget && budget.candidates <= 0) break;
      if (budget) budget.candidates--;
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
      chosen = pair;
      break;
    }
    // A capacity-valid pair may need owned spacing before a viable corridor
    // exists. Keep that preferred pair for the bounded geometry reflow.
    chosen ??= firstCapacityPair;
    if (!chosen) {
      diagnostics.push(budget && budget.candidates <= 0 ? issue("renderer.routing.ia_joint_budget_exhausted",
        `IA aggregate allowance ended before attachment alternatives for "${occurrence.sourceEdgeId}" could be assessed.`, occurrence.connectorId)
        : issue("renderer.routing.ia_port_capacity_exhausted",
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

  // Endpoint geometry orders attachments; authored occurrence order breaks ties.
  for (const group of groups.values()) {
    const axis = group.side === "east" || group.side === "west" ? "y" : "x";
    const peerCoordinate = (id: string): number => {
      const request = assignments.get(id)!;
      const edge = edgeById.get(request.edgeId)!;
      const otherId = request.endpoint === "source" ? edge.to.itemId : edge.from.itemId;
      const other = positioned.get(otherId)!;
      const own = positioned.get(group.node.id)!;
      const otherAxis = axis === "x" ? "y" : "x";
      const ownSize = axis === "x" ? "width" : "height";
      const otherSize = axis === "x" ? "height" : "width";
      const coordinate = (other[axis] + other[ownSize] / 2 - own[axis] - own[ownSize] / 2)
        / Math.max(GEOMETRY_EPSILON, Math.abs(other[otherAxis] + other[otherSize] / 2 - own[otherAxis] - own[otherSize] / 2));
      const pairedId = sidePortRequest(otherId, occurrences.find(o => o.connectorId === edge.id)!.id,
        request.endpoint === "source" ? "target" : "source");
      const sameSideReturn = request.endpoint === "target" && assignments.get(pairedId)?.side === group.side;
      const source = positioned.get(edge.from.itemId)!, target = positioned.get(edge.to.itemId)!;
      const dx = target.x + target.width / 2 - source.x - source.width / 2;
      const dy = target.y + target.height / 2 - source.y - source.height / 2;
      const backwards = Math.abs(dx) >= Math.abs(dy) ? dx < 0 : dy < 0;
      const reverse = sameSideReturn !== (reverseReturnPorts && request.endpoint === "target" && backwards);
      return reverse ? -coordinate : coordinate;
    };
    group.requestIds.sort((a, b) => peerCoordinate(a) - peerCoordinate(b));
    const allocation = allocationFor(group.node, group.side, group.requestIds);
    if (allocation.status === "allocated") group.offsets = allocation.offsets;
  }

  const allocatedLoopPorts = new Map<string, Map<string, number>>();
  if (loopPolicy) for (const occurrence of occurrences.filter(record => record.from === record.to)) {
    const sourceId = sidePortRequest(occurrence.from, occurrence.id, "source");
    const targetId = sidePortRequest(occurrence.to, occurrence.id, "target");
    const source = assignments.get(sourceId), target = assignments.get(targetId);
    if (!source || !target) continue;
    const group = groups.get(`${source.nodeId}\0${source.side}`)!;
    const trial = loopPolicy.side_trials.find(candidate => candidate.side === source.side);
    const ordinaryIds = group.requestIds.filter(id => {
      const request = assignments.get(id)!;
      const edge = edgeById.get(request.edgeId)!;
      return edge.from.itemId !== edge.to.itemId;
    });
    const groupKey = `${source.nodeId}\0${source.side}`;
    const priorPairs = allocatedLoopPorts.get(groupKey) ?? new Map<string, number>();
    const ordinaryAllocation = allocationFor(group.node, group.side, ordinaryIds);
    if (!trial || ordinaryAllocation.status !== "allocated") {
      diagnostics.push(issue("renderer.routing.ia_loop_port_capacity", "Loaded loop side has no legal ordinary reservation allocation.", occurrence.connectorId));
      continue;
    }
    const pair = allocateOrderedPortPair({ sideLength: sideLength(group.node, group.side),
      minInset: getNodePrimitiveTheme(theme, group.node.primitive).portInset,
      minSeparation: readablePortPitch(theme.paint.arrowSize, theme.paint.edgeStrokeWidth),
      direction: loopPolicy.traversal.direction, placement: trial.pair_placement,
      occupiedOffsets: [...ordinaryAllocation.offsets.values(), ...priorPairs.values(), ...reserveForSide(group.node, group.side, usedStructuralPorts.get(group.node.id) ?? new Set())],
      otherArrivalOffsets: ordinaryIds.filter(id => assignments.get(id)?.endpoint === "target").map(id => ordinaryAllocation.offsets.get(id)!) });
    if (!pair) {
      diagnostics.push(issue("renderer.routing.ia_loop_port_capacity", "Loaded ordered loop pair does not fit the reserved side interval.", occurrence.connectorId));
      continue;
    }
    priorPairs.set(sourceId, pair.departure);
    priorPairs.set(targetId, pair.arrival);
    allocatedLoopPorts.set(groupKey, priorPairs);
    group.offsets = new Map([...ordinaryAllocation.offsets, ...priorPairs]);
  }
  if (diagnostics.length) return { measured, diagnostics };

  // Reconcile facing attachments against both legal spans before introducing bends.
  // A group retains its symmetric pitch; only unreserved singleton pairs may move.
  for (const occurrence of occurrences) {
    if (forcedPairs?.has(occurrence.connectorId)) continue;
    const sourceId = sidePortRequest(occurrence.from, occurrence.id, "source");
    const targetId = sidePortRequest(occurrence.to, occurrence.id, "target");
    const source = assignments.get(sourceId), target = assignments.get(targetId);
    if (!source || !target) continue;
    const a = groups.get(`${source.nodeId}\0${source.side}`)!, b = groups.get(`${target.nodeId}\0${target.side}`)!;
    const facing = source.side === "east" && target.side === "west" || source.side === "west" && target.side === "east"
      || source.side === "north" && target.side === "south" || source.side === "south" && target.side === "north";
    if (!facing || a.requestIds.length !== 1 && b.requestIds.length !== 1) continue;
    const ap = positioned.get(a.node.id)!, bp = positioned.get(b.node.id)!;
    const horizontal = source.side === "east" || source.side === "west";
    const axis = horizontal ? "y" : "x", size = horizontal ? "height" : "width";
    const insetA = getNodePrimitiveTheme(theme, a.node.primitive).portInset;
    const insetB = getNodePrimitiveTheme(theme, b.node.primitive).portInset;
    const coordinate = resolveFacingSideSharedCoordinate({
      sourceSpan: a.requestIds.length > 1 ? { min: ap[axis] + a.offsets.get(sourceId)!, max: ap[axis] + a.offsets.get(sourceId)! }
        : { min: ap[axis] + insetA, max: ap[axis] + ap[size] - insetA },
      targetSpan: b.requestIds.length > 1 ? { min: bp[axis] + b.offsets.get(targetId)!, max: bp[axis] + b.offsets.get(targetId)! }
        : { min: bp[axis] + insetB, max: bp[axis] + bp[size] - insetB },
      sourceCenter: ap[axis] + ap[size] / 2, targetCenter: bp[axis] + bp[size] / 2
    });
    if (coordinate === undefined) continue;
    if (reserveForSide(a.node, a.side, usedStructuralPorts.get(a.node.id) ?? new Set()).some(offset =>
      Math.abs(ap[axis] + offset - coordinate) < DEFAULT_ROUTING_POLICY.minSeparation - GEOMETRY_EPSILON)
      || reserveForSide(b.node, b.side, usedStructuralPorts.get(b.node.id) ?? new Set()).some(offset =>
        Math.abs(bp[axis] + offset - coordinate) < DEFAULT_ROUTING_POLICY.minSeparation - GEOMETRY_EPSILON)) continue;
    a.offsets = new Map([...a.offsets, [sourceId, coordinate - ap[axis]]]);
    b.offsets = new Map([...b.offsets, [targetId, coordinate - bp[axis]]]);
  }

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
      : { ...child, ports: [...child.ports.filter(port => !(portsByNode.get(child.id) ?? []).some(replacement => replacement.id === port.id)), ...(portsByNode.get(child.id) ?? [])] })
  });
  const rewrittenEdges = measured.edges.map(edge => {
    const source = [...assignments.values()].find(request => request.edgeId === edge.id && request.endpoint === "source");
    const target = [...assignments.values()].find(request => request.edgeId === edge.id && request.endpoint === "target");
    return { ...edge,
      from: source ? { ...edge.from, portId: source.id } : { ...edge.from },
      to: target ? { ...edge.to, portId: target.id } : { ...edge.to }
    };
  });
  const portGroups = [...groups.values()].map(group => {
    const offsets = group.requestIds.map(id => group.offsets.get(id)!);
    return { nodeId: group.node.id, side: group.side, requestIds: [...group.requestIds], offsets,
      reservedOffsets: reserveForSide(group.node, group.side, usedStructuralPorts.get(group.node.id) ?? new Set()),
      displacementFromCenter: (offsets[0]! + offsets.at(-1)!) / 2 - sideLength(group.node, group.side) / 2 };
  });
  return { measured: { ...measured, root: rewriteItems(measured.root), edges: rewrittenEdges }, diagnostics, portGroups,
    portDisplacement: portGroups.reduce((sum, group) => sum + Math.abs(group.displacementFromCenter), 0) };
}

type PortOffsetAllocationResult = ReturnType<typeof allocatePortOffsets>;

function collectRoutingGeometry(scene: PositionedScene): { boxes: RoutingBox[]; blockers: RoutingBox[] } {
  const boxes: RoutingBox[] = [];
  const blockers: RoutingBox[] = [];
  const scoped = inventoryFromScene(scene)?.routingScope;
  const clearance = scoped ? readableRoutingClearance(getRendererTheme(scene.themeId, "routing").paint.edgeStrokeWidth)
    : getRendererTheme(scene.themeId, "routing").paint.edgeStrokeWidth / 2 + DEFAULT_ROUTING_POLICY.epsilon;
  const visit = (item: PositionedItem): void => {
    if (item.kind === "node") {
      boxes.push({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height, clearance });
      return;
    }
    if (item.chrome.headerBandHeight && item.chrome.headerBandHeight > 0) blockers.push({
      id: `${item.id}:header-band`, x: item.x, y: item.y, width: item.width, height: item.chrome.headerBandHeight,
      ...(scoped ? { clearance } : {})
    });
    for (const block of item.headerContent) blockers.push({ id: block.id,
      x: item.x + block.x, y: item.y + block.y, width: block.width, height: block.height,
      ...(scoped ? { clearance } : {}) });
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
  const clearance = readableRoutingClearance(theme.paint.edgeStrokeWidth);
  const navigationOrder = new Map(sortBySourceOrder(inventory).map(item => [item.connectorId, item.sourceOrder]));
  const structuralOrder = new Map(inventory.expectedStructuralEdges.map((item, index) => [item.id, index]));
  const sharedBySegmentKey = buildStructuralSharing(scene, inventory);
  const scopeIds = new Set(inventory.routingScope?.containerIds ?? []);
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
    const owner = commonLabelOwner(scene, edge);
    connectors.push({ id: edge.id, route: edge.route,
      source: { point: { x: edge.from.x, y: edge.from.y }, side: source.port.side, nodeId: source.node.id,
        minLeg: markerRoutingClearance(edge.markers?.start, theme.paint.arrowSize, theme.paint.edgeStrokeWidth) },
      target: { point: { x: edge.to.x, y: edge.to.y }, side: target.port.side, nodeId: target.node.id,
        minLeg: markerRoutingClearance(edge.markers?.end, theme.paint.arrowSize, theme.paint.edgeStrokeWidth) },
      priority: navigationOrder.get(edge.id) ?? (1_000_000 + (structuralOrder.get(edge.id) ?? index)),
      ...(inventory.routingScope && owner.id !== scene.root.id ? { routingBounds: {
        ownerId: owner.id, minX: owner.x + clearance,
        minY: owner.y + (owner.chrome.headerBandHeight ?? 0) + clearance,
        maxX: owner.x + owner.width - clearance,
        maxY: owner.y + owner.height - clearance
      } } : {}),
      ...(sharedTrackGroupBySegmentIndex.size ? { sharedTrackGroupBySegmentIndex } : {})
    });
  }
  if (diagnostics.length) return { diagnostics };
  if (inventory.routingScope) {
    const lineages = ownerLineages(scene.root, scene.edges.flatMap(edge => [edge.from.itemId, edge.to.itemId]));
    for (const id of scopeIds) {
      const container = itemIndex.get(id);
      if (container?.kind !== "container") continue;
      const unrelated = connectors.filter(connector => ![connector.source.nodeId, connector.target.nodeId].some(nodeId =>
        lineages.get(nodeId)?.some(entry => entry.container.id === id))).map(connector => connector.id);
      if (unrelated.length) blockers.push({ id: `${id}:unrelated-interior`, x: container.x, y: container.y,
        width: container.width, height: container.height, clearance,
        appliesToConnectorIds: unrelated });
      for (const x of [container.x, container.x + container.width]) blockers.push({ id: `${id}:border-x:${x}`,
        x, y: container.y, width: 0, height: container.height, clearance,
        blocksAxis: "vertical" });
      for (const y of [container.y, container.y + container.height]) blockers.push({ id: `${id}:border-y:${y}`,
        x: container.x, y, width: container.width, height: 0, clearance,
        blocksAxis: "horizontal" });
    }
  }
  const exportInset = inventory.exportClearance === "readable_gap" ? clearance : theme.paint.edgeStrokeWidth / 2;
  return { context: {
    connectors, boxes, corridorSearch: "obstacle_aware", blockers: [...blockers, ...buildEndpointMarkerRoutingBlockers(connectors,
      new Map(scene.edges.map(edge => [edge.id, edge.markers])), theme.paint.arrowSize, theme.paint.edgeStrokeWidth)
      .map(blocker => {
        if (!inventory.routingScope) return blocker;
        const connector = connectors.find(connector => blocker.id.startsWith(`${connector.id}:`));
        const shared = connector?.sharedTrackGroupBySegmentIndex?.get(0);
        return { ...blocker, clearance: Math.max(blocker.clearance ?? 0, clearance),
          ...(shared ? { exemptSharedTrackGroupIds: [shared] } : {}) };
      })],
    bounds: { minX: scene.root.x + exportInset, minY: scene.root.y + exportInset,
      maxX: scene.root.x + scene.root.width - exportInset,
      maxY: scene.root.y + scene.root.height - exportInset }
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
      // A valid direct attachment has no transverse track to pack into this
      // channel. Its incident leg already owns both endpoint exceptions.
      if (connector.route.points.length === 2 && !validateFinalRouteSet({ ...context, connectors: [connector] }).length) continue;
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
        margin = Math.max(margin, endpoint.minLeg, context.boxes.find(box => box.id === node.id)?.clearance ?? 0);
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
  const claims = connectorLabelCapacityClaims(buildLabelInput(scene, expectedLabels), assessment, corridors);
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
    const scope = inventoryFromScene(scene)?.routingScope;
    const area = [...(lineages.get(endpoint.itemId) ?? [])].reverse().find(entry => scope
      ? scope.containerIds.includes(entry.container.id) : entry.container.role === "area")?.container;
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
      connectorIds: [...ids], margin: inventoryFromScene(scene)?.routingScope
        ? readableRoutingClearance(getRendererTheme(scene.themeId, "routing").paint.edgeStrokeWidth) : DEFAULT_ROUTING_POLICY.minTerminalLeg };
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
  const selected = inventoryFromScene(scene)?.routingScope;
  const owns = (container: PositionedContainer): boolean => selected
    ? selected.containerIds.includes(container.id) : container.role === "area";
  const targetAreas = new Set((lineages.get(edge.to.itemId) ?? [])
    .filter(entry => owns(entry.container)).map(entry => entry.container.id));
  return [...(lineages.get(edge.from.itemId) ?? [])].reverse()
    .find(entry => owns(entry.container) && targetAreas.has(entry.container.id))?.container ?? scene.root;
}

/** A gutter's vertical label overflow is owned by its endpoint containers.
 * Root padding would move the gutter and the nodes together without enlarging
 * the label's available distance above its attachment. */
function labelScopePaddingDemands(scene: PositionedScene,
  expectedLabels: ConnectorLabelLayoutInput["expectedLabels"],
  assessment: ReturnType<typeof assessConnectorLabels>): Map<string, number> {
  const demands = new Map<string, number>();
  const selected = inventoryFromScene(scene)?.routingScope;
  if (!selected) return demands;
  for (const request of measureConnectorLabelScopeDeficits(buildLabelInput(scene, expectedLabels), assessment)) {
    const edge = scene.edges.find(edge => edge.id === request.connectorId)!;
    const owner = commonLabelOwner(scene, edge);
    // Horizontal cross-owner deficits belong to the sibling gutter; an internal
    // label's exact overflow belongs to its own container's corresponding side.
    if (owner.id === scene.root.id && request.side !== "top" && request.side !== "bottom") continue;
    const owners = owner.id !== scene.root.id ? [owner] : [edge.from.itemId, edge.to.itemId].flatMap(id => {
      const lineage = ownerLineages(scene.root, [id]).get(id) ?? [];
      const container = [...lineage].reverse().find(entry => selected.containerIds.includes(entry.container.id))?.container;
      return container ? [container] : [];
    });
    for (const container of owners) {
      const key = `${container.id}\0${request.side}`;
      demands.set(key, Math.max(demands.get(key) ?? 0, request.deficit));
    }
  }
  return demands;
}

/** Preserve the selected gutter anchor when its full envelope exceeds the
 * movable right boundary. Nominal text width alone misses a vertical rail's offset. */
function labelScopeGapDemands(scene: PositionedScene,
  expectedLabels: ConnectorLabelLayoutInput["expectedLabels"], assessment: ReturnType<typeof assessConnectorLabels>): Map<GapKey, number> {
  const demands = new Map<GapKey, number>();
  const input = buildLabelInput(scene, expectedLabels);
  const corridors = siblingGapCorridors(scene);
  for (const request of measureConnectorLabelScopeDeficits(input, assessment)) {
    if (request.side !== "right") continue;
    const edge = scene.edges.find(edge => edge.id === request.connectorId)!;
    const owner = commonLabelOwner(scene, edge);
    const scope = input.scopeByConnectorId!.get(edge.id)!;
    const corridor = corridors.find(corridor => corridor.axis === "x" && corridor.containerId === owner.id
      && corridor.connectorIds.includes(edge.id) && Math.abs(corridor.bounds.x - scope.x) <= GEOMETRY_EPSILON
      && Math.abs(corridor.bounds.width - scope.width) <= GEOMETRY_EPSILON);
    if (corridor) demands.set(corridor.key, Math.max(demands.get(corridor.key) ?? 0, request.deficit));
  }
  return demands;
}

/** Compare a gutter row with constrained header or exterior tracks. Residual
 * clearance belongs to the selected endpoint owner's top or bottom padding. */
function labelRelativeOwnerPaddingDemands(scene: PositionedScene, context: FinalRoutingContext,
  expectedLabels: ConnectorLabelLayoutInput["expectedLabels"], assessment: ReturnType<typeof assessConnectorLabels>): Map<string, number> {
  const demands = new Map<string, number>();
  const selected = inventoryFromScene(scene)?.routingScope;
  if (!selected) return demands;
  const indexed = indexPositionedItems(scene.root);
  const ownerFor = (id: string): PositionedContainer | undefined => [...(ownerLineages(scene.root, [id]).get(id) ?? [])]
    .reverse().find(entry => selected.containerIds.includes(entry.container.id))?.container;
  const firstY = (item: PositionedItem): number => item.kind === "node" ? item.y : Math.min(...item.children.map(firstY));
  const clearance = readableRoutingClearance(getRendererTheme(scene.themeId, "routing").paint.edgeStrokeWidth);
  const constrained = new Map<string, ReturnType<typeof buildRouteSegmentDetails>>();
  const exteriorOwners = new Map<string, PositionedContainer>();
  for (const connector of context.connectors) {
    const sourceOwner = ownerFor(connector.source.nodeId), targetOwner = ownerFor(connector.target.nodeId);
    if (!sourceOwner || !targetOwner || sourceOwner.id === targetOwner.id) continue;
    if (connector.source.side === "south" && connector.target.side === "south") {
      const owner = sourceOwner.y + sourceOwner.height >= targetOwner.y + targetOwner.height ? sourceOwner : targetOwner;
      const y = owner.y + owner.height + clearance;
      const runs = buildRouteSegmentDetails(connector.route).filter(segment => segment.orientation === "horizontal"
        && segment.coordinate >= y - GEOMETRY_EPSILON);
      if (runs.length) {
        // This selected exterior topology follows the deepest owner's lower
        // boundary. Grow that owner by the independently measured label gap;
        // the baseline reflow also grows the ancestor/export envelope.
        constrained.set(connector.id, runs.map(segment => ({ ...segment, coordinate: y,
          start: { ...segment.start, y }, end: { ...segment.end, y } })));
        exteriorOwners.set(connector.id, owner);
      }
      continue;
    }
    if (connector.source.side !== "north" || connector.target.side !== "north"
      || Math.abs(indexed.get(connector.source.nodeId)!.y - firstY(sourceOwner)) > GEOMETRY_EPSILON
      || Math.abs(indexed.get(connector.target.nodeId)!.y - firstY(targetOwner)) > GEOMETRY_EPSILON) continue;
    const y = Math.max(...[sourceOwner, targetOwner].map(owner => owner.y + (owner.chrome.headerBandHeight ?? 0) + clearance));
    constrained.set(connector.id, buildRouteSegmentDetails({ style: "orthogonal", points: [
      { x: connector.source.point.x, y }, { x: connector.target.point.x, y }
    ] }));
  }
  for (const request of measureConnectorLabelRelativeClearanceDeficits(buildLabelInput(scene, expectedLabels), assessment, constrained)) {
    if (request.axis !== "y") continue;
    const exteriorOwner = exteriorOwners.get(request.otherConnectorId);
    if (request.direction === -1 && exteriorOwner) {
      const key = `${exteriorOwner.id}\0bottom`;
      demands.set(key, Math.max(demands.get(key) ?? 0, request.deficit));
      continue;
    }
    if (request.direction !== 1 || exteriorOwner) continue;
    const edge = scene.edges.find(edge => edge.id === request.connectorId)!;
    const source = portByEndpoint(scene, edge.from.itemId, edge.from.portId)!;
    const target = portByEndpoint(scene, edge.to.itemId, edge.to.portId)!;
    if (!(source.port.side === "east" && target.port.side === "west"
      || source.port.side === "west" && target.port.side === "east")) continue;
    for (const id of [edge.from.itemId, edge.to.itemId]) {
      const owner = ownerFor(id);
      if (!owner) continue;
      const key = `${owner.id}\0top`;
      demands.set(key, Math.max(demands.get(key) ?? 0, request.deficit));
    }
  }
  return demands;
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
    const routeMargin = inventoryFromScene(scene)?.routingScope
      ? readableRoutingClearance(getRendererTheme(scene.themeId, "routing").paint.edgeStrokeWidth) : DEFAULT_ROUTING_POLICY.minTerminalLeg;
    const scopeMargin = inventoryFromScene(scene)?.routingScope ? READABLE_ROUTING_GEOMETRY.clearance : DEFAULT_ROUTING_POLICY.minTerminalLeg;
    const margin = (routeMargin + scopeMargin) / 2;
    // Reserve the actual selected rail, including any displacement imposed by
    // a competing route. Nominal label width loses this offset and forces an
    // unnecessary second expansion after the same anchor is selected again.
    const box = assessment.labels.get(edge.id)!;
    const spanStart = vertical ? box.y : box.x, spanEnd = spanStart + (vertical ? box.height : box.width);
    const ownerNodeIds = new Set(ownerNodes.map(node => node.id));
    const competing = scene.edges.filter(other => other.id !== edge.id).flatMap(other => buildRouteSegmentDetails(other.route)
      .filter(segment => segment.orientation === anchor.orientation
        && (segment.coordinate >= low - GEOMETRY_EPSILON && segment.coordinate <= high + GEOMETRY_EPSILON
          // An incident cross-owner return may currently run just outside this
          // border. Its parallel rail and terminal turn still compete with the
          // internal label carrier; reserve their joint capacity before reflow.
          || owner.id !== scene.root.id && commonLabelOwner(scene, other).id === scene.root.id
            && (ownerNodeIds.has(other.from.itemId) || ownerNodeIds.has(other.to.itemId))
            && Math.abs(segment.coordinate - (farSide ? high + routeMargin : low - routeMargin)) <= GEOMETRY_EPSILON)
        && Math.min(vertical ? segment.end.y : segment.end.x, vertical ? segment.start.y : segment.start.x) < spanEnd
        && Math.max(vertical ? segment.end.y : segment.end.x, vertical ? segment.start.y : segment.start.x) > spanStart)
      .map(segment => ({ other, segment })));
    // A competing rail and its terminal turn occupy one physical flank. Its
    // parallel run certifies a lateral packing remedy even when the nearby turn
    // also crowds the label. A transverse-only rival supplies no such claim.
    if (assessment.problems.some(problem => problem.connectorId === edge.id
      && problem.kind !== "bounds" && problem.kind !== "header"
      && (!(problem.kind === "connector" || problem.kind === "ambiguous")
        || !competing.some(({ other }) => other.id === problem.obstacleId)))) continue;
    const rivalTracks = new Set(competing.map(({ segment }) => segment.coordinate)).size;
    const railOffset = Math.max(0, (farSide ? anchor.coordinate - highContent : lowContent - anchor.coordinate)
      - routeMargin - rivalTracks * DEFAULT_ROUTING_POLICY.minSeparation);
    corridors.push({ owner: key, axis,
      bounds: vertical ? { x: low, y: owner.y, width: high - low, height: owner.height }
        : { x: owner.x, y: low, width: owner.width, height: high - low },
      connectorIds: [edge.id], margin });
    claims.push({ owner: key, connectorId: `rail:${anchor.coordinate}`, priority,
      spanStart, spanEnd,
      thickness: (vertical ? label.width : label.height) + FIXED_LABEL_DISTANCE + railOffset });
    for (const rail of coalesceConnectorLabelPhysicalRails(competing.map(({ segment }) => ({ coordinate: segment.coordinate,
      spanStart: Math.min(vertical ? segment.start.y : segment.start.x, vertical ? segment.end.y : segment.end.x),
      spanEnd: Math.max(vertical ? segment.start.y : segment.start.x, vertical ? segment.end.y : segment.end.x) }))))
      claims.push({ owner: key, connectorId: `rail:${rail.coordinate}`, priority,
        spanStart: rail.spanStart, spanEnd: rail.spanEnd, thickness: 0 });
  }
  return new Map(measureConnectorLabelCapacity(corridors, claims, DEFAULT_ROUTING_POLICY.minSeparation, { mode: "interval_peak" })
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

/** An exterior U corridor must fit between the content and its owner's border. */
function routeOwnerPaddingDemands(scene: PositionedScene, context: FinalRoutingContext): Map<string, number> {
  const demands = new Map<string, number>();
  const indexed = indexPositionedItems(scene.root);
  const clearance = readableRoutingClearance(getRendererTheme(scene.themeId, "routing").paint.edgeStrokeWidth);
  const groups = new Map<string, FinalRoutingConnector[]>();
  for (const connector of context.connectors) {
    if (!connector.routingBounds && inventoryFromScene(scene)?.exportClearance !== "readable_gap") continue;
    const routingOwnerId = connector.routingBounds?.ownerId ?? scene.root.id;
    let side = connector.source.side;
    if (connector.source.side !== connector.target.side) {
      const source = indexed.get(connector.source.nodeId)!, target = indexed.get(connector.target.nodeId)!;
      const verticalReturn = target.y + target.height / 2 < source.y + source.height / 2
        && (side === "north" || side === "south");
      const blockingNodes = context.boxes.filter(box => box.id !== source.id && box.id !== target.id
        && box.y + box.height > target.y + target.height && box.y < source.y
        && source.x + source.width / 2 >= box.x - READABLE_ROUTING_GEOMETRY.clearance
        && source.x + source.width / 2 <= box.x + box.width + READABLE_ROUTING_GEOMETRY.clearance);
      if (!verticalReturn || !blockingNodes.length) continue;
      const owner = indexed.get(routingOwnerId)!;
      side = source.x + source.width / 2 >= owner.x + owner.width / 2 ? "east" : "west";
    }
    const key = `${routingOwnerId}\0${side}`;
    groups.set(key, [...(groups.get(key) ?? []), connector]);
  }
  for (const [key, connectors] of groups) {
    const [id, portSide] = key.split("\0");
    const owner = indexed.get(id!);
    if (owner?.kind !== "container") continue;
    const side = portSide === "east" ? "right" : portSide === "west" ? "left" : portSide === "north" ? "top" : "bottom";
    const horizontal = side === "left" || side === "right";
    const nodes = [...indexed.values()].filter(item => (item.kind === "node")
      && (owner.id === scene.root.id || ownerLineages(scene.root, [item.id]).get(item.id)?.some(entry => entry.container.id === owner.id)));
    const claims = connectors.map(connector => {
      const coordinate = (endpoint: FinalRoutingConnector["source"]): number => {
        const vector = sideVector(endpoint.side);
        const outward = Math.max(endpoint.minLeg, context.boxes.find(box => box.id === endpoint.nodeId)?.clearance ?? 0);
        return horizontal ? endpoint.point.y + vector.y * outward : endpoint.point.x + vector.x * outward;
      };
      const source = coordinate(connector.source), target = coordinate(connector.target);
      return { connectorId: connector.id, spanStart: Math.min(source, target), spanEnd: Math.max(source, target) };
    });
    const deficit = measureExteriorRoutingCorridorDeficit({
      bounds: { minX: owner.x, minY: owner.y + (owner.chrome.headerBandHeight ?? 0),
        maxX: owner.x + owner.width, maxY: owner.y + owner.height },
      side: portSide as PortSide, boxes: nodes, claims, clearance, separation: DEFAULT_ROUTING_POLICY.minSeparation,
      ...(owner.id === scene.root.id ? { parallelBorders: context.blockers?.filter(box => box.blocksAxis === (horizontal ? "vertical" : "horizontal")) } : {})
    });
    if (deficit > GEOMETRY_EPSILON) demands.set(`${owner.id}\0${side}`, deficit);
  }
  if (inventoryFromScene(scene)?.exportClearance === "readable_gap") {
    const exteriorObstacles = [...indexed.values()].filter(item => item.kind === "node");
    for (const [side, amount] of measureEndpointBypassPadding({ context, boundary: scene.root,
      exteriorObstacles, clearance, separation: DEFAULT_ROUTING_POLICY.minSeparation })) {
      const paddingSide = side === "east" ? "right" : side === "west" ? "left" : side === "north" ? "top" : "bottom";
      const key = `${scene.root.id}\0${paddingSide}`;
      demands.set(key, Math.max(demands.get(key) ?? 0, amount));
    }
  }
  return demands;
}

function appendDiagnostics(scene: PositionedScene, diagnostics: readonly RendererDiagnostic[]): PositionedScene {
  return { ...scene, diagnostics: sortRendererDiagnostics([...scene.diagnostics, ...diagnostics]) };
}

function buildLabelInput(scene: PositionedScene, labels: ConnectorLabelLayoutInput["expectedLabels"]): ConnectorLabelLayoutInput {
  return { scene, expectedLabels: labels, rejectAmbiguousAssociation: true, eventBasedHorizontalSearch: true,
    ...(inventoryFromScene(scene)?.routingScope ? { requireAdjacentLabels: true, unrelatedRouteClearance: FIXED_LABEL_CLEARANCE } : {}),
    scopeByConnectorId: new Map(scene.edges.map(edge => {
      const owner = commonLabelOwner(scene, edge);
      const corridor = siblingGapCorridors(scene).find(c => c.axis === "x" && c.connectorIds.includes(edge.id)
        && c.containerId === owner.id);
      const margin = inventoryFromScene(scene)?.routingScope ? READABLE_ROUTING_GEOMETRY.clearance : 0;
      const paintedMargin = owner.id === scene.root.id && inventoryFromScene(scene)?.exportClearance === "readable_gap"
        ? margin + getRendererTheme(scene.themeId, "routing").paint.strokeWidth / 2 : margin;
      return [edge.id, corridor?.bounds ?? { x: owner.x + paintedMargin,
        y: owner.y + (owner.chrome.headerBandHeight ?? 0) + paintedMargin, width: owner.width - 2 * paintedMargin,
        height: owner.height - (owner.chrome.headerBandHeight ?? 0) - 2 * paintedMargin }];
    })) };
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
  if (scene.iaAcceptancePolicy && JSON.stringify(scene.iaAcceptancePolicy) !== JSON.stringify(inventory))
    return [issue("renderer.routing.ia_loaded_policy_lost", "Final IA scene lost or altered its prepared loaded acceptance policy.", scene.root.id)];
  if (!inventory) return [];
  const diagnostics = auditPortAttachments(scene);
  for (const reason of auditIaForwardShortcutScene(scene, {
    buildContext: positioned => { const expected = inventoryFromScene(positioned); return expected ? buildFinalRoutingContext(positioned, expected).context : undefined; },
    ownerId: forwardOwnerId,
    auditOrdinary: positioned => auditIaPlaceMapFinalScene(positioned)
  })) diagnostics.push(issue("renderer.routing.ia_forward_admission", "Final IA shortcut failed independent baseline and attachment acceptance.", scene.root.id, reason));
  if (inventory.exportClearance === "readable_gap") diagnostics.push(...auditPaintedExportClearance(scene));
  const loopPolicy = inventory.routingPreferences?.self_loop;
  if (loopPolicy) for (const occurrence of inventory.expectedNavigationOccurrences.filter(record => record.from === record.to)) {
    const edge = scene.edges.find(candidate => candidate.id === occurrence.connectorId);
    const source = edge && portByEndpoint(scene, edge.from.itemId, edge.from.portId);
    const target = edge && portByEndpoint(scene, edge.to.itemId, edge.to.portId);
    const axis = loopPolicy.traversal.axis;
    if (!source || !target || source.port.side !== target.port.side
      || !loopPolicy.side_trials.some(trial => trial.side === source.port.side)
      || !orderedPortPairHasTraversal(source.port[axis], target.port[axis], loopPolicy.traversal.direction, GEOMETRY_EPSILON)) {
      diagnostics.push(issue("renderer.routing.ia_loop_traversal", "Final self-loop violates its loaded side and ordered traversal policy.", occurrence.connectorId));
      continue;
    }
    const sideTrial = loopPolicy.side_trials.find(trial => trial.side === source.port.side)!;
    if (sideTrial.pair_placement === "before_other_arrivals") {
      const pitch = readablePortPitch(getRendererTheme(scene.themeId, "routing").paint.arrowSize,
        getRendererTheme(scene.themeId, "routing").paint.edgeStrokeWidth);
      const arrivalOffsets = scene.edges.filter(candidate => candidate.id !== edge!.id && candidate.to.itemId === occurrence.to)
        .map(candidate => portByEndpoint(scene, candidate.to.itemId, candidate.to.portId))
        .filter(candidate => candidate?.port.side === source.port.side).map(candidate => candidate!.port[axis]);
      if (arrivalOffsets.some(offset => offset - Math.max(source.port[axis], target.port[axis]) < pitch - GEOMETRY_EPSILON))
        diagnostics.push(issue("renderer.routing.ia_loop_arrival_reservation", "Final loop pair violates the loaded ordinary-arrival reservation interval.", occurrence.connectorId));
    }
    const tangentRuns = edge!.route.points.slice(1).map((point, index) => ({
      from: edge!.route.points[index]!, to: point
    })).filter(run => Math.abs(run.to[axis] - run.from[axis]) > GEOMETRY_EPSILON);
    if (!tangentRuns.length || tangentRuns.some(run => !orderedPortPairHasTraversal(run.from[axis], run.to[axis], loopPolicy.traversal.direction, GEOMETRY_EPSILON)))
      diagnostics.push(issue("renderer.routing.ia_loop_rail_traversal", "Final self-loop exterior rail reverses its loaded traversal direction.", occurrence.connectorId));
  }
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
  diagnostics.push(...auditPositionedSceneMarkers(scene, inventory.routingScope && context.context ? {
    unrelatedRouteClearance: readableRoutingClearance(getRendererTheme(scene.themeId, "routing").paint.edgeStrokeWidth),
    obstacleClearance: READABLE_ROUTING_GEOMETRY.clearance,
    scopeByConnectorId: new Map(context.context.connectors.flatMap(connector => connector.routingBounds ? [[connector.id, {
      x: connector.routingBounds.minX, y: connector.routingBounds.minY,
      width: connector.routingBounds.maxX - connector.routingBounds.minX,
      height: connector.routingBounds.maxY - connector.routingBounds.minY
    }] as const] : [])),
    sharedTrackGroupBySegmentIndexByConnectorId: new Map(context.context.connectors.flatMap(connector =>
      connector.sharedTrackGroupBySegmentIndex ? [[connector.id, connector.sharedTrackGroupBySegmentIndex] as const] : [])),
    markerSharingGroupByConnectorId: new Map(context.context.connectors.flatMap(connector =>
      connector.sharedTrackGroupBySegmentIndex?.get(0) ? [[connector.id, connector.sharedTrackGroupBySegmentIndex.get(0)!] as const] : []))
  } : undefined));
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
type IaSolveAllowance = { candidates: number; repairs: number; expansions: number };

function forwardOwnerId(scene: PositionedScene, nodeId: string): string | undefined {
  const selected = inventoryFromScene(scene)?.routingScope?.containerIds;
  return [...(ownerLineages(scene.root, [nodeId]).get(nodeId) ?? [])].reverse()
    .find(entry => selected?.includes(entry.container.id))?.container.id;
}

function measureIaPortDisplacement(scene: PositionedScene, movableSourceIds: ReadonlySet<string> = new Set()): number {
  const inventory = inventoryFromScene(scene);
  if (!inventory) return 0;
  const nodeIndex = indexPositionedItems(scene.root);
  const structuralIds = new Set(inventory.expectedStructuralEdges.map(edge => edge.id));
  const groups = new Map<string, { offsets: number[]; length: number }>();
  let individual = 0;
  for (const edge of scene.edges) {
    if (structuralIds.has(edge.id)) continue;
    for (const [role, endpoint] of [["source", edge.from], ["target", edge.to]] as const) {
      const node = nodeIndex.get(endpoint.itemId), port = node?.ports.find(port => port.id === endpoint.portId);
      if (node?.kind !== "node" || !port) continue;
      const length = sideLength(node, port.side), offset = endpointOffset(port);
      if (role === "source" && movableSourceIds.has(edge.id)) { individual += Math.abs(offset - length / 2); continue; }
      const key = `${node.id}\0${port.side}`, group = groups.get(key) ?? { offsets: [], length };
      group.offsets.push(offset); groups.set(key, group);
    }
  }
  return individual + [...groups.values()].reduce((sum, group) => sum
    + Math.abs((Math.min(...group.offsets) + Math.max(...group.offsets)) / 2 - group.length / 2), 0);
}

function forwardCallbacks(): IaForwardShortcutCallbacks {
  return {
    buildContext: positioned => { const inventory = inventoryFromScene(positioned); return inventory ? buildFinalRoutingContext(positioned, inventory).context : undefined; },
    audit: auditIaPlaceMapFinalScene,
    ownerId: forwardOwnerId,
    portDisplacement: measureIaPortDisplacement,
    assessLabels: (positioned, budget) => {
      const inventory = inventoryFromScene(positioned);
      if (!inventory) return undefined;
      const expected = expectedLabelMapFromFinalScene(positioned, inventory);
      const assessment = assessConnectorLabels({ ...buildLabelInput(positioned, expected), searchBudget: budget });
      if (assessment.problems.length) return undefined;
      return { ...positioned, edges: positioned.edges.map(edge => ({ ...edge, label: assessment.labels.get(edge.id) ?? edge.label })) };
    },
    prepareTrial: async (result, pairs, budget) => {
      const inventory = inventoryFromScene(result.positionedScene);
      if (!inventory) return undefined;
      const retainedPairs = new Map(result.positionedScene.edges.flatMap(edge => {
        const source = portByEndpoint(result.positionedScene, edge.from.itemId, edge.from.portId);
        const target = portByEndpoint(result.positionedScene, edge.to.itemId, edge.to.portId);
        return source && target ? [[edge.id, [source.port.side, target.port.side] as const] as const] : [];
      }));
      for (const [id, pair] of pairs) retainedPairs.set(id, pair);
      const allocation = allocateOccurrencePorts(result.measuredScene, result.positionedScene, inventory,
        undefined, budget, false, undefined, undefined, undefined, retainedPairs, new Set(pairs.keys()));
      if (allocation.diagnostics.length) return undefined;
      // Groups whose ordinary membership is unchanged retain the accepted
      // baseline reservations and facing reconciliation. Newly affected groups
      // use the ordinary allocator; movable sources are excluded from both.
      const movablePorts = new Set(result.positionedScene.edges.filter(edge => pairs.has(edge.id)).map(edge => edge.from.portId));
      const oldItems = indexPositionedItems(result.positionedScene.root);
      for (const [id, node] of indexMeasuredNodes(allocation.measured.root)) {
        const old = oldItems.get(id);
        if (old?.kind !== "node") continue;
        for (const side of ["north", "east", "south", "west"] as const) {
          const oldPorts = old.ports.filter(port => port.side === side && !movablePorts.has(port.id));
          const newPorts = node.ports.filter(port => port.side === side && !movablePorts.has(port.id));
          if (JSON.stringify(oldPorts.map(port => port.id).sort()) !== JSON.stringify(newPorts.map(port => port.id).sort())) continue;
          for (const port of newPorts) Object.assign(port, oldPorts.find(previous => previous.id === port.id)!);
        }
      }
      const positioned = positionMeasuredEdgesAgainstRoot(allocation.measured, await positionSceneBeforeRouting(allocation.measured));
      return { ...positioned, iaAcceptancePolicy: result.positionedScene.iaAcceptancePolicy,
        edges: positioned.edges.map(edge => {
          const old = result.positionedScene.edges.find(candidate => candidate.id === edge.id)!;
          return !pairs.has(edge.id) && Math.abs(edge.from.x - old.from.x) < GEOMETRY_EPSILON
            && Math.abs(edge.from.y - old.from.y) < GEOMETRY_EPSILON && Math.abs(edge.to.x - old.to.x) < GEOMETRY_EPSILON
            && Math.abs(edge.to.y - old.to.y) < GEOMETRY_EPSILON ? { ...edge, route: old.route, label: old.label } : edge;
        }) };
    }
  };
}

export async function runIaPlaceMapRendererPipeline(scene: RendererScene): Promise<StagedRendererPipelineResult> {
  const inventory = inventoryFromScene(scene);
  if (!inventory) return runStagedRendererPipeline(scene);
  const policy = inventory.routingPreferences?.self_loop;
  const allowance: IaSolveAllowance = { candidates: DEFAULT_FINAL_ROUTING_LIMITS.maxCandidates,
    repairs: DEFAULT_FINAL_ROUTING_LIMITS.maxRepairRevisions, expansions: DEFAULT_ROUTING_POLICY.maxExpansionPasses };
  const forwardPolicy = inventory.routingPreferences?.forward_shortcut;
  let hasForwardGeometry = false;
  if (forwardPolicy) {
    const preliminary = await positionSceneBeforeRouting(measureScene(scene));
    const items = indexPositionedItems(preliminary.root);
    const structural = new Set(inventory.expectedStructuralEdges.map(edge => edge.id));
    hasForwardGeometry = inventory.expectedNavigationOccurrences.some(occurrence => {
      if (occurrence.from === occurrence.to || structural.has(occurrence.connectorId)
        || forwardOwnerId(preliminary, occurrence.from) !== forwardOwnerId(preliminary, occurrence.to)) return false;
      const source = items.get(occurrence.from), target = items.get(occurrence.to);
      if (!source || !target) return false;
      const axis = forwardPolicy.progression.axis, size = axis === "x" ? "width" : "height";
      return forwardPolicy.progression.direction === "positive"
        ? target[axis] + target[size] / 2 > source[axis] + source[size] / 2
        : target[axis] + target[size] / 2 < source[axis] + source[size] / 2;
    });
  }
  const forwardReserve = hasForwardGeometry ? 512 : 0;
  allowance.candidates -= forwardReserve;
  const finishForward = async (result: StagedRendererPipelineResult): Promise<StagedRendererPipelineResult> => {
    allowance.candidates += forwardReserve;
    const optimized = await finalizeIaForwardShortcuts(result, allowance, forwardCallbacks());
    return { ...optimized, positionedScene: { ...optimized.positionedScene, routingEvidence: {
      candidates: DEFAULT_FINAL_ROUTING_LIMITS.maxCandidates - allowance.candidates,
      repairs: DEFAULT_FINAL_ROUTING_LIMITS.maxRepairRevisions - allowance.repairs,
      expansionPasses: DEFAULT_ROUTING_POLICY.maxExpansionPasses - allowance.expansions,
      remainingCandidates: allowance.candidates, remainingRepairs: allowance.repairs,
      remainingExpansionPasses: allowance.expansions,
      revisions: optimized.positionedScene.routingEvidence?.revisions ?? [] } } };
  };
  if (!policy || !inventory!.expectedNavigationOccurrences.some(record => record.from === record.to))
    return finishForward(await runIaPlaceMapRendererTrial(scene, allowance));
  const trials = [...policy.side_trials].sort((a, b) => Number(a.pair_placement === "before_other_arrivals")
    - Number(b.pair_placement === "before_other_arrivals") || a.side.localeCompare(b.side));
  const results: Array<{ result: StagedRendererPipelineResult; side: PortSide; cost: readonly number[]; reasons: RendererDiagnostic[] }> = [];
  const evidence: RendererRoutingRevisionEvidence[] = [];
  for (let index = 0; index < trials.length; index++) {
    const trial = trials[index]!;
    const remainingTrials = trials.length - index;
    const reservedCandidates = Math.min(1024 * (remainingTrials - 1),
      Math.floor(allowance.candidates * (remainingTrials - 1) / remainingTrials));
    const reservedExpansions = Math.min(remainingTrials - 1, allowance.expansions);
    allowance.candidates -= reservedCandidates;
    allowance.expansions -= reservedExpansions;
    let result: StagedRendererPipelineResult;
    try { result = await runIaPlaceMapRendererTrial(scene, allowance, trial.side); }
    finally { allowance.candidates += reservedCandidates; allowance.expansions += reservedExpansions; }
    const reasons = auditIaPlaceMapFinalScene(result.positionedScene);
    const routeContext = buildFinalRoutingContext(result.positionedScene, inventory).context;
    const [crossings, bends, length] = routeContext ? routeCost(routeContext.connectors) : [Infinity, Infinity, Infinity];
    const base = measureScene(scene);
    const expansion = Math.max(0, result.measuredScene.root.width - base.root.width)
      + Math.max(0, result.measuredScene.root.height - base.root.height);
    const displacement = measureIaPortDisplacement(result.positionedScene);
    const cost = [crossings, bends, expansion, displacement, length];
    results.push({ result, side: trial.side, cost, reasons });
    evidence.push(...(result.positionedScene.routingEvidence?.revisions ?? []), { pass: index,
      costs: [[`independent-loop-${trial.side}`, cost]],
      rejected: reasons.map(reason => ({ id: `independent-loop-${trial.side}`, reason: reason.message })),
      remainingCandidates: allowance.candidates, remainingRepairs: allowance.repairs });
  }
  const accepted = results.filter(record => !record.reasons.length
    && !record.result.positionedScene.diagnostics.some(diagnostic => diagnostic.severity === "error"));
  accepted.sort((a, b) => compareRouteCosts(a.cost, b.cost) || a.side.localeCompare(b.side));
  const chosen = accepted[0] ?? results[0]!;
  return finishForward({ ...chosen.result, positionedScene: { ...chosen.result.positionedScene, routingEvidence: {
    candidates: DEFAULT_FINAL_ROUTING_LIMITS.maxCandidates - allowance.candidates,
    repairs: DEFAULT_FINAL_ROUTING_LIMITS.maxRepairRevisions - allowance.repairs, revisions: evidence } } });
}

async function runIaPlaceMapRendererTrial(scene: RendererScene, sharedAllowance?: IaSolveAllowance,
  selectedLoopSide?: PortSide): Promise<StagedRendererPipelineResult> {
  const inventory = inventoryFromScene(scene);
  if (!inventory) return runStagedRendererPipeline(scene);
  const measuredBaseline = measureScene(scene);
  const diagnostics = validateIndependentInventory(scene, measuredBaseline, inventory);
  if (diagnostics.length) {
    const positioned = await positionSceneBeforeRouting(measuredBaseline);
    return { rendererScene: scene, measuredScene: measuredBaseline,
      positionedScene: appendDiagnostics(positioned, diagnostics) };
  }

  const absoluteGapIncrements = new Map<GapKey, number>();
  const absolutePaddingIncrements = new Map<string, number>();
  const seenRevisions = new Set<string>();
  const expectedLabels = expectedLabelMap(measuredBaseline, inventory);
  const budget = sharedAllowance ?? { candidates: DEFAULT_FINAL_ROUTING_LIMITS.maxCandidates, repairs: DEFAULT_FINAL_ROUTING_LIMITS.maxRepairRevisions,
    expansions: DEFAULT_ROUTING_POLICY.maxExpansionPasses };
  const maximumExpansionPasses = budget.expansions;
  const evidence: RendererRoutingRevisionEvidence[] = [];
  let bestAccepted: { positioned: PositionedScene; measured: MeasuredScene; cost: readonly number[] } | undefined;
  let finalMeasured = measuredBaseline;
  let finalPositioned = positionMeasuredEdgesAgainstRoot(measuredBaseline, await positionSceneBeforeRouting(measuredBaseline));
  const finish = (positioned: PositionedScene, measured: MeasuredScene): StagedRendererPipelineResult => ({
    rendererScene: scene, measuredScene: measured, positionedScene: { ...positioned, iaAcceptancePolicy: structuredClone(inventory), routingEvidence: {
      candidates: DEFAULT_FINAL_ROUTING_LIMITS.maxCandidates - budget.candidates,
      repairs: DEFAULT_FINAL_ROUTING_LIMITS.maxRepairRevisions - budget.repairs, revisions: evidence
    } }
  });
  const finishAccepted = (comparisonLimited = false): StagedRendererPipelineResult => finish(
    appendDiagnostics({ ...bestAccepted!.positioned, diagnostics: bestAccepted!.positioned.diagnostics.filter(diagnostic =>
      diagnostic.code !== "renderer.routing.edge_label_segment_fallback" || !expectedLabels.has(diagnostic.targetId ?? "")) },
    comparisonLimited ? [createRoutingDiagnostic("renderer.routing.ia_quality_comparison_limited",
      "IA routing passed geometry and label acceptance; comparison of further alternatives reached its aggregate limit.", scene.root.id)] : []),
    bestAccepted!.measured);
  for (let pass = 0; pass <= maximumExpansionPasses; pass++) {
    const revisionKey = JSON.stringify([[...absoluteGapIncrements].sort(), [...absolutePaddingIncrements].sort()]);
    if (seenRevisions.has(revisionKey) || budget.candidates <= 0) {
      if (bestAccepted) return finishAccepted(true);
      return finish(appendDiagnostics(finalPositioned, [issue("renderer.routing.ia_joint_budget_exhausted",
        "IA joint routing repeated a state or exhausted its aggregate search budget.", scene.root.id)]), finalMeasured);
    }
    seenRevisions.add(revisionKey);
    const measuredRevision = cloneMeasuredWithGapDemands(measuredBaseline, absoluteGapIncrements, absolutePaddingIncrements);
    const root = await positionSceneBeforeRouting(measuredRevision);
    const seed = positionMeasuredEdgesAgainstRoot(measuredRevision, root);
    if (inventory.routingScope) {
      const minimumGapDemands = new Map<GapKey, number>();
      const corridors = siblingGapCorridors(seed);
      const preflightInput = buildLabelInput(seed, expectedLabels);
      const capacityScopes = new Map(preflightInput.scopeByConnectorId);
      for (const [id, scope] of capacityScopes) {
        const edge = seed.edges.find(edge => edge.id === id)!;
        const owner = commonLabelOwner(seed, edge);
        const corridor = corridors.find(corridor => corridor.axis === "x" && corridor.containerId === owner.id
          && corridor.connectorIds.includes(id));
        if (corridor) capacityScopes.set(id, { ...scope, x: scope.x + corridor.margin,
          width: Math.max(0, scope.width - 2 * corridor.margin) });
      }
      for (const request of measureConnectorLabelMinimumScopeDeficits({ ...preflightInput, scopeByConnectorId: capacityScopes })) {
        if (request.axis !== "x") continue;
        const edge = seed.edges.find(edge => edge.id === request.connectorId)!;
        const owner = commonLabelOwner(seed, edge);
        const corridor = corridors.find(corridor => corridor.axis === "x" && corridor.containerId === owner.id
          && corridor.connectorIds.includes(request.connectorId));
        if (corridor) minimumGapDemands.set(corridor.key, Math.max(minimumGapDemands.get(corridor.key) ?? 0, request.deficit));
      }
      if (minimumGapDemands.size && pass < maximumExpansionPasses) {
        // Preflight the same inner envelope reserved by shared corridor capacity.
        // Reflow its real gutter first; disjoint labels reuse the maximum width.
        // Anchor-specific track and row demands are assessed after routing.
        evidence.push({ pass, expansion: { gaps: [...minimumGapDemands], padding: [] },
          remainingCandidates: budget.candidates, remainingRepairs: budget.repairs });
        mergeDemands(absoluteGapIncrements, minimumGapDemands);
        budget.expansions--;
        continue;
      }
    }
    type Revision = { measured: MeasuredScene; positioned: PositionedScene; context: FinalRoutingContext; id: string;
      portGroups: RendererRoutingPortGroupEvidence[]; portDisplacement: number };
    const revisions: Revision[] = [];
    // Label assessment can spend far more work than route enumeration. Reserve
    // a fair share for each remaining owned-spacing revision and for final
    // selection within this revision; every slice still deducts from one budget.
    const frameAllowance = expectedLabels.size && inventory.routingScope
      ? Math.max(1, Math.floor(budget.candidates / (maximumExpansionPasses - pass + 1))) : budget.candidates;
    let expansionReserve = budget.candidates - frameAllowance;
    const selectionReserve = expectedLabels.size && inventory.routingScope ? Math.floor(frameAllowance / 2) : 0;
    const candidatesBeforePortStrategies = budget.candidates;
    const candidates: Array<{ id: string; context: FinalRoutingContext; requiredExpansion: number; portDisplacement: number }> = [];
    const sceneKey = (context: FinalRoutingContext) => JSON.stringify(context.connectors.map(c => [c.id, c.route.points]).sort(([a], [b]) => String(a).localeCompare(String(b))));
    const labelAssessments = new Map<string, ReturnType<typeof assessConnectorLabels>>();
    const labelProbes = new Map<string, ReturnType<typeof assessConnectorLabels>>();
    const probedCosts: Array<[string, readonly number[]]> = [];
    const allocationDiagnostics: RendererDiagnostic[] = [];
    // Alternate return sides compare coherent complete revisions, never individual
    // edges detached from their competing routes, labels and marker reservations.
    const sides: Array<PortSide | undefined> = inventory.routingScope ? [undefined, "north", "south", "east", "west"] : [undefined];
    const strategies = sides.map(side => ({ side, flank: undefined as PortSide | undefined, loopSide: undefined as PortSide | undefined,
      parallelSide: undefined as PortSide | undefined }));
    if (inventory.routingScope) for (const flank of ["west", "east"] as const)
      strategies.push({ side: undefined, flank, loopSide: undefined, parallelSide: undefined }, { side: flank, flank, loopSide: undefined, parallelSide: undefined });
    // A local loop and a cross-owner return have independent attachment choices.
    // Preserve the existing same-side trials and compare an upper local loop
    // with each remaining return direction under the same aggregate allowance.
    if (inventory.routingScope && inventory.expectedNavigationOccurrences.some(occurrence => occurrence.from === occurrence.to))
      strategies.unshift(...(["south", "east", "west"] as const).map(side => ({ side, flank: undefined, loopSide: "north" as const, parallelSide: undefined })));
    const parallelCounts = new Map<string, number>();
    for (const occurrence of inventory.expectedNavigationOccurrences) if (occurrence.label) {
      const key = JSON.stringify([occurrence.from, occurrence.to]);
      parallelCounts.set(key, (parallelCounts.get(key) ?? 0) + 1);
    }
    if (inventory.routingScope && [...parallelCounts.values()].some(count => count > 2))
      strategies.unshift({ side: "south", flank: undefined, loopSide: undefined, parallelSide: "north" });
    const portStates = new Set<string>();
    for (const { side, flank, loopSide, parallelSide, reverse } of strategies.flatMap(strategy => [{ ...strategy, reverse: false }, { ...strategy, reverse: true }])) {
      if (budget.candidates <= expansionReserve + selectionReserve) break;
      const allocation = allocateOccurrencePorts(measuredRevision, seed, inventory, side, budget, reverse, flank, selectedLoopSide ?? loopSide, parallelSide);
      allocationDiagnostics.push(...allocation.diagnostics);
      if (allocation.diagnostics.length) continue;
      let positioned = positionMeasuredEdgesAgainstRoot(allocation.measured, await positionSceneBeforeRouting(allocation.measured));
      let built = buildFinalRoutingContext(positioned, inventory);
      if (!built.context) { allocationDiagnostics.push(...built.diagnostics); continue; }
      if (inventory.routingScope) {
        const connectors = built.context.connectors.map(connector => {
          if (connector.runConstraints?.size || connector.sharedTrackGroupBySegmentIndex?.size || budget.candidates <= 0) return connector;
          const clearance = built.context!.boxes.find(box => box.id === connector.source.nodeId)?.clearance ?? 0;
          const route = buildPortCorridorSeed(connector, clearance);
          if (!route) return connector;
          budget.candidates--;
          return { ...connector, route };
        });
        positioned = applyFinalRoutes(positioned, { ...built.context, connectors });
        // Marker reservations must describe the same outward seed, including its
        // declared terminal side; an old border-parallel marker is not retained.
        built = buildFinalRoutingContext(positioned, inventory);
        if (!built.context) { allocationDiagnostics.push(...built.diagnostics); continue; }
      }
      const portKey = JSON.stringify(built.context.connectors.map(c => [c.id, c.source, c.target]));
      if (portStates.has(portKey)) continue;
      portStates.add(portKey);
      const revision = { measured: allocation.measured, positioned, context: built.context,
        id: `${side ?? "facing"}${flank ? `-flank-${flank}` : ""}${loopSide ? `-loop-${loopSide}` : ""}${parallelSide ? `-parallel-${parallelSide}` : ""}${reverse ? "-reverse" : ""}`,
        portGroups: allocation.portGroups ?? [], portDisplacement: allocation.portDisplacement ?? 0 };
      revisions.push(revision);
    }
    // Materialize every ordinary attachment strategy before label searches can
    // consume a frame. Direct seeds remain eligible even when a route beam ends.
    expansionReserve = Math.max(0, expansionReserve - (candidatesBeforePortStrategies - budget.candidates));
    for (const [revisionIndex, revision] of revisions.entries()) {
      const positioned = revision.positioned;
      const built = { context: revision.context };
      // The generator's route limit and its label probes consume the same
      // aggregate allowance. Shared stage reservations keep assessment from
      // consuming the remaining connectors' fair share.
      const proposalBudget = budget;
      const proposalAllowance = Math.min(128, Math.max(0, budget.candidates - expansionReserve - selectionReserve));
      const scoreLabels = (context: FinalRoutingContext): readonly number[] => {
        const key = sceneKey(context);
        let labels = labelProbes.get(key);
        if (!labels) {
          const settled = new Set(context.connectors.map(connector => connector.id));
          const parent = labelProbes.get(sceneKey({ ...context, connectors: context.connectors.slice(0, -1) }));
          const partialScene = { ...applyFinalRoutes(positioned, context), edges: positioned.edges.filter(edge => settled.has(edge.id))
            .map(edge => ({ ...edge, route: context.connectors.find(connector => connector.id === edge.id)!.route,
              label: parent?.labels.get(edge.id) ?? edge.label })) };
          const partialLabels = new Map([...expectedLabels].filter(([id]) => settled.has(id)));
          labels = assessConnectorLabels({ ...buildLabelInput(partialScene, partialLabels),
            adjacentProbeOnly: true,
            prospectiveOffsetEvents: context.connectors.length === positioned.edges.length,
            ...(context.connectors.length < positioned.edges.length
              ? { searchConnectorIds: new Set([context.connectors.at(-1)!.id]) } : {}), searchBudget: proposalBudget });
          labelProbes.set(key, labels);
          if (!labels.problems.length) labelAssessments.set(key, labels);
        }
        if (!labels.problems.length && context.connectors.length === positioned.edges.length) {
          const full = applyFinalRoutes(positioned, context);
          const acceptedScene = { ...full, edges: full.edges.map(edge => ({ ...edge, label: labels.labels.get(edge.id) ?? edge.label })) };
          if (!auditIaPlaceMapFinalScene(acceptedScene).length) {
            const [crossings, bends, length] = routeCost(context.connectors);
            const expansion = [...absoluteGapIncrements.values(), ...absolutePaddingIncrements.values()].reduce((a, b) => a + b, 0);
            const cost = [crossings, bends, expansion, revision.portDisplacement, length];
            probedCosts.push([`${revision.id}:accepted-probe-${probedCosts.length}`, cost]);
            if (!bestAccepted || compareRouteCosts(cost, bestAccepted.cost) < 0)
              bestAccepted = { positioned: acceptedScene, measured: revision.measured, cost };
          }
        }
        // Scope and obstacle overlap may have a measured owned capacity remedy;
        // compare topology penalties here and measure those deficits after the
        // full route set is built. Zero is the lower bound of this penalty.
        return [labels.problems.filter(problem => problem.kind !== "bounds" && problem.kind !== "node" && problem.kind !== "header").length,
          labels.problems.length];
      };
      const generate = () => generateRoutingQualityCandidates(revision.context, { maxCandidates: routingEndpointEnvelopeExhausted(revision.context) ? 0 : proposalAllowance,
        beamWidth: 4, maxAlternativesPerConnector: 16, budget: proposalBudget,
        // Apply the same readable-row comparison before every beam truncation;
        // an earlier labelled route must survive until the full scene is solved.
        ...(inventory.routingScope && expectedLabels.size ? { scoreCompleteContext: scoreLabels, scorePartialContext: scoreLabels } : {}),
        fixedConnectorIds: new Set(inventory.expectedStructuralEdges.map(edge => edge.id)) });
      const allowance = Math.max(0, budget.candidates - expansionReserve - selectionReserve);
      const proposed = allowance > 0 ? withRoutingQualityBudgetAllowance(budget, allowance, generate)
        : { candidates: [], evaluatedCandidates: 0, exhausted: true };
      const expansion = [...absoluteGapIncrements.values(), ...absolutePaddingIncrements.values()].reduce((a, b) => a + b, 0);
      const seedCandidates = !proposed.candidates.length || !validateFinalRouteSet(built.context).length
        ? [{ id: "seed", context: built.context }] : [];
      for (const proposal of [...proposed.candidates, ...seedCandidates]) candidates.push({
        id: `${revision.id}:${proposal.id}`, context: proposal.context, requiredExpansion: expansion, portDisplacement: revision.portDisplacement });
    }
    const portsKey = (context: FinalRoutingContext) => JSON.stringify(context.connectors.map(c => [c.id, c.source, c.target]));
    const revisionFor = (context: FinalRoutingContext) => revisions.find(revision => portsKey(revision.context) === portsKey(context))!;
    const accepted = new Map<string, PositionedScene>();
    const rejected: Array<{ revision: Revision; context: FinalRoutingContext; positioned: PositionedScene;
      violations: readonly RoutingViolation[]; labels: ReturnType<typeof assessConnectorLabels>; reasons: RendererDiagnostic[] }> = [];
    const assess = (context: FinalRoutingContext) => {
      const revision = revisionFor(context);
      let positioned = applyFinalRoutes(revision.positioned, context);
      const violations = validateFinalRouteSet(context);
      const probe = labelProbes.get(sceneKey(context));
      const labels = violations.length ? assessConnectorLabels({ ...buildLabelInput(positioned, expectedLabels),
        adjacentProbeOnly: true, searchBudget: budget })
        : labelAssessments.get(sceneKey(context))
          ?? (probe?.problems.every(problem => problem.kind === "bounds" || problem.kind === "header") ? probe : undefined)
          ?? assessConnectorLabels({ ...buildLabelInput(positioned, expectedLabels), searchBudget: budget });
      positioned = { ...positioned, edges: positioned.edges.map(edge => ({ ...edge, label: labels.labels.get(edge.id) ?? edge.label })) };
      return { revision, context, positioned, labels, violations, reasons: auditIaPlaceMapFinalScene(positioned) };
    };
    // Compare admissible complete proposals before spending repair allowance on
    // invalid seeds. Within that class, readable adjacent rows precede known
    // label conflicts; final acceptance still audits the complete scene.
    const proposalRanks = new Map(candidates.map(candidate => {
      const labels = labelProbes.get(sceneKey(candidate.context));
      return [candidate.id, [Number(validateFinalRouteSet(candidate.context).length > 0),
        labels ? labels.problems.filter(problem => problem.kind !== "bounds" && problem.kind !== "node" && problem.kind !== "header").length : Number.MAX_SAFE_INTEGER,
        labels?.problems.length ?? Number.MAX_SAFE_INTEGER, ...routeCost(candidate.context.connectors)]] as const;
    }));
    candidates.sort((a, b) => compareRouteCosts(proposalRanks.get(a.id)!, proposalRanks.get(b.id)!) || a.id.localeCompare(b.id));
    const select = () => selectRoutingQuality(candidates, { maxCandidates: budget.candidates, maxRepairRevisions: budget.repairs,
      budget,
      maxCandidatesPerTrial: 128,
      accept: context => {
        const assessment = assess(context);
        if (assessment.reasons.length) { rejected.push(assessment); return false; }
        accepted.set(sceneKey(context), assessment.positioned);
        return true;
      },
      onRejected: (candidate, reason, violations) => {
        if (reason !== "scene_rejected") rejected.push({ ...assess(candidate.context), violations });
      }
    });
    const selectionAllowance = Math.max(0, budget.candidates - expansionReserve);
    const selected = selectionAllowance > 0 ? withRoutingQualityBudgetAllowance(budget, selectionAllowance, select)
      : { selected: undefined, costs: new Map<string, readonly number[]>(), rejected: [],
        trace: { candidates: 0, validations: 0, repairRevisions: 0, expansionPasses: 0, repeatedStates: 0 } };
    evidence.push({ pass, costs: [...probedCosts, ...selected.costs], rejected: selected.rejected,
      ports: revisions.map(revision => ({ id: revision.id, groups: revision.portGroups })),
      proposalCount: candidates.length, remainingCandidates: budget.candidates, remainingRepairs: budget.repairs });
    if (selected.selected) {
      const revision = revisionFor(selected.selected.context);
      const positioned = accepted.get(sceneKey(selected.selected.context))!;
      const cost = selected.costs.get(selected.selected.id)!;
      if (!bestAccepted || compareRouteCosts(cost, bestAccepted.cost) < 0)
        bestAccepted = { positioned, measured: revision.measured, cost };
      if (bestAccepted.cost[0] === 0) return finishAccepted();
    }
    if (bestAccepted?.cost[0] === 0) return finishAccepted();
    if (bestAccepted && budget.candidates <= 0) return finishAccepted(true);
    if (!rejected.length) {
      if (bestAccepted) return finishAccepted();
      return finish(appendDiagnostics(seed, allocationDiagnostics.length ? allocationDiagnostics : [
        issue("renderer.routing.ia_joint_budget_exhausted", "IA joint selection found no complete revision within its aggregate budget.", scene.root.id)
      ]), measuredRevision);
    }
    const requestsFor = (best: typeof rejected[number]) => {
      const blockedRows = connectorLabelCapacityClaims(buildLabelInput(best.positioned, expectedLabels), best.labels,
        siblingGapCorridors(best.positioned)).filter(claim => claim.thickness === 0 && expectedLabels.has(claim.connectorId)
          && best.labels.problems.some(problem => problem.connectorId === claim.connectorId)).length;
      const routeDemand = routeGapDemands(best.positioned, best.context, best.violations);
      const failedIds = new Set(best.violations.flatMap(violation => violation.connectorIds));
      const endpointDemands = endpointChannelGapDemands(best.positioned, best.context, failedIds);
      for (const [key, amount] of endpointDemands)
        routeDemand.demands.set(key, Math.max(routeDemand.demands.get(key) ?? 0, amount));
      // Capacity is measured against legal route anchors, never a rejected topology.
      if (!best.violations.length) for (const [key, amount] of labelGapDemands(best.positioned, expectedLabels, best.labels))
        routeDemand.demands.set(key, Math.max(routeDemand.demands.get(key) ?? 0, amount));
      if (!best.violations.length) for (const [key, amount] of labelScopeGapDemands(best.positioned, expectedLabels, best.labels))
        routeDemand.demands.set(key, Math.max(routeDemand.demands.get(key) ?? 0, amount));
      const paddingDemands = routeOwnerPaddingDemands(best.positioned, best.context);
      // A label escaping its selected owner must grow that owner, which also
      // grows the coherent root. Charging its same overflow to root padding
      // would reserve the space twice. Root-owned paint alone supplies root
      // demand; the final export audit still checks every painted envelope.
      const rootOwnedEdges = best.positioned.edges.filter(edge => !best.context.connectors.find(connector => connector.id === edge.id)?.routingBounds);
      if (inventory.exportClearance === "readable_gap") for (const [side, amount] of measurePaintedExportDeficits({ ...best.positioned, edges: rootOwnedEdges })) {
        const paddingSide = side === "west" ? "left" : side === "east" ? "right" : side === "north" ? "top" : "bottom";
        const key = `${best.positioned.root.id}\0${paddingSide}`;
        paddingDemands.set(key, Math.max(paddingDemands.get(key) ?? 0, amount));
      }
      const headerIds = new Set(failedIds);
      if (!best.violations.length) for (const problem of best.labels.problems) {
        if ((problem.kind === "header" || problem.kind === "bounds")
          && best.context.connectors.find(connector => connector.id === problem.connectorId)?.routingBounds)
          headerIds.add(problem.connectorId);
      }
      for (const [key, amount] of headerPaddingDemands(best.positioned, expectedLabels, headerIds))
        paddingDemands.set(key, Math.max(paddingDemands.get(key) ?? 0, amount));
      if (!best.violations.length) for (const [key, amount] of exteriorLabelPaddingDemands(best.positioned, expectedLabels, best.labels))
        paddingDemands.set(key, Math.max(paddingDemands.get(key) ?? 0, amount));
      if (!best.violations.length) for (const [key, amount] of labelScopePaddingDemands(best.positioned, expectedLabels, best.labels))
        paddingDemands.set(key, Math.max(paddingDemands.get(key) ?? 0, amount));
      if (!best.violations.length) for (const [key, amount] of labelRelativeOwnerPaddingDemands(best.positioned, best.context, expectedLabels, best.labels))
        paddingDemands.set(key, Math.max(paddingDemands.get(key) ?? 0, amount));
      const deficit = [...routeDemand.demands.values(), ...paddingDemands.values()].reduce((a, b) => a + Math.max(0, b), 0);
      return { best, routeDemand, paddingDemands, deficit, blockedRows,
        endpointDeficit: [...endpointDemands.values()].some(amount => amount > GEOMETRY_EPSILON) };
    };
    const topologyProblems = (request: ReturnType<typeof requestsFor>): number => request.best.labels.problems
      .filter(problem => problem.kind !== "bounds" && problem.kind !== "node" && problem.kind !== "header").length;
    const requests = rejected.map(requestsFor).sort((a, b) => Number(b.deficit > GEOMETRY_EPSILON) - Number(a.deficit > GEOMETRY_EPSILON)
      || a.blockedRows - b.blockedRows
      // A missing endpoint channel prevents coherent route generation. Resolve
      // that measured physical prerequisite before comparing label capacity.
      || Number(b.endpointDeficit) - Number(a.endpointDeficit)
      || Number(a.best.violations.length > 0) - Number(b.best.violations.length > 0)
      || topologyProblems(a) - topologyProblems(b)
      || (a.deficit > GEOMETRY_EPSILON && b.deficit > GEOMETRY_EPSILON ? a.deficit - b.deficit : 0)
      || a.best.violations.length - b.best.violations.length || a.best.labels.problems.length - b.best.labels.problems.length
      || a.best.revision.id.localeCompare(b.best.revision.id));
    const { best, routeDemand, paddingDemands, deficit } = requests[0]!;
    if (bestAccepted && deficit <= GEOMETRY_EPSILON) return finishAccepted();
    finalMeasured = best.revision.measured;
    finalPositioned = best.positioned;
    evidence.push({ pass, expansion: { gaps: [...routeDemand.demands], padding: [...paddingDemands] },
      rejectedRevision: best.revision.id, violations: best.violations.map(v => v.message), labels: best.labels.problems });
    const gapChanged = mergeDemands(absoluteGapIncrements, routeDemand.demands);
    const paddingChanged = mergeDemands(absolutePaddingIncrements, paddingDemands);
    if ((!gapChanged && !paddingChanged) || pass === maximumExpansionPasses) {
      if (bestAccepted) return finishAccepted(pass === maximumExpansionPasses);
      return finish(appendDiagnostics(finalPositioned, [...best.reasons,
        issue("renderer.routing.ia_joint_capacity_exhausted", "IA joint route and label selection could not satisfy final acceptance within owned spacing and aggregate limits.", scene.root.id)]), finalMeasured);
    }
    budget.expansions--;
  }
  return finish(appendDiagnostics(finalPositioned, [issue("renderer.routing.ia_joint_budget_exhausted",
    "IA joint routing exhausted its aggregate search budget.", scene.root.id)]), finalMeasured);
}
