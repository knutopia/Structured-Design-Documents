import { describe, it, expect } from 'vitest';
import { measureEndpointBypassPadding } from '../src/renderer/staged/routingCore/endpointBypassCapacity.js';
import type { FinalRoutingContext } from '../src/renderer/staged/routingCore/lifecycle.js';
const context: FinalRoutingContext = {
  bounds: { minX: 17, minY: 17, maxX: 483, maxY: 483 }, blockers: [{ id: 'owner-border', x: 476, y: 24, width: 0, height: 220, blocksAxis: 'vertical' }], boxes: [
    { id: 'source', x: 350, y: 80, width: 100, height: 40, clearance: 17 },
    { id: 'body', x: 350, y: 154, width: 100, height: 40, clearance: 17 },
    { id: 'target', x: 50, y: 80, width: 100, height: 40, clearance: 17 }],
  connectors: [{    
id: 'return', priority: 0, source: { point: { x: 400, y: 120 }, side: 'south', nodeId: 'source', minLeg: 12 },
    target: { point: { x: 100, y: 120 }, side: 'south', nodeId: 'target', minLeg: 12 },
    route: { style: 'orthogonal', points: [{ x: 400, y: 120 }, { x: 400, y: 137 }, { x: 100, y: 137 }, { x: 100, y: 120 }] }  
}]
};
function input() {  
return {    
context: structuredClone(context), boundary: { id: 'root', x: 0, y: 0, width: 500, height: 500 },
    exteriorObstacles: structuredClone(context.boxes), clearance: 17, separation: 16  
};
}
describe('physical endpoint bypass capacity', () => {
  it('measures the missing outer flank when the departure faces another body', () => {
    expect([...measureEndpointBypassPadding(input())]).toEqual([['east', 10]]);
  });
  it('does not expand when the body no longer blocks the departure', () => {
    const value = input(); value.context.boxes.find(box => box.id === 'body')!.x = 200;
    expect(measureEndpointBypassPadding(value).size).toBe(0);
  });
  it('preserves the demand under translation and shrinks it when actual padding grows', () => {
    const value = input(); const dx = -800, dy = 900;
    for (const box of [...value.context.boxes, ...value.context.blockers!, ...value.exteriorObstacles, value.boundary]) { box.x += dx; box.y += dy; }
    for (const c of value.context.connectors) { c.source.point.x += dx; c.source.point.y += dy; c.target.point.x += dx; c.target.point.y += dy; }
    expect([...measureEndpointBypassPadding(value)]).toEqual([['east', 10]]);
    value.boundary.width += 10;
    expect(measureEndpointBypassPadding(value).size).toBe(0);
  });
});
