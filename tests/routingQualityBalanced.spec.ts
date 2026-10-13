import { expect, it } from "vitest";
import { buildPortCorridorCandidates, generateRoutingQualityCandidates, type FinalRoutingContext } from "../src/renderer/staged/routingCore/index.js";

function crossingCount(points: readonly {x:number;y:number}[]): number {
  let count = 0;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1]!, b = points[index]!;
    if (a.x === b.x && a.x > 10 && a.x < 90 && Math.min(a.y,b.y) < 50 && Math.max(a.y,b.y) > 50) count++;
  }
  return count;
}
it("exposes a feasible other-axis alternative within sixteen trials despite dense first-axis events", () => {
  const context: FinalRoutingContext = { bounds: { minX: -100, minY: -100, maxX: 200, maxY: 150 },
    corridorSearch: "obstacle_aware",
    boxes: [...[{id:"left-stop",x:9,y:90,width:2,height:1},{id:"right-stop",x:89,y:9,width:2,height:1}], ...Array.from({length:40}, (_unused,index) => ({id:`event-${index}`,x:30+index,y:1000,width:1,height:1}))],
    connectors: [{ id:"ordinary",priority:1,source:{nodeId:"s",side:"east",point:{x:0,y:0},minLeg:10},
      target:{nodeId:"t",side:"west",point:{x:100,y:100},minLeg:10},route:{style:"orthogonal",points:[{x:0,y:0},{x:50,y:0},{x:50,y:50},{x:60,y:50},{x:60,y:100},{x:100,y:100}]}},
      {id:"settled",priority:0,source:{nodeId:"a",side:"east",point:{x:10,y:50},minLeg:0},
        target:{nodeId:"b",side:"west",point:{x:90,y:50},minLeg:0},route:{style:"orthogonal",points:[{x:10,y:50},{x:90,y:50}]}}] };
  const edge = context.connectors[0]!;
  const legacy = [...buildPortCorridorCandidates(edge,context)].slice(0,16);
  expect(legacy.every(points => crossingCount(points)>0)).toBe(true);
  const balanced = [...buildPortCorridorCandidates(edge,context,{topologyOrder:"balanced"})].slice(0,16);
  expect(balanced.some(points => crossingCount(points)===0)).toBe(true);
  const proposals = generateRoutingQualityCandidates(context,{maxCandidates:16,maxAlternativesPerConnector:16, fixedConnectorIds:new Set(["settled"])});
  expect(proposals.evaluatedCandidates).toBeLessThanOrEqual(16);
  expect(proposals.candidates.some(candidate => crossingCount(candidate.context.connectors[0]!.route.points)===0)).toBe(true);
  const selected = proposals.candidates.find(candidate => crossingCount(candidate.context.connectors[0]!.route.points) === 0)!.context.connectors[0]!.route.points;
  for (let index = 1; index < selected.length; index++) {
    const a = selected[index - 1]!, b = selected[index]!;
    expect(a.x === b.x || a.y === b.y).toBe(true);
    for (const box of context.boxes.slice(0,2)) {
      const intersects = a.x === b.x
        ? a.x > box.x && a.x < box.x + box.width && Math.max(a.y,b.y) > box.y && Math.min(a.y,b.y) < box.y + box.height
        : a.y > box.y && a.y < box.y + box.height && Math.max(a.x,b.x) > box.x && Math.min(a.x,b.x) < box.x + box.width;
      expect(intersects).toBe(false);
    }
    if (a.y === b.y && Math.max(a.x,b.x) > 10 && Math.min(a.x,b.x) < 90) expect(Math.abs(a.y - 50)).toBeGreaterThanOrEqual(16);
  }
});

