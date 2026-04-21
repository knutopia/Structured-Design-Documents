# [Done] SDD Skill Authority Model Gated Implementation Plan

Status: proposed gated implementation plan for `docs/skill_ops_improvement_design_2nd_attempt.md`

Audience: maintainers and orchestration threads implementing the SDD skill authority model, helper documentation updates, regression tests, and future MCP alignment

Purpose: turn `docs/skill_ops_improvement_design_2nd_attempt.md` into sequential gates with explicit source authorities, write scopes, proof tasks, stop conditions, and orchestration handoff rules.

## 1. Summary

This plan implements the authority-selection architecture described in `docs/skill_ops_improvement_design_2nd_attempt.md`.

The implementation target is not a new helper command and not a prompt-specific modeling guide. The target is a reliable operating layer where:

- `sdd-skill` chooses the task branch and authority.
- helper discovery and helper contract detail govern helper mechanics.
- `bundle/v0.1/` governs SDD language semantics.
- shared `assessment` governs continuation, commit, and render gates.
- `sdd show` produces saved user-facing artifacts.
- helper `preview` remains a transient artifact path for tool or inline consumption.
- future MCP behavior preserves the same boundaries while using shared services directly.

This plan must be executed gate by gate. A later gate must not begin until the orchestration thread verifies the previous gate against its acceptance criteria and stop conditions.

## 2. Source Evidence

The implementation must use these sources by role:

| Role | Source |
| --- | --- |
| Design source for this plan | `docs/skill_ops_improvement_design_2nd_attempt.md` |
| Repository source-of-truth policy | `AGENTS.md` |
| Active bundle manifest | `bundle/v0.1/manifest.yaml` |
| Active syntax authority | `bundle/v0.1/core/syntax.yaml` |
| Active vocabulary authority | `bundle/v0.1/core/vocab.yaml` |
| Active endpoint-contract authority | `bundle/v0.1/core/contracts.yaml` |
| Active view authority | `bundle/v0.1/core/views.yaml` |
| Bundle loading path | `src/bundle/loadBundle.ts` |
| Parser syntax runtime entrypoint | `src/parser/syntaxRuntime.ts` and `src/parser/parseSource.ts` |
| Helper command discovery | `src/cli/helperDiscovery.ts` |
| Helper command wiring and request loading | `src/cli/helperProgram.ts` |
| Helper contract metadata | `src/authoring/contractMetadata.ts` |
| Helper bundle-resolved contract metadata | `src/authoring/contractResolution.ts` |
| Shared assessment implementation | `src/authoring/outcomeAssessment.ts` |
| Public authoring/helper contracts | `src/authoring/contracts.ts` |
| Helper README | `docs/readme_support_docs/sdd-helper/README.md` |
| Current repository skill | `skills/sdd-skill/SKILL.md` |
| Current workflow reference | `skills/sdd-skill/references/workflow.md` |
| Current helper gaps reference | `skills/sdd-skill/references/current-helper-gaps.md` |
| Change operation recipes | `skills/sdd-skill/references/change-set-recipes.md` |
| Skill source regression test | `tests/sddSkillSource.spec.ts` |
| Helper CLI regression test | `tests/helperCli.spec.ts` |
| Contract resolution test | `tests/authoringContractResolution.spec.ts` |
| Assessment classifier test | `tests/authoringOutcomeAssessment.spec.ts` |
| Parser syntax-runtime proof tests | `tests/parserSyntaxRuntime.spec.ts`, `tests/parserSyntaxAlignment.spec.ts` |
| Existing MCP contract-layer plan | `docs/future_explorations/mcp_server/sdd_machine_readable_contract_layer_implementation_plan.md` |
| Existing MCP server design | `docs/future_explorations/mcp_server/sdd_mcp_server_design.md` |

Verified helper facts from the current repo:

