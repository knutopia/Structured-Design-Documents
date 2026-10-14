import { createRoutingDiagnostic, type RendererDiagnostic } from "./diagnostics.js";
import type { StagedRendererPipelineResult } from "./pipeline.js";
import type { RendererForwardRoutingWitness, PositionedScene, PositionedEdge, PositionedNode, PortSide } from "./contracts.js";
import { selectRoutingQuality, type RoutingQualityBudget } from "./routingCore/qualitySelection.js";
import type { FinalRoutingContext } from "./routingCore/lifecycle.js";
import { proposeMovableSourceRoutes, auditMovableSourceAdmission } from "./routingCore/movablePorts.js";
import { createForwardRoutingWitness, auditForwardRoutingWitness } from "./routingCore/forwardWitness.js";
import { READABLE_ROUTING_GEOMETRY, readablePortPitch } from "./routingCore/bounds.js";
import { getRendererTheme } from "./theme.js";
import { getNodePrimitiveTheme } from "./primitives.js";
import { collapseRoutePoints } from "./routingCore/geometry.js";
import { allocatePortOffsets } from "./routingCore/portCapacity.js";
import { routeCost } from "./routingCore/optimization.js";

export interface IaForwardShortcutCallbacks {
  buildContext(scene: PositionedScene): FinalRoutingContext | undefined;
  audit(scene: PositionedScene): RendererDiagnostic[];
  assessLabels(scene: PositionedScene, budget: RoutingQualityBudget): PositionedScene | undefined;
  ownerId(scene: PositionedScene, nodeId: string): string | undefined;
  portDisplacement?(scene: PositionedScene, movableSourceIds: ReadonlySet<string>): number;
  prepareTrial(result: StagedRendererPipelineResult, pairs: ReadonlyMap<string, readonly [PortSide, PortSide]>, budget: RoutingQualityBudget): Promise<PositionedScene | undefined>;
}
function nodes(scene: PositionedScene): Map<string, PositionedNode> {
  const result = new Map<string, PositionedNode>();
  const walk = (item: PositionedScene["root"] | PositionedNode) => {
    if (item.kind === "node") result.set(item.id, item); else item.children.forEach(walk);
  };
  walk(scene.root); return result;
}
function applyConnector(scene: PositionedScene, connector: FinalRoutingContext["connectors"][number]): PositionedScene {
  const copy = structuredClone(scene);
  const all = nodes(copy), edge = copy.edges.find(edge => edge.id === connector.id)!;
  for (const [reference, endpoint] of [[edge.from, connector.source], [edge.to, connector.target]] as const) {
    reference.x = endpoint.point.x; reference.y = endpoint.point.y;
    const node = all.get(reference.itemId)!, port = node.ports.find(port => port.id === reference.portId)!;
    port.side = endpoint.side; port.x = reference.x - node.x; port.y = reference.y - node.y;
    port.offset = endpoint.side === "south" || endpoint.side === "north" ? port.x : port.y;
  }
  edge.route = structuredClone(connector.route); return copy;
}
/** Optional optimization only after the corrected ordinary full scene is
 * accepted. All interval probes and label assessments consume the caller's live
 * solve budget; a failed shortcut never earns a repaired longer topology. */
