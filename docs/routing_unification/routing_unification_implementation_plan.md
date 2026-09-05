# Routing Unification Implementation Plan

**Status:** Complete and verified on 2026-09-04. The proof wave and all six renderer
adoptions, including Journey Map physical-track assignment, are complete. Accepted
visual proofs, focused tests, the TypeScript build, and the full repository suite all
pass; the final full-suite run completed with 109 test files and 1,040 tests passing.

## Implementation Record

The implementation established `src/renderer/staged/routingCore/` with shared route
geometry, stable physical-segment identity, observation aggregation, deterministic
track assignment, reconstruction, candidate selection, typed validation, expansion
requests, and a bounded solve-validate-repair lifecycle.

The current adoption state is:

| View | Implemented state |
| --- | --- |
| Outcome-Opportunity | Shared claims, assignment, reconstruction, and final validation. The detailed `multiple_outcomes` overlap is fixed. |
| Service Blueprint | Shared candidate selection, claims, assignment, reconstruction, and final validation. The two `sdd_for_sdd.sdd` node intersections are fixed in compact and detailed output. |
| Scenario Flow | Shared claims, assignment, reconstruction, and structural validation after view-owned semantic expansion. |
| Journey Map | Shared physical-segment aggregation and bounded assignment with view-owned archetypes, directional corridors, reciprocal-pair constraints, expansion ownership, crossing minimization, and continuity marks. |
| IA Place Map | Shared final validation with explicit intentional shared-trunk declarations. |
| UI Contracts | Renderer-owned SCC/longest-path layered placement, shared exterior route repair, and shared final validation. ELK and `elkjs` are removed. |

The proof SVGs and SVG-derived PNGs were inspected before artifact refresh. Repeated
Outcome-Opportunity and Service Blueprint renders were byte-identical and emitted no
proof-case routing errors.

The initial Journey convergence experiment was rejected because it consumed partial
assignments, treated peripheral routes as uniformly locked, omitted outward-only
corridor bounds, and allowed view-owned endpoint and crossing passes to invalidate an
earlier shared assignment. The implemented adapter now runs shared assignment after
Journey topology and endpoint construction; admits only outward coordinates for Stage,
root-span, root-outer, and branch/join resources; locks only the paired tracks whose
relative reciprocal topology is view-owned; converts displacement into absolute
view-owned expansion requests; and never consumes a non-`resolved` solver result.
The core keeps stable claim-order search as its cross-renderer default; Journey opts
into a bounded most-constrained-first search for its dense peripheral corridor
components, without imposing that cost or ordering policy on other adapters.

Journey's crossing minimizer remains view-owned and may only permute legal assignments
without worsening track separation, collinear merging, or Stage-gate traversal.
Coincident logical crossings share one physical continuity mark. The accepted dense
proof has 57 logical crossing pairs at 55 physical crossing points, retains 55 visible
continuity marks, emits no track-separation, constraint-unsatisfiable, or boundary-gate
diagnostic, and is byte-deterministic. The accepted endpoint-order proof retains its
ports and exact 16px minimum track separation with a small permitted Y-coordinate
change. Goldens were refreshed only after SVG and SVG-derived PNG inspection.

Label placement also remains downstream and view-owned as assumed in Section 12.
Shared final validation covers route geometry; the existing independent visual oracle
continues to enforce label clearance.

## 1. Summary

Build shared routing infrastructure for all six staged renderers without forcing them into one universal route generator.

The shared layer will own geometry, physical-segment identity, constraint aggregation, track assignment, expansion requests, final validation, and the bounded solve-validate-repair lifecycle. View adapters will retain semantic ports, connector priorities, route archetypes, corridor discovery, intentional sharing, and crossing policies.

Outcome-Opportunity and Service Blueprint form the first mandatory proof wave. That wave must resolve:

- The 32px final collinear overlap in detailed `multiple_outcomes`.
- The Service Blueprint node intersections for `J-020__precedes__J-021` and `J-040__precedes__J-043` when rendering `sdd_for_sdd.sdd`.

Scenario Flow follows because it shares the same occupancy architecture. Journey Map then adopts the shared mechanics while retaining its route archetypes and marked-crossing behavior. IA Place Map and UI Contracts adopt the shared geometry and acceptance layer; UI Contracts also replaces its remaining ELK-based layout and route hints.

## 2. Authority and Non-Negotiable Invariants

Authority is applied in this order:

1. `AGENTS.md` governs renderer boundaries, bundle authority, determinism, no-ELK direction, quality gates, and stop conditions.
2. `bundle/v0.1/` governs machine-readable view semantics.
3. `renderer_migration_guidance.md` and `architecture.md` govern renderer architecture after their stale ELK guidance is corrected.
4. The Outcome-Opportunity remediation handoff and the observed Service Blueprint failure provide defect evidence.
5. Focused routing tests and visual-acceptance tests are executable acceptance authority.
6. Existing snapshots, goldens, and the deferred cross-renderer research are supporting evidence only.

The implementation must preserve:

- `projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`.
- Projection as the semantic boundary.
- SVG as the first-class staged artifact and PNG as rasterization of that SVG.
- Renderer-owned, backend-neutral scene contracts.
- Existing semantic edge IDs, classes, ports, markers, labels, order, and detail policy unless an accepted routing correction requires geometry changes.
- Deterministic ordering, measurement, routing, diagnostics, and serialization.
- Legacy Graphviz, DOT, and Mermaid behavior.
- Explicit diagnostics when a valid route cannot be found.

The implementation must not:

- Introduce or expand ELK, Graphviz, Mermaid, or another external engine in staged rendering.
- Put coordinates, routes, SVG, or layout data into `RendererScene`.
- Move routing into parsing, compilation, validation, or projection.
- Special-case current proof IDs or coordinates.
- Weaken node-clearance, orthogonality, endpoint, or 16px separation invariants.
- Refresh artifacts to conceal a failing invariant.

## 3. Affected Renderer Matrix

| View | Adoption level | View-specific behavior retained |
| --- | --- | --- |
| Outcome-Opportunity | Full shared solver and lifecycle; first proof wave | Semantic columns and bands, channel selection, route archetypes, ports, parking fallbacks |
| Service Blueprint | Full shared solver and lifecycle; first proof wave | Operational lanes and columns, connector families, ports, support/resource patterns |
| Scenario Flow | Full shared solver and lifecycle after proof wave | Step spine, branch patterns, parking corridors, decision labels |
| Journey Map | Shared geometry, resources, solver, expansion, and validation | Archetype generation, stage gates, candidate families, continuity marks |
| IA Place Map | Shared geometry and validation; solver only where routes compete | Direct-vertical routes and explicitly declared shared trunks |
| UI Contracts | Shared routing and validation plus non-ELK layered placement | Container-origin contract lanes, scope ownership, transition priorities |

All staged SVG and PNG outputs are affected through their shared positioned scenes. Legacy renderers are not migrated.

## 4. Target Architecture

### Shared versus view-owned responsibility

Create an internal `src/renderer/staged/routingCore/` subsystem.

The shared core owns:

- Orthogonal route normalization and stable segment extraction.
- Point, segment, rectangle, span, and route geometry.
- Node intrusion, endpoint intrusion, crossings, collinear overlap, terminal-leg, and separation checks.
- Physical corridor/resource and track-claim contracts.
- Constraint aggregation for a physical segment.
- Deterministic track assignment and overflow calculation.
- Expansion requests expressed as absolute required capacity.
- Final route validation and typed violations.
- Bounded solve-validate-repair coordination.
- Generic deterministic scoring and tie-breaking.

Each view adapter owns:

- Semantic edge-to-channel mapping.
- Ports and preferred endpoint sides.
- Semantic priority.
- Route candidate and archetype generation.
- Discovery of view-specific corridors and expandable layout owners.
- Intentional track sharing.
- Perpendicular-crossing treatment.
- Reconstruction of view decorations and Journey continuity marks.
- Macro placement and labels.

The shared core must not contain names such as `Step`, `Opportunity`, `PRECEDES`, or `ADDRESSES`.

### Internal contracts

Introduce internal contracts equivalent to:

- `RoutingSegmentId`: opaque, deterministic identity containing connector, candidate, and logical-run identity. Point-array indexes are debug metadata only and never segment identity.
- `RoutingSegment`: axis, longitudinal span, transverse coordinate, endpoint role, and adjacent-run continuity.
- `RoutingResource`: corridor identity, axis, usable coordinate bounds, owning layout region, and expansion capability.
- `RoutingObservation`: one obstacle, gutter, endpoint, or bundle constraint observed for a segment.
- `RoutingTrackClaim`: the fully aggregated claim for one physical segment, including all observations and resources.
- `RoutingPolicy`: separation, clearance, terminal-leg, sharing, crossing, and bounded-attempt policy.
- `RoutingAssignment`: the one authoritative coordinate selected for each physical segment.
- `RoutingExpansionRequest`: layout owner, direction, absolute required size, responsible segments, and violation.
- `RoutingViolation`: typed geometry or policy failure with connector, segment, resource, and obstacle context.
- `RoutingCandidate`: stable topology plus segments and reconstruction metadata.
- `RoutingSolveResult`, discriminated as:
  - `resolved`
  - `needs_expansion`
  - `needs_alternate_candidate`
  - `unsatisfiable`