- `skills/sdd-skill/scripts/run_helper.sh capabilities` exposes `inspect`, `search`, `create`, `apply`, `author`, `undo`, `validate`, `project`, `preview`, `git-status`, `git-commit`, `contract`, and `capabilities`.
- The same capabilities payload identifies `apply`, `author`, and `undo` as request-body commands through `--request`.
- `contract helper.command.create` exposes `create_revision_is_bootstrap_continuation_surface` and `inspect_may_fail_on_empty_bootstrap`.
- `contract helper.command.preview --resolve bundle` resolves `view_id` from `bundle.views.views` and `profile_id` from `bundle.manifest.profiles`.
- `src/authoring/contractResolution.ts` currently resolves only `manifest_profiles` and `views_yaml`.
- `src/cli/helperProgram.ts` currently validates `validate_profile` with a fixed `simple | permissive | strict` list before the request reaches shared authoring code.

## 3. Non-Negotiable Invariants

These invariants come from `docs/skill_ops_improvement_design_2nd_attempt.md`, `AGENTS.md`, and the inspected implementation.

1. `bundle/v0.1/` is the machine-readable source of truth for SDD language semantics.
2. Skill prose must not duplicate bundle-owned vocabulary, endpoint policy, syntax, profile lists, or view definitions as normative truth.
3. Helper discovery and helper contract detail are the authority for helper mechanics, request shape, result shape, continuation semantics, and request transport.
4. Helper discovery is not sufficient authority for SDD authoring semantics.
5. Shared `assessment` is the authority for operational continuation, commit eligibility, render eligibility, stop decisions, and blocking diagnostics.
6. Result `status` is supporting detail only. It is not the acceptance gate.
7. Existing `.sdd` structural mutations go through helper-backed authoring flows when the helper supports the operation.
8. Existing-document handle-based edits require fresh inspect data or committed continuation handles for the returned revision.
9. Fresh document authoring continues from the `create` revision; immediate inspect is not the normal bootstrap step because an empty document can be parse-invalid.
10. Diagram or file-output requests require a saved artifact from `sdd show` unless the user explicitly asks only for structured data or text output.
11. Helper `preview` returns an ephemeral `artifact_path`; it is not the canonical saved artifact.
12. Examples, snapshots, and goldens are downstream evidence only.
13. MCP must be a sibling adapter over shared services. MCP must not shell out to `sdd-helper`.
14. Parser work must continue to flow through `loadBundle(...)` and `createParserSyntaxRuntime(bundle)`.
15. If a needed feature cannot be expressed through the bundle contract, the implementation must extend the bundle contract and generic runtime path before adding behavior around it.

## 4. Orchestration Thread Protocol

The orchestration thread owns sequencing, verification, and handoff. It may delegate implementation work to one sub-agent per gate, but it must not let two gates proceed concurrently.

### 4.1 Required Orchestrator Behavior

For each gate:

1. Re-read this plan section for the selected gate.
2. Re-inspect the source files listed in the gate before spawning the sub-agent.
3. Spawn exactly one sub-agent for the gate.
4. Give the sub-agent the gate goal, source evidence, write scope, forbidden scope, proof tasks, verification commands, and stop conditions.
5. Require the sub-agent to stop and report if a stop condition is hit.
6. Review the sub-agent's diff before running verification.
7. Run the gate's verification commands with `TMPDIR=/tmp`.
8. Check the gate acceptance criteria manually against the diff and command output.
9. Record satisfied invariants, violated invariants, tests run, and any skipped verification with the exact reason.
10. Spawn the next gate only after the current gate is accepted.

The orchestration thread must not accept a gate because tests passed if the cited invariants are still violated.

### 4.2 Sub-Agent Brief Template

Use this exact structure when spawning each gate sub-agent:

```text
You are implementing Gate <N>: <gate title> from docs/skill_ops_improvement_gated_implementation_plan.md.

Read first:
- <gate source files>

Write scope:
- <allowed files>

Forbidden scope:
- <files or behavior not allowed in this gate>

Required invariants:
- <gate-specific invariants>

Proof tasks:
- <gate proof tasks>

Verification commands:
- <commands>

Stop and report instead of coding through it if:
- <gate stop conditions>

Final response must include:
- files changed
- source evidence used
- tests run
- satisfied invariants
- violated invariants
- unresolved risks or blockers
```

