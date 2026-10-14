import { effectiveRoutingBounds } from "./bounds.js";
import { DEFAULT_ROUTING_POLICY, type RoutingViolation } from "./contracts.js";
import { buildPortCorridorCandidates } from "./candidates.js";
import { DEFAULT_FINAL_ROUTING_LIMITS, runRoutingLifecycle, validateFinalRouteSet, type FinalRoutingContext, type FinalRoutingTrace } from "./lifecycle.js";
import { routeCost } from "./optimization.js";

export interface RoutingQualityCandidate {
  id: string;
  context: FinalRoutingContext;
  /** Nonnegative measured expansion magnitude. */
  requiredExpansion?: number;
  /** Nonnegative aggregate displacement magnitude, rather than a signed shift. */
  portDisplacement?: number;
}
export interface RoutingQualityBudget { candidates: number; repairs: number }
/** Reserve aggregate candidate headroom while synchronous nested work shares the
 * original budget object. Repairs remain globally shared and cannot be reset. */
export function withRoutingQualityBudgetAllowance<T>(budget: RoutingQualityBudget, allowance: number, callback: () => T): T {
  for (const value of [budget.candidates, budget.repairs, allowance]) {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      throw new RangeError("Routing quality budgets must be finite nonnegative integers.");
    }
  }
  const exposed = Math.min(budget.candidates, allowance);
  if (exposed === 0) throw new RangeError("Routing quality candidate allowance is depleted.");
  const reserved = budget.candidates - exposed;
  const repairs = budget.repairs;
  budget.candidates = exposed;
  try {
    return callback();
  } finally {
    const unspent = budget.candidates;
    budget.candidates = reserved + (Number.isFinite(unspent) ? Math.max(0, Math.min(exposed, Math.floor(unspent))) : 0);
    const remainingRepairs = budget.repairs;
    budget.repairs = Number.isFinite(remainingRepairs) ? Math.max(0, Math.min(repairs, Math.floor(remainingRepairs))) : 0;
    if (!Number.isFinite(unspent) || !Number.isInteger(unspent) || unspent < 0 || unspent > exposed
      || !Number.isFinite(remainingRepairs) || !Number.isInteger(remainingRepairs) || remainingRepairs < 0 || remainingRepairs > repairs) {
      throw new RangeError("Routing quality work exceeded or increased its reserved budget allowance.");
    }
  }
}
export interface RoutingQualityOptions {
  /** Shared remaining budget; adapter callbacks may consume it synchronously. */
  budget?: RoutingQualityBudget;
  maxCandidates?: number;
  maxRepairRevisions?: number;
  maxCandidatesPerTrial?: number;
  /** Complete-scene labels and painted markers may reject otherwise valid routes. */
  accept?: (context: FinalRoutingContext) => boolean;
  /** Optional policy admission against a retained accepted baseline. Evaluated
   * per candidate after repair and scene acceptance; never cached by geometry. */
  admit?: (candidate: RoutingQualityCandidate) => boolean;
  onRejected?: (candidate: RoutingQualityCandidate, reason: string, violations: readonly RoutingViolation[]) => void;
}
export interface RoutingQualitySelection {
  selected?: RoutingQualityCandidate;
  costs: ReadonlyMap<string, readonly number[]>;
  rejected: readonly { id: string; reason: string }[];
  trace: FinalRoutingTrace;
}
const policyFunctionIds = new WeakMap<Function, number>();
let nextPolicyFunctionId = 0;
/** Stable serialization includes every declared geometry and resource field. */
export function canonicalRoutingQualityContext(context: FinalRoutingContext): string {
  const normalize = (value: unknown): unknown => {
    if (typeof value === "function") {
      let id = policyFunctionIds.get(value);
      if (id === undefined) { id = nextPolicyFunctionId++; policyFunctionIds.set(value, id); }
      return { policyFunctionId: id };
    }
    if (value instanceof Map) return [...value].map(([key, item]) => [normalize(key), normalize(item)])
      .sort((a, b) => JSON.stringify(a[0]).localeCompare(JSON.stringify(b[0])));
    if (value instanceof Set) return [...value].map(normalize).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, normalize(item)]));
    if (typeof value === "number" && !Number.isFinite(value)) return { nonfinite: String(value) };
    return value;
  };
  return JSON.stringify(normalize({ ...context, connectors: [...context.connectors].sort((a, b) => a.id.localeCompare(b.id)),
    boxes: [...context.boxes].sort((a, b) => a.id.localeCompare(b.id)),
    blockers: context.blockers && [...context.blockers].sort((a, b) => a.id.localeCompare(b.id)) }));
}

