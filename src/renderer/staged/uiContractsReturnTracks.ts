import type { MeasuredScene } from "./contracts.js";
import { createEdgeLabelMeasurementService } from "./microLayout.js";
import { FIXED_LABEL_DISTANCE } from "./connectorLabelPlacement.js";
import { readableRoutingClearance } from "./routingCore/bounds.js";
import { resolveRendererTheme } from "./theme.js";
import { UI_CONTRACTS_SPACING } from "./uiContractsPresentationScene.js";

/** Allocation belongs to this measured revision, never to scene intent.
 * Empty labels retain the same production-measured reservation as labelled
 * returns; they simply do not paint a label. */
export function allocateUiReturnTracks(scene: MeasuredScene): ReadonlyMap<string, number> {
  const clearance = readableRoutingClearance(resolveRendererTheme(scene.themeId).theme.paint.edgeStrokeWidth);
  const measure = createEdgeLabelMeasurementService(scene.themeId, []);
  const groups = new Map<string, MeasuredScene["edges"]>();
  for (const edge of scene.edges) {
    const intent = edge.viewMetadata?.uiTransition;
    if (intent?.kind !== "return") continue;
    const key = JSON.stringify([intent.ownerId, intent.sequenceOwnerId]), group = groups.get(key) ?? [];
    group.push(edge); groups.set(key, group);
  }
  const tracks = new Map<string, number>();
  for (const group of groups.values()) {
    // Stable sort retains source order for equal/absent lanes.
    group.sort((a, b) => (a.viewMetadata!.uiTransition!.returnLane ?? 0) - (b.viewMetadata!.uiTransition!.returnLane ?? 0));
    let offset = -UI_CONTRACTS_SPACING.arrowApproach;
    for (const edge of group) {
      tracks.set(edge.id, offset);
      const reservation = edge.label ?? measure({ text: "", textStyleRole: "edge_label" }, edge.id);
      offset -= Math.max(clearance, reservation.height + FIXED_LABEL_DISTANCE + clearance);
    }
  }
  return tracks;
}