### 4.3 Gate Handoff Checklist

The orchestration thread may hand off to the next gate only when all checklist items are true:

- The sub-agent stayed inside the gate write scope.
- The diff contains no unrelated refactor.
- The gate's required source files were read or re-read in the sub-agent thread.
- The gate proof tasks are implemented or explicitly proven unnecessary by direct source evidence.
- The verification commands passed, or any skipped command has a concrete environment reason.
- The acceptance criteria are satisfied by source, tests, and docs.
- No stop condition remains unresolved.
- The final gate note names satisfied and violated invariants.

If any checklist item fails, keep the same gate open and repair or report the blocker. Do not spawn the next gate.

## 5. Gate Sequence Overview

The implementation sequence is:

1. Gate 0: Baseline And Authority Inventory
2. Gate 1: Skill Top-Level Authority Model
3. Gate 2: Workflow Reference Authority Routing
4. Gate 3: Bundle-Authority Runtime Gap Closure
5. Gate 4: Helper Documentation Alignment
6. Gate 5: Skill Regression Tests And Drift Guards
7. Gate 6: MCP Alignment Notes
8. Gate 7: End-To-End Closeout

Gate 3 is included because the current code still has fixed `validate_profile` validation in `src/cli/helperProgram.ts`, while the design requires bundle-owned profile values to stay bundle-owned. The gate must either remove that drift or stop with a concrete design/blocker report.

## 6. Gate 0: Baseline And Authority Inventory

### Goal

Confirm the current repository state before changing files.

### Read Scope

- `docs/skill_ops_improvement_design_2nd_attempt.md`
- `AGENTS.md`
- `bundle/v0.1/manifest.yaml`
- `bundle/v0.1/core/syntax.yaml`
- `bundle/v0.1/core/vocab.yaml`
- `bundle/v0.1/core/contracts.yaml`
- `bundle/v0.1/core/views.yaml`
- `skills/sdd-skill/SKILL.md`
- `skills/sdd-skill/references/workflow.md`
- `docs/readme_support_docs/sdd-helper/README.md`
- `src/cli/helperDiscovery.ts`
- `src/cli/helperProgram.ts`
- `src/authoring/contractResolution.ts`
- `src/authoring/outcomeAssessment.ts`
- `tests/sddSkillSource.spec.ts`
- `tests/helperCli.spec.ts`
- `tests/authoringContractResolution.spec.ts`

### Write Scope

No file edits in this gate.

### Proof Tasks

1. Record the current helper command list from `skills/sdd-skill/scripts/run_helper.sh capabilities`.
2. Record whether `contract helper.command.create` exposes bootstrap continuation metadata.
3. Record whether `contract helper.command.preview --resolve bundle` resolves active views and profiles from the bundle.
4. Record all current skill text that conflicts with the new design's authority model.
5. Record all current implementation code that duplicates bundle-owned values outside generic bundle loading or contract resolution.

### Verification Commands

```bash
skills/sdd-skill/scripts/run_helper.sh capabilities
skills/sdd-skill/scripts/run_helper.sh contract helper.command.create
skills/sdd-skill/scripts/run_helper.sh contract helper.command.preview --resolve bundle
TMPDIR=/tmp pnpm exec vitest run tests/sddSkillSource.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/helperCli.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/authoringContractResolution.spec.ts
```

### Acceptance Criteria

- The baseline records the actual helper surface and does not rely on memory.
- Current conflicts are listed with file paths.
- No source files are changed.

### Stop Conditions

Stop if the helper commands listed by capabilities differ from `skills/sdd-skill/references/current-helper-gaps.md` or `docs/readme_support_docs/sdd-helper/README.md`. Resolve documentation or implementation authority before later gates.

## 7. Gate 1: Skill Top-Level Authority Model

### Goal

Update `skills/sdd-skill/SKILL.md` so the top-level skill is a concise branch selector and authority selector matching the design.