export async function finalizeIaForwardShortcuts(result: StagedRendererPipelineResult, budget: RoutingQualityBudget,
  callbacks: IaForwardShortcutCallbacks): Promise<StagedRendererPipelineResult> {
  const baseline = result.positionedScene;
  const policy = baseline.iaAcceptancePolicy?.routingPreferences?.forward_shortcut
    ?? baseline.root.viewMetadata?.iaPlaceMap?.routingPreferences?.forward_shortcut;
  if (!policy || callbacks.audit(baseline).length || baseline.diagnostics.some(d => d.severity === "error")) return result;
  const baselineContext = callbacks.buildContext(baseline);
  if (!baselineContext) return result;
  const all = nodes(baseline);
  const structural = new Set((baseline.iaAcceptancePolicy ?? baseline.root.viewMetadata?.iaPlaceMap)?.expectedStructuralEdges.map(edge => edge.id));
  const eligible: Array<{ edge: PositionedEdge; pairs: readonly { source: PortSide; target: PortSide ;}[] ;}> = [];
  for (const edge of baseline.edges) {
    const connector = baselineContext.connectors.find(c => c.id === edge.id);
    const s = all.get(edge.from.itemId), t = all.get(edge.to.itemId);
    if (!connector || !s || !t || s.id === t.id || structural.has(edge.id) || connector.runConstraints?.size || connector.sharedTrackGroupBySegmentIndex?.size
      || collapseRoutePoints(connector.route.points).length <= 3 || callbacks.ownerId(baseline, s.id) !== callbacks.ownerId(baseline, t.id)) continue;
    const axis = policy.progression.axis, size = axis === "x" ? "width" : "height";
    if (policy.progression.direction === "positive" ? t[axis] <= s[axis] + s[size] : t[axis] + t[size] >= s[axis]) continue;
    eligible.push({ edge, pairs: policy.side_pairs });
  }
  eligible.sort((a, b) => a.edge.id.localeCompare(b.edge.id));
  const sets = eligible.map(item => [item]);
  // Bounded joint sets supplement singleton fairness, without an exhaustive
  // subset promise or a new branch allowance.
  if (eligible.length > 1) sets.push(eligible.slice(0, 4));
  let selected = baseline, selectedCost = routeCost(baselineContext.connectors);
  let selectedDisplacement = Infinity;
  let comparisonLimited = false;
  const rejected: Array<{ id: string; reason: string ;}> = [];
  for (const [setIndex, set] of sets.entries()) {
    const remainingSets = sets.length - setIndex;
    const reservedCandidates = Math.floor(budget.candidates * (remainingSets - 1) / remainingSets);
    budget.candidates -= reservedCandidates;
    try {
      for (let pairIndex = 0; pairIndex < Math.max(...set.map(item => item.pairs.length)); pairIndex++) {
        if (budget.candidates <= 0) { comparisonLimited = true; break; }
        budget.candidates--;
        const pairs = new Map(set.map(item => [item.edge.id, [item.pairs[pairIndex % item.pairs.length]!.source, item.pairs[pairIndex % item.pairs.length]!.target] as const]));
        let trial = await callbacks.prepareTrial(result, pairs, budget);
        if (!trial) { rejected.push({ id: set.map(item => item.edge.id).join(","), reason: "ordinary_target_capacity" }); continue; }
        const proposals: Array<{ scene: PositionedScene; displacement: number; attachments: NonNullable<RendererForwardRoutingWitness["attachments"]> ;}> = [{ scene: trial, displacement: 0, attachments: [] }];
        const settled = new Set<string>();
        const geometricSet = [...set].sort((a, b) => {
          const axis = policy.progression.axis, sign = policy.progression.direction === "positive" ? 1 : -1;
          return sign * (all.get(b.edge.to.itemId)![axis] - all.get(a.edge.to.itemId)![axis]) || a.edge.id.localeCompare(b.edge.id);
        });
        for (const item of geometricSet) {
          const next: Array<{ scene: PositionedScene; displacement: number; attachments: NonNullable<RendererForwardRoutingWitness["attachments"]> ;}> = [];
          for (const partial of proposals.slice(0, 4)) {
            const built = callbacks.buildContext(partial.scene);
            if (!built) continue;
            const context = { ...built, connectors: built.connectors.filter(connector => !pairs.has(connector.id) || settled.has(connector.id) || connector.id === item.edge.id) };
            const source = nodes(partial.scene).get(item.edge.from.itemId)!;
            const [sourceSide, targetSide] = pairs.get(item.edge.id)!;
            const theme = getRendererTheme(partial.scene.themeId, "routing");
            const occupied = context.connectors.filter(c => c.id !== item.edge.id).flatMap(c => [c.source, c.target])
              .filter(endpoint => endpoint.nodeId === source.id && endpoint.side === sourceSide).map(endpoint => endpoint.point);
            const extraBlockers = partial.scene.edges.filter(edge => !pairs.has(edge.id) && edge.label).map(edge => ({
id: `forward-label:${edge.id}`,
              x: edge.label!.x, y: edge.label!.y, width: edge.label!.width, height: edge.label!.height, clearance: READABLE_ROUTING_GEOMETRY.clearance
}));
            const proposed = proposeMovableSourceRoutes({
context, connectorId: item.edge.id, sourceBox: source, sourceSide, targetSide,
              sourceInset: getNodePrimitiveTheme(theme, source.primitive).portInset, portPitch: readablePortPitch(theme.paint.arrowSize, theme.paint.edgeStrokeWidth),
              occupiedSourcePorts: occupied, extraBlockers, budget
});
            comparisonLimited ||= proposed.exhausted;
            for (const proposal of proposed.proposals.slice(0, 4)) next.push({ scene: applyConnector(partial.scene, proposal.connector), displacement: partial.displacement + proposal.displacement, attachments: [...partial.attachments, { connectorId: item.edge.id, targetSide, intervals: proposed.intervals.map(interval => [...interval] as const), midpoint: proposal.midpoint, coordinate: proposal.coordinate, displacement: proposal.displacement }] });
            if (!proposed.proposals.length) rejected.push({ id: item.edge.id, reason: proposed.exhausted ? "comparison_limit" : proposed.rejections.join(",") });
          }
          proposals.splice(0, proposals.length, ...next);
          settled.add(item.edge.id);
        }
        for (const candidate of proposals) {
          const full = callbacks.assessLabels(candidate.scene, budget);
          if (!full) { rejected.push({ id: set.map(item => item.edge.id).join(","), reason: "label_capacity_or_association" }); continue; }
          const context = callbacks.buildContext(full);
          if (!context) continue;
          const ids = new Set(pairs.keys());
          const reasons = auditMovableSourceAdmission(baselineContext, context, ids);
          const witnessed = { ...full, forwardRoutingWitness: createForwardRoutingWitness(baseline, [...ids], candidate.attachments) };
          reasons.push(...auditForwardRoutingWitness(witnessed, { buildContext: callbacks.buildContext, auditOrdinary: callbacks.audit }));
          const displacement = callbacks.portDisplacement?.(full, ids) ?? candidate.displacement;
          const selection = selectRoutingQuality([{ id: [...ids].join(","), context, portDisplacement: displacement }], {
            budget, maxCandidates: 1, maxRepairRevisions: 0,
            accept: () => callbacks.audit(witnessed).length === 0,
            admit: () => reasons.length === 0
          });
          if (!selection.selected) { rejected.push({ id: [...ids].join(","), reason: reasons.join(",") || selection.rejected[0]?.reason || "comparison_limit" }); continue; }
          const cost = routeCost(selection.selected.context.connectors);
          if (cost[0] < selectedCost[0] || cost[0] === selectedCost[0] && (cost[1] < selectedCost[1]
            || cost[1] === selectedCost[1] && (displacement < selectedDisplacement || displacement === selectedDisplacement && cost[2] < selectedCost[2]))) {
            selected = witnessed; selectedCost = cost; selectedDisplacement = displacement;
          }
        }
      }
    } finally { budget.candidates += reservedCandidates; }
  }
  if (comparisonLimited && !selected.diagnostics.some(diagnostic => diagnostic.code === "renderer.routing.ia_quality_comparison_limited")) {
    selected = { ...selected, diagnostics: [...selected.diagnostics, createRoutingDiagnostic(
      "renderer.routing.ia_quality_comparison_limited",
      "IA routing passed final acceptance; optional forward comparison reached its aggregate allowance.", selected.root.id) ] };
  }
  return {
    ...result,
    positionedScene: {
      ...selected,
      routingEvidence: {
        ...(selected.routingEvidence ?? { candidates: 0, repairs: 0, revisions: [] }),
        revisions: [
          ...(selected.routingEvidence?.revisions ?? []),
          { pass: 0, costs: [["forward-baseline", routeCost(baselineContext.connectors)], ["forward-selected", selectedCost]],
            rejected, remainingCandidates: budget.candidates, remainingRepairs: budget.repairs }
        ]
      }
    }
  };
}

