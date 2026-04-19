# SDD Skill Operational Reliability Implementation Plan

Status: proposed gated implementation plan

Audience: maintainers implementing shared outcome assessment, helper exposure, skill restructuring, and future MCP-aligned reliability behavior

Purpose: implement `docs/sdd_skill_operational_reliability_design.md` through small gates with proof tasks and stop conditions.

This is an implementation plan for `docs/sdd_skill_operational_reliability_design.md`. It is not a replacement for the existing MCP/helper design, helper documentation, skill documentation, machine-readable contract design, or runtime contracts. Each gate should update those documents only after the corresponding behavior exists in code and tests.

## 1. Summary

This plan adds shared outcome assessment to the existing helper-first SDD architecture and then updates `sdd-helper`, the machine-readable contract layer, documentation, and `sdd-skill` to consume that assessment.

The current implementation shape is the starting point:

- `sdd-helper` is implemented in `src/cli/helperProgram.ts`.
- shared public contracts live in `src/authoring/contracts.ts`.
- machine-readable contract metadata lives in `src/authoring/contractMetadata.ts`.
- mutation and authoring behavior runs through `src/authoring/mutations.ts` and `src/authoring/authoringIntents.ts`.
- preview failures flow through `src/authoring/preview.ts`.
- skill source and skill-source tests live under `skills/sdd-skill/` and `tests/sddSkillSource.spec.ts`.

The goal is not to replace `src/authoring/*`, merge `sdd-helper` into `sdd`, make MCP shell out to `sdd-helper`, or make `sdd-skill` the authority for result interpretation. The goal is to make result interpretation shared, explicit, testable, and available to both helper and future MCP consumers.

## 2. How To Use This Plan

This document is intended to drive multiple sequential implementation threads.

Rules for use:

1. Complete one gate at a time.
2. At the start of each gate, restate the selected gate and re-inspect the current repository state.
3. Use `TMPDIR=/tmp` for Node-based test and helper commands.
4. Treat each gate as proof-case work. Do not broaden the gate because adjacent work is convenient.
5. If a gate exposes a design gap, stop and update `docs/sdd_skill_operational_reliability_design.md` before implementation continues.
6. Update docs only after the behavior described by those docs is implemented and verified.

## 3. Gate 0: Baseline And Invariants

### Goal

Confirm the current repository still matches the design document before changing code.

### In Scope

- re-read `docs/sdd_skill_operational_reliability_design.md`
- inspect current `src/authoring/contracts.ts`
- inspect current `src/authoring/contractMetadata.ts`
- inspect current `src/cli/helperProgram.ts`
- inspect current `src/authoring/mutations.ts`
- inspect current `src/authoring/authoringIntents.ts`
- inspect current `src/authoring/preview.ts`
- run the targeted current tests before implementation:
  - `TMPDIR=/tmp pnpm test -- tests/helperCli.spec.ts`
  - `TMPDIR=/tmp pnpm test -- tests/authoringContractMetadata.spec.ts`
  - `TMPDIR=/tmp pnpm test -- tests/sddSkillSource.spec.ts`

### Required Note

Confirm whether the targeted test command syntax works in the current repo. If it does not, use the repo-supported Vitest invocation and record the exact command in the gate notes before proceeding.

### Acceptance Criteria

- the as-is architecture still matches the design document
- the targeted baseline tests are run or a repo-supported equivalent is recorded
- no code changes are made in this gate

### Stop Conditions

Stop this gate if:

- the current code no longer matches the as-is architecture in the design doc
- targeted tests cannot be run and no repo-supported equivalent is identified
- implementing later gates would require replacing the helper-first architecture described in the design

## 4. Gate 1: Shared Assessment Model And Pure Classifier

### Goal

Add the shared assessment model and pure classification logic without changing helper output behavior.

### Landing Zones

- `src/authoring/contracts.ts`
- a new shared assessment module under `src/authoring/`
- new assessment unit tests under `tests/`

### In Scope

Add this public shape to `src/authoring/contracts.ts`:

```ts
export interface AuthoringOutcomeAssessment {
  kind: "sdd-authoring-outcome-assessment";
  outcome: "acceptable" | "blocked" | "review_required";
  layer:
    | "transport"
    | "request_shape"
    | "domain_rejection"
    | "candidate_diagnostics"
    | "persisted_validation"
    | "projection"
    | "render"
    | "success";
  can_commit: boolean;
  can_render: boolean;
  should_stop: boolean;
  next_action: string;
  blocking_diagnostics: Diagnostic[];
  summary: string;
}
```

Implement pure shared classifier functions for current result envelopes:

- helper errors
- `ChangeSetResult`
- `ApplyAuthoringIntentResult`
- `CreateDocumentResult`
- `ValidationResource`
- `ProjectionResource`
- `RenderPreviewResult`

### Locked Classification Rules

- empty stdin to `--request -`: `outcome: "blocked"`, `layer: "transport"`, `can_commit: false`, `can_render: false`, `should_stop: true`
- invalid JSON or invalid request body from a non-empty source: `layer: "request_shape"`
- `ChangeSetResult.status === "rejected"`: `layer: "domain_rejection"`
- any error diagnostic on an applied dry run: `layer: "candidate_diagnostics"`, `can_commit: false`
- warnings or info diagnostics without errors: `outcome: "review_required"` and the next step remains allowed when no blocking diagnostic exists
- clean applied dry run: `outcome: "acceptable"`, `layer: "success"`, `can_commit: true`, `can_render: false`
- clean committed mutation: `outcome: "acceptable"`, `layer: "success"`, `can_commit: false`
- successful preview: `outcome: "acceptable"`, `layer: "success"`, `can_render: true`
- preview helper errors with diagnostics classify by diagnostic stage: validation diagnostics use `persisted_validation`, projection diagnostics use `projection`, render diagnostics use `render`
- successful `create` with only the known empty-bootstrap parse diagnostic is `outcome: "review_required"`, `layer: "success"`, `should_stop: false`, `can_render: false`, with `next_action` directing the caller to author initial content from the returned revision

### Tests

Add tests that cover:

- every acceptance scenario from the design doc
- create bootstrap as a special case
- warning-only diagnostics separately from error diagnostics
- projection-result diagnostics nested under a change set

### Acceptance Criteria

- classification behavior is implemented in shared code, not helper-only code or skill prose
- tests prove the classifier works without invoking the helper CLI
- helper output behavior is unchanged in this gate

### Stop Conditions

Stop this gate if:

- the classifier needs bundle-owned language rules to decide basic operational outcome
- the classifier cannot classify existing public result envelopes without changing those envelopes
- the implementation starts adding helper-specific transport behavior to the shared classifier

## 5. Gate 2: Helper Exposure

### Goal

Expose shared assessment through `sdd-helper` without removing or renaming existing fields.

### Landing Zones

- `src/authoring/contracts.ts`
- `src/cli/helperProgram.ts`
- `tests/helperCli.spec.ts`

### In Scope

- add optional `assessment?: AuthoringOutcomeAssessment` to relevant result types in `src/authoring/contracts.ts`
- attach assessment to helper responses for `create`, `apply`, `author`, `undo`, `validate`, `project`, and `preview`
- attach assessment to `sdd-helper-error` payloads
- preserve helper errors as non-zero exits
- preserve structured domain rejections as zero-exit JSON results
- preserve current `kind` values and all existing fields

### Required Helper Handling

- `parseJsonRequest` or its caller must retain enough context to classify empty stdin separately from malformed non-empty JSON.
- The `AuthoringMutationError` catch path must write the rejected change set with assessment attached.
- The `AuthoringPreviewError` path must preserve diagnostics and attach assessment based on diagnostic stage.

### Tests

Update `tests/helperCli.spec.ts` to assert assessment on:

- empty author stdin
- malformed JSON
- malformed request shape
- structured domain rejection
- applied dry run with diagnostics
- clean applied dry run
- preview failure with diagnostics
- existing helper payload fields remaining present

### Acceptance Criteria

