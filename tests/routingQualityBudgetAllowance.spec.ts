import {expect,it} from "vitest";
import {withRoutingQualityBudgetAllowance, selectRoutingQuality} from "../src/renderer/staged/routingCore/index.js";

it("shares the original object across nested allowances with exact global deductions",()=>{
  const budget={candidates:100,repairs:12};let innerSeen=0;
  const result=withRoutingQualityBudgetAllowance(budget,40,()=>{
    expect(budget.candidates).toBe(40);budget.candidates-=3;
    withRoutingQualityBudgetAllowance(budget,15,()=>{innerSeen=budget.candidates;budget.candidates-=7;budget.repairs-=2;});
    expect(budget.candidates).toBe(30);budget.candidates-=4;return "done";
  });
  expect(result).toBe("done");expect(innerSeen).toBe(15);expect(budget).toEqual({candidates:86,repairs:10});
  withRoutingQualityBudgetAllowance(budget,200,()=>{expect(budget.candidates).toBe(86);budget.candidates--;});
  expect(budget.candidates).toBe(85);
});
it("restores reserved candidates when synchronous work throws",()=>{
  const budget={candidates:100,repairs:12};
  expect(()=>withRoutingQualityBudgetAllowance(budget,20,()=>{budget.candidates-=8;throw new Error("assessment failed");})).toThrow("assessment failed");
  expect(budget).toEqual({candidates:92,repairs:12});
});
it("rejects overdraw, budget growth and malformed mutations without losing reserved headroom",()=>{
  for(const bad of [-1,21,NaN,Infinity,1.5]){
    const budget={candidates:100,repairs:12};
    expect(()=>withRoutingQualityBudgetAllowance(budget,20,()=>{budget.candidates=bad;})).toThrow(RangeError);
    expect(budget.candidates).toBeGreaterThanOrEqual(80);expect(budget.candidates).toBeLessThanOrEqual(100);
  }
  const budget={candidates:100,repairs:12};
  expect(()=>withRoutingQualityBudgetAllowance(budget,20,()=>{budget.repairs++;})).toThrow(RangeError);
  expect(budget).toEqual({candidates:100,repairs:12});
});
it("never enters work with malformed or depleted allowances",()=>{
  let called=false;
  for(const allowance of [-1,NaN,Infinity,1.5,0])expect(()=>withRoutingQualityBudgetAllowance({candidates:10,repairs:1},allowance,()=>{called=true;})).toThrow(RangeError);
  expect(()=>withRoutingQualityBudgetAllowance({candidates:0,repairs:1},10,()=>{called=true;})).toThrow(RangeError);
  expect(called).toBe(false);
});

it("does not cache baseline admission across geometry-equivalent candidates", () => {
  const context = {bounds: {minX: 0, minY: 0, maxX: 100, maxY: 100}, boxes: [], connectors: []};
  const visited: string[] = [];
  const budget = {candidates: 2, repairs: 0};
  const selection = selectRoutingQuality([{id: "rejected", context}, {id: "accepted", context}], {
    budget, admit: candidate => { visited.push(candidate.id); return candidate.id === "accepted"; }
  });
  expect(visited).toEqual(["rejected", "accepted"]);
  expect(selection.selected?.id).toBe("accepted");
  expect(selection.rejected).toEqual([{id: "rejected", reason: "baseline_admission_rejected"}]);
  expect(budget.candidates).toBe(0);
});