### Read Scope

- `docs/skill_ops_improvement_design_2nd_attempt.md`
- `skills/sdd-skill/SKILL.md`
- `skills/sdd-skill/references/workflow.md`
- `skills/sdd-skill/references/current-helper-gaps.md`
- `tests/sddSkillSource.spec.ts`

### Write Scope

- `skills/sdd-skill/SKILL.md`
- `tests/sddSkillSource.spec.ts` only for assertions that lock the new top-level skill behavior

### Required Changes

The top-level skill must explicitly state:

- helper `capabilities` answers which helper commands exist
- helper `contract <subject_id>` answers exact helper request and result shape, continuation semantics, and helper constraints
- `bundle/v0.1/manifest.yaml` plus the active core files answer SDD language semantics
- shared `assessment` answers whether to stop, commit, render, or continue
- docs explain surfaces and investigate mismatches
- implementation code is for implementation debugging, not normal helper request-shape recovery

Replace the current generic fallback wording with explicit authority routing:

- use helper discovery for helper mechanics
- use bundle files for SDD language
- use docs to explain a surface or investigate a mismatch
- use implementation code only for implementation debugging

The top-level skill must keep the current branch structure:

- create a new document
- edit an existing document
- read, validate, project, or render an existing document
- diagnose helper failure
- use helper git commands

The top-level skill must keep hard stops for request files, `--request -`, helper-backed `.sdd` mutations, inspect before handle-based edits, create revision continuation, dry-run before commit, persisted validation before render, shared assessment, and handle reuse.

### Forbidden Changes

- Do not add bundle-owned node types, relationship types, profile IDs, view IDs, endpoint pairs, syntax regexes, or examples as top-level normative skill rules.
- Do not add a promised helper command that is absent from capabilities.
- Do not make `SKILL.md` longer than the existing test limit unless the test limit is intentionally changed with a cited reason.

### Proof Tasks

1. `SKILL.md` names helper discovery as helper-command authority.
2. `SKILL.md` names bundle files as SDD-language authority.
3. `SKILL.md` removes the generic `capabilities -> contract -> code/docs only if still insufficient` fallback as a universal rule.
4. `SKILL.md` preserves request-file, assessment, create-continuation, inspect, dry-run, and render hard stops.
5. `tests/sddSkillSource.spec.ts` asserts the new authority boundaries and rejects the old generic fallback wording.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/sddSkillSource.spec.ts
```

### Acceptance Criteria

- The top-level skill is shorter than the workflow reference and keeps only branch selection, authority selection, and hard stops.
- The skill does not claim examples, snapshots, tests, or TypeScript literals are SDD language authority.
- The test protects against returning to the old generic fallback wording.

### Stop Conditions

Stop if updating the top-level skill requires duplicating bundle-owned language facts in prose. Move that detail to Gate 2 as targeted bundle-reading procedure or Gate 3 as bundle-backed runtime support.

## 8. Gate 2: Workflow Reference Authority Routing

### Goal

Update `skills/sdd-skill/references/workflow.md` so detailed procedure follows the new authority matrix and targeted bundle-reading protocol.

### Read Scope

- `docs/skill_ops_improvement_design_2nd_attempt.md`
- `skills/sdd-skill/references/workflow.md`
- `skills/sdd-skill/references/change-set-recipes.md`
- `skills/sdd-skill/references/current-helper-gaps.md`
- `bundle/v0.1/manifest.yaml`
- `bundle/v0.1/core/syntax.yaml`
- `bundle/v0.1/core/vocab.yaml`
- `bundle/v0.1/core/contracts.yaml`
- `bundle/v0.1/core/views.yaml`
- `tests/sddSkillSource.spec.ts`

### Write Scope

- `skills/sdd-skill/references/workflow.md`
- `skills/sdd-skill/references/change-set-recipes.md` only if it currently implies recipes are language authority
- `tests/sddSkillSource.spec.ts`

### Required Changes

The workflow reference must contain a targeted bundle-reading section:

- read `manifest.yaml` first for fresh authoring or when active core files need confirmation
- read `core/syntax.yaml` for node IDs, node headers, edge lines, property lines, nesting, and source syntax
- read `core/vocab.yaml` for node and relationship token selection
- read `core/contracts.yaml` for relationship endpoint validity
- read `core/views.yaml` for projection scope, hierarchy edges, ordering edges, view-specific annotations, and rendered-view behavior
- read profile files only when profile behavior is needed beyond profile IDs exposed by helper contract resolution

The workflow reference must explicitly separate:

- helper request-shape authority from SDD language authority
- source nesting from graph semantics
- projection checks from graph authoring targets
- saved artifacts from transient helper artifacts
- examples/snapshots from normative sources

The workflow reference must preserve:

- request-file default for JSON request bodies
- dry-run before commit
- assessment gates
- `sdd show` for saved artifacts
- helper `preview` only for transient artifact access or inline display
- helper-failure layer diagnosis through `assessment.layer`, `assessment.next_action`, and diagnostics

### Forbidden Changes

- Do not add full bundle token lists as normative workflow prose.
- Do not tell agents to inspect `.sdd` examples to infer language rules.
- Do not remove current helper limitations from `current-helper-gaps.md`.

### Proof Tasks

1. The workflow reference contains targeted bundle-reading guidance for syntax, vocabulary, contracts, views, and profiles.
2. The workflow reference states that prompt words are input language and bundle vocabulary/contracts decide SDD language.
3. The workflow reference states that nesting alone does not establish graph semantics.
4. The workflow reference states that examples and snapshots are downstream evidence only.
5. The workflow reference preserves saved-artifact and transient-preview branches.
6. `tests/sddSkillSource.spec.ts` asserts these policy points without locking full paragraphs unnecessarily.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/sddSkillSource.spec.ts
```