/** Adapter-owned eligibility audited independently of interval generation. */
export function auditIaForwardShortcutScene(scene: PositionedScene, callbacks: Pick<IaForwardShortcutCallbacks, "buildContext" | "ownerId"> & {
  auditOrdinary(scene: PositionedScene): readonly unknown[];
}): string[] {
  const witness = scene.forwardRoutingWitness;
  const problems = auditForwardRoutingWitness(scene, callbacks);
  const policy = (scene.iaAcceptancePolicy ?? scene.root.viewMetadata?.iaPlaceMap)?.routingPreferences?.forward_shortcut;
  if (!policy) return witness ? [...problems, "missing_forward_policy"] : [];
  const context = callbacks.buildContext(scene), all = nodes(scene);
  if (!context) return [...problems, "missing_forward_context"];
  const theme = getRendererTheme(scene.themeId, "routing"), pitch = readablePortPitch(theme.paint.arrowSize, theme.paint.edgeStrokeWidth);
  problems.push(...auditOrdinaryForwardPorts(scene, context, witness?.shortcutIds ?? []));
  for (const id of witness?.shortcutIds ?? []) {
    const connector = context.connectors.find(c => c.id === id);
    if (!connector) continue;
    const source = all.get(connector.source.nodeId), target = all.get(connector.target.nodeId);
    if (!source || !target) { problems.push(`missing_forward_node:${id}`); continue; }
    if (!policy.side_pairs.some(pair => pair.source === connector.source.side && pair.target === connector.target.side)) problems.push(`unconfigured_forward_sides:${id}`);
    if (callbacks.ownerId(scene, source.id) !== callbacks.ownerId(scene, target.id)) problems.push(`cross_owner_forward:${id}`);
    const axis = policy.progression.axis, size = axis === "x" ? "width" : "height";
    if (policy.progression.direction === "positive" ? target[axis] <= source[axis] + source[size] : target[axis] + target[size] >= source[axis]) problems.push(`backward_forward:${id}`);
    const horizontal = connector.source.side === "north" || connector.source.side === "south";
    const offset = horizontal ? connector.source.point.x - source.x : connector.source.point.y - source.y;
    const inset = getNodePrimitiveTheme(theme, source.primitive).portInset;
    const length = horizontal ? source.width : source.height;
    if (offset < inset - READABLE_ROUTING_GEOMETRY.tolerance || offset > length - inset + READABLE_ROUTING_GEOMETRY.tolerance) problems.push(`forward_source_inset:${id}`);
    for (const other of context.connectors) for (const endpoint of [other.source, other.target]) {
      if (endpoint === connector.source || endpoint.nodeId !== source.id || endpoint.side !== connector.source.side) continue;
      const distance = horizontal ? Math.abs(endpoint.point.x - connector.source.point.x) : Math.abs(endpoint.point.y - connector.source.point.y);
      if (distance < pitch - READABLE_ROUTING_GEOMETRY.tolerance) problems.push(`forward_source_pitch:${id}`);
    }
  }
  return problems;
}