it("completes five ordinary edges under 128 trials while retaining dominant straight routes", () => {
  const context: FinalRoutingContext = { bounds: { minX: 0, minY: 0, maxX: 300, maxY: 600 }, boxes: [], connectors: Array.from({length:5}, (_unused,index) => {
    const y = 30 + index * 100;
    return { id:`edge-${index}`, priority:index, source:{nodeId:`s-${index}`,side:"east" as const,point:{x:20,y},minLeg:10},
      target:{nodeId:`t-${index}`,side:"west" as const,point:{x:200,y:y+30},minLeg:10},
      route:{style:"orthogonal" as const,points:[{x:20,y},{x:80,y},{x:80,y:y+30},{x:200,y:y+30}]} };
  }) };
  // One aligned route has a provably zero-bend, zero-crossing attachment.
  const direct = context.connectors[0]!;
  direct.target.point.y = direct.source.point.y;
  direct.route.points = [direct.source.point,{x:80,y:direct.source.point.y},{x:80,y:direct.source.point.y+20},{x:150,y:direct.source.point.y+20},{x:150,y:direct.source.point.y},direct.target.point];
  const proposals = generateRoutingQualityCandidates(context,{maxCandidates:128,beamWidth:4,maxAlternativesPerConnector:16});
  expect(proposals.evaluatedCandidates).toBeLessThanOrEqual(128);
  expect(proposals.candidates.length).toBeGreaterThan(0);
  for (const candidate of proposals.candidates) {
    expect(candidate.context.connectors).toHaveLength(5);
    expect(candidate.context.connectors[0]!.route.points).toEqual([direct.source.point,direct.target.point]);
    for (const connector of candidate.context.connectors) {
      const points = connector.route.points;
      expect(points[0]).toEqual(connector.source.point); expect(points.at(-1)).toEqual(connector.target.point);
      for (let index=1;index<points.length;index++) expect(points[index]!.x===points[index-1]!.x || points[index]!.y===points[index-1]!.y).toBe(true);
    }
  }
});

it("exposes both feasible return flanks within eight trials instead of exhausting nearer left channels", () => {
  const context: FinalRoutingContext = { bounds:{minX:0,minY:0,maxX:300,maxY:140},corridorSearch:"obstacle_aware",boxes:[
    {id:"reservation-left",x:41,y:82,width:58,height:6,appliesToConnectorIds:["return"]},
    {id:"reservation-right",x:101,y:82,width:128,height:6,appliesToConnectorIds:["return"]}],connectors:[
    {id:"return",priority:1,source:{nodeId:"s",side:"north",point:{x:100,y:100},minLeg:20},target:{nodeId:"t",side:"north",point:{x:200,y:100},minLeg:10},route:{style:"orthogonal",points:[{x:100,y:100},{x:100,y:80},{x:40,y:80},{x:40,y:90},{x:200,y:90},{x:200,y:100}]}},
    {id:"structural",priority:0,source:{nodeId:"a",side:"south",point:{x:60,y:50},minLeg:0},target:{nodeId:"b",side:"north",point:{x:60,y:110},minLeg:0},route:{style:"orthogonal",points:[{x:60,y:50},{x:60,y:110}]},sharedTrackGroupBySegmentIndex:new Map([[0,"trunk"]])},
    {id:"ordinary",priority:0,source:{nodeId:"c",side:"south",point:{x:180,y:0},minLeg:0},target:{nodeId:"d",side:"north",point:{x:180,y:81},minLeg:0},route:{style:"orthogonal",points:[{x:180,y:0},{x:180,y:81}]}}]};
  const paths=[...buildPortCorridorCandidates(context.connectors[0]!,context,{topologyOrder:"balanced"})].slice(0,8);
  const left=paths.find(points=>points.some(p=>p.x<60));
  const right=paths.find(points=>points.some(p=>p.x>=229));
  expect(left).toBeDefined(); expect(right).toBeDefined();
  // Independent strict interior crossings against the two frozen vertical routes.
  const crosses=(points:readonly{x:number;y:number}[])=>points.slice(1).reduce((count,b,index)=>{
    const a=points[index]!;
    if(a.y!==b.y)return count;
    return count+Number(Math.min(a.x,b.x)<60&&Math.max(a.x,b.x)>60&&a.y>50&&a.y<110)
      +Number(Math.min(a.x,b.x)<180&&Math.max(a.x,b.x)>180&&a.y>0&&a.y<81);
  },0);
  expect(crosses(left!)).toBe(2); expect(crosses(right!)).toBe(1);
});