### Acceptance Criteria

- The workflow gives concrete routing instructions for each authority.
- The workflow does not promote prompt-specific modeling rules to general guidance.
- The workflow remains task-kind-first rather than forcing every task through broad reading, search, inspect, validation, projection, and preview.

### Stop Conditions

Stop if the workflow needs a bundle-owned semantic rule that cannot be represented in current bundle files. Document the missing bundle expression and route the work to Gate 3 or a bundle-contract extension before continuing.

## 9. Gate 3: Bundle-Authority Runtime Gap Closure

### Goal

Close confirmed runtime drift where helper adapter validation or contract metadata duplicates bundle-owned values outside generic bundle-backed machinery.

### Read Scope

- `docs/skill_ops_improvement_design_2nd_attempt.md`
- `AGENTS.md`
- `bundle/v0.1/manifest.yaml`
- `src/cli/helperProgram.ts`
- `src/authoring/contractMetadata.ts`
- `src/authoring/contractResolution.ts`
- `src/authoring/contracts.ts`
- `tests/helperCli.spec.ts`
- `tests/authoringContractResolution.spec.ts`

### Write Scope

- `src/cli/helperProgram.ts`
- `src/authoring/contractMetadata.ts`
- `src/authoring/contractResolution.ts`
- `src/authoring/contracts.ts`
- `tests/helperCli.spec.ts`
- `tests/authoringContractResolution.spec.ts`

### Confirmed Drift To Address

`src/cli/helperProgram.ts` currently validates `validate_profile` with the fixed values `simple`, `permissive`, and `strict`. The active profile list is bundle-owned through `bundle/v0.1/manifest.yaml`, and `src/authoring/contractResolution.ts` already resolves profile IDs from `bundle.manifest.profiles` for helper contract detail.

### Required Changes

The implementation must remove or isolate fixed profile validation so helper request acceptance depends on the loaded bundle rather than a hardcoded adapter enum.

Allowed implementation paths:

- validate `validate_profile` against `bundle.manifest.profiles` after bundle load in helper request handling, or
- move profile validation into a shared bundle-backed request validation helper consumed by helper and future MCP paths.

