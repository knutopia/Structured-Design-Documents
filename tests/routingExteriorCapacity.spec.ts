import { expect, it } from "vitest";
import { measureExteriorRoutingCorridorDeficit, type ExteriorRoutingCorridorInput } from "../src/renderer/staged/routingCore/exteriorCapacity.js";
const input = (): ExteriorRoutingCorridorInput => ({bounds:{minX:296,minY:0,maxX:700,maxY:800},side:"west",clearance:17,separation:16,
  boxes:[{x:312,y:80,width:100,height:66},{x:360,y:274,width:100,height:98}],
  claims:[{connectorId:"forward",spanStart:113,spanEnd:787}, ...[0,1,2].map(index=>({connectorId:`return-${index}`,spanStart:307,spanEnd:763}))]});
it("measures the overlapping rows rather than combining unrelated shallow nodes and return tracks",()=>{
  const fixture=input(); expect(measureExteriorRoutingCorridorDeficit(fixture)).toBe(18);
  fixture.claims=fixture.claims.slice(1); expect(measureExteriorRoutingCorridorDeficit(fixture)).toBe(2);
  // Independent row arithmetic: narrow early row holds one track (34-16),
  // later content has four simultaneous tracks (82-64); no row needs 66px.
  expect(Math.max(2*17-16,2*17+3*16-64)).toBe(18);
});
it("reuses slots for disjoint spans and supports every owner side",()=>{
  const fixture=input();fixture.claims=[{connectorId:"one",spanStart:100,spanEnd:130},{connectorId:"two",spanStart:280,spanEnd:320}];
  expect(measureExteriorRoutingCorridorDeficit(fixture)).toBe(18);
  const reflected: ExteriorRoutingCorridorInput={...fixture,side:"east",bounds:{minX:0,minY:0,maxX:404,maxY:800},boxes:fixture.boxes.map(box=>({...box,x:700-box.x-box.width}))};
  expect(measureExteriorRoutingCorridorDeficit(reflected)).toBe(18);
  const transposed: ExteriorRoutingCorridorInput={...fixture,side:"north",bounds:{minX:0,minY:296,maxX:800,maxY:700},boxes:fixture.boxes.map(box=>({x:box.y,y:box.x,width:box.height,height:box.width}))};
  expect(measureExteriorRoutingCorridorDeficit(transposed)).toBe(18);
  const south: ExteriorRoutingCorridorInput={...reflected,side:"south",bounds:{minX:0,minY:0,maxX:800,maxY:404},boxes:reflected.boxes.map(box=>({x:box.y,y:box.x,width:box.height,height:box.width}))};
  expect(measureExteriorRoutingCorridorDeficit(south)).toBe(18);
});
it("clips spans to owner space, accepts reversed spans and rejects invalid measurements",()=>{
  const fixture=input(); fixture.claims=[{connectorId:"outside",spanStart:-100,spanEnd:-10}];expect(measureExteriorRoutingCorridorDeficit(fixture)).toBe(0);
  fixture.claims=[{connectorId:"reversed",spanStart:140,spanEnd:100}];expect(measureExteriorRoutingCorridorDeficit(fixture)).toBe(18);
  expect(()=>measureExteriorRoutingCorridorDeficit({...fixture,clearance:NaN})).toThrow(RangeError);
});
