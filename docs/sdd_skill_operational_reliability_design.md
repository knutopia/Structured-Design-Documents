# SDD Skill Operational Reliability Design

Status: design foundation, partially implemented through Gates 1-3

Audience: maintainers improving `sdd-skill`, `sdd-helper`, shared SDD authoring services, and the future SDD MCP server

Purpose: define how to make agent use of SDD tooling reliable by reducing prose-only operational burden, keeping `sdd-skill` focused on routing and hard stops, and adding shared outcome assessment for helper and MCP consumers.

This document is a design foundation, not a gate-by-gate implementation plan. The shared assessment model, helper exposure, and contract metadata exposure described here are implemented in shared code and `sdd-helper` documentation as of Gates 1-4. Skill restructuring, live MCP adapter behavior, and end-to-end closeout remain future gates.

## 1. Purpose And Status

The current helper-first architecture gives agents a structured way to create, inspect, edit, validate, project, preview, undo, and narrowly commit `.sdd` documents. The recent helper-use failure does not show that this architecture should be replaced. It shows that the agent operating layer still depends too heavily on a model following prose instructions across transport details, result interpretation, and multi-step sequencing.

This design keeps the existing shared authoring substrate and improves the reliability boundary around it. Correctness-critical interpretation is now shared, machine-readable behavior exposed by `sdd-helper` and intended for the future MCP server. `sdd-skill` should become a smaller branch selector and operating guide that delegates acceptance judgment to shared assessment data instead of encoding that judgment only in prose.

## 2. Ground Truth

The current agent-facing stack is:

```text
sdd-skill
  -> skills/sdd-skill/scripts/run_helper.sh
  -> pnpm --silent sdd-helper
  -> src/cli/helperProgram.ts
  -> src/authoring/*
  -> repo files + bundle/v0.1 + existing runtime
```

The current human-facing CLI is separate:

```text
sdd CLI
  -> human-oriented validate, compile, show, and preview workflows
  -> repo files + bundle/v0.1 + existing runtime
```

The future MCP server is intended to be a sibling adapter over the same shared SDD domain services used by `sdd-helper`. The MCP server must not shell out to `sdd-helper`, and `sdd-helper` must not define a separate data model from MCP.

Grounding sources:

- `skills/sdd-skill/SKILL.md`: defines the current skill workflow, the helper wrapper entrypoint, request-file guidance, bootstrap caveats, preview policy, and helper command set.
- `skills/sdd-skill/scripts/run_helper.sh`: locates the repository, sets `TMPDIR=/tmp`, ensures `node` and `pnpm` are available, changes to the repo root, and executes `pnpm --silent sdd-helper "$@"`.
- `docs/readme_support_docs/sdd-helper/README.md`: defines `sdd-helper` as the JSON-first machine-facing companion surface, separate from the human-facing `sdd` CLI.
- `docs/future_explorations/mcp_server/sdd_mcp_server_design.md`: defines helper and MCP as sibling surfaces over shared SDD domain services, with no MCP shell-out to the helper app.
- `docs/future_explorations/mcp_server/sdd_machine_readable_contract_layer_design.md`: defines the shared contract layer used for helper and future MCP contract metadata, with lightweight discovery and deep introspection.
- `src/cli/helperProgram.ts`: implements the `sdd-helper` CLI adapter by loading repo and bundle context, loading request text from files or stdin, parsing JSON, validating request shape, invoking `src/authoring/*` services, and returning one JSON payload.
- `src/authoring/contracts.ts`: defines shared public types for document resources, inspect resources, change sets, authoring intents, validation, projection, preview, helper errors, helper capabilities, and contract metadata.

## 3. Problem Analysis

The operational failure that motivated this design was not a failure of the shared SDD authoring architecture. It was a failure of agent execution discipline around a sharp transport edge and a failure to preserve the exact error boundary while diagnosing the result.

The current `sdd-skill` is correct to prefer helper-backed authoring and to avoid raw `.sdd` edits. The problem is that the skill still asks the agent to carry too much implicit state:

- whether a request body was delivered by file or by stdin
- whether a helper error is a transport failure, request-shape failure, runtime failure, domain rejection, candidate diagnostic failure, persisted validation failure, projection failure, or render failure
- whether a result is commit-eligible or render-eligible
- whether returned handles are informational dry-run handles or continuation-safe committed handles
- whether a document is in an intentional empty bootstrap state after creation

