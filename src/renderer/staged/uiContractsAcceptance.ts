import type { MeasuredEdgeLabel, PositionedItem, PositionedScene } from "./contracts.js";
import { createRoutingDiagnostic, sortRendererDiagnostics, type RendererDiagnostic } from "./diagnostics.js";
import { auditConnectorLabels, wrappedLabelPreservesText } from "./connectorLabelLayout.js";
import { createEdgeLabelMeasurementService } from "./microLayout.js";
import { auditPositionedSceneMarkers, buildEndpointMarkerRoutingBlockers } from "./markerAudit.js";
import { readablePortPitch, readableRoutingClearance } from "./routingCore/bounds.js";
import { validateFinalRouteSet, type FinalRoutingContext } from "./routingCore/lifecycle.js";
import { resolveRendererTheme } from "./theme.js";
import { auditPositionedSceneContentBounds } from "./contentBoundsAudit.js";

export function uiSceneItems(item: PositionedItem): PositionedItem[] {
  return [item, ...(item.kind === "container" ? item.children.flatMap(uiSceneItems) : [])];
}

export function uiExpectedLabels(scene: PositionedScene): Map<string, MeasuredEdgeLabel> {
  const measure = createEdgeLabelMeasurementService(scene.themeId, []);
  return new Map((scene.root.viewMetadata?.uiContracts?.inventory?.segments ?? []).flatMap(segment =>
    segment.label ? [[segment.id, measure({ text: segment.label, textStyleRole: "edge_label" }, segment.id)] as const] : []));
}

export function uiLoopLabelAnchors(scene: PositionedScene): Map<string, { routeSegmentIndex: number; side: -1 | 1 }> {
  const bindings = new Map(scene.uiRoutingBindings?.map(binding => [binding.id, binding]));
  return new Map(scene.edges.flatMap(edge => {
    const side = bindings.get(edge.id)?.source.side;
    return edge.viewMetadata?.uiTransition?.kind === "loop" && side ? [[edge.id, { routeSegmentIndex: 1,
      side: side === "south" || side === "east" ? 1 as const : -1 as const }] as const] : [];
  }));
}

export function uiRelatedPhysicalSegments(scene: PositionedScene): Map<string, ReadonlySet<string>> {
  const inventory = scene.root.viewMetadata?.uiContracts?.inventory;
  return new Map(inventory?.segments.map(segment => [segment.id, new Set(inventory.segments.filter(other =>
    other.id !== segment.id && other.relationshipIds.some(id => segment.relationshipIds.includes(id))).map(other => other.id))]));
}

/** Margin-only incidence at an explicitly declared, independently bound junction.
 * Semantic cards and merely belonging to the same group grant no permission. */
function uiMarkerPathNeighbors(scene: PositionedScene): Map<string, ReadonlySet<string>> {
  const related = uiRelatedPhysicalSegments(scene), semanticItems = new Set(scene.root.viewMetadata?.uiContracts?.inventory?.occurrences.map(item => item.id));
  return new Map(scene.edges.map(edge => [edge.id, new Set([
    ...(related.get(edge.id) ?? []), ...scene.edges.filter(other => other.id !== edge.id
      && edge.viewMetadata?.uiJunction?.groupId !== undefined && edge.viewMetadata.uiJunction.groupId === other.viewMetadata?.uiJunction?.groupId
      && [edge.from, edge.to].some(endpoint => !semanticItems.has(endpoint.itemId)
        && [other.from, other.to].some(peer => peer.itemId === endpoint.itemId && Math.hypot(peer.x - endpoint.x, peer.y - endpoint.y) < 0.001)))
      .map(other => other.id)
  ])]));
}

