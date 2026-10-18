import type { UiContractsPresentationModel } from "../uiContractsPresentationModel.js";
import type { MeasuredScene, PositionedEdge, PositionedScene, RendererScene, StagedRenderSettings } from "./contracts.js";
import type { StagedRendererPipelineResult } from "./pipeline.js";
import { UI_CONTRACTS_SPACING, UiContractsSceneBuilder } from "./uiContractsPresentationScene.js";
import { measureRendererScene, type NodeMinimumExtent } from "./microLayout.js";
import { UiPortCapacityError, applyUiCapacityRequirements, mergeUiCapacityRequirements, uiCapacityResourceKey, type UiCapacityRequirement } from "./uiContractsCapacity.js";
export type { UiCapacityRequirement } from "./uiContractsCapacity.js";
import { positionMeasuredEdgesAgainstRoot, positionMeasuredSceneBeforeRouting } from "./macroLayout.js";
import { auditUiContractsScene, uiExpectedLabels, uiLoopLabelAnchors, uiRelatedPhysicalSegments, uiRoutingContext, uiSceneItems } from "./uiContractsAcceptance.js";
import { createRoutingDiagnostic, type RendererDiagnostic } from "./diagnostics.js";
import { markerRoutingClearance, arrowMarkerFootprintBox } from "./markerGeometry.js";
import { resolveRendererTheme } from "./theme.js";
import { allocateOrderedPortPair } from "./routingCore/orderedPortPair.js";
import { allocatePortOffsets, minimumPortGroupSideLength } from "./routingCore/portCapacity.js";
import { readablePortPitch, readableRoutingClearance } from "./routingCore/bounds.js";
import { buildPortCorridorSeed } from "./routingCore/candidates.js";
import { FIXED_LABEL_DISTANCE } from "./connectorLabelPlacement.js";
import { assessConnectorLabels, auditConnectorLabels } from "./connectorLabelLayout.js";
import { DEFAULT_FINAL_ROUTING_LIMITS, runRoutingLifecycle, validateFinalRouteSet } from "./routingCore/lifecycle.js";
import { DEFAULT_ROUTING_POLICY } from "./routingCore/contracts.js";
import { compareRouteCosts, resolveFacingSideSharedCoordinate, routeCost } from "./routingCore/optimization.js";
import { positionEdgeLabel } from "./routing.js";
import { withRoutingQualityBudgetAllowance, type RoutingQualityBudget } from "./routingCore/qualitySelection.js";

export interface UiSearchEvidence {
  candidates: number; repairs: number; expansions: number;
  limits: { candidates: number; repairs: number; expansions: number };
  work: { attachments: number; routes: number; labels: number };
  trials: Array<{ choices: number[]; requirements: UiCapacityRequirement[]; findings: RendererDiagnostic[]; accepted: boolean }>;
}
type Revision = StagedRendererPipelineResult;
export type UiRoutingOutcome =
  | { status: "accepted"; revision: Revision; evidence: UiSearchEvidence }
  | { status: "failed"; reason: "invalid_contract" | "attachment_capacity" | "unsupported_capacity_owner" | "no_candidate" | "repeated_geometry" | "candidate_budget" | "repair_budget" | "expansion_budget";
      violations: RendererDiagnostic[]; unresolved: UiCapacityRequirement[]; evidence: UiSearchEvidence; diagnosticRevision?: Revision };
export interface UiRoutingLimits { candidates?: number; repairs?: number; expansions?: number }

const ceil = (value: number) => Math.ceil(value * 1000) / 1000;
const resourceKey = uiCapacityResourceKey;