/** A turn outside an endpoint's painted envelope must fit inside its owner.
 * A valid incident-only direct route is exempt from this turn-space requirement. */
export function routingEndpointEnvelopeExhausted(context: FinalRoutingContext): boolean {
  return context.connectors.some(connector => {
    const bounds = effectiveRoutingBounds(connector, context);
    const impossible = [connector.source, connector.target].some(endpoint => {
      const clearance = context.boxes.find(box => box.id === endpoint.nodeId)?.clearance ?? 0;
      const required = Math.max(endpoint.minLeg, clearance);
      const available = endpoint.side === "west" ? endpoint.point.x - bounds.minX
        : endpoint.side === "east" ? bounds.maxX - endpoint.point.x
        : endpoint.side === "north" ? endpoint.point.y - bounds.minY : bounds.maxY - endpoint.point.y;
      return available < required - (context.policy?.epsilon ?? DEFAULT_ROUTING_POLICY.epsilon);
    });
    if (!impossible) return false;
    const direct = { ...connector, route: { ...connector.route, points: [connector.source.point, connector.target.point] } };
    return validateFinalRouteSet({ ...context, connectors: [direct] }).length > 0;
  });
}

/** Opt-in comparison of complete revisions, with one aggregate repair budget.
 * The existing valid-input preservation behavior of runRoutingLifecycle is unchanged.
 */
