# [Done:] View Implementation Execution Prompts

These prompts are designed to be copied into fresh Codex threads, one prompt per thread. They will create the capability to render all view types.

Usage:

1. Start with Prompt 1.
2. Do not start Prompt 2 until Prompt 1 is merged or otherwise available in the workspace.
3. Continue sequentially through Prompt 4.
4. Each prompt is self-contained on purpose, so the new thread should not need the planning thread.

Shared prompt shape:

- Goal
- Current Assumptions
- Canonical Sources
- Execution Instructions
- Required Deliverables
- Acceptance Criteria
- Non-Goals
- Verification

## [Done] Prompt 1

```text
Implement Plan 1: the shared foundation for multi-view projection and rendering work.

Goal

Refactor the current IA-only projector/renderer flow into an obvious multi-view-capable structure, add projection snapshot parity coverage for all manifest-declared projection snapshots, and document both contributor architecture and authoring-facing semantics for bundle view conventions.

Current Assumptions

- Deterministic ordering already exists for compiled graphs, projections, and renderer outputs.
- Source-order helpers for hierarchy-aware rendering already exist.
- SVG/PNG preview infrastructure already exists and should remain the preview path for DOT-backed views.
- Bundle-owned preview style defaults already exist in `bundle/v0.1/core/views.yaml`.
- This prompt is the first execution step, so do not assume any new multi-view foundation beyond the current repo state.

Canonical Sources

- `bundle/v0.1/core/views.yaml`
- `bundle/v0.1/manifest.yaml`
- `docs/toolchain/architecture.md`
- `docs/toolchain/development.md`

Execution Instructions

- Inspect the current implementation before editing, especially the IA-only flow in the projector, renderer, and CLI capability wiring.
- Refactor the internal structure so additional views can be added without growing one-off IA-only branching.
- Preserve the architecture boundary: bundle semantics belong in projection builders and render-model builders, not in DOT or Mermaid emitters.
- Do not add a public `sdd project` command in this rollout.
- Implement the scoped work end-to-end, including tests and documentation.
- Keep the current IA behavior working while you introduce the new structure.

Required Deliverables

- Code changes that make the projection/render pipeline obviously multi-view-capable
- Projection snapshot parity tests for all manifest-declared projection snapshots
- Any small shared test fixtures or helpers needed to support that coverage
- Contributor-facing documentation updates describing the new structure and extension pattern
- User-facing documentation updates explaining the meaning of `normative_defaults` and `renderer_defaults`
- A final thread summary with changed files, tests run, and residual risks

Acceptance Criteria

- Non-IA views have testable projection paths, even if they are not all renderable yet.
- Snapshot parity coverage exists for every projection snapshot declared in `bundle/v0.1/manifest.yaml`.
- Existing IA DOT, Mermaid, SVG, and PNG flows remain green with no regression.
- Contributor docs explain how future views should be added under the new structure.
- Authoring docs explain which bundle view conventions affect projection/rendering behavior.

Non-Goals

- Making every remaining view renderable in this prompt
- Adding new public CLI commands
- Reworking bundle semantics beyond what is needed to support the new structure

Verification

- Run targeted tests with `TMPDIR=/tmp`.
- At minimum, run the projection tests you add, the existing IA render tests, and relevant CLI/preview tests that protect current IA behavior.
- If you add or update snapshot-driven tests, verify they pass against the current manifest examples.
- In the final response, explicitly list every test command you ran and call out anything important you did not run.

Final Response Expectations

- Give a concise summary of what changed.
- Include clickable file references.
- List tests run and outcomes.
- Note blockers, assumptions, or residual risks.
- Do not hand off partial work without saying exactly what remains.
```

## [Done] Prompt 2

