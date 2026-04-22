# [Done] SDD Helper Hardening Implementation Plan

Status: active implementation plan for hardening the JSON-first `sdd-helper` surface

Audience: maintainers implementing helper contract hardening and regression coverage

## 1. Summary

Create a focused hardening milestone for `sdd-helper` that improves contract reliability without expanding the helper surface.

This is a hardening plan, not a feature-expansion plan. Scope is limited to confirmed, reproduced helper weaknesses. The goal is to make `sdd-helper` safer as a machine-facing contract for skills and future MCP work, and to make helper failures specific enough that automation can distinguish invalid intermediate authoring state from true environment or runtime failure.

This milestone also includes syncing the future MCP design note where helper hardening changes shared contract wording or preview-failure expectations.

This document is the forward-looking source of truth for the hardening sequence. Historical bug notes remain useful evidence, but this plan governs the next implementation pass.

## 2. Locked Goals And Boundaries

The hardening pass uses these defaults:

- harden the helper contract before adding helper features
- preserve the existing command surface unless a compatibility-safe hardening change is required
- prefer specific helper failures and structured domain rejections over generic runtime failures
- keep wrapper-based use supported, but do not require the wrapper for direct helper correctness inside a repo checkout
- make preview failures understandable enough for a skill to classify validation-state problems versus environment or backend problems

This milestone is intentionally out of scope for:

- new helper commands
- broader template work
- MCP feature work
- parser, bundle, compiler, validator, projector, or renderer behavior unrelated to helper hardening
- speculative audit items that have not yet been confirmed by reproduction or direct code evidence

## 3. Current Confirmed Risks

The following issues are confirmed and should drive this hardening sequence.

### 3.1 Rename-Aware Git Flow Is Inconsistent

`git-status` reports rename destinations, but `git-commit` stages and commits only the explicit supplied path list. In the reproduced rename case, helper status surfaced only the destination path, while helper commit created an add-only commit and left the delete side behind in the worktree.

This creates a contract mismatch between discovery and commit behavior for narrow `.sdd`-scoped git workflows. Evidence lives in [`src/authoring/git.ts`](../src/authoring/git.ts) and existing regression coverage at [`tests/authoringGitHelpers.spec.ts`](../tests/authoringGitHelpers.spec.ts).

### 3.2 Request Validation Is Too Shallow

`apply` currently validates only the top-level request shape strongly enough to confirm `path`, `base_revision`, and `operations`, but not the operational shape of each change item. That allows malformed-but-JSON-valid requests to reach authoring handlers that immediately dereference missing nested fields and crash with raw exception text.

This is a helper-boundary problem. Malformed requests should fail as `sdd-helper-error` with `invalid_args`, not as property-access `TypeError`s. Evidence lives in [`src/cli/helperProgram.ts`](../src/cli/helperProgram.ts) and [`src/authoring/mutations.ts`](../src/authoring/mutations.ts), with current CLI coverage in [`tests/helperCli.spec.ts`](../tests/helperCli.spec.ts).

### 3.3 Direct Helper Execution Is Too Dependent On `cwd`

Direct `sdd-helper` execution from a repo subdirectory can fail because the helper treats the current working directory as the repo root and resolves bundle paths relative to that directory. Git-only commands currently pass through the same helper-context loading path, even though they do not need bundle data.

The wrapper script masks part of this problem today, but direct helper correctness inside a repo should not depend on the wrapper. Evidence lives in [`src/cli/helperProgram.ts`](../src/cli/helperProgram.ts), [`src/authoring/workspace.ts`](../src/authoring/workspace.ts), and skill wrapper guidance in [`../skills/sdd-skill/scripts/run_helper.sh`](../skills/sdd-skill/scripts/run_helper.sh).

### 3.4 Unsupported Create-Version Rejection Uses The Wrong Diagnostic Code

Unsupported `create --version` rejection is currently emitted as `sdd.unsupported_template`, which prevents callers from distinguishing a version problem from a template problem.

This is a classification bug rather than a missing feature. The public contract should distinguish unsupported template IDs from unsupported document versions. Evidence lives in [`src/authoring/mutations.ts`](../src/authoring/mutations.ts), with related historical context in [`./Done/[Fixed] sdd-helper-create-cli-bug.md`](./Done/%5BFixed%5D%20sdd-helper-create-cli-bug.md).

### 3.5 Preview Failure Messaging Is Too Generic

When preview is attempted against an intermediate invalid document state under `strict`, the helper currently drops the real diagnostics and returns only a generic artifact failure message. That prevents the skill from understanding that the document is temporarily incomplete rather than the environment being broken.

The fresh confirmed example is:

- preview was run too early during a valid intermediate authoring workflow
- the document had been structurally updated, but required strict `Place` properties such as `owner`, `description`, `surface`, `route_or_key`, and `access` had not all been filled in yet
- once the document became fully valid under `strict`, preview succeeded
- this is a messaging and contract gap, not a permanent preview backend failure

The renderer pipeline already computes the specific diagnostics. The helper currently hides them behind a generic `Preview did not produce an artifact` message. Evidence lives in [`src/renderer/previewWorkflow.ts`](../src/renderer/previewWorkflow.ts), [`src/authoring/preview.ts`](../src/authoring/preview.ts), and [`tests/helperCli.spec.ts`](../tests/helperCli.spec.ts).

## 4. Sequenced Implementation Plan

Implementation should proceed in this order.

### Phase 1: Error Contract And Input Hardening

The first pass should harden the helper boundary itself.

