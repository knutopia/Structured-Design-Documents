import type {
  RoutingAssignment,
  RoutingCandidate,
  RoutingExpansionRequest,
  RoutingObservation,
  RoutingPolicy,
  RoutingResource,
  RoutingSegmentId,
  RoutingSolveResult,
  RoutingViolation
} from "./contracts.js";
import { aggregateRoutingObservations } from "./claims.js";
import { solveRoutingClaims } from "./solver.js";

export interface RoutingLifecycleCandidate<TMetadata, TOutput> extends RoutingCandidate<TMetadata> {
  observations: RoutingObservation[];
  resources: RoutingResource[];
  reconstruct: (assignments: ReadonlyMap<RoutingSegmentId, RoutingAssignment>) => TOutput;
}

export interface RoutingLifecycleAdapter<TState, TMetadata, TOutput> {
  buildCandidates: (state: TState) => RoutingLifecycleCandidate<TMetadata, TOutput>[];
  validate: (output: TOutput, candidate: RoutingLifecycleCandidate<TMetadata, TOutput>) => RoutingViolation[];
  buildRepairObservations?: (
    output: TOutput,
    candidate: RoutingLifecycleCandidate<TMetadata, TOutput>,
    violations: readonly RoutingViolation[]
  ) => RoutingObservation[];
  applyExpansion?: (
    state: TState,
    requests: readonly RoutingExpansionRequest[]
  ) => TState;
}

export type RoutingLifecycleResult<TState, TMetadata, TOutput> =
  | {
      status: "resolved";
      state: TState;
      candidate: RoutingLifecycleCandidate<TMetadata, TOutput>;
      output: TOutput;
      solveResult: Extract<RoutingSolveResult, { status: "resolved" }>;
      expansionPasses: number;
    }
  | {
      status: "unsatisfiable";
      state: TState;
      candidate?: RoutingLifecycleCandidate<TMetadata, TOutput>;
      output?: TOutput;
      violations: RoutingViolation[];
      expansionPasses: number;
    };

export function runRoutingLifecycle<TState, TMetadata, TOutput>(
  initialState: TState,
  adapter: RoutingLifecycleAdapter<TState, TMetadata, TOutput>,
  policy: RoutingPolicy
): RoutingLifecycleResult<TState, TMetadata, TOutput> {
  let state = initialState;
  let expansionPasses = 0;
  const terminalViolations: RoutingViolation[] = [];

  while (expansionPasses <= policy.maxExpansionPasses) {
    const candidates = adapter.buildCandidates(state);
    let requestedExpansion: RoutingExpansionRequest[] | undefined;

    for (const candidate of candidates) {
      let observations = [...candidate.observations];
      for (let repairPass = 0; repairPass <= policy.maxExpansionPasses; repairPass += 1) {
        const aggregated = aggregateRoutingObservations(candidate.segments, observations, policy.epsilon);
        const solveResult = solveRoutingClaims(aggregated.claims, {
          resources: candidate.resources,
          policy,
          priorViolations: aggregated.violations
        });
        if (solveResult.status === "needs_expansion") {
          requestedExpansion = solveResult.expansionRequests;
          terminalViolations.push(...solveResult.violations);
          break;
        }
        if (solveResult.status !== "resolved") {
          terminalViolations.push(...solveResult.violations);
          break;
        }

        const output = candidate.reconstruct(solveResult.assignments);
        const violations = adapter.validate(output, candidate);
        if (violations.length === 0) {
          return {
            status: "resolved",
            state,
            candidate,
            output,
            solveResult,
            expansionPasses
          };
        }
        terminalViolations.push(...violations);
        const repair = adapter.buildRepairObservations?.(output, candidate, violations) ?? [];
        if (repair.length === 0) {
          break;
        }
        observations = [...observations, ...repair];
      }
    }

    if (!requestedExpansion
      || requestedExpansion.length === 0
      || !adapter.applyExpansion
      || expansionPasses >= policy.maxExpansionPasses) {
      break;
    }
    state = adapter.applyExpansion(state, requestedExpansion);
    expansionPasses += 1;
  }

  return {
    status: "unsatisfiable",
    state,
    violations: terminalViolations.length > 0
      ? terminalViolations
      : [{
          kind: "assignment_exhausted",
          message: "Routing lifecycle exhausted candidates without producing a valid final route.",
          connectorIds: [],
          segmentIds: []
        }],
    expansionPasses
  };
}
