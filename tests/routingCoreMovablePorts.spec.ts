import { expect, it } from "vitest";
import { auditMovableSourceAdmission, proposeMovableSourceRoutes } from "../src/renderer/staged/routingCore/movablePorts.js";
import type { FinalRoutingContext } from "../src/renderer/staged/routingCore/lifecycle.js";

function fixture(): FinalRoutingContext {
  return {
    bounds: { minX: 0, minY: 0, maxX: 900, maxY: 600 }, policy: { crossingTreatment: "forbid" }, boxes: [
      { id: "source", x: 312, y: 50, width: 224, height: 96, clearance: 17 },
      { id: "middle", x: 360, y: 200, width: 176, height: 96, clearance: 17 },
      { id: "target", x: 360, y: 421, width: 176, height: 96, clearance: 17 }
    ], connectors: [{
      id: "shortcut", priority: 0,
      source: { nodeId: "source", side: "east", point: { x: 536, y: 98 }, minLeg: 17 },
      target: { nodeId: "target", side: "west", point: { x: 360, y: 469 }, minLeg: 17 },
      route: { style: "orthogonal", points: [{ x: 536, y: 98 }, { x: 600, y: 98 }, { x: 600, y: 350 }, { x: 330, y: 350 }, { x: 330, y: 469 }, { x: 360, y: 469 }] }
    }]
  };
}
function propose(context = fixture(), occupiedSourcePorts: { x: number; y: number ;}[] = [], candidates = 256) {
  const budget = { candidates, repairs: 128 };
  const result = proposeMovableSourceRoutes({
    context, connectorId: "shortcut", sourceBox: context.boxes[0]!,
    sourceSide: "south", targetSide: "west", sourceInset: 12, portPitch: 23, occupiedSourcePorts, budget
  });
  return { result, budget };
}
it("derives the independently documented [324,343] corridor and closest midpoint projection", () => {
  const { result, budget } = propose();
  expect(result.proposals[0]?.connector.route.points).toEqual([{ x: 343, y: 146 }, { x: 343, y: 469 }, { x: 360, y: 469 }]);
  expect(result.proposals[0]?.midpoint).toBe(424);
  expect(result.proposals[0]?.displacement).toBe(81);
  expect(Math.min(...result.intervals.map(([a]) => a))).toBe(324);
  expect(Math.max(...result.intervals.map(([, b]) => b))).toBe(343);
  expect(budget.candidates).toBeLessThan(256);
  expect(budget.repairs).toBe(128);
});
it("keeps occupied incoming/reserved source ports distinct and refuses blocked corridors", () => {
  const occupied = propose(fixture(), [{ x: 343, y: 146 }]).result;
  expect(occupied.proposals).toHaveLength(0);
  const context = fixture();
  context.boxes = [...context.boxes, { id: "blocked", x: 300, y: 180, width: 260, height: 20, clearance: 17 }];
  expect(propose(context).result.proposals).toHaveLength(0);
});
it("shrinks legal intervals for larger paint envelopes and respects live depletion", () => {
  const context = fixture();
  context.boxes = context.boxes.map(box => ({ ...box, clearance: 25 }));
  expect(propose(context).result.proposals[0]?.coordinate).toBe(335);
  const depleted = propose(fixture(), [], 0);
  expect(depleted.result.exhausted).toBe(true);
  expect(depleted.result.proposals).toHaveLength(0);
  expect(depleted.budget.candidates).toBe(0);
});
it("rotates configured perpendicular sides through the same geometry", () => {
  const context = fixture();
  const rotate = (p: { x: number; y: number ;}) => ({ x: 600 - p.y, y: p.x });
  context.boxes = context.boxes.map(box => ({ ...box, x: 600 - box.y - box.height, y: box.x, width: box.height, height: box.width }));
  context.connectors = context.connectors.map(c => ({    
...c, source: { ...c.source, side: "south", point: rotate(c.source.point) },
    target: { ...c.target, side: "north", point: rotate(c.target.point) }, route: { ...c.route, points: c.route.points.map(rotate) }  
}));
  context.bounds = { minX: 0, minY: 0, maxX: 600, maxY: 900 };
  const result = proposeMovableSourceRoutes({ context, connectorId: "shortcut", sourceBox: context.boxes[0]!, sourceSide: "west", targetSide: "north", sourceInset: 12, portPitch: 23, occupiedSourcePorts: [], budget: { candidates: 256, repairs: 128 } });
  expect(result.proposals[0]?.connector.route.points).toEqual([{ x: 454, y: 343 }, { x: 131, y: 343 }, { x: 131, y: 360 }]);
});
it("independently rejects invalid baselines, fake one-bend exceptions and damaged straight companions", () => {
  const baseline = fixture();
  const chosen = propose(baseline).result.proposals[0]!.connector;
  const proposed = { ...baseline, connectors: [chosen] };
  expect(auditMovableSourceAdmission(baseline, proposed, new Set(["shortcut"]))).toEqual([]);
  expect(auditMovableSourceAdmission(proposed, proposed, new Set(["shortcut"]))).toContain("no_scene_bend_improvement");
  const straight = { id: "companion", priority: 1, source: { nodeId: "a", side: "east" as const, point: { x: 50, y: 550 }, minLeg: 0 }, target: { nodeId: "b", side: "west" as const, point: { x: 250, y: 550 }, minLeg: 0 }, route: { style: "orthogonal" as const, points: [{ x: 50, y: 550 }, { x: 250, y: 550 }] } };
  baseline.connectors = [...baseline.connectors, straight];
  proposed.connectors = [chosen, { ...straight, route: { ...straight.route, points: [{ x: 50, y: 550 }, { x: 150, y: 550 }, { x: 150, y: 570 }, { x: 230, y: 570 }, { x: 230, y: 550 }, { x: 250, y: 550 }] } }];
  expect(auditMovableSourceAdmission(baseline, proposed, new Set(["shortcut"]))).toContain("protected_route:companion");
});

it("orders overlapping joint arrivals even when a baseline crossing would otherwise permit inversion", () => {
  const make = (id: string, x: number, y: number) => ({
    id, priority: y, source: {nodeId: 'source', side: 'south' as const, point: {x,y:0}, minLeg:10},
    target: {nodeId:id, side:'west' as const,point:{x:100,y},minLeg:10},
    route: {style:'orthogonal' as const,points:[{x,y:0},{x,y:y+40},{x:80,y:y+40},{x:80,y},{x:100,y}]}
  });
  const baseline: FinalRoutingContext = {bounds:{minX:0,minY:0,maxX:200,maxY:300},boxes:[],connectors:[make('near',30,100),make('far',60,200)]};
  const proposed = {...baseline, connectors:baseline.connectors.map(edge=>({...edge,route:{...edge.route,points:[edge.source.point,{x:edge.source.point.x,y:edge.target.point.y},edge.target.point]}}))};
  expect(auditMovableSourceAdmission(baseline,proposed,new Set(['near','far']))).toContain('source_target_order:near:far');
  const ordered = {...proposed,connectors:proposed.connectors.map(edge=>{
    const x=edge.id==='far'?30:60;
    return {...edge,source:{...edge.source,point:{x,y:0}},route:{...edge.route,points:[{x,y:0},{x,y:edge.target.point.y},edge.target.point]}};
  })};
  expect(auditMovableSourceAdmission(baseline,ordered,new Set(['near','far']))).toEqual([]);
});