No user-facing CLI, `.sdd`, compiler, projection, SVG, or PNG interface changes are intended.

### Stable physical-segment ownership

A candidate generator assigns logical run IDs before occupancy observations are created. The same run may be observed in several obstacle or corridor contexts, but all observations aggregate under one `RoutingSegmentId`.

Aggregation must:

- Intersect allowed coordinate ranges.
- Union forbidden coordinate ranges.
- Collect every applicable obstacle and resource.
- Reconcile locked coordinates, rejecting conflicting locks.
- Preserve one semantic priority and movement policy.
- Produce one final coordinate assignment.

This removes the current `connectorId + routeSegmentIndex` last-writer behavior and prevents independent obstacle groups from assigning different coordinates to the same physical segment.

### Shared solve lifecycle

Every adopted router follows:

1. Build ordered view-specific route candidates.
2. Assign stable logical segment IDs.
3. Discover routing resources and collect observations.
4. Aggregate all observations by physical segment.
5. Build conflict components from overlapping longitudinal spans and reachable transverse domains, not only current coordinates.
6. Solve locked claims first, then movable claims.
7. Reconstruct complete routes from assignments so adjacent bends remain connected.
8. Validate all final routes globally, across every occupancy classification.
9. Convert repairable violations into additional constraints and resolve again.
10. Request monotonic layout expansion if available capacity is insufficient.
11. Rebuild from the original candidate and accumulated absolute expansion state.
12. Try the next candidate when the topology, rather than capacity, is invalid.
13. Return `unsatisfiable` with an error diagnostic after the configured bound.

`No expansion requested` is not success unless final validation is clean.

### Deterministic assignment

For every conflict component:

- Validate locked coordinates first; conflicting locked claims require expansion or fail.
- Order movable claims by semantic priority, stable connector order, then stable segment ID.
- Enumerate legal coordinates from nominal and locked tracks at the configured separation interval within the feasible bounds.
- Use bounded branch-and-bound assignment rather than independent greedy overwrites.
- Minimize, in order:
  1. hard violations;
  2. required expansion;
  3. priority-weighted displacement;
  4. total displacement;
  5. crossings subject to view policy;
  6. bend count and Manhattan length;
  7. lexical assignment order.
- Preserve current expansion bounds through adapter policy: four passes for Outcome, Service, and Journey; eight for Scenario. Generic adopters default to four.
- Recompute from nominal candidates on every pass so displacement is not cumulative.

## 5. Common Acceptance Policy

The production validator and independent test oracle must check:

- Orthogonality for routes declared orthogonal.
- Endpoint identity and connection to the declared port.
- Exterior source departure and target arrival.
- No traversal through a non-endpoint node.
- Minimum marker terminal leg.
- No prohibited positive-span collinear overlap.
- At least 16px separation for competing same-orientation tracks, subject to the existing epsilon.
- Container, header, separator, and decoration clearance where the adapter declares them blocking.
- Label clearance after the existing downstream label placer runs.
- Explicit perpendicular-crossing treatment.

View policies are:

- Outcome, Service, and Scenario prohibit competing collinear sharing. Perpendicular crossings remain a scored cost unless an existing contract makes one illegal.
- Journey permits only its existing marked unavoidable crossings; unmarked crossings that require continuity treatment are violations.
- IA permits overlap only when all participating runs declare the same intentional shared-trunk group. Other overlaps are violations.
- UI preserves reserved container-origin lanes and otherwise uses normal exclusive tracks.

Adapters map shared violations to existing view-specific diagnostic codes. Add `renderer.routing.<view>_constraint_unsatisfiable` and `renderer.routing.<view>_expansion_exhausted` only where no existing equivalent exists. Intermediate violations that are repaired do not produce final warnings.

## 6. Bundle-Authority Gate

Before migrating each adapter, record every non-geometric routing input and classify it as:

- Already bundle-owned.
- Pure renderer geometry.
- View-specific topology algorithm derived from bundle semantics.
- Missing bundle-owned semantic policy.