/** Bind before constructing a candidate. No side is recovered from its polyline. */
function bindEdges(measured: MeasuredScene, positioned: PositionedScene, choices: readonly number[], budget: RoutingQualityBudget, labelAllowance: number): PositionedScene {
  const scene = positionMeasuredEdgesAgainstRoot({ ...measured, edges: measured.edges.filter(edge => !edge.viewMetadata?.uiTransition || edge.viewMetadata.uiTransition.kind === "forward") }, positioned);
  const items = new Map(uiSceneItems(scene.root).map(item => [item.id, item]));
  const theme = resolveRendererTheme(scene.themeId).theme, policy = scene.root.viewMetadata!.uiContracts!.routing!;
  const pitch = readablePortPitch(theme.paint.arrowSize, theme.paint.edgeStrokeWidth), depth = readableRoutingClearance(theme.paint.edgeStrokeWidth);
  scene.uiRoutingBindings = [];
  const endpoint = (end: PositionedEdge["from"], marker?: string) => {
    const item = items.get(end.itemId), port = item?.ports.find(port => port.id === end.portId);
    if (!item || !port) throw new Error(`Missing declared attachment ${end.itemId}/${end.portId}.`);
    return { nodeId: item.id, portId: port.id, side: port.side, point: { x: item.x + port.x, y: item.y + port.y },
      minLeg: item.kind === "node" ? markerRoutingClearance(marker === "arrow" ? "arrow" : undefined, theme.paint.arrowSize, theme.paint.edgeStrokeWidth) : marker === "arrow" ? markerRoutingClearance("arrow", theme.paint.arrowSize, theme.paint.edgeStrokeWidth) : 0 };
  };
  const counts = new Map<string, number>();
  for (const edge of scene.edges) for (const endpoint of [edge.from, edge.to]) {
    const item = items.get(endpoint.itemId), port = item?.ports.find(port => port.id === endpoint.portId);
    if (item?.kind === "node" && port) { const key = JSON.stringify([item.id, port.side]); counts.set(key, (counts.get(key) ?? 0) + 1); }
  }
  for (const edge of scene.edges) {
    const source = items.get(edge.from.itemId), target = items.get(edge.to.itemId);
    const sourcePort = source?.ports.find(port => port.id === edge.from.portId), targetPort = target?.ports.find(port => port.id === edge.to.portId);
    if (source?.kind !== "node" || target?.kind !== "node" || sourcePort?.side !== "east" || targetPort?.side !== "west") continue;
    const sourceCount = counts.get(JSON.stringify([source.id, "east"])) ?? 0, targetCount = counts.get(JSON.stringify([target.id, "west"])) ?? 0;
    if ((sourceCount > 1) === (targetCount > 1)) continue;
    const inset = DEFAULT_ROUTING_POLICY.minTerminalLeg;
    const coordinate = resolveFacingSideSharedCoordinate({
      sourceSpan: sourceCount > 1 ? { min: edge.from.y, max: edge.from.y } : { min: source.y + inset, max: source.y + source.height - inset },
      targetSpan: targetCount > 1 ? { min: edge.to.y, max: edge.to.y } : { min: target.y + inset, max: target.y + target.height - inset },
      sourceCenter: edge.from.y, targetCenter: edge.to.y });
    if (coordinate === undefined) continue;
    const movedPort = sourceCount === 1 ? sourcePort : targetPort, movedNode = sourceCount === 1 ? source : target;
    movedPort.offset = coordinate - movedNode.y; movedPort.y = movedPort.offset;
    if (sourceCount === 1) edge.from.y = coordinate; else edge.to.y = coordinate;
    const a = endpoint(edge.from, edge.markers?.start), b = endpoint(edge.to, edge.markers?.end);
    edge.route = { style: "orthogonal", points: [a.point, b.point] };
    const measuredLabel = measured.edges.find(candidate => candidate.id === edge.id)?.label;
    if (measuredLabel) edge.label = positionEdgeLabel(measuredLabel, edge.route, [], edge.id);
  }
  for (const edge of scene.edges) {
    const source = endpoint(edge.from, edge.markers?.start), target = endpoint(edge.to, edge.markers?.end);
    if (edge.viewMetadata?.uiJunction?.sourceSide) source.side = edge.viewMetadata.uiJunction.sourceSide;
    if (edge.viewMetadata?.uiJunction?.targetSide) target.side = edge.viewMetadata.uiJunction.targetSide;
    scene.uiRoutingBindings.push({ id: edge.id, source, target,
      ...(edge.viewMetadata?.uiTransition?.retainRoute ? { fixedRoute: structuredClone(edge.route) } : {}) });
  }
  const returnAttachments = new Map<string, ReturnType<typeof endpoint>>();
  const groups = new Map<string, Array<{ edgeId: string; role: "source" | "target"; attachment: ReturnType<typeof endpoint> }>>();
  for (const edge of measured.edges.filter(edge => edge.viewMetadata?.uiTransition?.kind === "return")) for (const role of ["source", "target"] as const) {
    const attachment = endpoint({ ...(role === "source" ? edge.from : edge.to), x: 0, y: 0 }, role === "source" ? edge.markers?.start : edge.markers?.end);
    const key = JSON.stringify([attachment.nodeId, attachment.side]), group = groups.get(key) ?? [];
    group.push({ edgeId: edge.id, role, attachment }); groups.set(key, group);
  }
  for (const group of groups.values()) {
    const first = group[0]!.attachment, node = items.get(first.nodeId)!;
    const horizontal = first.side === "north" || first.side === "south", axis = horizontal ? "x" : "y", sideLength = horizontal ? node.width : node.height;
    const reserved = scene.uiRoutingBindings.flatMap(binding => [binding.source, binding.target]).filter(binding => binding.nodeId === node.id && binding.side === first.side).map(binding => binding.point[axis] - node[axis]);
    const requests = group.map(request => `${request.edgeId}:${request.role}`), inset = Math.max(DEFAULT_ROUTING_POLICY.minTerminalLeg, ...group.map(request => request.attachment.minLeg));
    const allocation = allocatePortOffsets({ sideLength, minInset: inset, minSeparation: pitch, requestIds: requests, reservedOffsets: reserved });
    if (allocation.status !== "allocated") {
      const demand = minimumPortGroupSideLength({ sideLength, minInset: inset, minSeparation: pitch,
        relativeOffsets: requests.map((_, index) => index * pitch), reservedOffsets: reserved });
      if (demand.status === "growth_required") throw new UiPortCapacityError([{ resource: { kind: "node_extent", nodeId: node.id, axis },
        minimumExtent: demand.minimumExtent, reason: "port_capacity", connectorIds: group.map(request => request.edgeId) }]);
      throw new Error(`attachment_capacity:${group[0]!.edgeId}`);
    }
    for (const [index, request] of group.entries()) {
      const offset = allocation.offsets.get(requests[index]!)!, natural = node.ports.find(port => port.id === request.attachment.portId)!;
      const portId = group.length === 1 && !reserved.length ? natural.id : `${request.edgeId}:return:${request.role}`;
      const local = { x: horizontal ? offset : first.side === "east" ? node.width : 0, y: horizontal ? first.side === "south" ? node.height : 0 : offset };
      const existing = node.ports.find(port => port.id === portId);
      if (existing) Object.assign(existing, { offset, ...local }); else node.ports.push({ ...natural, id: portId, offset, ...local });
      returnAttachments.set(requests[index]!, { ...request.attachment, portId, point: { x: node.x + local.x, y: node.y + local.y } });
    }
  }
  const loopPairPlans = new Map<string, { departure: number; arrival: number }>();
  const returnArrivals = [...groups.values()].flatMap(group => group.filter(request => request.role === "target")
    .map(request => returnAttachments.get(`${request.edgeId}:target`)!));
  const loopEdges = measured.edges.filter(edge => edge.viewMetadata?.uiTransition?.kind === "loop");
  const loopGroups = new Map<string, Array<{ edge: typeof loopEdges[number]; trial: typeof policy.self_loop.side_trials[number] }>>();
  for (const [index, edge] of loopEdges.entries()) {
    const trial = policy.self_loop.side_trials[choices[index] ?? 0]!, key = JSON.stringify([edge.from.itemId, trial.side]), group = loopGroups.get(key) ?? [];
    group.push({ edge, trial }); loopGroups.set(key, group);
  }
  for (const group of loopGroups.values()) {
    const { edge, trial } = group[0]!, node = items.get(edge.from.itemId)!, horizontal = trial.side === "north" || trial.side === "south", axis = horizontal ? "x" : "y";
    const bindings = [...scene.uiRoutingBindings.flatMap(binding => [binding.source, binding.target]), ...returnAttachments.values()];
    const occupied = bindings.filter(binding => binding.nodeId === node.id && binding.side === trial.side).map(binding => binding.point[axis] - node[axis]);
    const arrivals = [...scene.uiRoutingBindings.map(binding => binding.target), ...returnArrivals]
      .filter(binding => binding.nodeId === node.id && binding.side === trial.side).map(binding => binding.point[axis] - node[axis]);
    const inset = Math.max(DEFAULT_ROUTING_POLICY.minTerminalLeg, markerRoutingClearance("arrow", theme.paint.arrowSize, theme.paint.edgeStrokeWidth));
    const order = policy.self_loop.traversal.direction === "negative" ? ["arrival", "departure"] : ["departure", "arrival"];
    const requestIds = group.flatMap(({ edge }) => order.map(role => JSON.stringify([edge.id, role])));
    const high = trial.pair_placement === "before_other_arrivals" && arrivals.length ? Math.min(...arrivals) - pitch : undefined;
    const allocation = allocatePortOffsets({ sideLength: horizontal ? node.width : node.height, minInset: inset, minSeparation: pitch,
      requestIds, reservedOffsets: occupied, ...(high === undefined ? {} : { maximumOffset: high }) });
    if (allocation.status !== "allocated") {
      const demand = minimumPortGroupSideLength({ sideLength: horizontal ? node.width : node.height, minInset: inset, minSeparation: pitch,
        relativeOffsets: requestIds.map((_, index) => index * pitch), reservedOffsets: occupied, ...(high === undefined ? {} : { maximumGroupEnd: high }) });
      if (demand.status === "growth_required") throw new UiPortCapacityError([{ resource: { kind: "node_extent", nodeId: node.id, axis },
        minimumExtent: demand.minimumExtent, reason: "port_capacity", connectorIds: group.map(({ edge }) => edge.id) }]);
      throw new Error(`attachment_capacity:${edge.id}`);
    }
    for (const { edge } of group) {
      const ownIds = new Set(order.map(role => JSON.stringify([edge.id, role])));
      const pair = group.length > 1 ? {
        departure: allocation.offsets.get(JSON.stringify([edge.id, "departure"]))!, arrival: allocation.offsets.get(JSON.stringify([edge.id, "arrival"]))!
      } : allocateOrderedPortPair({ sideLength: horizontal ? node.width : node.height, minInset: inset, minSeparation: pitch,
        direction: policy.self_loop.traversal.direction, placement: trial.pair_placement,
        occupiedOffsets: [...occupied, ...[...allocation.offsets].filter(([id]) => !ownIds.has(id)).map(([, offset]) => offset)], otherArrivalOffsets: arrivals });
      if (!pair) throw new Error(`attachment_capacity:${edge.id}`);
      loopPairPlans.set(edge.id, pair);
    }
  }
  let loopIndex = 0;
  for (const edge of measured.edges.filter(edge => edge.viewMetadata?.uiTransition && edge.viewMetadata.uiTransition.kind !== "forward")) {
    const intent = edge.viewMetadata!.uiTransition!, owner = items.get(intent.ownerId);
    if (!owner || owner.kind !== "container") throw new Error(`Missing transition owner ${intent.ownerId}.`);
    let source = endpoint({ ...edge.from, x: 0, y: 0 }, edge.markers?.start), target = endpoint({ ...edge.to, x: 0, y: 0 }, edge.markers?.end);
    let route: PositionedEdge["route"], label: PositionedEdge["label"];
    if (intent.kind === "return") {
      source = returnAttachments.get(`${edge.id}:source`)!; target = returnAttachments.get(`${edge.id}:target`)!;
      const sequence = intent.sequenceOwnerId ? items.get(intent.sequenceOwnerId) : undefined;
      if (!sequence) throw new Error("Return connector has no declared sequence owner.");
      const laneOffset = (intent.returnLane ?? 0) * depth;
      // A lower arrival approaches from below so its vertical stub cannot cut
      // through an earlier arrow or its label on the same side of the card.
      const lowerArrival = !intent.retainRoute && [...scene.uiRoutingBindings.map(binding => binding.target), ...returnArrivals].some(other =>
        other.nodeId === target.nodeId && other.side === target.side && other.point.y < target.point.y - DEFAULT_ROUTING_POLICY.epsilon);
      const rail = lowerArrival ? sequence.y + sequence.height - (intent.returnTrack ?? 0) : sequence.y + (intent.returnTrack ?? 0),
        west = intent.retainRoute ? sequence.x - UI_CONTRACTS_SPACING.arrowApproach
        : target.point.x - Math.max(DEFAULT_ROUTING_POLICY.minTerminalLeg, target.minLeg),
        east = intent.retainRoute ? sequence.x + sequence.width + UI_CONTRACTS_SPACING.arrowApproach
          : source.point.x + UI_CONTRACTS_SPACING.arrowApproach + laneOffset;
      route = { style: "orthogonal", points: [source.point, { x: east, y: source.point.y },
        { x: east, y: rail }, { x: west, y: rail }, { x: west, y: target.point.y }, target.point] };
      if (edge.label) label = { ...edge.label, x: (west + east - edge.label.width) / 2,
        y: lowerArrival ? rail + FIXED_LABEL_DISTANCE : rail - FIXED_LABEL_DISTANCE - edge.label.height };
    } else {
      const trial = policy.self_loop.side_trials[choices[loopIndex++] ?? 0]!;
      const node = items.get(edge.from.itemId)!;
      const horizontal = trial.side === "north" || trial.side === "south", axis = horizontal ? "x" : "y";
      const allocation = loopPairPlans.get(edge.id)!;
      const attach = (role: "source" | "target", offset: number) => {
        const id = `${edge.id}:loop:${role}`, x = horizontal ? offset : trial.side === "east" ? node.width : 0,
          y = horizontal ? trial.side === "south" ? node.height : 0 : offset;
        node.ports.push({ id, role: "transition", side: trial.side, offset, x, y });
        return { nodeId: node.id, portId: id, side: trial.side, point: { x: node.x + x, y: node.y + y }, minLeg: Math.max(DEFAULT_ROUTING_POLICY.minTerminalLeg, source.minLeg, target.minLeg) };
      };
      source = attach("source", allocation.departure); target = attach("target", allocation.arrival);
      route = buildPortCorridorSeed({ id: edge.id, route: { style: "orthogonal", points: [] }, source, target, priority: scene.edges.length }, depth)!;
      if (!route) throw new Error(`attachment_capacity:${edge.id}`);
      if (edge.label) label = { ...edge.label,
        x: horizontal ? (source.point.x + target.point.x - edge.label.width) / 2 : trial.side === "east" ? route.points[1]!.x + FIXED_LABEL_DISTANCE : route.points[1]!.x - FIXED_LABEL_DISTANCE - edge.label.width,
        y: horizontal ? trial.side === "south" ? route.points[1]!.y + FIXED_LABEL_DISTANCE : route.points[1]!.y - FIXED_LABEL_DISTANCE - edge.label.height : (source.point.y + target.point.y - edge.label.height) / 2 };
    }
    scene.edges.push({ ...edge, paintGroup: "edges", from: { itemId: source.nodeId, portId: source.portId, ...source.point },
      to: { itemId: target.nodeId, portId: target.portId, ...target.point }, route, label });
    scene.uiRoutingBindings.push({ id: edge.id, source, target, ...(intent.retainRoute ? { fixedRoute: structuredClone(route) } : {}) });
  }
  // Initial anchors are assessed first, with zero proposal cost. Alternative label
  // proposals spend the same remaining budget as attachment and route proposals.
  const input = { scene, expectedLabels: uiExpectedLabels(scene), searchConnectorIds: new Set(scene.edges.filter(edge =>
    edge.viewMetadata?.uiTransition?.kind === "loop" || !edge.viewMetadata?.uiTransition?.retainRoute).map(edge => edge.id)),
    anchorConstraints: uiLoopLabelAnchors(scene),
    rejectOwnRouteOverlap: true,
    scopeByConnectorId: new Map(scene.edges.flatMap(edge => {
      const owner = edge.ownerContainerId && items.get(edge.ownerContainerId);
      return owner ? [[edge.id, owner] as const] : [];
    })),
    rejectAmbiguousAssociation: true, requireAdjacentLabels: true, eventBasedHorizontalSearch: true,
    unrelatedRouteClearance: depth, searchBudget: budget };
  const initial = auditConnectorLabels(input);
  // A pure bounds deficit needs owned layout, not a displaced label. Preserve
  // its prospective anchor until the branch has rebuilt sufficient space.
  const outsideOwners = new Set(initial.problems.filter(problem => problem.kind === "bounds").map(problem => problem.connectorId));
  const pending = new Set(initial.problems.filter(problem => problem.kind !== "bounds" && !outsideOwners.has(problem.connectorId)
    && input.searchConnectorIds.has(problem.connectorId)).map(problem => problem.connectorId));
  if (pending.size && labelAllowance > 0) withRoutingQualityBudgetAllowance(budget, labelAllowance, () => {
    const placement = assessConnectorLabels({ ...input, searchConnectorIds: pending, preferredAnchorByConnectorId: initial.anchorByConnectorId });
    for (const edge of scene.edges) if (pending.has(edge.id) && placement.labels.has(edge.id)) edge.label = placement.labels.get(edge.id);
  });
  return scene;
}