Adding more prose to `SKILL.md` is not sufficient. Prose can remind an agent to be careful, but it cannot make result interpretation deterministic. Gates 1-3 represent correctness-critical judgments in shared code, expose them on helper payloads, and describe them through machine-readable contract metadata.

Known sharp edges that the design must address:

- `--request -` is transport-sensitive. Request files are the default for helper commands that accept JSON request bodies. Stdin remains valid only when JSON is piped in the same shell command or when an actual interactive terminal supplies the body before EOF.
- `create` can produce an intentionally parse-invalid bootstrap document. That document may fail `inspect` until a top-level node block is added through a follow-on mutation using the returned revision.
- Helper errors, domain rejections, diagnostics, validation results, projection results, and render failures are different layers. They must not be collapsed into one generic failure class.
- `status` and diagnostics must be interpreted together. A result with `status: "applied"` and blocking diagnostics is not acceptable for commit or render.
- Dry-run handles and dry-run `created_targets` are review aids only. Committed handles and committed `created_targets` are continuation-safe only for the returned committed `resulting_revision`.

## 4. Design Direction

This design preserves the existing architecture rather than replacing it.

Locked direction:

- Keep `src/authoring/*` as the shared domain/service layer for helper and future MCP behavior.
- Keep `sdd-helper` as the JSON-first CLI adapter over shared authoring services.
- Keep the future MCP server as a sibling adapter over the same shared services.
- Keep the human-facing `sdd` CLI separate from `sdd-helper`.
- Keep `.sdd` files as the source of truth.
- Keep bundle-owned language truth in `bundle/v0.1/`.
- Keep raw text editing out of public helper, skill, and MCP authoring flows.

The reliability change is to move acceptance judgment into shared authoring/domain code and expose it through adapter surfaces. `sdd-skill` should use that shared judgment instead of becoming the authority for result interpretation.

The top-level skill should become smaller. Its job should be to classify the user request, select the right helper branch, enforce hard stops, and load deeper references only when needed. It should not duplicate bundle vocabulary, relationship endpoint rules, JSON schemas, continuation rules, or result acceptance logic that belongs in shared code or the machine-readable contract layer.

## 5. Shared Outcome Assessment Design

The additive shared assessment concept is named `AuthoringOutcomeAssessment`.

`AuthoringOutcomeAssessment` is produced from existing helper/domain result envelopes and diagnostics. It is not produced by agent-side heuristics. The assessment logic lives in shared code consumed by `sdd-helper` and intended for the future MCP server. `sdd-skill` reads the assessment and follows its decision fields.

Implemented semantic shape:

```ts
interface AuthoringOutcomeAssessment {
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

The TypeScript interface and helper-exposed field are implemented under this name.

Field semantics:

- `kind` identifies the assessment payload.
- `outcome` is the top-level operational judgment.
- `layer` identifies the first layer that determines the operational judgment.
- `can_commit` is true only when the assessed candidate is eligible for a commit request without changing the candidate content.
- `can_render` is true only when the persisted document state is eligible for preview or saved rendering under the requested profile and view.
- `should_stop` is true when the caller must not continue to the next workflow step until the reported issue is fixed.
- `next_action` is a short imperative instruction suitable for `sdd-skill` to follow or report.
- `blocking_diagnostics` contains diagnostics that make the current result unacceptable for the next workflow step.
- `summary` is a concise human-readable explanation of the assessment.

Assessment rules:

- Empty stdin to `--request -` is a transport/request JSON failure at the helper adapter boundary. The assessment layer is `transport` when the body is absent because the request did not reach domain semantics.
- A parsed JSON body that fails request validation is a request-shape failure. The assessment layer is `request_shape`.
- A structured domain rejection is a domain rejection, not a helper transport failure. The assessment layer is `domain_rejection`.
- A dry-run mutation result with blocking parse, compile, validate, or projection diagnostics is not commit-eligible. The assessment layer is `candidate_diagnostics` unless the result already identifies a narrower persisted validation, projection, or render layer.
- A clean dry run with expected validation and projection feedback is commit-eligible. The assessment layer is `success`, `can_commit` is true, and `can_render` is false unless the assessed state is already persisted and render-gated.
- A committed result with clean persisted validation is render-eligible when the requested view and profile are known. The assessment layer is `success` and `can_render` is true.
- A preview failure caused by invalid document state is classified according to the validation or render diagnostics returned with the failure. It is not automatically classified as renderer infrastructure failure.

Adapter exposure:

- Existing helper result shapes remain backward-compatible.
- Assessment exposure is additive. `sdd-helper` adds optional `assessment` fields to relevant result payloads and helper errors without changing existing `kind` values, existing fields, or exit-code behavior. Future MCP exposure should use the same assessment semantics from shared code.
- The machine-readable contract layer describes `shared.shape.authoring_outcome_assessment` and optional `assessment` properties on relevant helper result schemas through deep introspection.

## 6. Skill Restructuring Design

`SKILL.md` should become a branch selector and hard-stop guide.

Required top-level branches:

- create a new document
- edit an existing document
- read, validate, project, or render an existing document
- diagnose a helper failure
- use helper git commands

Detailed procedure should live in references only where needed. The top-level skill should load those references after it has selected a branch. The top-level skill should stay short enough that the agent can keep the operating model active while working.

Hard stops that remain in top-level `SKILL.md`:

- Use request files by default for helper commands whose contract reports a JSON body through `--request`.
- Use `--request -` only when JSON is piped in the same shell command.
- Do not hand-edit supported `.sdd` structure.
- Inspect before handle-based edits to existing parseable documents.
- Use the returned `create` revision for fresh-document bootstrap follow-on authoring instead of immediately forcing `inspect`.
- Dry-run before commit.
- Do not render before clean committed validation.
- Defer acceptance judgment to shared assessment.

Skill guidance must not duplicate bundle vocabulary, endpoint rules, profile lists, view lists, parser grammar, or node ID syntax as normative skill-owned behavior. When a task needs bundle-owned values, the skill should direct the agent to use helper contract introspection with bundle resolution or other shared bundle-backed surfaces.

## 7. Helper And MCP Surface Implications

`sdd-helper` remains a CLI adapter. It owns shell-facing concerns:

- command names and options
- request file and stdin loading
- JSON parsing at the transport boundary
- request-shape validation at the adapter boundary
- stdout JSON behavior
- exit codes for helper-level failures

`sdd-helper` must not become the unique authority for result acceptance. It exposes shared assessment semantics produced by shared code.

The future MCP server remains a sibling adapter. It must call shared SDD domain services directly and must not shell out to `sdd-helper`. It should expose the same assessment semantics without inheriting helper-specific stdin, stdout, or process exit behavior.

Shared domain code owns:

- result assessment semantics
- diagnostic layer classification
- commit eligibility
- render eligibility
- continuation-safe versus informational handles
- relationship between existing result envelopes and next workflow steps

The shared machine-readable contract layer describes the implemented assessment payload shape and adapter exposure rules. The bundle remains the authority for SDD language behavior, vocabulary, relationships, views, and profiles.

## 8. Acceptance Scenarios

The design is successful only if the implemented system can support these scenarios without requiring `sdd-skill` to read TypeScript implementation files.

1. Empty stdin to `--request -` is classified as a transport/request JSON failure. No document semantics are diagnosed.
2. Invalid request shape is classified as request-shape failure.
3. Domain rejection is classified separately from helper failure.
4. Dry-run result with blocking diagnostics is not commit-acceptable.
5. Clean dry run with expected projection is commit-eligible.
6. Committed result with clean persisted validation is render-eligible.
7. Preview failure caused by invalid document state is not classified as renderer infrastructure failure.
8. `sdd-skill` can route each scenario by reading helper/MCP result envelopes, shared assessment data, and documented contracts.

## 9. Key Design Commitments

- Do not propose replacing `src/authoring/*`.
- Do not propose merging `sdd-helper` into `sdd`.
- Do not propose making MCP call `sdd-helper`.
- Do not make `sdd-skill` the authority for result interpretation.
- Do not encode bundle-owned SDD language semantics in skill prose.
- Treat this as a reliability design over the existing helper-first architecture.

## 10. Documentation Verification

This document is complete only when:

- it exists at `docs/sdd_skill_operational_reliability_design.md`
- it contains an explicit as-is architecture diagram matching current repo ground truth
- it names the grounding sources used by the design
- it defines `AuthoringOutcomeAssessment` with all required fields
- it includes the acceptance scenarios
- it does not describe speculative repo structure as current fact
- it distinguishes implemented Gates 1-4 behavior from future skill and MCP gates
- it changes no code and no tracked non-doc behavior