Existing bundle data-such as Outcome connector channels and priority, Journey branch placement, Service lane mapping, Scenario layout, IA source-order chains, and UI transition priority-must continue to drive behavior.

Any hardcoded semantic priority, port-role preference, track-sharing rule, or crossing treatment uncovered by the audit must be represented through a generic `renderer_defaults.connectors` or routing-policy field before the adapter consumes it. Extend the bundle types and loader first, then prove with a bundle-mutation test that changing the field changes runtime behavior.

Do not put geometric constants, rectangle math, candidate scoring, or constraint-solving mechanics into the bundle.

## 7. Implementation Phases

### Phase 0 - Freeze architecture and acceptance

- Save this plan in the destination directory.
- Correct `renderer_migration_guidance.md` so ELK is no longer recommended or permitted for new staged layout or routing.
- Correct stale architecture claims, including Service Blueprint's former ELK ownership.
- Record the six-view acceptance matrix and bundle-policy trace.
- Preserve the exact two current failing reproductions before changing routing code.
- Establish which existing diagnostics are hard failures, permitted degradation, or known defects.

Exit gate:

- Authority is unambiguous.
- No new ELK work is permitted.
- Both failures reproduce through production paths.
- No goldens have been refreshed.

### Phase 1 - Shared geometry and validation without route changes

- Extract duplicated production geometry into `routingCore`.
- Keep the visual test harness as an independent oracle.
- Add typed violations and view-policy hooks.
- Run the shared validator against existing positioned scenes in focused tests without changing route generation.
- Re-export established helpers through the current routing module where needed to limit churn.

Exit gate:

- Geometry tests cover boundary touching versus intrusion, partial and complete collinear overlap, perpendicular crossings, endpoints, terminal legs, and epsilon behavior.
- Existing render geometry is unchanged.
- The validator detects both known defects.
- Existing test behavior is otherwise preserved.

### Phase 2 - Shared claims, solver, expansion, and lifecycle

- Add stable segment identities and observation aggregation.
- Implement deterministic conflict-component construction and assignment.
- Implement absolute expansion requests and bounded lifecycle coordination.
- Add adapter callbacks for candidate generation, resource discovery, reconstruction, expansion, finalization, and diagnostic mapping.
- Test the core using synthetic geometry before connecting a production renderer.

Required synthetic regressions include:

- One segment constrained by multiple obstacles receives one assignment.
- A later obstacle observation cannot overwrite an earlier one.
- Resolving conflict A cannot create an unresolved conflict B.
- Exactly 16px separation remains legal.
- Movable claims respect locked claims.
- Conflicting locks request expansion or fail explicitly.
- Reconstructed bends remain orthogonal and connected.
- Insufficient capacity returns a bounded result.
- Shuffled input produces byte-identical assignments and diagnostics.

Exit gate:

- The shared solver passes independently of all view semantics.
- No adapter-specific node or edge kinds appear in the core.
- Search and expansion are finite and deterministic.

### Phase 3 - Outcome-Opportunity and Service Blueprint proof wave

Migrate both adapters together because their compaction and displacement structures are duplicated.

For Service Blueprint:

- Replace per-obstacle coordinate writes with aggregated physical-segment claims.
- Preserve the safe step-3 topology while preventing later compaction from moving a run through another node.
- Ensure a Step-only customer-lane blueprint is valid even if it is not a useful blueprint.
- Add a small semantic-ID-independent multi-obstacle fixture in addition to the exact `sdd_for_sdd.sdd` smoke test.

For Outcome-Opportunity:

- Feed displacement-created final conflicts back into shared solving.
- Consider all final geometrically competing segments regardless of original occupancy group.
- Preserve accepted shared-node width and measurement.
- Keep labels downstream of resolved final routes.

Exit gate:

- Detailed `multiple_outcomes` has no `OP-003`/`OP-004` overlap or replacement violation.
- The Service Blueprint reproduction renders without the two node-intersection errors in compact and detailed modes.
- Both views pass global orthogonality, endpoint, node-clearance, separation, and determinism checks.
- Step-2, step-3, gutter, and final debug artifacts remain meaningful.
- Goldens are updated only after SVG and derived PNG visual inspection.

### Phase 4 - Scenario Flow adoption

- Translate lane, band, obstacle, endpoint, and parking occupancy into shared resources and claims.
- Replace duplicated compaction, coordinate resolution, expansion, and final validation.
- Preserve the existing eight-pass expansion bound, Step spine, branch ordering, decision-node behavior, parking routes, and label policy.
- Use the shared lifecycle for final violations rather than emitting invalid final geometry.

