# Shared label-space reservation and bounded correction for Scenario flows

## Implementation progress — 2026-10-07

- [x] Record eight failing proof association checks before production changes (`/tmp/sdd-label-red.log`).
- [x] Implement shared association audit, opt-in placement acceptance, and measured corridor capacity.
- [x] Integrate Scenario's correction loop, cumulative budgets, complete-scene rollback, warnings and debug trace.
- [x] Verify all eight proof configurations; inspect the detailed PNG and eight-mode contact sheet in `/tmp/sdd-label-proof`.
- [x] Add shared capacity/audit and orchestration regressions: 34 tests pass across the three focused files.
- [x] Verify existing Scenario snapshots and routing, plus Outcome, Service and visual acceptance: no golden updates are needed.
- [x] Reproduce the two previously reported unrelated failures against HEAD in `/tmp/sdd-label-baseline`.
- [x] Finish the complete suite and record its result in the execution ledger: 1,698 passed, three failed; the source-hash guard was subsequently resolved and its 33-test compatibility rerun passes. The two remaining failures reproduce against HEAD.

The implementation preserves displayed labels, uses the existing eight-expansion and 4096/128 routing limits, and publishes warning-only degraded output when correction cannot finish. Proof acceptance is clean; compact detail suppresses branch labels according to the existing bundle policy. Unrelated `progress.md` changes are preserved.


## 1. Objective, authority, and acceptance

Make Scenario connector labels remain clearly associated with their connectors by reserving measured space, validating the final placement, and circling back to layout when necessary.

Implement reusable renderer infrastructure, with Scenario as its first adopter. Do not migrate other renderers in this change.

**Chosen failure policy:** when label correction cannot finish, publish the best diagram with valid routing and explicit warnings. Do not silently omit labels. Invalid connector routing still prevents publication.

Use these sources in this order:

- **Architectural guardrails:** [AGENTS.md](/home/knut/projects/sdd/AGENTS.md), especially shared renderer ownership, projection boundaries, determinism, and proof before snapshot updates.
- **Routing acceptance contract:** [routing decisions](/home/knut/projects/sdd/docs/routing_hardening/design_decisions.md). Preserve complete route-set validation, port permissions, clearance, search budgets, and expansion ownership.
- **Implementation precedents:** Outcome’s label-aware gutter demand, UI Contracts’ measured label spacing and association audit, and the existing shared connector-label placement helper.
- **Proof case:** `tests/fixtures/render/scenario_overlap_reconvergence.sdd`. The previous rendered proof documents the defect; it is not the desired visual result.

Required invariants:

1. Every emitted connector set passes complete routing validation.
2. Every displayed label is audited against its **final** connector and surrounding geometry.
3. The proof’s two cross-link labels remain visibly attached to their connectors instead of being displaced below the node rows.
4. The proof succeeds without label fallback, omission, or unresolved-label warnings in all eight detail/decorator configurations.
5. Expansion is driven by measured deficits, not arbitrary increments or fixture identifiers.
6. Correction is deterministic, bounded, and detects ineffective expansion.
7. Other renderers retain their existing behavior unless explicitly opting into the new infrastructure.

This is renderer geometry work. No bundle changes, language changes, CLI options, or projection changes are planned. If implementation appears to require new semantic routing permissions, stop and address the bundle contract first.

## 2. Shared label infrastructure

### Placement assessment and final audit

Add shared label-layout infrastructure alongside `connectorLabelPlacement.ts` and `labelCollisionGeometry.ts`. Keep the existing placement entrypoint and its defaults compatible for Outcome, Service Blueprint, and UI Contracts.

Expose an internal assessment result containing:

- Proposed label placements.
- The associated connector segment for each placement.
- Structured problems: missing placement, detached placement, node/header/separator collision, other-label collision, other-connector collision, marker collision, or bounds violation.
- Measured capacity requests for adapter-owned corridors.
- A deterministic comparison key for selecting the best attempted result.

Use measured label dimensions and the existing font/theme machinery. Do not estimate width from character count or change wrapping in this task.

Define association geometrically:

- The label must be within `FIXED_LABEL_DISTANCE`—currently 12px—of an actual segment of its own connector.
- Its projection along that segment must overlap by at least the minimum of `FIXED_LABEL_CLEARANCE`, the label’s extent on that axis, and the segment’s length.
- Ignore zero-length segments.
- Apply the same rule to horizontal and vertical segments.
- Permit an existing label centered on its own connector; the current renderer already uses that presentation.

Audit separately from placement scoring. A fallback candidate is never automatically considered valid.

Reuse existing collision and marker geometry helpers. Scenario retains its existing node and label spacing policy. Check actual painted marker footprints and lane/header geometry, not every container as an implicit solid obstacle.

### Placement behavior

For Scenario:

- Retain placements that already pass the complete audit.
- Reposition invalid labels in existing connector-priority order, with stable identity as the final tie-break.
- Enable adjacent horizontal anchors and the existing association controls.
- Consider both horizontal and vertical anchors; do not force every label onto a horizontal segment.
- Prefer a valid associated placement over a detached collision-free placement.
- Recheck retained labels whenever routing or layout changes.