If the implementation discovers other fixed bundle-owned profile/view value checks in helper request handling, include them in this gate only when they are the same class of drift and can be covered by the same tests.

### Forbidden Changes

- Do not move bundle-owned profile values into static contract metadata.
- Do not widen profile fields to unchecked strings without adding a bundle-backed validation path.
- Do not change `ProfileId` type aliases without a direct source-backed reason and tests that prove the public contract still works.
- Do not modify parser, compiler, validator, projector, or renderer behavior unrelated to this runtime drift.

### Proof Tasks

1. A helper `author` or `apply` request with `validate_profile` is checked against active `bundle.manifest.profiles`, not a fixed local list.
2. Existing `simple`, `permissive`, and `strict` cases still pass because those are the active bundle profiles.
3. An unsupported profile still returns `sdd-helper-error` with `invalid_args` or an equivalent request-shape assessment, not a downstream runtime crash.
4. `contract --resolve bundle` behavior remains unchanged and still resolves profile IDs from the active bundle.
5. Static capabilities remain static and do not load the bundle.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/helperCli.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/authoringContractResolution.spec.ts
```

### Acceptance Criteria

- Changing the active bundle profile list would change helper request validation behavior through the generic bundle-backed path.
- Static helper discovery does not inline active profile values.
- Bundle-resolved contract detail remains the explicit way to expand profile and view values for clients.

### Stop Conditions

Stop if request-shape validation cannot become bundle-backed without a larger shared request-validation design. Report the exact blocker and do not hide the fixed profile list behind skill prose or tests.

## 10. Gate 4: Helper Documentation Alignment

### Goal

Align helper documentation with the authority model and any Gate 3 runtime changes.

### Read Scope

- `docs/skill_ops_improvement_design_2nd_attempt.md`
- `docs/readme_support_docs/sdd-helper/README.md`
- `src/cli/helperDiscovery.ts`
- `src/cli/helperProgram.ts`
- `src/authoring/contracts.ts`
- `src/authoring/outcomeAssessment.ts`
- `src/authoring/contractResolution.ts`
- `tests/helperCli.spec.ts`

### Write Scope

- `docs/readme_support_docs/sdd-helper/README.md`
- `tests/sddSkillSource.spec.ts` only if helper documentation assertions belong there

### Required Changes

The helper README must state:

- `capabilities` is helper command discovery and remains static
- `contract` is deep helper contract detail
- `contract --resolve bundle` expands active bundle-owned `view_id` and `profile_id` values
- helper mechanics are not SDD language authority
- request files are the safest default for `--request`
- domain rejections, helper errors, diagnostics, persisted validation, projection, and render failures are distinct layers
- `assessment` fields drive workflow decisions
- `preview` artifact paths are transient and not saved artifacts
- `sdd show` is the saved-artifact path when a durable user-facing artifact is needed

The README must replace the old generic fallback wording with the same authority routing used by the skill:

- helper discovery for helper mechanics
- bundle files for SDD language
- docs for explanation or mismatch investigation
- implementation code for implementation debugging

### Forbidden Changes

- Do not make the helper README a second bundle spec.
- Do not document helper commands that capabilities does not expose.
- Do not document future MCP behavior as implemented helper behavior.

### Proof Tasks

1. Helper README authority language matches `SKILL.md` and `workflow.md`.
2. Helper README no longer says code/docs are the generic fallback for all unresolved knowledge.
3. Helper README preserves the JSON-first helper contract and outcome-assessment guidance.
4. Helper README remains aligned with `src/cli/helperDiscovery.ts` command names.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/helperCli.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/sddSkillSource.spec.ts
```

### Acceptance Criteria

- Helper docs explain the implemented helper surface without redefining bundle language.
- Helper docs and skill docs use the same authority hierarchy.
- Helper docs distinguish saved artifacts from transient helper preview paths.

### Stop Conditions

Stop if helper docs would need to describe behavior that is not present in `src/cli/helperDiscovery.ts`, `src/cli/helperProgram.ts`, or current helper command output.