export function selectRoutingQuality(candidates: Iterable<RoutingQualityCandidate>, options: RoutingQualityOptions = {}): RoutingQualitySelection {
  for (const value of [options.maxCandidates, options.maxRepairRevisions, options.maxCandidatesPerTrial, options.budget?.candidates, options.budget?.repairs]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || !Number.isInteger(value))) {
      throw new RangeError("Routing quality budgets must be finite nonnegative integers.");
    }
  }
  const trace: FinalRoutingTrace = { candidates: 0, validations: 0, repairRevisions: 0, expansionPasses: 0, repeatedStates: 0 };
  const costs = new Map<string, readonly number[]>();
  const seenCandidateIds = new Set<string>();
  const rejected: { id: string; reason: string }[] = [];
  const maxCandidates = Math.max(0, Math.floor(options.maxCandidates ?? DEFAULT_FINAL_ROUTING_LIMITS.maxCandidates));
  const maxRevisions = Math.max(0, Math.floor(options.maxRepairRevisions ?? DEFAULT_FINAL_ROUTING_LIMITS.maxRepairRevisions));
  const cache = new Map<string, { context: FinalRoutingContext; reason?: string; assessed?: boolean; violations: readonly RoutingViolation[] }>();
  let selected: RoutingQualityCandidate | undefined;
  const iterator = candidates[Symbol.iterator]();
  while (trace.candidates < maxCandidates && (options.budget?.candidates ?? Infinity) > 0) {
    const step = iterator.next();
    if (step.done || (options.budget?.candidates ?? Infinity) <= 0) break;
    const candidate = step.value;
    trace.candidates++;
    if (options.budget) options.budget.candidates--;
    if (seenCandidateIds.has(candidate.id)) {
      rejected.push({ id: candidate.id, reason: "duplicate_candidate_id" });
      options.onRejected?.(candidate, "duplicate_candidate_id", []); continue;
    }
    seenCandidateIds.add(candidate.id);
    if ([candidate.requiredExpansion, candidate.portDisplacement].some(value => value !== undefined && (!Number.isFinite(value) || value < 0))) {
      rejected.push({ id: candidate.id, reason: "invalid_quality_metrics" });
      options.onRejected?.(candidate, "invalid_quality_metrics", []); continue;
    }
    const key = canonicalRoutingQualityContext(candidate.context);
    const cached = cache.get(key);
    let context: FinalRoutingContext;
    if (cached) {
      trace.repeatedStates++;
      context = cached.context;
      if (cached.reason) {
        rejected.push({ id: candidate.id, reason: cached.reason });
        continue;
      }
    } else {
      trace.validations++;
      context = candidate.context;
      const violations = validateFinalRouteSet(context);
      if (violations.length) {
        if (!violations.some(violation => violation.kind === "endpoint_mismatch") && routingEndpointEnvelopeExhausted(context)) {
          cache.set(key, { context, reason: "endpoint_envelope_exhausted", violations });
          rejected.push({ id: candidate.id, reason: "endpoint_envelope_exhausted" });
          options.onRejected?.({ ...candidate, context }, "endpoint_envelope_exhausted", violations); continue;
        }
        const remaining = Math.min(maxCandidates - trace.candidates, options.maxCandidatesPerTrial ?? 256, options.budget?.candidates ?? Infinity);
        const revisions = Math.min(maxRevisions - trace.repairRevisions, options.budget?.repairs ?? Infinity);
        if (remaining <= 0 || revisions <= 0) {
          cache.set(key, { context, reason: "budget_exhausted", violations });
          rejected.push({ id: candidate.id, reason: "budget_exhausted" });
          options.onRejected?.({ ...candidate, context }, "budget_exhausted", violations); continue;
        }
        const result = runRoutingLifecycle(context, { maxCandidates: remaining, maxRepairRevisions: revisions });
        if (options.budget) {
          options.budget.candidates -= result.trace.candidates;
          options.budget.repairs -= result.trace.repairRevisions;
        }
        for (const traceKey of Object.keys(trace) as (keyof FinalRoutingTrace)[]) trace[traceKey] += result.trace[traceKey];
        if (result.status !== "resolved") {
          context = { ...context, connectors: result.debugConnectors };
          cache.set(key, { context, reason: result.reason, violations: result.violations });
          rejected.push({ id: candidate.id, reason: result.reason });
          options.onRejected?.({ ...candidate, context }, result.reason, result.violations); continue;
        }
        context = result.context;
      }
      const resolved = { context, assessed: false, reason: undefined as string | undefined, violations: [] };
      cache.set(key, resolved);
      cache.set(canonicalRoutingQualityContext(context), resolved);
    }
    const assessment = cache.get(key)!;
    if (!assessment.assessed) {
      assessment.assessed = true;
      if (options.accept && !options.accept(context)) {
        assessment.reason = "scene_rejected";
        rejected.push({ id: candidate.id, reason: "scene_rejected" });
        options.onRejected?.({ ...candidate, context }, "scene_rejected", []); continue;
      }
    }
    if (options.admit && !options.admit({ ...candidate, context })) {
      rejected.push({ id: candidate.id, reason: "baseline_admission_rejected" });
      options.onRejected?.({ ...candidate, context }, "baseline_admission_rejected", []); continue;
    }
    const [crossings, bends, length] = routeCost(context.connectors);
    const cost = [crossings, bends, candidate.requiredExpansion ?? 0, candidate.portDisplacement ?? 0, length];
    costs.set(candidate.id, cost);
    const previous = selected && costs.get(selected.id)!;
    const firstDifference = previous ? cost.findIndex((value, index) => value !== previous[index]) : -1;
    if (!selected || firstDifference >= 0 && cost[firstDifference]! < previous![firstDifference]!
      || firstDifference === -1 && candidate.id.localeCompare(selected.id) < 0) selected = { ...candidate, context };
  }
  return { selected, costs, rejected, trace };
}

