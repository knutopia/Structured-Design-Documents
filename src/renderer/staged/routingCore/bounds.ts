/** Opt-in readable geometry; existing routing defaults remain unchanged. */
export const READABLE_ROUTING_GEOMETRY = Object.freeze({ clearance: 16, tolerance: 0.5 });
export interface RoutingBounds { minX: number; minY: number; maxX: number; maxY: number }
/** Owner identity persists when an adapter rebuilds the rectangle after reflow. */
export interface ConnectorRoutingBounds extends RoutingBounds { ownerId: string }
export function effectiveRoutingBounds(connector: { routingBounds?: ConnectorRoutingBounds }, context: { bounds: RoutingBounds }): RoutingBounds {
  const owner = connector.routingBounds;
  return owner ? { minX: Math.max(context.bounds.minX, owner.minX), minY: Math.max(context.bounds.minY, owner.minY),
    maxX: Math.min(context.bounds.maxX, owner.maxX), maxY: Math.min(context.bounds.maxY, owner.maxY) } : context.bounds;
}
export function validRoutingBounds(bounds: RoutingBounds): boolean {
  return [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite)
    && bounds.minX <= bounds.maxX && bounds.minY <= bounds.maxY;
}

/** Centreline margin retaining the readable gap outside the painted stroke. */
export function readableRoutingClearance(strokeWidth: number): number {
  if (!Number.isFinite(strokeWidth)) throw new RangeError("Routing stroke width must be finite.");
  return READABLE_ROUTING_GEOMETRY.clearance + Math.max(0, strokeWidth) / 2;
}

/** Port pitch leaves the readable gap between one stroke and a lateral arrowhead. */
export function readablePortPitch(arrowSize: number, strokeWidth: number): number {
  if (![arrowSize, strokeWidth].every(Number.isFinite)) throw new RangeError("Port marker geometry must be finite.");
  return READABLE_ROUTING_GEOMETRY.clearance + Math.max(0, arrowSize) / 2 + Math.max(0, strokeWidth);
}
