import type { PositionedScene, PortSide } from './contracts.js';
import { arrowMarkerFootprintBox } from './markerGeometry.js';
import { getRendererTheme } from './theme.js';
import { READABLE_ROUTING_GEOMETRY } from './routingCore/bounds.js';
import { createRoutingDiagnostic, type RendererDiagnostic } from './diagnostics.js';

export interface PaintedExportEnvelope {
  connectorId: string;
  kind: 'route' | 'label' | 'marker';
  x: number; y: number; width: number; height: number;
}
/** Painted routing content only; root chrome and titles retain their own containment contract. */
export function routedPaintEnvelopes(scene: PositionedScene): PaintedExportEnvelope[] {
  const { paint } = getRendererTheme(scene.themeId, 'routing');
  const half = paint.edgeStrokeWidth / 2;
  return scene.edges.flatMap(edge => {
    const boxes: PaintedExportEnvelope[] = edge.route.points.slice(1).map((point, index) => {
      const start = edge.route.points[index]!;
      return {
        connectorId: edge.id, kind: 'route', x: Math.min(start.x, point.x) - half,
        y: Math.min(start.y, point.y) - half, width: Math.abs(start.x - point.x) + 2 * half,
        height: Math.abs(start.y - point.y) + 2 * half
      };
    });
    if (edge.label) {
      const labelHalf = paint.strokeWidth / 2;
      boxes.push({
        connectorId: edge.id, kind: 'label', x: edge.label.x - labelHalf,
        y: edge.label.y - labelHalf, width: edge.label.width + 2 * labelHalf, height: edge.label.height + 2 * labelHalf
      });
    }
    for (const end of ['start', 'end'] as const) {
      if (edge.markers?.[end] !== 'arrow' || edge.route.points.length < 2) continue;
      const tip = end === 'start' ? edge.route.points[0]! : edge.route.points.at(-1)!;
      const neighbor = end === 'start' ? edge.route.points[1]! : edge.route.points.at(-2)!;
      const box = arrowMarkerFootprintBox(tip, neighbor, paint.arrowSize, paint.edgeStrokeWidth);
      if (box) boxes.push({ connectorId: edge.id, kind: 'marker', ...box });
    }
    return boxes;
  });
}

/** Physical deficit per affected side, measured against the logical export rectangle. */
export function measurePaintedExportDeficits(scene: PositionedScene, gap = READABLE_ROUTING_GEOMETRY.clearance): Map<PortSide, number> {
  if (!Number.isFinite(gap) || gap < 0) throw new RangeError('Export clearance must be finite and nonnegative.');
  const root = scene.root;
  const demands = new Map<PortSide, number>();
  for (const box of routedPaintEnvelopes(scene)) {
    if (![box.x, box.y, box.width, box.height, root.x, root.y, root.width, root.height].every(Number.isFinite)) {
      throw new RangeError('Painted export envelopes must have finite geometry.');
    }
    for (const [side, deficit] of [
      ['west', root.x + gap - box.x], ['east', box.x + box.width - (root.x + root.width - gap)],
      ['north', root.y + gap - box.y], ['south', box.y + box.height - (root.y + root.height - gap)]
    ] as const) if (deficit > READABLE_ROUTING_GEOMETRY.tolerance)
        demands.set(side, Math.max(demands.get(side) ?? 0, deficit));
  }
  return demands;
}

export function auditPaintedExportClearance(scene: PositionedScene, gap = READABLE_ROUTING_GEOMETRY.clearance): RendererDiagnostic[] {
  try {
    return [...measurePaintedExportDeficits(scene, gap)].map(([side, deficit]) => createRoutingDiagnostic(
      'renderer.routing.export_clearance', `Routed paint lacks ${deficit.toFixed(3)}px of required ${gap}px ${side} export clearance.`,
      scene.root.id, 'error'));
  } catch (error) {
    return [createRoutingDiagnostic('renderer.routing.export_geometry', String(error), scene.root.id, 'error')];
  }
}