it("ranks complete-scene feasibility before truncating the final beam under a live aggregate budget",()=>{
  const context:FinalRoutingContext={bounds:{minX:-100,minY:-100,maxX:400,maxY:150},corridorSearch:"obstacle_aware",
    boxes:[{id:"outside-event",x:300,y:-20,width:10,height:10}],connectors:[{id:"edge",priority:0,
      source:{nodeId:"s",side:"east",point:{x:0,y:20},minLeg:16},target:{nodeId:"t",side:"west",point:{x:100,y:80},minLeg:16},
      route:{style:"orthogonal",points:[{x:0,y:20},{x:50,y:20},{x:50,y:80},{x:100,y:80}]}}]};
  const short=generateRoutingQualityCandidates(context,{maxCandidates:64,maxAlternativesPerConnector:32,beamWidth:1});
  const length=(points:readonly{x:number;y:number}[])=>points.slice(1).reduce((sum,p,index)=>sum+Math.abs(p.x-points[index]!.x)+Math.abs(p.y-points[index]!.y),0);
  const baseline=short.candidates[0]!.context.connectors[0]!.route.points;
  expect(baseline.every(point=>point.y>=0)).toBe(true);
  const budget={candidates:96,repairs:0};let assessed=0;
  const complete=generateRoutingQualityCandidates(context,{maxCandidates:64,maxAlternativesPerConnector:32,beamWidth:1,budget,
    scoreCompleteContext: revision=>{assessed++;expect(budget.candidates).toBeGreaterThan(0);budget.candidates--;return[revision.connectors[0]!.route.points.some(point=>point.y<0)?0:1];}});
  const points=complete.candidates[0]!.context.connectors[0]!.route.points;
  expect(points.some(point=>point.y<0)).toBe(true);expect(length(points)).toBeGreaterThan(length(baseline));
  expect(complete.evaluatedCandidates+assessed).toBe(96-budget.candidates);expect(budget.candidates).toBeGreaterThanOrEqual(0);
  for(let index=1;index<points.length;index++)expect(points[index]!.x===points[index-1]!.x||points[index]!.y===points[index-1]!.y).toBe(true);
  const last={candidates:3,repairs:0};let callbacks=0;
  generateRoutingQualityCandidates(context,{budget:last,scoreCompleteContext:()=>{callbacks++;last.candidates=0;return[0];}});
  expect(last.candidates).toBe(0);expect(callbacks).toBe(1);
});

it("does not discard label-feasible detours through final-stage geometric direct dominance",()=>{
  const context:FinalRoutingContext={bounds:{minX:-100,minY:-100,maxX:400,maxY:150},corridorSearch:"obstacle_aware",
    boxes:[{id:"event",x:300,y:-20,width:10,height:10}],connectors:[{id:"edge",priority:0,
      source:{nodeId:"s",side:"east",point:{x:0,y:20},minLeg:16},target:{nodeId:"t",side:"west",point:{x:100,y:20},minLeg:16},
      route:{style:"orthogonal",points:[{x:0,y:20},{x:100,y:20}]}}]};
  expect(generateRoutingQualityCandidates(context,{beamWidth:1}).candidates[0]!.context.connectors[0]!.route.points).toHaveLength(2);
  const scored=generateRoutingQualityCandidates(context,{beamWidth:1,maxAlternativesPerConnector:16,
    scoreCompleteContext:revision=>[revision.connectors[0]!.route.points.some(point=>point.y<20)?0:1]});
  expect(scored.candidates[0]!.context.connectors[0]!.route.points.length).toBeGreaterThan(2);
  expect(scored.candidates[0]!.context.connectors[0]!.route.points.some(point=>point.y<20)).toBe(true);
});