Do not change the default options used by other renderers.

### Measured capacity

Add a shared geometric capacity helper. Scenario supplies physical corridor bounds and opaque expansion-owner identifiers; the helper must not inspect Scenario channels, node types, or fixture IDs.

Capacity requests must include the owner, axis, available size, required size, and contributing connector/label IDs.

Implement these rules:

1. Consider label rectangles and connector-clearance envelopes together.
2. Measure both axes: label width can require column expansion, and label height can require row expansion even for connectors with east/west endpoints.
3. Assign one proposed anchor per label before counting its demand. Do not reserve space for every alternative anchor simultaneously.
4. Group demand by physical corridor and overlapping spans. Non-overlapping spans may reuse space.
5. Pack overlapping claims deterministically in connector-priority order, reusing the first compatible track. A track’s required thickness is the maximum claim thickness assigned to it.
6. Include label clearance and routing separation in the occupied envelope. Count a label and its own supporting route as one combined claim where their envelopes overlap.
7. Calculate the positive difference between required and available space.
8. Merge requirements for the same boundary using the maximum required size; do not add duplicate deficits from independent analyses.
9. Quantize the resulting positive expansion using Scenario’s existing separation-distance rounding.

Scenario maps these requests onto its existing column/lane expansion owner. Requests without a movable boundary are unfulfillable; do not manufacture space outside the node rows or repeatedly enlarge the canvas as a substitute.

Use current route geometry to associate demand with corridors. Do not copy Outcome’s south-to-north row rule literally: the proof’s cross-links have east/west endpoints.

## 3. Scenario integration and correction lifecycle

Keep `runRoutingLifecycle` as the sole coordinator that accepts connector geometry. Add label orchestration around it, without adding label violations to the routing search’s traversable violation kinds.

Use this lifecycle:

```text
Build the existing measured layout and stable baseline.
Prepare nominal routes and measured routing/label capacity requirements.
Apply effective requirements through the existing expansion owner.

Run complete routing resolution.
If no valid routing result exists, preserve existing routing failure behavior.

Place labels and audit the resulting scene.
Save this complete route-valid scene as a candidate result.

If all label checks pass:
    return this scene.

Otherwise:
    derive measured capacity corrections;
    stop if there is no effective correction or budget remaining;
    rebuild layout from the stable baseline plus cumulative expansions;
    rebuild endpoints, routes, decorations, and label inputs;
    repeat routing, placement, and audit.

On label exhaustion:
    return the best saved route-valid scene with warnings.
```

### Expansion and budget ownership

- Keep one cumulative column/lane expansion state.
- Apply cumulative expansions to the original positioned baseline, never repeatedly to an already shifted scene.
- Preparation, routing-driven expansion, and label correction share the existing **eight effective expansions**.
- Multiple boundary changes applied in one rebuild count as one expansion.
- Reject requests after the final movable row/column and requests that do not change relevant geometry.
- Carry routing search consumption across repeated calls: at most **4,096 candidates and 128 repair revisions** for the complete Scenario operation.
- Pass remaining budgets through the existing routing options. Do not call with zero remaining candidates: the current lifecycle clamps that argument to at least one.
- Centralize the existing routing default limits if needed to avoid copying their numeric values into another module; preserve defaults for all existing callers.
- Track canonical layout/route/placement states. A repeated state or ineffective request terminates correction with a warning.

Do not raise budgets or add a second expansion owner.

### Final scene selection and degraded output

Keep each candidate as a complete snapshot: scene, routes, corresponding accepted routing context, labels, gutter state, and diagnostics. Never combine labels from one revision with routes from another.

Rank saved route-valid scenes lexicographically by:

1. Missing labels.
2. Collision and bounds violations.
3. Detached labels.
4. Total detachment distance.
5. Canvas area.
6. Earliest revision.

If a later label-driven layout produces routing failure, discard that attempted revision and retain the best previously accepted scene. Never publish its failed routes.

For exhausted label correction:

- Keep the best available placement for every displayed label.
- Emit `renderer.routing.scenario_flow_edge_label_unresolved` with severity `warn`, once per affected connector.
- Include problem kinds, termination reason, and measured deficits in diagnostic details.
- Do not retain warnings from abandoned attempts when the selected final scene is clean.
- Preserve existing error diagnostics when no valid routed scene was ever found.

Add an internal/debug `labelLayoutTrace` to the Scenario routing result containing expansion counts by cause, aggregate routing counters, selected revision, termination reason, and unresolved label IDs. Preserve the meaning of the existing per-call `finalResolutionTrace`; do not silently redefine it.

Revalidate the selected emitted routes and labels after final decorations and bounds are assembled.

## 4. Implementation order and tests

### A. Establish the regression first

Extend the existing Scenario overlap proof tests before changing production behavior.

For all eight combinations of `compact`/`detailed` and `none`/`type`/`id`/`type,id`:

- Assert the displayed label set is preserved.
- Assert association with each label’s own final connector.
- Retain collision, routing, clipping, and determinism checks.
- Assert the two cross-link labels remain within the vertical envelope of their endpoint rows.
- Assert no unresolved-label or fallback diagnostics.
- Record the current failures.

