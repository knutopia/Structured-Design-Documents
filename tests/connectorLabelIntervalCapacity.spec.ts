import { describe, expect, it } from "vitest";
import { coalesceConnectorLabelPhysicalRails, measureConnectorLabelCapacity, type ConnectorLabelCapacityClaim, type ConnectorLabelCorridor } from "../src/renderer/staged/connectorLabelLayout.js";
const corridor=(width:number):ConnectorLabelCorridor=>({owner:"owner",axis:"x",bounds:{x:0,y:0,width,height:40},connectorIds:[],margin:16.5});
const claims:ConnectorLabelCapacityClaim[]=[{owner:"owner",connectorId:"small",priority:0,spanStart:0,spanEnd:10,thickness:22},
  {owner:"owner",connectorId:"rival",priority:0,spanStart:5,spanEnd:15,thickness:0},
  {owner:"owner",connectorId:"wide",priority:1,spanStart:20,spanEnd:30,thickness:112}];
describe("opt-in interval peak label capacity",()=>{
  it("reuses disjoint rows rather than summing unrelated maximum track widths",()=>{
    expect(measureConnectorLabelCapacity([corridor(145)],claims,16)).toMatchObject([{requiredSize:183}]);
    expect(measureConnectorLabelCapacity([corridor(145)],claims,16,{mode:"interval_peak"})).toEqual([]);
    expect(measureConnectorLabelCapacity([corridor(100)],claims,16,{mode:"interval_peak"})).toMatchObject([{requiredSize:145,availableSize:100}]);
    // Independent row maximum: small+rival need33+22+16; wide alone needs33+112.
    expect(Math.max(33+22+16,33+112)).toBe(145);
    const measured=claims.map(claim=>claim.connectorId==="wide"?{...claim,thickness:155.676+12}:claim);
    expect(measureConnectorLabelCapacity([corridor(200.676)],measured,16)).toMatchObject([{requiredSize:238.676}]);
    expect(measureConnectorLabelCapacity([corridor(200.676)],measured,16,{mode:"interval_peak"})).toEqual([]);
  });
  it("sums genuinely overlapping widths and separation and deduplicates explicit physical identity",()=>{
    const overlap=claims.map(claim=>({...claim,spanStart:0,spanEnd:10}));
    expect(measureConnectorLabelCapacity([corridor(100)],overlap,16,{mode:"interval_peak"})).toMatchObject([{requiredSize:199}]);
    expect(measureConnectorLabelCapacity([corridor(100)],[...overlap,{...overlap[1]!}],16,{mode:"interval_peak"})).toMatchObject([{requiredSize:199}]);
  });
  it("preserves gaps between coalesced physical rail spans",()=>{
    const rails=coalesceConnectorLabelPhysicalRails([{coordinate:17,spanStart:10,spanEnd:0},{coordinate:17,spanStart:5,spanEnd:15},
      {coordinate:17,spanStart:30,spanEnd:20},{coordinate:33,spanStart:0,spanEnd:30}]);
    expect(rails).toEqual([{coordinate:17,spanStart:0,spanEnd:15},{coordinate:17,spanStart:20,spanEnd:30},{coordinate:33,spanStart:0,spanEnd:30}]);
    const gapClaims=[{owner:"owner",connectorId:"label",priority:0,spanStart:16,spanEnd:19,thickness:112},
      ...rails.filter(rail=>rail.coordinate===17).map(rail=>({owner:"owner",connectorId:"rail:17",priority:0,...rail,thickness:0}))];
    expect(measureConnectorLabelCapacity([corridor(145)],gapClaims,16,{mode:"interval_peak"})).toEqual([]);
  });
  it("bounds intervals to the supplied owner and rejects malformed opt-in geometry",()=>{
    expect(measureConnectorLabelCapacity([corridor(0)],[{...claims[2]!,spanStart:50,spanEnd:60}],16,{mode:"interval_peak"})).toEqual([]);
    expect(()=>measureConnectorLabelCapacity([corridor(100)],[{...claims[2]!,thickness:NaN}],16,{mode:"interval_peak"})).toThrow(RangeError);
  });
});