## 11. Gate 5: Skill Regression Tests And Drift Guards

### Goal

Harden regression tests so the skill cannot drift back into prompt-specific rules, bundle duplication, status-only acceptance, or examples-as-authority.

### Read Scope

- `docs/skill_ops_improvement_design_2nd_attempt.md`
- `skills/sdd-skill/SKILL.md`
- `skills/sdd-skill/references/workflow.md`
- `skills/sdd-skill/references/change-set-recipes.md`
- `skills/sdd-skill/references/current-helper-gaps.md`
- `tests/sddSkillSource.spec.ts`

### Write Scope

- `tests/sddSkillSource.spec.ts`
- Skill docs only for small fixes required by the new tests

### Required Test Coverage

Add or update assertions that prove:

- top-level skill names helper discovery as helper-command authority
- top-level skill names bundle files as SDD-language authority
- workflow reference describes targeted bundle reads for authoring
- workflow reference preserves request-file defaults
- workflow reference preserves assessment gates
- workflow reference requires `sdd show` for saved diagram artifacts
- no prompt-specific domain phrase is promoted to a general modeling rule
- no skill text claims examples or snapshots are language authority
- skill text does not include fixed bundle-owned view IDs, profile IDs, relationship endpoint pairs, or syntax regexes as normative rules
- old generic fallback wording does not return

The tests must protect against both failures named by the design:

- too ceremonial: every task forces broad reading, search, inspect, validation, projection, and preview
- too thin: fresh authoring proceeds from helper request shape alone without reading bundle language facts

### Forbidden Changes

- Do not lock entire long paragraphs when narrower assertions can protect the invariant.
- Do not add tests that require bundle-owned token lists to appear in skill prose.
- Do not loosen existing hard-stop assertions without replacing them with equivalent coverage.

### Proof Tasks

1. `tests/sddSkillSource.spec.ts` fails if the top-level skill drops bundle authority.
2. `tests/sddSkillSource.spec.ts` fails if workflow targeted bundle-reading guidance is removed.
3. `tests/sddSkillSource.spec.ts` fails if the old generic fallback wording returns.
4. `tests/sddSkillSource.spec.ts` fails if saved-artifact guidance no longer requires `sdd show`.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/sddSkillSource.spec.ts
```

### Acceptance Criteria

- Drift tests encode design invariants without making skill prose brittle.
- The tests reject bundle-authority failures and status-only acceptance.
- The tests do not require broad ceremonial steps for simple read or render tasks.

### Stop Conditions

Stop if the tests can only pass by reintroducing bundle-owned rules into skill prose. Fix the docs structure instead.

## 12. Gate 6: MCP Alignment Notes

### Goal

Update MCP design notes only where the implemented helper/skill authority model changes shared contract wording or future MCP guidance.

### Read Scope

- `docs/skill_ops_improvement_design_2nd_attempt.md`
- `docs/future_explorations/mcp_server/sdd_mcp_server_design.md`
- `docs/future_explorations/mcp_server/sdd_machine_readable_contract_layer_design.md`
- `docs/future_explorations/mcp_server/sdd_machine_readable_contract_layer_implementation_plan.md`
- `src/authoring/contracts.ts`
- `src/authoring/outcomeAssessment.ts`
- `src/authoring/contractMetadata.ts`

### Write Scope

- `docs/future_explorations/mcp_server/sdd_mcp_server_design.md`
- `docs/future_explorations/mcp_server/sdd_machine_readable_contract_layer_design.md` only if it contradicts the implemented authority model
- `docs/future_explorations/mcp_server/sdd_machine_readable_contract_layer_implementation_plan.md` only for status or follow-on note corrections

### Required Changes

The MCP notes must preserve:

- MCP is a sibling adapter over shared SDD services
- MCP must not shell out to `sdd-helper`
- helper and MCP share domain behavior, assessment semantics, diagnostics, validation, projection, preview generation paths, and contract metadata where applicable
- helper-specific stdin/stdout/exit-code behavior remains helper-specific
- future MCP contract metadata should mirror the shared contract layer rather than invent a second discovery model
- bundle-owned language values remain bundle-owned for MCP as well

### Forbidden Changes

- Do not implement the MCP server in this gate.
- Do not mark deferred MCP consumption as complete unless code exists.
- Do not add MCP behavior claims that are absent from current shared services or existing design docs.

### Proof Tasks

1. MCP docs state that future MCP must preserve the authority model.
2. MCP docs state that future MCP calls shared services directly.
3. MCP docs do not require MCP to share helper-specific failure envelopes for stdin, stdout, or process exits.
4. MCP docs keep `artifact_path` or future resource behavior distinct from saved `sdd show` artifacts.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/helperCli.spec.ts tests/authoringOutcomeAssessment.spec.ts
```