Use an independent test-side association calculation, following the existing visual-harness pattern. Do not merely call the production audit and assert that it reports success.

Separate two guarantees currently combined in the integration tests:

- Shared overlap recovery still succeeds with fixed nodes/endpoints/bounds in `routingOverlapRecovery.spec.ts`.
- Full Scenario rendering may expand layout for labels.

Remove the integration test’s single-lifecycle-call assumption when the correction loop is introduced. Validate against the routing context belonging to the selected emitted revision, rather than blindly using the last attempted call.

### B. Implement shared helpers and prove the seven-node case

Add focused unit tests for:

- Horizontal and vertical association.
- Nearby labels with insufficient segment overlap.
- Short and zero-length segments.
- Adjacent-anchor selection.
- Node, label, separator, marker, and other-route collisions.
- Width-driven and height-driven deficits.
- Multiple simultaneous labels/tracks.
- Space reuse for non-overlapping spans.
- Duplicate-deficit merging.
- Deterministic ordering and input immutability.

Implement the shared helpers and Scenario adoption. Get the seven-node proof correct before broadening fixtures or refreshing snapshots.

Render and inspect all eight SVGs, plus a contact sheet and a detailed `type,id` PNG. Check that label ownership is visually clear, not merely within a distance threshold.

If the proof still produces structurally wrong placement, stop and report the violated invariant. Do not tune arbitrary offsets or weaken the audit.

### C. Exercise the correction loop and fallback

Add focused orchestration tests covering:

| Case | Expected behavior |
|---|---|
| Labels already fit | No label-driven expansion; preserve valid geometry and placements. |
| Insufficient column capacity | Measured column expansion, rerouting, clean final audit. |
| Insufficient row capacity | Measured row expansion, rerouting, clean final audit. |
| Routing changes the useful label anchor | Reassess against the new route; perform another correction if required. |
| Multiple labels share a corridor | Reserve simultaneous capacity; no label collisions. |
| Non-progressing or unmappable request | Stop without wasting repeated expansions; warn. |
| Expansion budget exhausted | Publish the best route-valid scene with warnings. |
| Routing budget exhausted during correction | Do not reset counters; retain a prior route-valid candidate when available. |
| Later correction causes routing failure | Roll back the complete scene, not just routes or labels. |
| Initial routing is irreparable | Preserve existing error and no-artifact behavior. |
| Warning-only result | Both SVG and PNG previews remain available. |
| Repeated render | Identical geometry, warnings, trace, and LF-normalized SVG. |

Include long/wrapped labels, unequal node heights, unlabeled connectors, a vertical connection, and a backward connection. Use valid sources for each bundle version; do not change document semantics to make renderer tests pass.

### D. Compatibility and snapshots

Run existing shared placement, UI label repair, Outcome, Service, Scenario routing, Scenario snapshots, and visual-acceptance suites. Include IA and Journey checks before completion because shared renderer code is involved.

No intended changes to:

- Other renderers’ geometry or diagnostics.
- Legacy DOT/Mermaid/Graphviz artifacts.
- RendererScene or MeasuredScene geometry ownership.
- Compilation, projection, or validation behavior.

Existing Scenario SVG/positioned-scene snapshots may change after acceptance. Update only reviewed Scenario artifacts. Do not regenerate the entire rendered corpus.

## 5. Verification, documentation, and completion

Run commands from the repository root with `TMPDIR=/tmp`.

Start with the new label-capacity and Scenario label-layout suites, plus:

```bash
TMPDIR=/tmp pnpm exec vitest run \
  tests/connectorLabelPlacement.spec.ts \
  tests/uiContractsLabelRepair.spec.ts \
  tests/scenarioFlowOverlap.spec.ts \
  tests/routingOverlapRecovery.spec.ts \
  tests/routingHardeningScenario.spec.ts \
  tests/stagedScenarioFlow.spec.ts \
  tests/stagedOutcomeOpportunityMap.spec.ts \
  tests/stagedVisualAcceptance.spec.ts \
  --maxWorkers=2 --minWorkers=1
```

Then run the renderer compatibility suites and:

```bash
TMPDIR=/tmp pnpm test --maxWorkers=2 --minWorkers=1
git diff --check
```

Do not increase test timeouts to conceal repeated layout/routing work. Record aggregate search counters and expansion counts for the proof.

Update the routing decisions and implementation ledger with:

- The measured capacity and correction lifecycle.
- Shared budget ownership.
- The user-selected warning fallback.
- The distinction between fixed-geometry routing recovery and label-driven layout changes.
- Proof images, test evidence, changed snapshots, and any unresolved limitations.

Previously reported unrelated full-suite failures must be reproduced against the current baseline before calling them pre-existing. Preserve unrelated workspace edits.

**Completion requires:** all eight proof configurations have clear, collision-free label association without warnings; correction and degraded-output tests pass; routing contracts remain enforced; other renderers show no unintended changes; and the actual SVG/PNG output has been visually reviewed. Warning fallback is a supported failure mode, not acceptance for the proof case.