function capacityRequirements(scene: PositionedScene): UiCapacityRequirement[] {
  const theme = resolveRendererTheme(scene.themeId).theme, clearance = readableRoutingClearance(theme.paint.edgeStrokeWidth);
  const items = new Map(uiSceneItems(scene.root).map(item => [item.id, item]));
  const requests: UiCapacityRequirement[] = [];
  for (const edge of scene.edges) {
    const kind = edge.viewMetadata?.uiTransition?.kind;
    if (kind !== "loop" && !(kind === "return" && !edge.viewMetadata?.uiTransition?.retainRoute)) continue;
    const owner = edge.ownerContainerId ? items.get(edge.ownerContainerId) : undefined;
    if (!owner || owner.kind !== "container") continue;
    const marker = arrowMarkerFootprintBox(edge.route.points.at(-1)!, edge.route.points.at(-2)!, theme.paint.arrowSize, theme.paint.edgeStrokeWidth);
    const boxes = [...edge.route.points.map(point => ({ ...point, width: 0, height: 0 })), ...(edge.label ? [edge.label] : []), ...(marker ? [marker] : [])];
    const margin = kind === "loop" ? clearance : theme.paint.edgeStrokeWidth / 2;
    const deficits = { top: owner.y - Math.min(...boxes.map(box => box.y)) + margin,
      bottom: Math.max(...boxes.map(box => box.y + box.height)) + margin - owner.y - owner.height,
      left: owner.x - Math.min(...boxes.map(box => box.x)) + margin,
      right: Math.max(...boxes.map(box => box.x + box.width)) + margin - owner.x - owner.width };
    for (const side of ["top", "right", "bottom", "left"] as const) if (deficits[side] > 0.5) requests.push({
      resource: { kind: "padding", containerId: owner.id, side }, minimumExtent: ceil(owner.chrome.padding[side] + deficits[side]),
      reason: edge.label ? "label_envelope" : "route_clearance", connectorIds: [edge.id] });
  }
  // Linear label corridors have an actual adjacent-child owner. Packing does
  // not implement gapAfter, so packed row boundaries never become fake gaps.
  const ancestry = new Map<string, string[]>();
  const visit = (item: PositionedScene["root"], ancestors: string[]) => {
    ancestry.set(item.id, ancestors);
    for (const child of item.children) {
      ancestry.set(child.id, [...ancestors, item.id]);
      if (child.kind === "container") visit(child, [...ancestors, item.id]);
    }
  };
  visit(scene.root, []);
  for (const edge of scene.edges) {
    if (!edge.label || edge.viewMetadata?.uiTransition) continue;
    const left = [...(ancestry.get(edge.from.itemId) ?? []), edge.from.itemId], right = [...(ancestry.get(edge.to.itemId) ?? []), edge.to.itemId];
    let depth = 0; while (depth < Math.min(left.length, right.length) && left[depth] === right[depth]) depth++;
    const common = items.get(left[depth - 1] ?? "");
    if (!common || common.kind !== "container" || common.layout.strategy !== "stack" || common.layout.pack) continue;
    const first = common.children.findIndex(child => child.id === left[depth]), second = common.children.findIndex(child => child.id === right[depth]);
    if (first < 0 || second < 0 || Math.abs(first - second) !== 1) continue;
    const before = common.children[Math.min(first, second)]!, after = common.children[Math.max(first, second)]!;
    const vertical = (common.layout.direction ?? "vertical") === "vertical";
    const needed = (vertical ? edge.label.height : edge.label.width) + FIXED_LABEL_DISTANCE * 2;
    const current = common.layout.gapAfter?.[before.id] ?? common.layout.gap ?? 0;
    if (current < needed - 0.5) requests.push({ resource: { kind: "gap", containerId: common.id, beforeId: before.id, afterId: after.id },
      minimumExtent: ceil(needed), reason: "label_envelope", connectorIds: [edge.id] });
  }
  return requests;
}