export interface RoutingQualityProposalOptions {
  /** Live remaining budget, shared with synchronous complete-scene assessment. */
  budget?: RoutingQualityBudget;
  /** Finite nonnegative complete-scene penalties precede final beam route costs. */
  scoreCompleteContext?: (context: FinalRoutingContext) => readonly number[];
  /** Finite nonnegative settled-scene penalties before nonterminal beam truncation. */
  scorePartialContext?: (context: FinalRoutingContext) => readonly number[];
  maxCandidates?: number;
  beamWidth?: number;
  maxAlternativesPerConnector?: number;
  /** Adapter-owned structural grammar is retained verbatim. */
  fixedConnectorIds?: ReadonlySet<string>;
}
export interface RoutingQualityProposals {
  candidates: RoutingQualityCandidate[];
  evaluatedCandidates: number;
  exhausted: boolean;
}
/** Construct bounded complete-scene proposals while keeping declared structural
 * resources fixed. Each partial revision is validated against every settled route,
 * all obstacles and its owner envelope before it can enter the beam. */
export function generateRoutingQualityCandidates(context: FinalRoutingContext, options: RoutingQualityProposalOptions = {}): RoutingQualityProposals {
  const limit = options.maxCandidates ?? 256;
  const width = options.beamWidth ?? 8;
  const alternatives = options.maxAlternativesPerConnector ?? 16;
  if (![limit, width, alternatives, options.budget?.candidates ?? 0, options.budget?.repairs ?? 0].every(value => Number.isFinite(value) && Number.isInteger(value) && value >= 0)) {
    throw new RangeError("Routing proposal budgets must be finite nonnegative integers.");
  }
  if (limit === 0 || width === 0 || alternatives === 0 || options.budget?.candidates === 0) return { candidates: [], evaluatedCandidates: 0, exhausted: limit === 0 || options.budget?.candidates === 0 };
  const fixed = context.connectors.filter(connector => options.fixedConnectorIds?.has(connector.id)
    || connector.runConstraints?.size || connector.sharedTrackGroupBySegmentIndex?.size);
  const ordinary = context.connectors.filter(connector => !fixed.includes(connector)).sort((a, b) => {
    const straightA = a.source.point.x === a.target.point.x || a.source.point.y === a.target.point.y;
    const straightB = b.source.point.x === b.target.point.x || b.source.point.y === b.target.point.y;
    return Number(straightB) - Number(straightA) || a.priority - b.priority || a.id.localeCompare(b.id);
  });
  let evaluatedCandidates = 0;
  let beam: FinalRoutingContext[] = [{ ...context, connectors: fixed }];
  let exhausted = false;
  const contextScores = new Map<FinalRoutingContext, readonly number[]>();
  const scoreCache = new Map<string, readonly number[]>();
  let scoreArity: number | undefined;
  for (const [connectorIndex, connector] of ordinary.entries()) {
    const next: FinalRoutingContext[] = [];
    const scoreContext = connectorIndex === ordinary.length - 1 ? options.scoreCompleteContext : options.scorePartialContext;
    // Reserve a fair share for every remaining connector before exploring more
    // alternatives at this stage. An early beam must not consume the whole solve.
    const stageBudget = Math.floor((limit - evaluatedCandidates) / (ordinary.length - connectorIndex));
    const stageActualBudget = options.budget ? Math.floor(options.budget.candidates / (ordinary.length - connectorIndex)) : Infinity;
    if (stageBudget <= 0 || stageActualBudget <= 0) { exhausted = true; beam = []; break; }
    const stageStart = evaluatedCandidates;
    const stageRemainingStart = options.budget?.candidates;
    const stageCost = () => evaluatedCandidates - stageStart;
    const stageActualCost = () => stageRemainingStart === undefined ? 0 : stageRemainingStart - options.budget!.candidates;
    for (const [partialIndex, partial] of beam.entries()) {
      const partialBudget = Math.floor((stageBudget - stageCost()) / (beam.length - partialIndex));
      const partialActualBudget = Math.floor((stageActualBudget - stageActualCost()) / (beam.length - partialIndex));
      const partialStart = evaluatedCandidates;
      const partialRemainingStart = options.budget?.candidates;
      const partialCost = () => evaluatedCandidates - partialStart;
      const partialActualCost = () => partialRemainingStart === undefined ? 0 : partialRemainingStart - options.budget!.candidates;
      if (partialBudget <= 0 || partialActualBudget <= 0) continue;
      const routes = (function* () {
        yield [connector.source.point, connector.target.point];
        yield connector.route.points;
        yield* buildPortCorridorCandidates(connector, partial, { topologyOrder: "balanced" });
      })();
      const seen = new Set<string>();
      let tried = 0;
      for (const points of routes) {
        const key = JSON.stringify(points);
        if (seen.has(key)) continue;
        seen.add(key);
        if (evaluatedCandidates >= limit || (options.budget?.candidates ?? Infinity) <= 0 || tried >= alternatives || partialCost() >= partialBudget || partialActualCost() >= partialActualBudget) {
          exhausted ||= evaluatedCandidates >= limit || (options.budget?.candidates ?? Infinity) <= 0; break;
        }
        evaluatedCandidates++; tried++;
        if (options.budget) options.budget.candidates--;
        const revision: FinalRoutingContext = { ...partial, connectors: [...partial.connectors,
          { ...connector, route: { ...connector.route, points: points.map(point => ({ ...point })) } }] };
        if (validateFinalRouteSet(revision).length === 0) {
          next.push(revision);
          if (scoreContext) {
            const key = canonicalRoutingQualityContext(revision);
            let completeScore = scoreCache.get(key);
            if (!completeScore) {
              if (options.budget) {
                // Expose only this beam state's remaining fair share to the same
                // budget object closed over by synchronous label/marker callbacks.
                const callbackAllowance = Math.max(0, partialActualBudget - partialActualCost());
                const reserved = options.budget.candidates - callbackAllowance;
                options.budget.candidates = callbackAllowance;
                try {
                  completeScore = Object.freeze([...scoreContext(revision)]);
                } finally {
                  const unspent = options.budget.candidates;
                  options.budget.candidates = reserved + (Number.isFinite(unspent) ? Math.max(0, Math.min(callbackAllowance, unspent)) : 0);
                  if (!Number.isFinite(unspent) || !Number.isInteger(unspent) || unspent < 0 || unspent > callbackAllowance) {
                    throw new RangeError("Scene assessment exceeded its reserved candidate allowance.");
                  }
                }
              } else completeScore = Object.freeze([...scoreContext(revision)]);
              if (!completeScore.every(value => Number.isFinite(value) && value >= 0) || scoreArity !== undefined && completeScore.length !== scoreArity) {
                throw new RangeError("Scene penalties must be finite, nonnegative and have consistent arity.");
              }
              scoreArity = completeScore.length;
              scoreCache.set(key, completeScore);
            }
            contextScores.set(revision, completeScore);
          }
          // A legal two-point attachment adding no crossing dominates longer
          // alternatives for this settled context: zero bends is already minimal.
          if (points.length === 2 && (!scoreContext || contextScores.get(revision)?.every(value => value === 0))
            && routeCost(revision.connectors)[0] === routeCost(partial.connectors)[0]) break;
        }
      }
      if (evaluatedCandidates >= limit || (options.budget?.candidates ?? Infinity) <= 0) break;
    }
    next.sort((a, b) => {
      const left = [...(contextScores.get(a) ?? []), ...routeCost(a.connectors)];
      const right = [...(contextScores.get(b) ?? []), ...routeCost(b.connectors)];
      for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return left[index]! - right[index]!;
      return JSON.stringify(a.connectors.map(c => [c.id, c.route.points])).localeCompare(JSON.stringify(b.connectors.map(c => [c.id, c.route.points])));
    });
    const unique = new Set<string>();
    beam = next.filter(revision => { const key = JSON.stringify(revision.connectors.map(c => [c.id, c.route.points]));
      if (unique.has(key)) return false; unique.add(key); return true; }).slice(0, width);
    if (!beam.length) break;
  }
  const candidates = beam.filter(revision => revision.connectors.length === context.connectors.length)
    .map((revision, index) => ({ id: `proposal-${index}`, context: { ...revision,
      connectors: context.connectors.map(connector => revision.connectors.find(candidate => candidate.id === connector.id)!) } }));
  return { candidates, evaluatedCandidates, exhausted };
}
