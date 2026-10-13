import { describe, expect, it } from "vitest";
import { canonicalRoutingQualityContext, effectiveRoutingBounds, generateRoutingQualityCandidates, resolveFacingSideSharedCoordinate, routingEndpointEnvelopeExhausted, runRoutingLifecycle, validateFinalRouteSet, selectRoutingQuality, type FinalRoutingContext } from "../src/renderer/staged/routingCore/index.js";
const context = (): FinalRoutingContext => ({ bounds: { minX: 0, minY: 0, maxX: 200, maxY: 200 }, boxes: [], connectors: [{ id: "edge", priority: 0,
  source: { nodeId: "s", side: "east", minLeg: 0, point: { x: 20, y: 30 } }, target: { nodeId: "t", side: "west", minLeg: 0, point: { x: 80, y: 30 } },
  route: { style: "orthogonal", points: [{ x: 20, y: 30 }, { x: 80, y: 30 }] },
  routingBounds: { ownerId: "owner", minX: 10, minY: 10, maxX: 90, maxY: 90 } }] });
describe("connector ownership bounds", () => {
  it("rejects nonnumeric ownership coordinates rather than coercing them", () => {
    const c = context();
    Object.assign(c.connectors[0]!.routingBounds!, { minX: "10" });
    expect(validateFinalRouteSet(c).some(violation => violation.kind === "empty_coordinate_range")).toBe(true);
  });
  it("rejects malformed ownership identity without weakening the rectangular envelope", () => {
    for (const ownerId of ["", 17, {}]) {
      const c = context(); Object.assign(c.connectors[0]!.routingBounds!, {ownerId});
      expect(validateFinalRouteSet(c).some(violation => violation.kind === "empty_coordinate_range")).toBe(true);
    }
  });
  it("keeps closure-owned pair policies distinct in the quality cache", () => {
    const allow = context(), forbid = context();
    const pairPolicy = (treatment: "allow" | "forbid") => () => treatment;
    allow.policy = { crossingTreatmentForPair: pairPolicy("allow") };
    forbid.policy = { crossingTreatmentForPair: pairPolicy("forbid") };
    expect(canonicalRoutingQualityContext(allow)).not.toBe(canonicalRoutingQualityContext(forbid));
    expect(canonicalRoutingQualityContext(allow)).toBe(canonicalRoutingQualityContext(allow));
  });
  it("intersects owner bounds with root and accepts internal direct routes", () => {
    const c = context(); c.bounds.maxX = 85;
    expect(effectiveRoutingBounds(c.connectors[0]!, c)).toEqual({ minX: 10, minY: 10, maxX: 85, maxY: 90 });
    expect(validateFinalRouteSet(c)).toEqual([]);
    const result = runRoutingLifecycle(c);
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.context.connectors[0]!.routingBounds?.ownerId).toBe("owner");
  });
  it("rejects an internal escape independently of global bounds", () => {
    const c = context(); c.connectors[0]!.route.points = [{ x: 20, y: 30 }, { x: 100, y: 30 }, { x: 100, y: 50 }, { x: 70, y: 50 }, { x: 70, y: 30 }, { x: 80, y: 30 }];
    expect(validateFinalRouteSet(c).some(v => v.kind === "empty_coordinate_range")).toBe(true);
  });
  it("does not add an internal envelope to a cross-owner connector", () => {
    const c = context(); delete c.connectors[0]!.routingBounds;
    c.connectors[0]!.target.point.x = 180; c.connectors[0]!.route.points[1]!.x = 180;
    expect(validateFinalRouteSet(c)).toEqual([]);
  });
  it("rejects expansion dropping owner identity and permits geometric owner reflow", () => {
    const c = context(); c.connectors[0]!.routingBounds!.maxX = 70;
    const result = runRoutingLifecycle(c, { maxCandidates: 16, maxRepairRevisions: 4, expand: current => {
      const rebuilt = { ...current, bounds: { ...current.bounds, maxX: 210 }, connectors: current.connectors.map(edge => ({ ...edge, routingBounds: undefined })) };
      return rebuilt;
    } });
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.reason).toBe("invalid_context");
    const retained = runRoutingLifecycle(c, { maxCandidates: 16, maxRepairRevisions: 4, expand: current => ({ ...current,
      bounds: { ...current.bounds, maxX: 210 }, connectors: current.connectors.map(edge => ({ ...edge, routingBounds: { ...edge.routingBounds!, maxX: 100 } })) }) });
    expect(retained.status).toBe("resolved");
  });
  it("minimizes both centre displacements inside facing legal spans on either axis", () => {
    const spans = { sourceSpan: { min: 10, max: 80 }, targetSpan: { min: 40, max: 120 }, sourceCenter: 30, targetCenter: 90 };
    expect(resolveFacingSideSharedCoordinate(spans)).toBe(60);
    expect(resolveFacingSideSharedCoordinate({ ...spans, sourceCenter: 0, targetCenter: 0 })).toBe(40);
    expect(resolveFacingSideSharedCoordinate({ ...spans, targetSpan: { min: 100, max: 120 } })).toBeUndefined();
  });
  it("keeps quality trials and repairs under a single aggregate budget", () => {
    const invalid = context(); invalid.connectors[0]!.routingBounds!.maxX = 70;
    const result = selectRoutingQuality(Array.from({ length: 20 }, (_value, index) => ({ id: `candidate-${index}`, context: invalid })), { maxCandidates: 3, maxRepairRevisions: 1 });
    expect(result.selected).toBeUndefined(); expect(result.trace.candidates).toBeLessThanOrEqual(3);
    expect(result.trace.repairRevisions).toBeLessThanOrEqual(1);
  });
  it("caps an invalid trial so later alternatives are examined and rejects malformed budgets", () => {
    const invalid = context(); invalid.connectors[0]!.routingBounds!.maxX = 70;
    const result = selectRoutingQuality([{ id: "invalid", context: invalid }, { id: "valid", context: context() }], { maxCandidates: 8, maxCandidatesPerTrial: 1 });
    expect(result.selected?.id).toBe("valid");
    for (const value of [NaN, Infinity, -1, 1.5]) expect(() => selectRoutingQuality([], { maxCandidates: value })).toThrow(RangeError);
  });
  it("generates bounded straight proposals while retaining fixed structural routes", () => {
    const c = context(); c.connectors[0]!.route.points = [{ x: 20, y: 30 }, { x: 40, y: 30 }, { x: 40, y: 60 }, { x: 60, y: 60 }, { x: 60, y: 30 }, { x: 80, y: 30 }];
    const proposals = generateRoutingQualityCandidates(c, { maxCandidates: 8 });
    expect(proposals.evaluatedCandidates).toBeLessThanOrEqual(8);
    expect(proposals.candidates[0]!.context.connectors[0]!.route.points).toEqual([{ x: 20, y: 30 }, { x: 80, y: 30 }]);
    expect(generateRoutingQualityCandidates(c, { fixedConnectorIds: new Set(["edge"]) }).candidates[0]!.context.connectors[0]!.route).toEqual(c.connectors[0]!.route);
    expect(generateRoutingQualityCandidates(c, { maxCandidates: 0 }).candidates).toEqual([]);
  });
  it("reports coherent rejected revisions for adapter capacity assessment", () => {
    const c = context(), rejected: Array<{ context: FinalRoutingContext; reason: string; count: number }> = [];
    const onRejected = (candidate: { context: FinalRoutingContext }, reason: string, violations: readonly unknown[]) => rejected.push({ context: candidate.context, reason, count: violations.length });
    selectRoutingQuality([{ id: "valid", context: c }], { accept: () => false, onRejected });
    expect(rejected[0]).toEqual({ context: c, reason: "scene_rejected", count: 0 });
    c.connectors[0]!.routingBounds!.maxX = 70;
    selectRoutingQuality([{ id: "invalid", context: c }], { maxCandidates: 1, onRejected });
    expect(rejected[1]!.context.connectors[0]!.routingBounds?.ownerId).toBe("owner");
    expect(rejected[1]!.count).toBeGreaterThan(0);
  });
  it("caches complete revisions without losing stable identity costs or resource changes", () => {
    const c = context();
    const result = selectRoutingQuality([{ id: "z", context: c }, { id: "a", context: context() }], { maxCandidates: 2 });
    expect(result.trace.candidates).toBe(2); expect(result.trace.validations).toBe(1);
    expect(result.trace.repeatedStates).toBe(1); expect([...result.costs.keys()]).toEqual(["z", "a"]);
    expect(result.selected?.id).toBe("a");
    const original = canonicalRoutingQualityContext(c);
    c.connectors[0]!.sharedTrackGroupBySegmentIndex = new Map([[0, "shared"]]);
    expect(canonicalRoutingQualityContext(c)).not.toBe(original);
    const changed = canonicalRoutingQualityContext(c);
    c.blockers = [{ id: "marker", x: 20, y: 80, width: 2, height: 2, clearance: 17 }];
    expect(canonicalRoutingQualityContext(c)).not.toBe(changed);
    const invalid = context(); invalid.connectors[0]!.routingBounds!.maxX = 70;
    const rejected = selectRoutingQuality([{ id: "one", context: invalid }, { id: "two", context: invalid }], { maxCandidates: 2, maxRepairRevisions: 0 });
    expect(rejected.trace.candidates).toBe(2); expect(rejected.trace.repeatedStates).toBe(1);
    expect(rejected.rejected.map(candidate => candidate.id)).toEqual(["one", "two"]);
  });
  it("bounds equivalent infinite candidates and caches assessment callbacks", () => {
    for (const accepted of [true, false]) {
      let pulled = 0, assessed = 0, rejected = 0;
      const c = context();
      function* duplicates() { while (true) { pulled++; yield { id: `duplicate-${pulled}`, context: c }; } }
      const result = selectRoutingQuality(duplicates(), { maxCandidates: 4,
        accept: () => { assessed++; return accepted; }, onRejected: () => { rejected++; } });
      expect(pulled).toBe(4); expect(result.trace.candidates).toBe(4);
      expect(result.trace.validations).toBe(1); expect(result.trace.repairRevisions).toBe(0);
      expect(result.trace.repeatedStates).toBe(3); expect(assessed).toBe(1); expect(rejected).toBe(accepted ? 0 : 1);
      expect(accepted ? result.costs.size : result.rejected.length).toBe(4);
    }
    let pulled = 0;
    function* untouched() { pulled++; yield { id: "unused", context: context() }; }
    selectRoutingQuality(untouched(), { maxCandidates: 0 }); expect(pulled).toBe(0);
  });
  it("shares remaining budget with synchronous assessment work without double counting", () => {
    const budget = { candidates: 3, repairs: 0 };
    let assessments = 0;
    const result = selectRoutingQuality([{ id: "one", context: context() }, { id: "two", context: context() }], {
      budget, accept: () => { assessments++; budget.candidates -= 2; return true; }
    });
    expect(assessments).toBe(1); expect(result.trace.candidates).toBe(1);
    expect(result.trace.repairRevisions).toBe(0); expect(budget).toEqual({ candidates: 0, repairs: 0 });
    const invalid = context(); invalid.connectors[0]!.routingBounds!.maxX = 70;
    const noRepair = { candidates: 2, repairs: 0 };
    const rejected = selectRoutingQuality([{ id: "invalid", context: invalid }], { budget: noRepair });
    expect(rejected.trace.candidates).toBe(1); expect(rejected.trace.repairRevisions).toBe(0);
    expect(rejected.rejected[0]?.reason).toBe("budget_exhausted"); expect(noRepair.candidates).toBe(1);
    const limited = { candidates: 2, repairs: 1 };
    const repaired = selectRoutingQuality([{ id: "invalid", context: invalid }], { budget: limited });
    expect(limited.candidates).toBe(2 - repaired.trace.candidates);
    expect(limited.repairs).toBe(1 - repaired.trace.repairRevisions);
    expect(limited.candidates).toBeGreaterThanOrEqual(0); expect(limited.repairs).toBeGreaterThanOrEqual(0);
  });
  it("observes budget consumed by lazy proposal production before spending a trial", () => {
    const budget={candidates:1,repairs:1}; let assessed=0;
    function* lazy() { budget.candidates--; yield {id:"last",context:context()}; }
    const result=selectRoutingQuality(lazy(),{budget,accept:()=>{assessed++;return true;}});
    expect(budget.candidates).toBe(0);expect(result.trace.candidates).toBe(0);expect(assessed).toBe(0);
    expect(result.selected).toBeUndefined();
  });
  it("rejects proven endpoint-envelope exhaustion without spending repair and retains short direct exceptions", () => {
    const cramped = context();
    cramped.boxes = [{id:"s",x:0,y:20,width:20,height:20,clearance:17}];
    cramped.connectors[0]!.routingBounds!.maxX = 35;
    cramped.connectors[0]!.target.point = {x:30,y:60};
    cramped.connectors[0]!.route.points = [{x:20,y:30},{x:30,y:30},{x:30,y:60}];
    expect(routingEndpointEnvelopeExhausted(cramped)).toBe(true);
    let reason: string | undefined;
    const result = selectRoutingQuality([{id:"cramped",context:cramped},{id:"valid",context:context()}], {maxCandidates:2,
      onRejected: (_candidate,rejectedReason) => { reason=rejectedReason; }});
    expect(reason).toBe("endpoint_envelope_exhausted"); expect(result.selected?.id).toBe("valid");
    expect(result.trace.candidates).toBe(2); expect(result.trace.repairRevisions).toBe(0);
    const short = context(); short.boxes = [{id:"s",x:0,y:20,width:20,height:20,clearance:17}];
    short.connectors[0]!.routingBounds!.maxX=30; short.connectors[0]!.target.point.x=30;
    short.connectors[0]!.route.points=[{x:20,y:30},{x:30,y:30}];
    expect(routingEndpointEnvelopeExhausted(short)).toBe(false);
    const direct=selectRoutingQuality([{id:"short",context:short}]);
    expect(direct.selected?.id).toBe("short"); expect(direct.trace.repairRevisions).toBe(0);
  });
  it("rejects duplicate identities without overwriting the retained better route cost", () => {
    const direct = context(), detour = context();
    detour.connectors[0]!.route.points = [{x:20,y:30},{x:40,y:30},{x:40,y:60},{x:60,y:60},{x:60,y:30},{x:80,y:30}];
    const result = selectRoutingQuality([{id:"first",context:direct},{id:"first",context:detour},{id:"other",context:detour}]);
    expect(result.selected?.id).toBe("first"); expect(result.selected?.context.connectors[0]!.route.points).toHaveLength(2);
    expect(result.costs.get("first")?.[1]).toBe(0); expect(result.rejected).toContainEqual({id:"first",reason:"duplicate_candidate_id"});
    expect(result.trace.candidates).toBe(3);
  });
  it("rejects malformed cost magnitudes before they can poison accepted route rankings", () => {
    for (const value of [NaN,Infinity,-Infinity,-1]) for (const metric of ["requiredExpansion","portDisplacement"] as const) {
      const result=selectRoutingQuality([{id:"malformed",context:context(),[metric]:value},{id:"valid",context:context()}]);
      expect(result.selected?.id).toBe("valid"); expect(result.costs.has("malformed")).toBe(false);
      expect(result.rejected).toContainEqual({id:"malformed",reason:"invalid_quality_metrics"});
    }
  });
  it("quality comparison favors a valid straight complete scene and honors zero budgets", () => {
    const direct = context(), detour = context();
    detour.connectors[0]!.route.points = [{ x: 20, y: 30 }, { x: 40, y: 30 }, { x: 40, y: 60 }, { x: 60, y: 60 }, { x: 60, y: 30 }, { x: 80, y: 30 }];
    expect(selectRoutingQuality([{ id: "detour", context: detour }, { id: "direct", context: direct }]).selected?.id).toBe("direct");
    expect(selectRoutingQuality([{ id: "direct", context: direct }], { maxCandidates: 0 }).selected).toBeUndefined();
    expect(selectRoutingQuality([{ id: "direct", context: direct }], { accept: () => false }).selected).toBeUndefined();
  });
});