/** Asynchronous scene rebuilding is owned here, outside the synchronous router. */
export async function runUiContractsRendererPipeline(model: UiContractsPresentationModel, settings: StagedRenderSettings,
  limits: UiRoutingLimits = {}): Promise<UiRoutingOutcome> {
  if (!model.routing) throw new Error("Dedicated UI routing requires loaded routing policy.");
  const maximum = { candidates: limits.candidates ?? DEFAULT_FINAL_ROUTING_LIMITS.maxCandidates,
    repairs: limits.repairs ?? DEFAULT_FINAL_ROUTING_LIMITS.maxRepairRevisions, expansions: limits.expansions ?? DEFAULT_ROUTING_POLICY.maxExpansionPasses };
  if (Object.values(maximum).some(value => !Number.isInteger(value) || value < 0)) throw new RangeError("Routing limits must be finite nonnegative integers.");
  const budget: RoutingQualityBudget = { candidates: maximum.candidates, repairs: maximum.repairs };
  const evidence: UiSearchEvidence = { candidates: 0, repairs: 0, expansions: 0, limits: maximum,
    work: { attachments: 0, routes: 0, labels: 0 }, trials: [] };
  if (model.diagnostics.some(diagnostic => diagnostic.severity === "error")) return {
    status: "failed", reason: "invalid_contract", violations: [...model.diagnostics], unresolved: [], evidence
  };
  const loopCount = model.scopes.reduce((count, scope) => count + scope.sequences.reduce((n, sequence) => n + sequence.edges.filter(edge => edge.from === edge.to).length, 0), 0);
  type Trial = { choices: number[]; ledger: UiCapacityRequirement[] };
  const queue: Trial[] = [], visited = new Set<string>(), realized = new Set<string>();
  const initial = Array.from({ length: loopCount }, () => 0);
  queue.push({ choices: initial, ledger: [] });
  let best: { revision: Revision; cost: number[] } | undefined, diagnosticRevision: Revision | undefined;
  let reason: Extract<UiRoutingOutcome, { status: "failed" }>["reason"] = "no_candidate", unresolved: UiCapacityRequirement[] = [], lastFindings: RendererDiagnostic[] = [];
  // Lazy mixed-radix enumeration: one complete assignment is generated at a time,
  // rather than allocating a Cartesian product. Baseline side seeds precede reflow.
  let nextChoices: number[] | undefined = [...initial];
  const originalHeightFloors = new Map<string, number>();
  const originalNodeExtents = new Map<string, { width: number; height: number }>();
  const baselineResourceExtents = new Map<string, number>();
  let seedAssessments = 0;
  const totalSeeds = Math.min(maximum.candidates + 1, model.routing.self_loop.side_trials.length ** loopCount);
  const enqueueRequirements = (trial: Trial, requests: UiCapacityRequirement[]): void => {
    if (requests.length) unresolved = requests;
    const permitted = requests.filter(request => request.resource.kind === "node_extent" ? model.routing!.capacity.node === "port_minimum" : model.routing!.capacity.owner !== "fixed");
    if (permitted.length !== requests.length || !requests.length) return;
    const merged = mergeUiCapacityRequirements(trial.ledger, requests);
    if (JSON.stringify(merged) === JSON.stringify(trial.ledger)) { reason = "repeated_geometry"; return; }
    queue.push({ choices: trial.choices, ledger: merged });
  };
  const enqueueNext = () => {
    if (!nextChoices || !loopCount) { nextChoices = undefined; return; }
    const next = [...nextChoices]; let index = next.length - 1;
    for (; index >= 0; index--) { next[index] = next[index]! + 1; if (next[index]! < model.routing!.self_loop.side_trials.length) break; next[index] = 0; }
    if (index < 0) { nextChoices = undefined; return; }
    nextChoices = next; queue.unshift({ choices: next, ledger: [] });
  };
  while (queue.length) {
    const trial = queue.shift()!, key = JSON.stringify([model.routing, trial.choices, trial.ledger.map(request => [resourceKey(request), request.minimumExtent]).sort()]);
    if (visited.has(key)) continue;
    visited.add(key);
    if (!trial.ledger.length) enqueueNext();
    if (evidence.trials.length && budget.candidates === 0) { reason = "candidate_budget"; break; }
    // Every complete attachment/side assignment costs one proposal; the first seed
    // is still independently audited when no search allowance is available.
    if (budget.candidates > 0) { budget.candidates--; evidence.work.attachments++; }
    if (!trial.ledger.length) seedAssessments++;
    if (trial.ledger.length) {
      if (evidence.expansions >= maximum.expansions) { reason = "expansion_budget"; continue; }
      evidence.expansions++;
    }
    const minimumNodeExtents = new Map<string, NodeMinimumExtent>();
    for (const request of trial.ledger) if (request.resource.kind === "node_extent") {
      const { nodeId, axis } = request.resource, previous = minimumNodeExtents.get(nodeId) ?? {};
      minimumNodeExtents.set(nodeId, { ...previous, ...(originalHeightFloors.has(nodeId) ? { height: Math.max(previous.height ?? 0, originalHeightFloors.get(nodeId)!) } : {}),
        [axis === "x" ? "width" : "height"]: Math.max(request.minimumExtent, axis === "y" ? originalHeightFloors.get(nodeId) ?? 0 : 0) });
    }
    const builder = new UiContractsSceneBuilder(settings.detailId, settings.nodeDecoratorMode ?? { id: "none", showNodeType: false, showNodeId: false }, settings.themeId, minimumNodeExtents);
    let rendererScene: RendererScene, measuredScene: MeasuredScene;
    try {
      rendererScene = builder.complete(model);
      const naturalItems = new Map<string, RendererScene["root"]>();
      const collect = (item: RendererScene["root"]) => { naturalItems.set(item.id, item); item.children.forEach(child => { if (child.kind === "container") collect(child); }); };
      collect(rendererScene.root);
      for (const request of trial.ledger) if (!baselineResourceExtents.has(resourceKey(request))) {
        const resource = request.resource;
        if (resource.kind === "padding") baselineResourceExtents.set(resourceKey(request), naturalItems.get(resource.containerId)?.chrome.padding[resource.side] ?? 0);
        else if (resource.kind === "gap") {
          const owner = naturalItems.get(resource.containerId);
          baselineResourceExtents.set(resourceKey(request), owner?.layout.gapAfter?.[resource.beforeId] ?? owner?.layout.gap ?? 0);
        } else {
          const original = originalNodeExtents.get(resource.nodeId);
          if (original) baselineResourceExtents.set(resourceKey(request), resource.axis === "x" ? original.width : original.height);
        }
      }
      const applied = applyUiCapacityRequirements(rendererScene, trial.ledger);
      if (applied.status === "unsupported_capacity_owner") {
        reason = "unsupported_capacity_owner"; unresolved = trial.ledger;
        lastFindings = [createRoutingDiagnostic("renderer.routing.ui_contracts_unsupported_capacity_owner", "Requested capacity has no realizable scene-tree owner.", JSON.stringify(applied.resource), "error")];
        evidence.trials.push({ choices: trial.choices, requirements: trial.ledger, findings: lastFindings, accepted: false }); continue;
      }
      measuredScene = measureRendererScene(rendererScene, { minimumNodeExtents });
    } catch (error) {
      if (!(error instanceof UiPortCapacityError)) throw error;
      reason = "attachment_capacity";
      for (const [id, height] of error.originalHeightFloors) if (!originalHeightFloors.has(id)) originalHeightFloors.set(id, height);
      for (const [id, extent] of error.originalNodeExtents) if (!originalNodeExtents.has(id)) { originalNodeExtents.set(id, extent); originalHeightFloors.set(id, extent.height); }
      lastFindings = [createRoutingDiagnostic("renderer.routing.ui_contracts_attachment_capacity", error.message, error.requirements[0]?.connectorIds[0] ?? "root", "error")];
      evidence.trials.push({ choices: trial.choices, requirements: trial.ledger, findings: lastFindings, accepted: false });
      enqueueRequirements(trial, error.requirements); continue;
    }
    const baseline = await positionMeasuredSceneBeforeRouting(measuredScene);
    for (const item of uiSceneItems(baseline.root)) if (item.kind === "node" && !originalHeightFloors.has(item.id)) {
      originalHeightFloors.set(item.id, item.height); originalNodeExtents.set(item.id, { width: item.width, height: item.height });
    }
    let positionedScene: PositionedScene;
    const reservedSeeds = Math.min(budget.candidates, Math.max(0, totalSeeds - seedAssessments));
    const allowance = Math.max(0, Math.floor((budget.candidates - reservedSeeds) / (2 * Math.max(1, queue.length + 1))));
    const beforeLabelWork = budget.candidates;
    try { positionedScene = bindEdges(measuredScene, baseline, trial.choices, budget, allowance); }
    catch (error) {
      reason = error instanceof UiPortCapacityError || String(error).includes("attachment_capacity:") ? "attachment_capacity" : "invalid_contract";
      lastFindings = [createRoutingDiagnostic(`renderer.routing.ui_contracts_${reason}`, String(error), rendererScene.root.id, "error")];
      evidence.trials.push({ choices: trial.choices, requirements: trial.ledger, findings: lastFindings, accepted: false });
      if (error instanceof UiPortCapacityError) enqueueRequirements(trial, error.requirements);
      continue;
    }
    evidence.work.labels += beforeLabelWork - budget.candidates;
    const geometry = JSON.stringify([
      uiSceneItems(positionedScene.root).map(item => [item.id, item.x, item.y, item.width, item.height, item.ports,
        item.kind === "container" ? item.headerContent : item.content]),
      positionedScene.uiRoutingBindings, positionedScene.edges.map(edge => [edge.id, edge.from, edge.to, edge.route, edge.label, edge.markers])
    ]);
    if (realized.has(geometry)) { reason = "repeated_geometry"; continue; }
    realized.add(geometry);
    const revision = { rendererScene, measuredScene, positionedScene };
    diagnosticRevision = revision;
    reason = "no_candidate";
    let findings = [...positionedScene.diagnostics.filter(d => d.severity === "error"), ...auditUiContractsScene(positionedScene)];
    // Ordinary movable connectors may use shared recovery. Compact and retained
    // return/forward paths are fixed inside this trial, never silently repaired.
    const context = uiRoutingContext(positionedScene);
    const routeViolations = validateFinalRouteSet(context);
    if (!capacityRequirements(positionedScene).length && routeViolations.some(violation => violation.connectorIds.some(id => context.connectors.some(connector => connector.id === id && !connector.fixed))) && budget.candidates > 0 && budget.repairs > 0) {
      // Route recovery shares the same seed reservation as label recovery.
      const allowance = Math.floor(Math.max(0, budget.candidates - reservedSeeds) / Math.max(1, queue.length + 1));
      if (allowance > 0) withRoutingQualityBudgetAllowance(budget, allowance, () => {
        const result = runRoutingLifecycle(context, { maxCandidates: budget.candidates, maxRepairRevisions: budget.repairs });
        budget.candidates -= result.trace.candidates; budget.repairs -= result.trace.repairRevisions;
        evidence.work.routes += result.trace.candidates;
        if (result.status === "resolved") {
          const changed = new Set<string>();
          for (const edge of positionedScene.edges) {
            const route = result.routeByConnectorId.get(edge.id);
            if (route && JSON.stringify(route) !== JSON.stringify(edge.route)) { edge.route = route; changed.add(edge.id); }
          }
          const beforeLabels = budget.candidates;
          if (changed.size && budget.candidates > 0) {
            const items = new Map(uiSceneItems(positionedScene.root).map(item => [item.id, item]));
            const placement = assessConnectorLabels({ scene: positionedScene, expectedLabels: uiExpectedLabels(positionedScene), searchConnectorIds: changed,
              scopeByConnectorId: new Map(positionedScene.edges.flatMap(edge => { const owner = edge.ownerContainerId && items.get(edge.ownerContainerId); return owner ? [[edge.id, owner] as const] : []; })),
              anchorConstraints: uiLoopLabelAnchors(positionedScene), relatedConnectorIdsByConnectorId: uiRelatedPhysicalSegments(positionedScene),
              rejectOwnRouteOverlap: true,
              rejectAmbiguousAssociation: true, requireAdjacentLabels: true, eventBasedHorizontalSearch: true,
              unrelatedRouteClearance: readableRoutingClearance(resolveRendererTheme(positionedScene.themeId).theme.paint.edgeStrokeWidth), searchBudget: budget });
            for (const edge of positionedScene.edges) if (changed.has(edge.id) && placement.labels.has(edge.id)) edge.label = placement.labels.get(edge.id);
          }
          evidence.work.labels += beforeLabels - budget.candidates;
          findings = [...positionedScene.diagnostics.filter(d => d.severity === "error"), ...auditUiContractsScene(positionedScene)];
        } else reason = result.reason === "candidate_exhausted" ? "candidate_budget" : result.reason === "repair_exhausted" ? "repair_budget" : result.reason === "repeated_state" ? "repeated_geometry" : "no_candidate";
      });
    }
    const accepted = findings.length === 0;
    evidence.trials.push({ choices: trial.choices, requirements: trial.ledger, findings, accepted }); lastFindings = findings;
    if (accepted) {
      const [crossings, bends, length] = routeCost(uiRoutingContext(positionedScene).connectors);
      const values = { crossings: crossings!, bends: bends!, length: length!, enlargement: trial.ledger.reduce((sum, request) =>
        sum + Math.max(0, request.minimumExtent - (baselineResourceExtents.get(resourceKey(request)) ?? 0)), 0) };
      // Source-ordered side choices compare lexicographically without an
      // overflowing mixed-radix scalar; each owned growth resource is counted once.
      const cost = model.routing.self_loop.selection.flatMap(criterion => criterion === "side_order" ? trial.choices : [values[criterion]]);
      if (!best || compareRouteCosts(cost, best.cost) < 0) best = { revision, cost };
    } else {
      enqueueRequirements(trial, capacityRequirements(positionedScene));
    }
  }
  evidence.candidates = maximum.candidates - budget.candidates; evidence.repairs = maximum.repairs - budget.repairs;
  if (best) return { status: "accepted", revision: best.revision, evidence };
  return { status: "failed", reason, violations: lastFindings, unresolved, evidence, diagnosticRevision };
}