export function uiRoutingContext(scene: PositionedScene): FinalRoutingContext {
  const theme = resolveRendererTheme(scene.themeId).theme;
  const items = uiSceneItems(scene.root), index = new Map(items.map(item => [item.id, item]));
  const bindings = new Map(scene.uiRoutingBindings?.map(binding => [binding.id, binding]));
  const connectors = scene.edges.flatMap((edge, priority) => {
    const bound = bindings.get(edge.id);
    if (!bound) return [];
    const owner = edge.ownerContainerId ? index.get(edge.ownerContainerId) : undefined;
    return [{ id: edge.id, route: edge.route, source: bound.source, target: bound.target, priority,
      fixed: edge.viewMetadata?.uiTransition?.kind === "loop" || edge.viewMetadata?.uiTransition?.retainRoute === true,
      ...(owner ? { routingBounds: { ownerId: owner.id, minX: owner.x, minY: owner.y,
        maxX: owner.x + owner.width, maxY: owner.y + owner.height } } : {}) }];
  });
  const connectorByMarker = new Map<string, string>(scene.edges.flatMap(edge => (["start", "end"] as const).map(end => [`${edge.id}:${end}:marker`, edge.id] as const)));
  const related = uiMarkerPathNeighbors(scene);
  return { connectors, boxes: items.filter(item => item.kind === "node"),
    blockers: [
      ...items.flatMap(item => item.kind === "container" ? [
        ...(item.chrome.headerBandHeight ? [{ id: `${item.id}:header`, x: item.x, y: item.y, width: item.width, height: item.chrome.headerBandHeight }] : []),
        ...item.headerContent.map(block => ({ id: block.id, x: item.x + block.x, y: item.y + block.y, width: block.width, height: block.height }))] : []),
      ...scene.edges.flatMap(edge => edge.label ? [{ id: `label:${edge.id}`, ...edge.label, clearance: theme.paint.edgeStrokeWidth / 2 }] : []),
      ...buildEndpointMarkerRoutingBlockers(connectors, new Map(scene.edges.map(edge => [edge.id, edge.markers])), theme.paint.arrowSize, theme.paint.edgeStrokeWidth).flatMap(blocker => {
        const ownId = connectorByMarker.get(blocker.id)!;
        // Painted footprints block every other physical connector. Only the
        // additional unrelated-route margin excludes pieces of its own path.
        return [blocker, { ...blocker, id: `${blocker.id}:readable`, clearance: readableRoutingClearance(theme.paint.edgeStrokeWidth),
          appliesToConnectorIds: blocker.appliesToConnectorIds?.filter(id => !related.get(ownId)?.has(id)) }];
      })
    ], bounds: { minX: scene.root.x, minY: scene.root.y, maxX: scene.root.x + scene.root.width, maxY: scene.root.y + scene.root.height },
    policy: { crossingTreatment: "penalize" } };
}