### Acceptance Criteria

- MCP documentation is aligned with the authority model but does not pretend MCP is implemented.
- Helper and MCP boundaries remain clear.

### Stop Conditions

Stop if MCP wording requires a design decision that is not already present in the MCP design documents or shared code. Record the unresolved decision rather than filling it with speculative text.

## 13. Gate 7: End-To-End Closeout

### Goal

Verify the full implementation across docs, helper contracts, bundle runtime, and tests.

### Read Scope

- All files changed in Gates 1 through 6
- `docs/skill_ops_improvement_design_2nd_attempt.md`
- `AGENTS.md`
- `bundle/v0.1/manifest.yaml`
- `src/cli/helperDiscovery.ts`
- `src/cli/helperProgram.ts`
- `src/authoring/contractResolution.ts`
- `src/authoring/outcomeAssessment.ts`
- `tests/sddSkillSource.spec.ts`
- `tests/helperCli.spec.ts`
- `tests/authoringContractResolution.spec.ts`
- `tests/authoringOutcomeAssessment.spec.ts`

### Write Scope

- Only small documentation or test fixes found by closeout verification

### Proof Tasks

1. A reader can identify the bundle files that encode SDD language behavior.
2. A reader can identify the runtime path that consumes bundle syntax through `loadBundle(...)` and `createParserSyntaxRuntime(bundle)`.
3. A reader can identify the helper command paths for mechanics and contract detail.
4. A reader can identify the shared assessment path for continuation decisions.
5. A reader can identify which tests protect skill docs from drift.
6. The implementation does not update snapshots, goldens, or examples to normalize failures.

### Verification Commands

```bash
TMPDIR=/tmp pnpm exec vitest run tests/sddSkillSource.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/helperCli.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/authoringContractResolution.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/authoringOutcomeAssessment.spec.ts
TMPDIR=/tmp pnpm exec vitest run tests/parserSyntaxRuntime.spec.ts tests/parserSyntaxAlignment.spec.ts
TMPDIR=/tmp pnpm test
```

### Acceptance Criteria

- All targeted tests pass.
- The full test suite passes, or any failure is unrelated and documented with exact failing test names and output summary.
- Skill docs, helper docs, and MCP notes agree on the authority model.
- No new prompt-specific modeling rule appears in skill guidance.
- No bundle-owned language list is duplicated in skill prose as normative truth.
- No helper command is promised unless capabilities exposes it.
- No unresolved stop condition remains from earlier gates.

### Stop Conditions

Stop if full closeout finds an authority mismatch. Do not update snapshots or docs to hide it. Return to the earliest gate that owns the mismatch.

## 14. Final Closeout Report Format

The final orchestration thread response after Gate 7 must include:

- gates completed
- files changed
- commands run
- satisfied invariants
- violated invariants, if any
- skipped verification, if any, with exact reason
- whether the implementation is acceptable

Use this acceptance statement only when every invariant is satisfied:

```text
The implementation is acceptable: helper mechanics, bundle language authority, shared assessment gates, saved artifact handling, transient preview handling, and future MCP boundaries are all represented in source docs/tests and verified by the listed commands.
```

If any invariant fails, use this statement:

```text
The implementation is incomplete: <specific invariant> is not satisfied by the current source and tests.
```