Exit gate:

- Existing Scenario focused and visual tests pass.
- Dense branches, multi-obstacle routes, parking corridors, and compact/detailed labels remain readable.
- No Scenario-specific branch exists in the shared core.

### Phase 5 - Journey Map adoption

- First replace geometry and final validation.
- Then map stage gates, stage bypasses, root spans, and outer gutters to shared resources.
- Move track assignment and expansion onto the shared solver incrementally.
- Retain Journey's candidate generators, route archetypes, source ordering, boundary gates, backward-edge treatment, and continuity marks.
- Use shared candidate scoring only for the common hard-violation and deterministic tie-break portions.

Exit gate:

- Existing Journey branch/join, cycle, backward-edge, root-span, and visual suites pass.
- No accepted route loses its required continuity mark.
- Existing unavoidable-crossing diagnostics remain intentional.
- Candidate generation remains view-owned.

### Phase 6 - IA Place Map and UI Contracts

For IA Place Map:

- Adopt shared segment geometry, endpoint checks, and final validation.
- Mark intentional shared trunks with an explicit shared-track group.
- Keep direct vertical and shared-trunk templates view-owned.
- Invoke the solver only when non-shared physical tracks compete.

For UI Contracts:

- Replace `elk_layered` with a renderer-owned `layered` strategy.
- Build each transition graph by:
  1. finding strongly connected components;
  2. topologically ranking the condensed graph by longest path;
  3. ordering components and nodes by bundle priority and stable model/source order;
  4. placing ranks left-to-right with existing spacing;
  5. routing cycles, self-loops, and backward connections through shared outer resources.
- Preserve ViewState-versus-State priority and container-origin contract lanes.
- Route positioned transition graphs through the shared core rather than consuming ELK route hints.
- After the final consumer is removed, delete `elk_layered`, `require_elk`, ELK option fields, staged adapter code, dependency, and obsolete tests.

Exit gate:

- IA's intentional trunks remain intentional and no unrelated overlap is exempted.
- UI cycles, disconnected components, nested scopes, transition labels, and contract lanes pass focused and visual acceptance.
- No staged source imports or invokes `elkjs`.
- Legacy Graphviz remains available and unchanged.

### Phase 7 - Consolidation and artifact refresh

- Remove duplicated geometry, compaction, displacement, expansion, and validation code only after its last adapter migrates.
- Retain view-specific candidates, resources, decorations, and semantic adapters.
- Update architecture and migration documentation to describe the implemented state.
- Refresh affected renderer-stage snapshots and rendered corpus artifacts view by view.
- Run the complete repository suite and deterministic repeat-render checks.
- Record satisfied and violated invariants after each renderer wave.

Exit gate:

- All six staged views use shared production geometry and final validation.
- Outcome, Service, Scenario, and Journey use shared resource/claim solving.
- IA and UI use the relevant shared mechanics without losing their special route contracts.
- No known routing defect is normalized into a golden.

## 8. Verification Plan

Run focused tests after each phase, then the full suite:

```bash
TMPDIR=/tmp pnpm exec vitest run tests/outcomeOpportunityMapRouting.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedServiceBlueprint.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/scenarioFlowRouting.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/journeyMapRouting.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedIaPlaceMap.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedUiContracts.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/stagedVisualAcceptance.spec.ts
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm test
```

Required production smoke cases:

```bash
TMPDIR=/tmp pnpm sdd show \
  bundle/v0.1/examples/multiple_outcomes.sdd \
  --view outcome_opportunity_map \
  --detail detailed

TMPDIR=/tmp pnpm sdd show \
  docs/sdd_app_planning/sdd_for_sdd.sdd \
  --view service_blueprint
```

Repeat the Service Blueprint render with detailed rendering.

Before refreshing artifacts:

- Inspect the exact proof SVG.
- Inspect PNG produced from that SVG.
- Confirm corrected connectors remain distinct and readable.
- Confirm no replacement overlap, node traversal, endpoint intrusion, short marker leg, or label collision.
- Compare two repeated renders for deterministic scene data and SVG bytes.
- Report each acceptance invariant as satisfied or violated.

## 9. Compatibility and Rollout

- Migrate one renderer wave at a time; do not use a user-visible feature flag.
- Switch a renderer atomically only after its proof and regression gates pass.
- Preserve external edge identities, classes, ports, markers, labels, debug-stage names, and detail behavior.
- Permit route-coordinate and canvas-size changes required for valid separation or expansion.
- Preserve existing view-specific diagnostic codes where they remain accurate.
- Do not change parser, compiler, validation, or projection output.
- Do not change legacy artifacts unless a separate legacy task explicitly authorizes it.

