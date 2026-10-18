import type { MeasuredContentBlock, PositionedItem, PositionedScene } from "./contracts.js";
import { createRoutingDiagnostic, sortRendererDiagnostics, type RendererDiagnostic } from "./diagnostics.js";
import { READABLE_ROUTING_GEOMETRY } from "./routingCore/bounds.js";

/** The SVG painter reads shared layouts directly, rather than their flattened
 * node.content copies. All painted block coordinates are local to their item,
 * including shared decorator, title and attribute blocks (not their regions). */
export function paintedItemContent(item: PositionedItem): readonly MeasuredContentBlock[] {
  if (item.kind === "container") return item.headerContent;
  if (!item.content.length) return [];
  const shared = item.sharedNode;
  return shared ? [
    ...(shared.decorator?.items ?? []), shared.body.title,
    ...shared.body.attributeGroups.flatMap(group => [group.label, ...group.values])
  ] : item.content;
}

/** Read-only content containment on the exact objects consumed by the painter.
 * A badge block already includes its chrome padding in its measured rectangle. */
export function auditPositionedSceneContentBounds(scene: PositionedScene): RendererDiagnostic[] {
  const findings: RendererDiagnostic[] = [];
  const tolerance = READABLE_ROUTING_GEOMETRY.tolerance;
  const valid = (box: { x: number; y: number; width: number; height: number }): boolean =>
    [box.x, box.y, box.width, box.height, box.x + box.width, box.y + box.height].every(Number.isFinite)
    && box.width >= 0 && box.height >= 0;
  const inside = (box: { x: number; y: number; width: number; height: number }, owner: PositionedItem): boolean =>
    valid(owner) && box.x >= owner.x - tolerance && box.y >= owner.y - tolerance
    && box.x + box.width <= owner.x + owner.width + tolerance && box.y + box.height <= owner.y + owner.height + tolerance;
  const visit = (item: PositionedItem): void => {
    for (const block of paintedItemContent(item)) {
      const box = { x: item.x + block.x, y: item.y + block.y, width: block.width, height: block.height };
      const fail = (kind: string, message: string) => findings.push(createRoutingDiagnostic(
        `renderer.routing.content_${kind}`, `Painted content '${block.id}' ${message}`, block.id, "error"));
      if (!valid(block) || !valid(box) || !Number.isFinite(block.lineHeight) || block.lineHeight < 0) {
        fail("invalid_bounds", `has invalid dimensions or coordinates in owner '${item.id}'.`);
        continue;
      }
      if (!inside(box, item)) fail("owner_bounds", `does not fit actual owner '${item.id}'.`);
      if (!inside(box, scene.root)) fail("viewport_bounds", `does not fit exported viewport '${scene.root.id}'.`);
    }
    if (item.kind === "container") item.children.forEach(visit);
  };
  visit(scene.root);
  return sortRendererDiagnostics(findings);
}