```text
Implement Plan 2: `journey_map` and `outcome_opportunity_map` end-to-end on top of the shared foundation from Plan 1.

Goal

Implement `journey_map` and `outcome_opportunity_map`, including projection support, render-model and DOT rendering support, CLI render/show capability for supported outputs, and authoring documentation for the modeling conventions these views depend on.

Current Assumptions

- Deterministic ordering already exists for compiled graphs, projections, and renderer outputs.
- Source-order helpers for hierarchy-aware rendering already exist.
- SVG/PNG preview infrastructure already exists and should remain the preview path for DOT-backed views.
- Bundle-owned preview style defaults already exist in `bundle/v0.1/core/views.yaml`.
- Plan 1 has already landed, so the projector/renderer structure is multi-view-capable and manifest projection snapshot parity coverage exists.

Canonical Sources

- `bundle/v0.1/core/views.yaml`
- `bundle/v0.1/manifest.yaml`
- `docs/toolchain/architecture.md`
- `docs/toolchain/development.md`

Execution Instructions

- Inspect the current implementation before editing, including the Plan 1 foundation work and the relevant bundle projection snapshots.
- Implement `journey_map` and `outcome_opportunity_map` using the existing bundle semantics rather than inventing new view rules in emitter code.
- Preserve the architecture boundary: bundle semantics belong in projection builders and render-model builders, not in DOT or Mermaid emitters.
- Treat DOT as the minimum rendering contract. Add Mermaid only if it stays readable and low-complexity for these views.
- Add CLI render/show support only for formats that are actually supported by the implementation.
- Do not add a public `sdd project` command in this rollout.
- Implement the scoped work end-to-end, including tests and documentation.

Required Deliverables

- Projection support for `journey_map` and `outcome_opportunity_map`
- Render-model and DOT rendering support for both views
- CLI render/show capability updates for supported outputs
- Tests, goldens, and snapshots as appropriate
- Contributor-facing documentation updates describing the implementation pattern used here
- User-facing documentation updates for `Stage -> CONTAINS -> Step`, `Step.props.opportunity_refs`, and `Metric -> INSTRUMENTED_AT -> target`
- A final thread summary with changed files, tests run, and residual risks

Acceptance Criteria

- Both views project correctly from the bundle examples.
- Both views render deterministically in DOT.
- `sdd show` works for the supported preview path for these views.
- Documentation explains the authoring conventions and renderer interpretation for these views.
- The implementation fits the shared multi-view structure introduced in Plan 1.

Non-Goals

- `service_blueprint`
- `scenario_flow`
- `ui_contracts`
- Over-engineering Mermaid support if it harms readability or adds disproportionate complexity

Verification

- Run targeted tests with `TMPDIR=/tmp`.
- Cover projection parity, DOT render output, CLI render/show flows, and any view-specific regression cases introduced by the new derivations.
- Verify the relevant bundle example paths for `journey_map` and `outcome_opportunity_map`.
- In the final response, explicitly list every test command you ran and call out anything important you did not run.

Final Response Expectations

- Give a concise summary of what changed.
- Include clickable file references.
- List tests run and outcomes.
- Note blockers, assumptions, or residual risks.
- Do not hand off partial work without saying exactly what remains.
```

## [Done] Prompt 3

```text
Implement Plan 3: `service_blueprint` and `scenario_flow` end-to-end on top of the shared foundation from Plans 1 and 2.

Goal

Implement `service_blueprint` and `scenario_flow`, including projection support, DOT rendering support, CLI render/show wiring for supported outputs, and documentation for both contributor-facing architecture rationale and user-facing authoring conventions.

Current Assumptions

- Deterministic ordering already exists for compiled graphs, projections, and renderer outputs.
- Source-order helpers for hierarchy-aware rendering already exist.
- SVG/PNG preview infrastructure already exists and should remain the preview path for DOT-backed views.
- Bundle-owned preview style defaults already exist in `bundle/v0.1/core/views.yaml`.
- Plan 1 has already landed, so the projector/renderer structure is multi-view-capable and manifest projection snapshot parity coverage exists.
- Plan 2 has already landed, so the current multi-view path already supports non-IA rendered views and corresponding CLI capability wiring.

Canonical Sources

- `bundle/v0.1/core/views.yaml`
- `bundle/v0.1/manifest.yaml`
- `docs/toolchain/architecture.md`
- `docs/toolchain/development.md`

Execution Instructions

- Inspect the current implementation before editing, especially the shared multi-view structure and the target projection snapshots for these two views.
- Implement `service_blueprint` lane derivation from the existing bundle defaults and process visibility data.
- Implement `scenario_flow` decision-node styling and branch-label derivation from existing graph metadata such as `kind`, `guard`, `event`, and target naming.
- Preserve the architecture boundary: lane and branch semantics belong in projection builders and render-model builders, not in DOT or Mermaid emitters.
- Treat DOT as the minimum rendering contract. Add Mermaid only if it stays readable and does not create avoidable complexity.
- Do not add a public `sdd project` command in this rollout.
- Implement the scoped work end-to-end, including tests and documentation.

Required Deliverables

- Projection support for `service_blueprint` and `scenario_flow`
- DOT rendering support for both views
- CLI render/show capability updates for supported outputs
- Tests, goldens, and snapshots as appropriate
- Contributor-facing documentation updates explaining why lane/branch semantics live above emitters
- User-facing documentation updates for `visibility`, decision steps, and branch label precedence
- A final thread summary with changed files, tests run, and residual risks

Acceptance Criteria

- Both views match projection intent from the bundle snapshots.
- DOT output for both views is deterministic and readable.
- CLI render/show support is wired for the supported outputs.
- Documentation explains both the authoring semantics and the implementation rationale.
- The implementation stays within the shared structure established by earlier plans.

Non-Goals

- `ui_contracts`
- Schema expansion unless it is strictly required by current bundle semantics
- Pushing view semantics down into emitter-only logic

Verification

- Run targeted tests with `TMPDIR=/tmp`.
- Cover projection parity, DOT goldens, CLI render/show flows, and focused regressions for lane assignment and branch-label precedence.
- Verify the relevant bundle example paths for `service_blueprint` and `scenario_flow`.
- In the final response, explicitly list every test command you ran and call out anything important you did not run.

Final Response Expectations

- Give a concise summary of what changed.
- Include clickable file references.
- List tests run and outcomes.
- Note blockers, assumptions, or residual risks.
- Do not hand off partial work without saying exactly what remains.
```