it("retains the contained 81px annotation track before a later route can hide it through partial pruning",()=>{
  const context:FinalRoutingContext={bounds:{minX:1,minY:1,maxX:754,maxY:315},corridorSearch:"obstacle_aware",
    boxes:[{id:"left",x:40,y:146,width:224,height:48,clearance:17},{id:"right",x:491,y:146,width:224,height:48,clearance:17},{id:"child",x:491,y:228,width:224,height:48,clearance:17}],
    blockers:[{id:"left-header",x:24,y:24,width:256,height:40,clearance:17},{id:"right-header",x:475,y:24,width:256,height:40,clearance:17}],
    connectors:[{id:"upper",priority:0,source:{nodeId:"left",side:"east",point:{x:264,y:158.5},minLeg:17},target:{nodeId:"right",side:"west",point:{x:491,y:158.5},minLeg:17},route:{style:"orthogonal",points:[{x:264,y:158.5},{x:491,y:158.5}]}},
      {id:"lower",priority:1,source:{nodeId:"left",side:"east",point:{x:264,y:181.5},minLeg:17},target:{nodeId:"right",side:"west",point:{x:491,y:181.5},minLeg:17},route:{style:"orthogonal",points:[{x:264,y:181.5},{x:491,y:181.5}]}},
      {id:"structural",priority:0,source:{nodeId:"right",side:"south",point:{x:515,y:194},minLeg:0},target:{nodeId:"child",side:"north",point:{x:515,y:228},minLeg:0},route:{style:"orthogonal",points:[{x:515,y:194},{x:515,y:228}]}},
      {id:"annotation",priority:2,source:{nodeId:"left",side:"north",point:{x:152,y:146},minLeg:17},target:{nodeId:"right",side:"north",point:{x:603,y:146},minLeg:17},route:{style:"orthogonal",points:[{x:152,y:146},{x:152,y:129},{x:603,y:129},{x:603,y:146}]}},
      {id:"return",priority:3,source:{nodeId:"right",side:"south",point:{x:603,y:194},minLeg:17},target:{nodeId:"left",side:"south",point:{x:152,y:194},minLeg:17},route:{style:"orthogonal",points:[{x:603,y:194},{x:603,y:211},{x:748,y:211},{x:748,y:309},{x:152,y:309},{x:152,y:194}]}}]};
  const options={maxCandidates:128,beamWidth:4,maxAlternativesPerConnector:16,fixedConnectorIds:new Set(["upper","lower","structural"])};
  const rows=(revision:FinalRoutingContext)=>{const points=revision.connectors.find(edge=>edge.id==="annotation")!.route.points;
    return points.slice(1).flatMap((p,index)=>p.y===points[index]!.y&&Math.abs(p.x-points[index]!.x)>100?[p.y]:[]);};
  const plain=generateRoutingQualityCandidates(context,options);
  expect(plain.candidates.some(candidate=>rows(candidate.context).includes(81))).toBe(false);
  const budget={candidates:128,repairs:0};let probes=0;
  const score=(revision:FinalRoutingContext)=>[Number(rows(revision).some(y=>110.5-y<24)),0];
  const aware=generateRoutingQualityCandidates(context,{...options,budget,
    scorePartialContext:revision=>{probes++;if(budget.candidates>0)budget.candidates--;return score(revision);},scoreCompleteContext:score});
  expect(aware.candidates.length).toBeGreaterThan(0);
  const retained=aware.candidates.find(candidate=>rows(candidate.context).includes(81));expect(retained).toBeDefined();
  for(const y of rows(retained!.context)){expect(110.5-y).toBeGreaterThanOrEqual(24);expect(y-64).toBeGreaterThanOrEqual(17);}
  const points=retained!.context.connectors.find(edge=>edge.id==="annotation")!.route.points;
  for(const point of points){expect(point.x).toBeGreaterThanOrEqual(1);expect(point.x).toBeLessThanOrEqual(754);expect(point.y).toBeGreaterThanOrEqual(1);expect(point.y).toBeLessThanOrEqual(315);}
  expect(aware.evaluatedCandidates+probes).toBe(128-budget.candidates);expect(budget.candidates).toBeGreaterThanOrEqual(0);
});

