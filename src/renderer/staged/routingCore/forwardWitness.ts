import type { PositionedScene, RendererForwardRoutingWitness, PositionedItem } from "../contracts.js";
import type { FinalRoutingContext } from "./lifecycle.js";
import { auditMovableSourceAdmission } from "./movablePorts.js";

function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
/** Finite immutable downstream proof; solver histories and earlier witnesses are
 * omitted before cloning, so optional comparisons never build recursive trees. */
export function createForwardRoutingWitness(baseline: PositionedScene, shortcutIds: readonly string[], attachments?: RendererForwardRoutingWitness["attachments"]): RendererForwardRoutingWitness {
  const { routingEvidence: _evidence, forwardRoutingWitness: _witness, ...scene } = baseline;
  return freeze({ baseline: structuredClone(scene), shortcutIds: [...shortcutIds].sort(), ...(attachments ? { attachments: structuredClone(attachments) } : {}) });
}
function layoutBinding(scene: PositionedScene): string {
  const withoutPorts = (item: PositionedItem): unknown => {
    const { ports: _ports, ...rest } = item;
    return item.kind === "container" ? { ...rest, children: item.children.map(withoutPorts) } : rest;
  };
  return JSON.stringify({
    viewId: scene.viewId, detailId: scene.detailId, themeId: scene.themeId,
    iaAcceptancePolicy: scene.iaAcceptancePolicy, root: withoutPorts(scene.root), decorations: scene.decorations,
    paintOrder: scene.paintOrder, edges: scene.edges.map(edge => ({
      id: edge.id, role: edge.role, classes: edge.classes,
      source: edge.from.itemId, target: edge.to.itemId, markers: edge.markers, paintGroup: edge.paintGroup,
      label: edge.label && {
        lines: edge.label.lines, width: edge.label.width, height: edge.label.height,
        lineHeight: edge.label.lineHeight, textStyleRole: edge.label.textStyleRole
      }
    })).sort((a, b) => a.id.localeCompare(b.id))
  });
}
export interface ForwardWitnessAuditCallbacks {
  buildContext(scene: PositionedScene): FinalRoutingContext | undefined;
  /** Full ordinary baseline audit, including labels and painted markers. */
  auditOrdinary(scene: PositionedScene): readonly unknown[];
}
/** Recompute costs and baseline acceptance from geometry, never recorded cost
 * numbers. Layout/measurement/policy changes invalidate a stale witness. */
export function auditForwardRoutingWitness(scene: PositionedScene, callbacks: ForwardWitnessAuditCallbacks): string[] {
  const witness = scene.forwardRoutingWitness;
  if (!witness) return [];
  const baseline = witness.baseline as PositionedScene;
  // Reject forbidden history before binding or callbacks can traverse it.
  // A mutated downstream witness may contain a cycle back to this scene.
  if ("forwardRoutingWitness" in baseline || "routingEvidence" in baseline) return ["recursive_baseline"];
  const problems: string[] = [];
  if (layoutBinding(baseline) !== layoutBinding(scene)) problems.push("baseline_geometry_or_policy_mismatch");
  if (!witness.shortcutIds.length || new Set(witness.shortcutIds).size !== witness.shortcutIds.length) problems.push("invalid_shortcut_inventory");
  if (callbacks.auditOrdinary(baseline).length) problems.push("baseline_scene_rejected");
  const b = callbacks.buildContext(baseline), f = callbacks.buildContext(scene);
  if (!b || !f) problems.push("missing_baseline_context");
  else problems.push(...auditMovableSourceAdmission(b, f, new Set(witness.shortcutIds)));
  return problems;
}
/** Translate all absolute positioned geometry; local measured port offsets and
 * the loaded policy remain unchanged. Translation preserves comparison identity. */
export function translateForwardRoutingWitness(witness: RendererForwardRoutingWitness, dx: number, dy: number): RendererForwardRoutingWitness {
  if (![dx, dy].every(Number.isFinite)) throw new RangeError("Witness translation must be finite.");
  const scene = structuredClone(witness.baseline) as PositionedScene;
  const point = (p: { x: number; y: number;}) => { p.x += dx; p.y += dy; };
  const item = (node: PositionedItem) => { point(node); if (node.kind === "container") node.children.forEach(item); };
  item(scene.root);
  for (const edge of scene.edges) {
    point(edge.from); point(edge.to); edge.route.points.forEach(point);
    if (edge.label) point(edge.label);
    edge.continuityMarks?.forEach(mark => point(mark.point));
  }
  scene.decorations.forEach(decoration => { if (decoration.kind === "line") { point(decoration.from); point(decoration.to); } else point(decoration); });
  const attachments = witness.attachments?.map(attachment => {
    const shift = attachment.targetSide === "west" ? dx : attachment.targetSide === "east" ? -dx : attachment.targetSide === "north" ? dy : -dy;
    return { ...attachment, intervals: attachment.intervals.map(([a, b]) => [a + shift, b + shift] as const), midpoint: attachment.midpoint + shift, coordinate: attachment.coordinate + shift };
  });
  return createForwardRoutingWitness(scene, witness.shortcutIds, attachments);
}