/** Read-only full revision contract, shared by trial assessment and serialization. */
export function auditUiContractsScene(scene: PositionedScene): RendererDiagnostic[] {
  const metadata = scene.root.viewMetadata?.uiContracts;
  const policy = scene.uiAcceptancePolicy ?? metadata?.routing;
  if (!policy) return [];
  const findings: RendererDiagnostic[] = auditPositionedSceneContentBounds(scene);
  const fail = (kind: string, id: string, message: string) => findings.push(createRoutingDiagnostic(`renderer.routing.ui_contracts_${kind}`, message, id, "error"));
  const inventory = metadata?.inventory;
  if (!inventory) { fail("inventory_missing", scene.root.id, "Enabled UI scene has no prepared relationship inventory."); return findings; }
  const items = new Map(uiSceneItems(scene.root).map(item => [item.id, item]));
  const edges = new Map(scene.edges.map(edge => [edge.id, edge]));
  const occurrences = new Map(inventory.occurrences.map(occurrence => [occurrence.id, occurrence.semanticId]));
  if (edges.size !== scene.edges.length) fail("duplicate_path", scene.root.id, "Painted connector IDs are duplicated.");
  for (const occurrence of inventory.occurrences) if (!items.has(occurrence.id)) fail("missing_occurrence", occurrence.id, "Prepared node occurrence is absent.");
  for (const relation of inventory.relationships) {
    if (!relation.structural && !relation.segmentIds.length) fail("missing_relationship", relation.id, "Prepared relationship has no declared path.");
    for (const id of relation.segmentIds) if (!edges.has(id)) fail("missing_segment", relation.id, `Declared physical segment '${id}' is absent.`);
    for (const id of relation.segmentIds) if (!inventory.segments.find(segment => segment.id === id)?.relationshipIds.includes(relation.id))
      fail("provenance", relation.id, `Physical segment '${id}' lost relationship provenance.`);
    if (!relation.structural && !relation.paths?.length) fail("path_coverage", relation.id, "Relationship has no declared ordered path.");
    const used = new Set<string>();
    for (const path of relation.paths ?? []) {
      if (occurrences.get(path.from) !== relation.from || occurrences.get(path.to) !== relation.to)
        fail("provenance", relation.id, "Ordered path endpoints disagree with semantic relationship provenance.");
      let previous: PositionedScene["edges"][number]["from"] | undefined;
      for (const [index, ref] of path.segments.entries()) {
        used.add(ref.id);
        const segment = edges.get(ref.id);
        if (!segment || !relation.segmentIds.includes(ref.id)) { fail("path_coverage", relation.id, "Ordered path references an absent or undeclared physical segment."); continue; }
        const start = ref.reverse ? segment.to : segment.from, end = ref.reverse ? segment.from : segment.to;
        if (index === 0 && start.itemId !== path.from || index === path.segments.length - 1 && end.itemId !== path.to
          || previous && (previous.itemId !== start.itemId || Math.hypot(previous.x - start.x, previous.y - start.y) > 0.001))
          fail("path_continuity", relation.id, "Declared physical path is discontinuous or out of order.");
        previous = end;
      }
    }
    for (const id of relation.segmentIds) if (!used.has(id)) fail("path_coverage", relation.id, `Physical segment '${id}' is outside the ordered relationship paths.`);
  }
  const bindings = new Map(scene.uiRoutingBindings?.map(binding => [binding.id, binding]));
  const expectedLabels = uiExpectedLabels(scene);
  for (const segment of inventory.segments) {
    for (const id of segment.relationshipIds) if (!inventory.relationships.find(relation => relation.id === id)?.segmentIds.includes(segment.id))
      fail("provenance", segment.id, "Physical segment references absent relationship provenance.");
    const edge = edges.get(segment.id);
    if (!edge) { fail("missing_path", segment.id, "Expected physical connector is absent."); continue; }
    if (edge.from.itemId !== segment.from.itemId || edge.to.itemId !== segment.to.itemId
      || edge.ownerContainerId !== segment.ownerContainerId || JSON.stringify(edge.classes) !== JSON.stringify(segment.classes)) fail("provenance", edge.id, "Connector endpoints, owner, or style disagree with prepared intent.");
    if (JSON.stringify(edge.viewMetadata?.uiTransition) !== JSON.stringify(segment.transition)) fail("provenance", edge.id, "Transition routing intent disagrees with the prepared inventory.");
    if (JSON.stringify(edge.viewMetadata?.uiJunction) !== JSON.stringify(segment.junction)) fail("provenance", edge.id, "Junction direction/sharing intent disagrees with prepared inventory.");
    if (JSON.stringify(edge.markers ?? {}) !== JSON.stringify(segment.markers ?? {})) fail("marker_coverage", edge.id, "Expected markers have changed.");
    if (segment.label && (!edge.label || !wrappedLabelPreservesText(edge.label.lines, segment.label))) fail("label_coverage", edge.id, "Full prepared label is absent or changed.");
    const expectedLabel = expectedLabels.get(edge.id);
    if (expectedLabel && edge.label && (edge.label.width !== expectedLabel.width || edge.label.height !== expectedLabel.height || edge.label.lineHeight !== expectedLabel.lineHeight))
      fail("label_measurement", edge.id, "Painted label dimensions disagree with production text measurement.");
    const bound = bindings.get(edge.id);
    if (!bound) { fail("binding_missing", edge.id, "Connector has no independently allocated attachment contract."); continue; }
    if ((segment.transition?.kind === "loop" || segment.transition?.retainRoute) && (!bound.fixedRoute || JSON.stringify(bound.fixedRoute) !== JSON.stringify(edge.route))) fail("fixed_route", edge.id, "A retained connector changed within its allocated trial.");
    for (const role of ["source", "target"] as const) {
      const endpoint = role === "source" ? edge.from : edge.to, binding = bound[role];
      const item = items.get(binding.nodeId), port = item?.ports.find(port => port.id === binding.portId);
      const declaredSide = item?.kind === "container" ? role === "source" ? segment.junction?.sourceSide ?? port?.side : segment.junction?.targetSide ?? port?.side : port?.side;
      if (!item || !port || declaredSide !== binding.side || endpoint.itemId !== binding.nodeId || endpoint.portId !== binding.portId
        || Math.abs(endpoint.x - binding.point.x) > 0.001 || Math.abs(endpoint.y - binding.point.y) > 0.001
        || Math.abs(item.x + port.x - binding.point.x) > 0.001 || Math.abs(item.y + port.y - binding.point.y) > 0.001) fail("attachment", edge.id, "Endpoint disagrees with independently allocated node/junction port.");
    }
    if (segment.transition?.kind === "loop") {
      const theme = resolveRendererTheme(scene.themeId).theme, points = edge.route.points;
      const pitch = readablePortPitch(theme.paint.arrowSize, theme.paint.edgeStrokeWidth), depth = readableRoutingClearance(theme.paint.edgeStrokeWidth);
      const direction = policy.self_loop.traversal.direction === "negative" ? -1 : 1;
      const side = bound.source.side, horizontal = side === "north" || side === "south", axis = horizontal ? "x" : "y", normal = horizontal ? "y" : "x";
      const sign = side === "south" || side === "east" ? 1 : -1;
      if (points.length !== 4 || side !== bound.target.side || bound.source.nodeId !== bound.target.nodeId
        || !policy.self_loop.side_trials.some(trial => trial.side === side)
        || Math.abs((bound.target.point[axis] - bound.source.point[axis]) - direction * pitch) > 0.001
        || Math.abs(bound.target.point[normal] - bound.source.point[normal]) > 0.001
        || points.length === 4 && (Math.abs(points[1]![normal] - bound.source.point[normal] - sign * depth) > 0.001
          || Math.abs(points[2]![normal] - bound.target.point[normal] - sign * depth) > 0.001
          || Math.abs(points[1]![axis] - bound.source.point[axis]) > 0.001 || Math.abs(points[2]![axis] - bound.target.point[axis]) > 0.001)) fail("compact_shape", edge.id, "Loop violates loaded traversal or shared compact pitch/depth.");
      const owner = edge.ownerContainerId ? items.get(edge.ownerContainerId) : undefined;
      const boxes = [...points.map(point => ({ ...point, width: 0, height: 0 })), ...(edge.label ? [edge.label] : [])];
      if (!owner || boxes.some(box => box.x - depth < owner.x - 0.5 || box.y - depth < owner.y - 0.5
        || box.x + box.width + depth > owner.x + owner.width + 0.5 || box.y + box.height + depth > owner.y + owner.height + 0.5))
        fail("export_clearance", edge.id, "Compact connector and full external label need readable space inside their declared owner.");
    }
  }
  for (const edge of scene.edges) if (!inventory.segments.some(segment => segment.id === edge.id)) fail("unexpected_path", edge.id, "Painted connector has no inventory provenance.");
  const context = uiRoutingContext(scene);
  for (const violation of validateFinalRouteSet(context)) fail(violation.kind, violation.connectorIds[0] ?? scene.root.id, violation.message);
  const scopeByConnectorId = new Map(scene.edges.flatMap(edge => {
    const owner = edge.ownerContainerId && items.get(edge.ownerContainerId);
    return owner ? [[edge.id, owner] as const] : [];
  }));
  const clearance = readableRoutingClearance(resolveRendererTheme(scene.themeId).theme.paint.edgeStrokeWidth);
  for (const problem of auditConnectorLabels({ scene, expectedLabels: uiExpectedLabels(scene), scopeByConnectorId,
    relatedConnectorIdsByConnectorId: uiRelatedPhysicalSegments(scene),
    rejectOwnRouteOverlap: true,
    anchorConstraints: uiLoopLabelAnchors(scene), rejectAmbiguousAssociation: true, requireAdjacentLabels: true, unrelatedRouteClearance: clearance }).problems)
    fail(`label_${problem.kind}`, problem.connectorId, `Label ${problem.kind}${problem.obstacleId ? ` against '${problem.obstacleId}'` : ""}.`);
  findings.push(...auditPositionedSceneMarkers(scene, { scopeByConnectorId, unrelatedRouteClearance: clearance,
    samePathConnectorIdsByConnectorId: uiMarkerPathNeighbors(scene) }));
  for (const item of items.values()) if (item.kind === "container") for (const child of item.children) {
    if (child.x < item.x - 0.5 || child.y < item.y - 0.5 || child.x + child.width > item.x + item.width + 0.5
      || child.y + child.height > item.y + item.height + 0.5) fail("containment", child.id, `Child does not fit actual owner '${item.id}'.`);
  }
  return sortRendererDiagnostics(findings);
}