it("retains zero-penalty direct lower bounds without burning complete-scene probe budget",()=>{
  const context:FinalRoutingContext={bounds:{minX:0,minY:0,maxX:300,maxY:600},boxes:[],connectors:Array.from({length:5},(_unused,index)=>{
    const y=30+100*index;return{id:`edge-${index}`,priority:index,source:{nodeId:`s-${index}`,side:"east" as const,point:{x:20,y},minLeg:10},
      target:{nodeId:`t-${index}`,side:"west" as const,point:{x:200,y},minLeg:10},route:{style:"orthogonal" as const,points:[{x:20,y},{x:200,y}]}};})};
  const budget={candidates:12,repairs:0};let probes=0;
  const score=()=>{probes++;budget.candidates--;return[0];};
  const proposals=generateRoutingQualityCandidates(context,{maxCandidates:128,budget,scorePartialContext:score,scoreCompleteContext:score});
  expect(proposals.candidates).toHaveLength(1);expect(proposals.evaluatedCandidates).toBe(5);expect(probes).toBe(5);
  expect(budget.candidates).toBe(2);for(const edge of proposals.candidates[0]!.context.connectors)expect(edge.route.points).toHaveLength(2);
  expect(()=>generateRoutingQualityCandidates(context,{scorePartialContext:()=>[-1]})).toThrow(RangeError);
});

it("reserves later connector and beam-state work while each score consumes two actual trials",()=>{
  const context:FinalRoutingContext={bounds:{minX:0,minY:0,maxX:300,maxY:600},boxes:[],connectors:Array.from({length:4},(_unused,index)=>{
    const y=30+100*index;return{id:`edge-${index}`,priority:index,source:{nodeId:`s-${index}`,side:"east" as const,point:{x:20,y},minLeg:10},
      target:{nodeId:`t-${index}`,side:"west" as const,point:{x:200,y:y+20},minLeg:10},route:{style:"orthogonal" as const,points:[{x:20,y},{x:80,y},{x:80,y:y+20},{x:200,y:y+20}]}};})};
  const budget={candidates:128,repairs:0};let probeTrials=0;
  const score=()=>{const work=Math.min(2,budget.candidates);budget.candidates-=work;probeTrials+=work;return[work===2?0:1];};
  const result=generateRoutingQualityCandidates(context,{maxCandidates:128,beamWidth:4,maxAlternativesPerConnector:16,budget,scorePartialContext:score,scoreCompleteContext:score});
  expect(result.candidates.length).toBeGreaterThan(0);for(const candidate of result.candidates)expect(candidate.context.connectors).toHaveLength(4);
  expect(result.evaluatedCandidates+probeTrials).toBe(128-budget.candidates);expect(budget.candidates).toBeGreaterThanOrEqual(0);
  const greedy={candidates:128,repairs:0};const stages=new Set<number>();
  const drain=(revision:FinalRoutingContext)=>{stages.add(revision.connectors.length);greedy.candidates=0;return[0];};
  const retained=generateRoutingQualityCandidates(context,{maxCandidates:128,beamWidth:4,maxAlternativesPerConnector:16,budget:greedy,scorePartialContext:drain,scoreCompleteContext:drain});
  expect([...stages].sort()).toEqual([1,2,3,4]);expect(retained.candidates.length).toBeGreaterThan(0);
  expect(greedy.candidates).toBeGreaterThanOrEqual(0);
  const throwing={candidates:128,repairs:0};
  expect(()=>generateRoutingQualityCandidates(context,{budget:throwing,scorePartialContext:()=>{throw new Error("probe failure");}})).toThrow("probe failure");
  expect(throwing.candidates).toBeGreaterThan(96);
});

