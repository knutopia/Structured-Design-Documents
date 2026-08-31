import type { RendererCellSizingConfig } from "../../bundle/types.js";
import type { LayoutIntent, MeasuredContainer, PositionedContainer, PositionedItem } from "./contracts.js";

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function buildCellSlots(
  policy: RendererCellSizingConfig,
  diagramId: string,
  laneId: string
): NonNullable<LayoutIntent["slots"]> {
  return {
    heightGroup: JSON.stringify([diagramId, policy.node_tier_scope === "lane" ? laneId : null]),
    minimumCount: 1,
    minimumHeightPrimitive: "card",
    alignment: policy.stack_alignment
  };
}

export function stackSlotExtent(count: number, height: number, gap: number): number {
  return roundMetric(count * height + Math.max(0, count - 1) * gap);
}

export function reservedStackSlotHeight(container: Pick<MeasuredContainer, "layout" | "resolvedSlotHeight" | "children" | "chrome">): number | undefined {
  if (container.resolvedSlotHeight === undefined || !container.layout.slots) {
    return undefined;
  }
  return stackSlotExtent(
    Math.max(container.layout.slots.minimumCount, container.children.length),
    container.resolvedSlotHeight,
    container.layout.gap ?? container.chrome.gutter ?? 0
  );
}

function translate(item: PositionedItem, dx: number, dy: number): void {
  item.x = roundMetric(item.x + dx);
  item.y = roundMetric(item.y + dy);
  if (item.kind === "container") {
    item.children.forEach(child => translate(child, dx, dy));
  }
}

/** Reapply slot alignment after a grid has stretched the containing cell. */
export function alignPositionedStackSlots(container: PositionedContainer): void {
  const slots = container.layout.slots;
  const slotHeight = container.resolvedSlotHeight;
  if (!slots || slotHeight === undefined) {
    return;
  }
  const { padding, headerBandHeight = 0 } = container.chrome;
  const gap = container.layout.gap ?? container.chrome.gutter ?? 0;
  const contentHeight = container.height - padding.top - padding.bottom - headerBandHeight;
  const contentWidth = container.width - padding.left - padding.right;
  const occupiedHeight = stackSlotExtent(container.children.length, slotHeight, gap);
  const stackOffset = slots.alignment === "center" ? Math.max(0, (contentHeight - occupiedHeight) / 2) : 0;
  container.children.forEach((child, index) => {
    const slotOffset = slots.alignment === "center" ? (slotHeight - child.height) / 2 : 0;
    const x = container.x + padding.left
      + (container.layout.crossAlignment === "center" ? (contentWidth - child.width) / 2 : 0);
    const y = container.y + padding.top + headerBandHeight + stackOffset + index * (slotHeight + gap) + slotOffset;
    translate(child, x - child.x, y - child.y);
  });
}