- helper responses include assessment where specified
- existing helper result shapes remain backward-compatible
- existing helper exit-code behavior is unchanged
- helper tests prove transport, request-shape, domain-rejection, candidate-diagnostic, preview-failure, and success classifications

### Stop Conditions

Stop this gate if:

- adding assessment requires changing existing helper `kind` values
- adding assessment requires changing existing helper exit-code behavior
- adding assessment requires removing or renaming existing result fields

## 6. Gate 3: Contract Metadata

### Goal

Expose the assessment shape through the shared machine-readable contract layer.

### Landing Zones

- `src/authoring/contractMetadata.ts`
- `tests/authoringContractMetadata.spec.ts`
- helper CLI contract tests in `tests/helperCli.spec.ts`

### In Scope

- add `shared.shape.authoring_outcome_assessment`
- add `assessment` as an optional property to relevant result schemas
- add `assessment` as an optional property to the `HelperErrorResult` schema
- keep existing required fields unchanged
- add continuation or constraint metadata only where it directly describes implemented assessment behavior
- keep `sdd-helper capabilities` lightweight and static
- ensure `sdd-helper contract helper.command.author` exposes the optional assessment schema through deep introspection
- ensure `sdd-helper contract helper.command.apply` exposes the optional assessment schema through deep introspection
- ensure `sdd-helper contract helper.command.preview --resolve bundle` still resolves bundle-owned values as before

### Tests

Update tests to prove:

- contract metadata includes the assessment shape
- the assessment shape includes all required assessment fields
- affected helper result schemas include optional `assessment`
- `capabilities` does not inline the full assessment schema

### Acceptance Criteria

- assessment semantics are represented in the shared contract layer
- deep introspection exposes the new shape
- lightweight discovery stays compact
- existing bundle-resolved contract behavior still works

### Stop Conditions

Stop this gate if:

- contract metadata starts duplicating bundle-owned language semantics
- lightweight discovery begins inlining full nested assessment schemas
- assessment metadata cannot be represented without changing existing required result fields

## 7. Gate 4: Documentation Sync

### Goal

Update documentation after the shared assessment model, helper exposure, and contract metadata are implemented and tested.

### Landing Zones

- `docs/sdd_skill_operational_reliability_design.md`
- `docs/readme_support_docs/sdd-helper/README.md`
- `docs/future_explorations/mcp_server/sdd_mcp_server_design.md`
- `docs/future_explorations/mcp_server/sdd_machine_readable_contract_layer_design.md`

### In Scope

- mark assessment behavior as implemented where appropriate
- document optional `assessment` on helper result payloads
- explain that helper and future MCP share assessment semantics from shared code
- keep MCP as a sibling adapter and explicitly reject shelling out to `sdd-helper`
- keep `sdd-helper` separate from the human-facing `sdd` CLI
- keep request-file guidance intact

### Verification

Run docs-related source tests that assert skill/helper guidance.

Run targeted checks for forbidden architecture drift:

- no documentation says MCP shells out to `sdd-helper`
- no documentation says `sdd-helper` replaces `sdd`
- no documentation makes `sdd-skill` the authority for result interpretation

### Acceptance Criteria

- docs describe implemented behavior only
- docs preserve the helper/MCP sibling-adapter architecture
- docs preserve the `sdd-helper` versus `sdd` separation
- docs keep request-file guidance aligned with the helper contract and skill guidance

### Stop Conditions

Stop this gate if:

- docs need to claim behavior that has not landed in code
- docs drift into making the skill the semantic authority
- docs imply MCP should shell out to `sdd-helper`

## 8. Gate 5: Skill Restructuring

### Goal

Make `sdd-skill` thinner and assessment-aware.

### Landing Zones

- `skills/sdd-skill/SKILL.md`
- `skills/sdd-skill/references/workflow.md`
- `tests/sddSkillSource.spec.ts`

### In Scope

Restructure top-level `SKILL.md` as a branch selector for:

- create new document
- edit existing document
- read, validate, project, or render existing document
- diagnose helper failure
- use helper git commands

Keep these top-level hard stops:

- request files by default
- `--request -` only with same-command piping
- no raw `.sdd` structural edits
- inspect before handle-based edits
- use create-returned revision for bootstrap follow-on
- dry-run before commit
- no render before clean committed validation
- defer acceptance judgment to shared assessment

Move longer procedural details into references. Remove skill-owned language semantics that should come from bundle-backed helper contract introspection.

### Tests

Update `tests/sddSkillSource.spec.ts` to assert:

- `SKILL.md` mentions assessment-based acceptance
- request-file guidance remains
- branch selector language exists
- references still exist and are linked
- no stale instruction tells the agent to infer acceptance from `status` alone

### Acceptance Criteria

- top-level skill guidance is shorter and branch-oriented
- skill hard stops remain visible
- detailed procedure lives in references
- acceptance judgment defers to shared assessment
- skill guidance does not duplicate bundle-owned vocabulary or endpoint rules

### Stop Conditions

Stop this gate if:

- the skill becomes longer or more semantically duplicative instead of thinner
- the skill claims assessment behavior before helper and contract surfaces expose it
- the skill tells agents to infer acceptance from `status` alone

## 9. Gate 6: End-To-End Acceptance Proof

### Goal

Run focused proof scenarios after all implementation gates.

### Required Scenarios

- empty stdin to `author --request -` returns `sdd-helper-error` with assessment layer `transport`
- malformed JSON returns assessment layer `request_shape`
- malformed request shape returns assessment layer `request_shape`
- structured rejected change set returns assessment layer `domain_rejection`
- applied dry run with parse, validation, or projection error diagnostics is not commit-eligible
- clean author or apply dry run is commit-eligible
- committed change plus clean validation supports render follow-on
- preview failure caused by invalid document state classifies by returned diagnostics
- successful preview is acceptable and render-positive
- create bootstrap result directs follow-on authoring rather than immediate inspect or render

### Verification Commands

Run:

```bash
TMPDIR=/tmp pnpm test
TMPDIR=/tmp pnpm sdd-helper capabilities
TMPDIR=/tmp pnpm sdd-helper contract helper.command.author
TMPDIR=/tmp pnpm sdd-helper contract helper.command.preview --resolve bundle
```

### Closeout

- update this implementation plan's gate statuses only after code and docs pass
- do not regenerate unrelated goldens or rendered artifacts
- report remaining gaps as incomplete rather than normalizing them through docs

### Acceptance Criteria

- all required scenarios are verified
- full test suite passes
- helper discovery and deep introspection still work
- docs and skill guidance match implemented behavior

### Stop Conditions

Stop closeout if:

- any required scenario fails
- helper discovery or contract introspection regresses
- docs describe behavior not present in code

## 10. Assumptions And Defaults

- This implementation plan lives at `docs/sdd_skill_operational_reliability_implementation_plan.md`.
- Assessment exposure uses an optional `assessment` field on relevant existing result payloads because that is additive and preserves helper result shapes.
- The first implementation milestone remains helper-first.
- Live MCP implementation remains deferred.
- Shared assessment code and contract metadata must be MCP-ready.
- No raw text editing surfaces are introduced.
- No new public mutation model is introduced.
- `src/authoring/*` remains the shared authoring/domain substrate.

## 11. References

- `docs/sdd_skill_operational_reliability_design.md`
- `docs/future_explorations/mcp_server/sdd_mcp_server_design.md`
- `docs/future_explorations/mcp_server/sdd_machine_readable_contract_layer_design.md`
- `docs/readme_support_docs/sdd-helper/README.md`
- `skills/sdd-skill/SKILL.md`
- `skills/sdd-skill/references/workflow.md`
- `src/authoring/contracts.ts`
- `src/authoring/contractMetadata.ts`
- `src/cli/helperProgram.ts`
- `src/authoring/mutations.ts`
- `src/authoring/authoringIntents.ts`
- `src/authoring/preview.ts`
- `tests/helperCli.spec.ts`
- `tests/authoringContractMetadata.spec.ts`
- `tests/sddSkillSource.spec.ts`