- deepen request-shape validation for `apply` and `undo`
- ensure malformed requests return `sdd-helper-error` with `invalid_args` instead of raw runtime exceptions
- fix incorrect diagnostic labeling for unsupported `create --version`
- harden preview failure reporting so non-artifact failures caused by compile, validation, projection, or render diagnostics remain non-zero helper errors but carry specific cause detail

The preview-failure contract is locked as follows:

- keep preview failure in the helper-error lane
- do not silently convert invalid preview attempts into success-shaped `sdd-preview` payloads
- require a specific message that names the failing stage or reason class when practical
- require structured diagnostic detail on the helper error so skills can classify the failure

### Phase 2: Command Context Hardening

The second pass should remove unnecessary environment brittleness.

- separate repo and workspace discovery from bundle loading
- make direct helper invocation work from nested directories inside a repo
- avoid loading bundle data for commands that do not need it, especially `git-status` and `git-commit`
- preserve wrapper support, but treat the wrapper as convenience and normalization rather than correctness infrastructure

### Phase 3: Git Semantics Hardening

The third pass should align narrow helper git behavior with what helper discovery reports.

- make rename handling consistent between `git-status` and `git-commit`
- ensure an explicit rename target path results in a complete rename commit rather than a stranded delete
- preserve narrow `.sdd`-scoped behavior and avoid staging unrelated files

### Phase 4: Regression Coverage And Contract Docs

The final pass should lock the behavior in tests and documentation.

- add regression tests for each confirmed issue
- update helper and skill documentation only after hardened behavior is implemented and verified
- update `docs/future_explorations/mcp_server/sdd_mcp_server_design.md` anywhere helper hardening changes shared contract wording
- keep skill and MCP guidance aligned with the actual helper contract rather than temporary behavior or wrapper workarounds

The MCP design sync must clarify that helper and MCP share the same domain diagnostics and success-side logical results, while failure mapping may remain surface-specific.

## 5. Public Contract Changes To Capture

The hardening implementation should explicitly capture these helper-facing changes.

- `HelperErrorResult` should gain optional structured diagnostic detail for applicable helper failures, especially preview failures
- preview failures caused by invalid intermediate document state should remain `sdd-helper-error` with non-zero exit
- preview helper errors should distinguish validation-style failures from generic runtime or backend failures strongly enough for a skill to react appropriately
- the MCP design note must be updated so helper preview success remains aligned with `sdd.render_preview`, while preview failure mapping is described as shared diagnostics plus surface-specific transport or error envelopes
- malformed request bodies should return `invalid_args` or `invalid_json`, not raw exception text
- direct helper execution from anywhere inside the repo should be supported
- rename commits should behave consistently with helper git-status reporting
- create version and template rejections should be distinguishable

The preview error text does not need a fixed literal template in advance, but the behavior is locked:

- the message must be more specific than `did not produce an artifact`
- the structured details must preserve the underlying diagnostics that explain why preview could not complete

This sync is documentation-only unless implementation reveals a true shared-domain contract gap.

## 6. Proof Tasks And Acceptance

Implementation is not complete until the following proof tasks pass.

1. A malformed `apply` request missing required nested placement data returns `invalid_args`, not `runtime_error`.
2. Direct helper invocation from a nested repo directory works for at least one git-only command and one bundle-backed command.
3. A rename-only `.sdd` change can be discovered via helper git-status and then committed via helper git-commit without leaving a delete behind.
4. `create` with an unsupported version reports the correct diagnostic classification.
5. A preview attempted too early under `strict` returns a non-zero `sdd-helper-error` with a specific message and structured diagnostics explaining the validation failure.
6. The same document, once made fully valid under `strict`, previews successfully.
7. Existing happy-path helper CLI tests still pass after hardening.
8. `docs/future_explorations/mcp_server/sdd_mcp_server_design.md` is updated to reflect the hardened helper contract, especially preview failure semantics and the distinction between shared diagnostics versus helper-only error envelopes.

Acceptance criteria:

- each confirmed failure mode is reproduced before the fix and prevented after the fix
- preview failures preserve enough detail for the skill to understand what happened
- regression tests cover the hardened behavior
- the MCP design note no longer implies that helper and MCP must share identical failure envelopes where the hardened helper contract keeps transport-specific error mapping
- docs and skill guidance describe only behavior that now actually works

## 7. References

Use these as the current implementation and evidence anchors for the hardening pass:

- [`src/cli/helperProgram.ts`](../src/cli/helperProgram.ts)
- [`src/authoring/preview.ts`](../src/authoring/preview.ts)
- [`src/renderer/previewWorkflow.ts`](../src/renderer/previewWorkflow.ts)
- [`src/authoring/git.ts`](../src/authoring/git.ts)
- [`src/authoring/mutations.ts`](../src/authoring/mutations.ts)
- [`tests/helperCli.spec.ts`](../tests/helperCli.spec.ts)
- [`tests/authoringGitHelpers.spec.ts`](../tests/authoringGitHelpers.spec.ts)
- [`docs/future_explorations/mcp_server/sdd_mcp_server_design.md`](./future_explorations/mcp_server/sdd_mcp_server_design.md)
- [`docs/Done/[Fixed] sdd-helper-create-cli-bug.md`](./Done/%5BFixed%5D%20sdd-helper-create-cli-bug.md)

## 8. Assumptions And Defaults

This plan assumes:

- the document lives in top-level `docs/`, not `docs/Deferred/`
- scope stays limited to confirmed, reproduced risks
- the sequence remains contract-first, with preview error specificity included in the first phase
- preview invalid-intermediate failures stay in the helper-error lane, but gain both better messaging and structured diagnostics
- the document should follow the repo’s existing active-plan style rather than introducing a new plan format
