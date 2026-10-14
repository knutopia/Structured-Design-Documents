import type { PortSide } from '../contracts.js';
import type { FinalRoutingContext } from './lifecycle.js';
import type { RoutingBox } from './contracts.js';
import { measureExteriorRoutingCorridorDeficit } from './exteriorCapacity.js';

/** Capacity for the exterior flank needed when an ordinary same-side departure
 * faces another solid body. This measures physical space, not a replacement
 * route: the coherent scene must still be rebuilt and independently accepted. */
export function measureEndpointBypassPadding(input: {
  context: FinalRoutingContext;
  boundary: RoutingBox;
  exteriorObstacles: readonly RoutingBox[];
  clearance: number;
  separation: number;
}): Map<PortSide, number> {
  const { context, boundary, clearance } = input;
  const demands = new Map<PortSide, number>();
  const epsilon = context.policy?.epsilon ?? 0.5;
  for (const connector of context.connectors) {
    if (connector.routingBounds || connector.source.side !== connector.target.side || connector.source.nodeId === connector.target.nodeId) continue;
    const vertical = connector.source.side === 'north' || connector.source.side === 'south';
    const axis = vertical ? 'y' : 'x', tangent = vertical ? 'x' : 'y';
    const size = vertical ? 'height' : 'width';
    const sign = connector.source.side === 'south' || connector.source.side === 'east' ? 1 : -1;
    const anchor = connector.source.point;
    const obstructingBodies = context.boxes.filter(box => {
      if (box.id === connector.source.nodeId || box.id === connector.target.nodeId || box.blocksAxis) return false;
      const tangentSize = vertical ? box.width : box.height;
      const normalNear = sign > 0 ? box[axis] : box[axis] + box[size];
      return (normalNear - anchor[axis]) * sign > epsilon
        && anchor[tangent] > box[tangent] - (box.clearance ?? clearance)
        && anchor[tangent] < box[tangent] + tangentSize + (box.clearance ?? clearance);
    });
    if (!obstructingBodies.length) continue;
    // Use the nearer boundary flank of the obstructed departure. Stable low-side
    // ties retain deterministic geometry; no semantic identifiers choose a side.
    const low = vertical ? boundary.x : boundary.y;
    const high = low + (vertical ? boundary.width : boundary.height);
    const side: PortSide = anchor[tangent] - low <= high - anchor[tangent]
      ? vertical ? 'west' : 'north' : vertical ? 'east' : 'south';
    const amount = measureExteriorRoutingCorridorDeficit({
      bounds: { minX: boundary.x, minY: boundary.y, maxX: boundary.x + boundary.width, maxY: boundary.y + boundary.height },
      side, boxes: input.exteriorObstacles,
      parallelBorders: context.blockers?.filter(box => box.blocksAxis === (vertical ? "vertical" : "horizontal")
        && (!box.appliesToConnectorIds || box.appliesToConnectorIds.includes(connector.id))),
      claims: [{
        connectorId: connector.id,
        spanStart: Math.min(connector.source.point[axis], connector.target.point[axis], ...obstructingBodies.map(box => box[axis] - clearance)),
        spanEnd: Math.max(connector.source.point[axis], connector.target.point[axis], ...obstructingBodies.map(box => box[axis] + box[size] + clearance))
      }],
      clearance, separation: input.separation
    });
    if (amount > epsilon) demands.set(side, Math.max(demands.get(side) ?? 0, amount));
  }
  return demands;
}