## [Done] Prompt 4

```text
Implement Plan 4: `ui_contracts` end-to-end on top of the shared foundation from Plans 1 through 3.

Goal

Implement `ui_contracts`, including projection semantics, DOT rendering and preview support, and documentation for both contributor-facing rationale and user-facing authoring guidance around `ViewState`, `State`, and `scope_id`.

Current Assumptions

- Deterministic ordering already exists for compiled graphs, projections, and renderer outputs.
- Source-order helpers for hierarchy-aware rendering already exist.
- SVG/PNG preview infrastructure already exists and should remain the preview path for DOT-backed views.
- Bundle-owned preview style defaults already exist in `bundle/v0.1/core/views.yaml`.
- Plans 1 through 3 have already landed, so the shared multi-view structure, snapshot parity coverage, and non-IA render/show path are already in place.

Canonical Sources

- `bundle/v0.1/core/views.yaml`
- `bundle/v0.1/manifest.yaml`
- `docs/toolchain/architecture.md`
- `docs/toolchain/development.md`

Execution Instructions

- Inspect the current implementation before editing, especially the shared multi-view structure and the target `ui_contracts` projection snapshots.
- Implement the `ui_contracts` projection semantics using the current bundle conventions, including primary `ViewState` transitions, grouped secondary `State` transitions, and fallback-to-secondary behavior when primary `ViewState` nodes are absent.
- Preserve the architecture boundary: transition-graph semantics belong in projection builders and render-model builders, not in DOT or Mermaid emitters.
- Treat DOT as the minimum rendering contract and support preview generation through the existing DOT-backed show pipeline.
- Do not add a public `sdd project` command in this rollout.
- Implement the scoped work end-to-end, including tests and documentation.

Required Deliverables

- Projection support for `ui_contracts`
- DOT rendering and preview support for `ui_contracts`
- CLI render/show capability updates for supported outputs
- Tests, goldens, and snapshots as appropriate
- Contributor-facing documentation updates explaining transition-graph priority and fallback rationale
- User-facing documentation updates for `ViewState`, `State`, and `scope_id`
- A final thread summary with changed files, tests run, and residual risks

Acceptance Criteria

- Both `place_viewstate_transition` and `ui_state_fallback` work correctly.
- Projection and rendering cover both primary and fallback cases.
- DOT output is deterministic and preview generation works through the supported path.
- Documentation makes the authoring contract and render behavior easy to understand.
- The implementation fits the shared structure established by earlier plans.

Non-Goals

- New validation policy unless existing bundle semantics clearly require it
- A generalized state-machine subsystem beyond what this view needs
- Re-architecting the already-working preview pipeline

Verification

- Run targeted tests with `TMPDIR=/tmp`.
- Cover projection parity, DOT goldens, CLI render/show flows, and focused regressions for grouping and fallback semantics.
- Verify both `place_viewstate_transition` and `ui_state_fallback`.
- In the final response, explicitly list every test command you ran and call out anything important you did not run.

Final Response Expectations

- Give a concise summary of what changed.
- Include clickable file references.
- List tests run and outcomes.
- Note blockers, assumptions, or residual risks.
- Do not hand off partial work without saying exactly what remains.
```
