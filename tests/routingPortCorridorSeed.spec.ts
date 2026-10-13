import { describe, expect, it } from "vitest";
import { buildPortCorridorSeed, validateFinalRouteSet, type FinalRoutingConnector, type FinalRoutingContext } from "../src/renderer/staged/routingCore/index.js";
import type { PortSide } from "../src/renderer/staged/contracts.js";
function connector(side:PortSide):FinalRoutingConnector {
  const source=side==="north"?{x:30,y:20}:side==="south"?{x:30,y:80}:side==="west"?{x:10,y:40}:{x:90,y:40};
  const target=side==="north"?{x:60,y:20}:side==="south"?{x:60,y:80}:side==="west"?{x:10,y:60}:{x:90,y:60};
  return{id:"loop",priority:0,source:{nodeId:"node",side,point:source,minLeg:3},target:{nodeId:"node",side,point:target,minLeg:23},route:{style:"orthogonal",points:[source,target]}};
}
function outward(side:PortSide,tip:{x:number;y:number},neighbor:{x:number;y:number}):number {
  return side==="north"?tip.y-neighbor.y:side==="south"?neighbor.y-tip.y:side==="west"?tip.x-neighbor.x:neighbor.x-tip.x;
}
describe("shared same-side port corridor seed",()=>{
  it.each(["north","south","west","east"] as const)("builds a finite legal outward %s U without changing attachment identity",side=>{
    const edge=connector(side);const seed=buildPortCorridorSeed(edge,17)!;
    expect(seed.points).toHaveLength(4);expect(seed.points[0]).toEqual(edge.source.point);expect(seed.points.at(-1)).toEqual(edge.target.point);
    expect(outward(side,edge.source.point,seed.points[1]!)).toBeGreaterThanOrEqual(17);
    expect(outward(side,edge.target.point,seed.points.at(-2)!)).toBeGreaterThanOrEqual(23);
    for(let index=1;index<seed.points.length;index++){const a=seed.points[index-1]!,b=seed.points[index]!;expect(a.x===b.x||a.y===b.y).toBe(true);expect(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)).toBeGreaterThan(0);}
    const context:FinalRoutingContext={bounds:{minX:-50,minY:-50,maxX:150,maxY:150},boxes:[{id:"node",x:10,y:20,width:80,height:60,clearance:17}],connectors:[{...edge,route:seed}]};
    expect(validateFinalRouteSet(context)).toEqual([]);
    context.connectors[0]!.routingBounds={ownerId:"owner",minX:10,minY:20,maxX:90,maxY:80};
    expect(validateFinalRouteSet(context).some(violation=>violation.kind==="empty_coordinate_range")).toBe(true);
    expect(seed.points[1]).not.toEqual(edge.source.point);
  });
  it("preserves straight intent, different-side contracts and coincident attachment capacity failure",()=>{
    const edge=connector("north");edge.route.style="straight";expect(buildPortCorridorSeed(edge,17)).toBeUndefined();
    edge.route.style="orthogonal";edge.target.side="south";expect(buildPortCorridorSeed(edge,17)).toBeUndefined();
    edge.target.side="north";edge.target.point={...edge.source.point};expect(buildPortCorridorSeed(edge,17)).toBeUndefined();
    expect(()=>buildPortCorridorSeed(edge,NaN)).toThrow(RangeError);
  });
});