/** Ordinary centring has explicit structural-reservation, facing-reconciliation,
 * and ordered-loop exceptions. Missing witnesses cannot authorize movable
 * perpendicular sources merely because their attachment is inside the card. */
function auditOrdinaryForwardPorts(scene: PositionedScene, context: FinalRoutingContext, shortcutIds: readonly string[]): string[] {
  const inventory = scene.iaAcceptancePolicy ?? scene.root.viewMetadata?.iaPlaceMap;
  if (!inventory) return ["missing_forward_inventory"];
  const structural = new Set(inventory.expectedStructuralEdges.map(edge => edge.id));
  const movable = new Set(shortcutIds), all = nodes(scene), problems: string[] = [];
  const theme = getRendererTheme(scene.themeId, "routing"), pitch = readablePortPitch(theme.paint.arrowSize, theme.paint.edgeStrokeWidth);
  const groups = new Map<string, Array<{ id: string; offset: number; connector: FinalRoutingContext["connectors"][number]; source: boolean ;}>>();
  const reserved = new Map<string, number[]>();
  for (const connector of context.connectors) for (const [source, endpoint] of [[true, connector.source], [false, connector.target]] as const) {
    const node = all.get(endpoint.nodeId); if (!node) continue;
    const key = `${node.id}\0${endpoint.side}`;
    const offset = endpoint.side === "north" || endpoint.side === "south" ? endpoint.point.x - node.x : endpoint.point.y - node.y;
    if (structural.has(connector.id)) { reserved.set(key, [...(reserved.get(key) ?? []), offset]); continue; }
    if (source && movable.has(connector.id)) continue;
    groups.set(key, [...(groups.get(key) ?? []), { id: `${connector.id}:${source}`, offset, connector, source }]);
  }
  for (const [key, group] of groups) {
    const [nodeId, side] = key.split("\0"), node = all.get(nodeId!)!;
    // Ordinary slots are allocated before ordered loop pairs. Exclude the pair
    // itself, whose traversal is audited separately, but still check every
    // ordinary endpoint sharing its side against that original allocation.
    const ordinary = inventory.routingPreferences?.self_loop
      ? group.filter(item => item.connector.source.nodeId !== item.connector.target.nodeId) : group;
    if (!ordinary.length) continue;
    const ordered = [...ordinary].sort((a, b) => a.offset - b.offset || a.id.localeCompare(b.id));
    const allocation = allocatePortOffsets({
sideLength: side === "north" || side === "south" ? node.width : node.height,
      minInset: getNodePrimitiveTheme(theme, node.primitive).portInset, minSeparation: pitch, reservedOffsets: reserved.get(key), requestIds: ordered.map(item => item.id)
});
    if (allocation.status !== "allocated") { problems.push(`ordinary_port_capacity:${key}`); continue; }
    for (const item of ordered) {
      if (Math.abs(item.offset - allocation.offsets.get(item.id)!) <= READABLE_ROUTING_GEOMETRY.tolerance) continue;
      const a = item.source ? item.connector.source : item.connector.target, b = item.source ? item.connector.target : item.connector.source;
      const facing = a.side === "north" && b.side === "south" || a.side === "south" && b.side === "north" || a.side === "east" && b.side === "west" || a.side === "west" && b.side === "east";
      const aligned = a.side === "north" || a.side === "south" ? Math.abs(a.point.x - b.point.x) <= READABLE_ROUTING_GEOMETRY.tolerance : Math.abs(a.point.y - b.point.y) <= READABLE_ROUTING_GEOMETRY.tolerance;
      if (group.length === 1 && facing && aligned && !(reserved.get(key)?.length)) continue;
      problems.push(`${scene.forwardRoutingWitness ? "ordinary_port_allocation" : "missing_forward_witness"}:${item.id}`);
    }
  }
  return problems;
}