it("exposes both endpoint-side gutter rails despite dense source-side interior events",()=>{
  const context:FinalRoutingContext={bounds:{minX:0,minY:0,maxX:800,maxY:300},corridorSearch:"obstacle_aware",
    boxes:[{id:"s",x:40,y:80,width:224,height:48,clearance:17},{id:"t",x:490,y:130,width:224,height:48,clearance:17},
      ...Array.from({length:140},(_unused,index)=>({id:`event-${index}`,x:300+index,y:1000,width:1,height:1}))],
    blockers:[{id:"source-wall",x:280,y:0,width:0,height:250,clearance:17,blocksAxis:"vertical"},
      {id:"target-wall",x:474,y:0,width:0,height:250,clearance:17,blocksAxis:"vertical"}],
    connectors:[{id:"edge",priority:0,source:{nodeId:"s",side:"east",point:{x:264,y:100},minLeg:17},
      target:{nodeId:"t",side:"west",point:{x:490,y:150},minLeg:17},route:{style:"orthogonal",points:[{x:264,y:100},{x:297,y:100},{x:297,y:150},{x:490,y:150}]}}]};
  const edge=context.connectors[0]!;
  const verticalRail=(points:readonly{x:number;y:number}[])=>points.slice(1).flatMap((p,index)=>p.x===points[index]!.x&&p.y!==points[index]!.y?[p.x]:[]);
  const legacy=[...buildPortCorridorCandidates(edge,context)].slice(0,16);
  expect(legacy.flatMap(verticalRail)).not.toContain(457);
  const balanced=[...buildPortCorridorCandidates(edge,context,{topologyOrder:"balanced"})];
  expect(balanced.length).toBeLessThanOrEqual(256);
  expect(balanced.slice(0,4).flatMap(verticalRail)).toContain(297);
  expect(balanced.slice(0,4).flatMap(verticalRail)).toContain(457);
  for(const rail of balanced.slice(0,4).flatMap(verticalRail)){
    expect(rail-280).toBeGreaterThanOrEqual(17);expect(474-rail).toBeGreaterThanOrEqual(17);
  }
});

it("keeps route alternatives reachable when scene probes exceed a fifteen-route stage share",()=>{
  const context:FinalRoutingContext={bounds:{minX:0,minY:0,maxX:300,maxY:600},boxes:[],connectors:Array.from({length:4},(_unused,index)=>{
    const y=30+100*index;return{id:`edge-${index}`,priority:index,source:{nodeId:`s-${index}`,side:"east" as const,point:{x:20,y},minLeg:10},
      target:{nodeId:`t-${index}`,side:"west" as const,point:{x:200,y:y+20},minLeg:10},route:{style:"orthogonal" as const,points:[{x:20,y},{x:80,y},{x:80,y:y+20},{x:200,y:y+20}]}};})};
  const budget={candidates:4096,repairs:0};let probeTrials=0;const assessed=new Map<number,number>();
  const score=(revision:FinalRoutingContext)=>{const count=revision.connectors.length;assessed.set(count,(assessed.get(count)??0)+1);
    const work=Math.min(15,budget.candidates);budget.candidates-=work;probeTrials+=work;return[1];};
  // Sixty route trials divided across four stages leaves fifteen at the first
  // stage. Each scene probe costs fifteen additional aggregate trials.
  const result=generateRoutingQualityCandidates(context,{maxCandidates:60,beamWidth:4,maxAlternativesPerConnector:16,budget,
    scorePartialContext:score,scoreCompleteContext:score});
  expect(assessed.get(1)).toBeGreaterThanOrEqual(5);
  expect([...assessed.keys()]).toEqual([1,2,3,4]);expect(result.candidates.length).toBeGreaterThan(0);
  expect(result.evaluatedCandidates).toBeLessThanOrEqual(60);
  expect(result.evaluatedCandidates+probeTrials).toBe(4096-budget.candidates);expect(budget.candidates).toBeGreaterThanOrEqual(0);
});
