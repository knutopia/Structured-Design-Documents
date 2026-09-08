import type { PositionedEdge } from "./contracts.js";
import type { RendererTheme } from "./theme.js";

/** Native marker geometry as ordinary filled paths for SVG importers that drop markers. */
export function paintUiContractsArrowheads(edge: PositionedEdge, theme: RendererTheme): string[] {
  const points = edge.route.points, size = theme.paint.arrowSize;
  const format = (value: number) => String(Math.round(value * 1000) / 1000);
  return (["start", "end"] as const).flatMap(end => {
    if (edge.markers?.[end] !== "arrow" || points.length < 2) return [];
    const tip = end === "end" ? points[points.length - 1] : points[0];
    const neighbor = end === "end" ? points[points.length - 2] : points[1];
    const length = Math.hypot(tip.x - neighbor.x, tip.y - neighbor.y);
    if (!length) return [];
    const dx = (tip.x - neighbor.x) / length, dy = (tip.y - neighbor.y) / length;
    const base = { x: tip.x - dx * (size - 1), y: tip.y - dy * (size - 1) };
    const path = `M ${format(tip.x + dx)} ${format(tip.y + dy)} L ${format(base.x - dy * size / 2)} ${format(base.y + dx * size / 2)} L ${format(base.x + dy * size / 2)} ${format(base.y - dx * size / 2)} Z`;
    return [`<path class="ui-contracts-arrowhead" data-arrow-${end}="true" d="${path}" fill="${theme.paint.palette.edge}" stroke="none"/>`];
  });
}