## 10. Stop Conditions

Stop and report instead of continuing when:

- A routing decision requires semantic policy that the bundle cannot express.
- A fix begins depending on current proof IDs, CSS classes, or raw `.sdd` text.
- Final validation still fails after the bounded lifecycle.
- An adapter requires domain terminology inside the shared core.
- Goldens would need updating before structural acceptance passes.
- UI's replacement layered layout is structurally worse than its accepted proof cases.
- Solver bounds or deterministic tie-breaking cannot be demonstrated.
- A route is labelled orthogonal while containing a diagonal segment.
- Legacy behavior changes without explicit scope expansion.

## 11. Completion Criteria

Routing unification is complete when:

- Both known failures are fixed through shared architecture rather than local exceptions.
- Every staged view uses the shared geometry and final-acceptance contract.
- All physical-segment constraints aggregate before assignment.
- Final violations re-enter repair, expansion, or alternate-candidate selection.
- Unsatisfied routing capacity produces an explicit bounded error.
- All machine-behavior semantics remain bundle-driven.
- UI Contracts no longer depends on ELK.
- Focused, visual, snapshot, build, and full-suite tests pass.
- SVG and derived PNG proofs are visually accepted.
- Architecture documentation matches the implemented system.

## 12. Assumptions and Defaults

- The program covers all six staged views.
- Outcome-Opportunity and Service Blueprint are the first mandatory proof wave.
- The current 16px track separation remains the baseline, exposed as shared policy rather than duplicated constants.
- Current per-view expansion bounds are preserved during migration.
- Label-placement unification is outside this program; current label placers remain downstream, while shared final validation checks their accepted output.
- Legacy Graphviz, DOT, and Mermaid paths remain out of scope.
- Internal routing types may change freely; user-facing commands and artifacts retain their semantic contracts.
- The selected document name is `routing_unification_implementation_plan.md`.

## Appendix A - Phase 0 Evidence and Policy Trace

Baseline captured before routing changes:

- `docs/sdd_app_planning/sdd_for_sdd.sdd` validates cleanly under `simple` and its `service_blueprint` projection contains eleven `Step` nodes, nine `PRECEDES` edges, and one derived customer lane.
- Its default staged Service Blueprint render fails only at routing, with the two documented non-endpoint-node intersections.
- `tests/stagedVisualAcceptance.spec.ts` has one baseline failure: the documented 32px Outcome-Opportunity overlap. Its other four proof cases pass.

Routing-policy ownership at the start of migration:

| View | Bundle-owned inputs | View-adapter inputs that remain architectural code | Bundle gap to resolve before moving the rule into shared code |
| --- | --- | --- | --- |
| Outcome-Opportunity | Semantic columns, edge-type channels, connector priority, detail policy | Band/corridor discovery and route archetypes | None for the first proof; do not duplicate the existing channel policy |
| Journey Map | Branch placement/order/scope and disconnected fallback | Stage gates, candidate archetypes, continuity-mark construction | Any crossing permission generalized beyond Journey must become an explicit policy input |
| Service Blueprint | Lane order/mapping, cell sizing, detail policy | Operational corridor discovery and connector archetypes | Semantic connector priority or port-role rules must be bundle-owned before extraction from the adapter |
| IA Place Map | Hierarchy and source-ordered place-chain semantics | Direct-vertical and shared-trunk topology | Intentional sharing must be passed explicitly; if made configurable, encode it in renderer defaults first |
| Scenario Flow | Decision-node policy, lane layout, component and branch order, detail policy | Step-spine, parking, and branch candidate construction | Semantic edge-family priority or side policy must be bundle-owned before extraction from the adapter |
| UI Contracts | Transition-graph priority and detail policy | Scoped containers and contract-lane construction | Any generalized transition side, sharing, or crossing rule must be bundle-owned before shared consumption |

Diagnostic classification at the start of migration:

- Final non-endpoint node intersections, endpoint intrusion, non-orthogonal routes, unpermitted collinear overlaps, and exhausted routing capacity are hard failures.
- Journey's explicitly marked unavoidable crossings and documented peripheral-route warnings are permitted degradation.
- Label fallback or omission remains governed by each existing label-placement policy and is not a substitute for repairing route geometry.
- The two captured proof failures are known defects, not accepted degradation.
