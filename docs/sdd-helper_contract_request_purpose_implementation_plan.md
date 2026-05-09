# Gated Implementation Plan: `sdd-helper contract --purpose request`

## Summary

Guide the additive rollout of `sdd-helper contract <subject_id> --purpose
request` through this live implementation plan.

Normative source: `docs/sdd_helper_contract_request_purpose_design.md`.

Non-negotiable invariants:
- No `--purpose` keeps the current full payload behavior.
- `--resolve bundle` remains only the bundle-resolution axis.
- `request` must not be added to `detail_modes`; use separate `contract_purposes` metadata if surfaced.
- Request-purpose payloads exclude `output_shape`, full result schemas, assessment schemas, diagnostic schemas, and result-only continuation notes.
- Implement and verify `helper.command.author` first, then pause before extending to `apply`, `create`, and `undo`.

## [Done] Gate 1: Author Slice

Implement only `helper.command.author --purpose request`.

Key changes:
- Add `ContractPurpose = "request"` and `purpose?: "request"` to helper contract args/types.
- Add optional `contract_purposes?: ["request"]` metadata without changing `detail_modes`.
- Add shared contract selection logic under `src/authoring/*`, returning the same `kind: "sdd-contract-subject-detail"` with request-only fields.
- For author request-purpose payload, include `subject`, `input_shape`, `request_body`, request-side constraints, request-side bundle bindings, `resolution`, and `authoring_format_card` when paired with `--resolve bundle`.
- Exclude top-level `output_shape`, output-shape constraints, result-only continuation, assessment schemas, and diagnostic result schemas.
- Wire CLI parsing for `--purpose <purpose>` in `src/cli/helperProgram.ts`; invalid values return `sdd-helper-error` with `code: "invalid_args"`.

Tests:
- Add metadata/resolution tests proving author request-purpose payload omits `output_shape` and is materially smaller than full resolved detail.
- Add CLI tests for:
  - `contract helper.command.author --purpose request --resolve bundle`
  - unchanged full behavior without `--purpose`
  - invalid `--purpose banana`
  - unchanged invalid `--resolve` behavior
- Update helper README and `sdd-skill` docs/tests so routine pre-authoring uses:
  `contract helper.command.author --purpose request --resolve bundle`.

Pause:
- Stop after Gate 1.
- Verify by using the updated skill workflow, not just unit tests:
  - run the skill wrapper contract call,
  - confirm the reduced author payload is sufficient for routine author request composition,
  - confirm the skill does not fall back to full contract, TypeScript, tests, or examples for normal request shape.
- Do not start `apply`, `create`, or `undo` until this verification is accepted.

## Gate 2: Apply

Extend the same request-purpose selector to `helper.command.apply`.

Key changes:
- Add `contract_purposes: ["request"]` for apply.
- Generalize the existing bundle-derived format-card builder so the public
  `authoring_format_card` field can carry command-specific guidance for apply,
  not author-intent JSON pointers.
- Include `input_shape`, `request_body`, low-level operation schema through `ApplyChangeSetArgs`, handle/base-revision request constraints, request bundle bindings for inline validation/projection fields, and `resolution`.
- Include command-specific `authoring_format_card` when `--resolve bundle` is
  supplied, with hints for `node_id`, `node_type`, `rel_type`, `to`, `event`,
  `effect`, `value_kind`, and `raw_value`.
- Exclude `output_shape`, insertion-handle continuation schemas, full assessment schemas, and full diagnostics schemas.

Tests:
- Assert `--purpose request` excludes `output_shape`.
- Assert request-side handle/revision constraints remain present.
- Assert resolved apply request-purpose payload includes the format card,
  excludes result schemas, and does not reuse author-intent JSON pointers.
- Assert no result-only continuation or assessment schema leaks into the payload.

## Gate 3: Create

Extend request-purpose selector to `helper.command.create`.

Key changes:
- Add `contract_purposes: ["request"]` for create.
- Include invocation metadata for `create <document_path> [--version <version>]`, `CreateDocumentArgs` as `input_shape`, `resolution`, and bootstrap continuation notes needed before the first follow-on mutation.
- Keep `request_body` absent because create does not use `--request`.
- Exclude `output_shape`, embedded change-set result schema, full assessment schemas, and full diagnostics schemas.

Tests:
- Assert request-purpose create payload includes path/version request shape and bootstrap continuation.
- Assert no request body is emitted.
- Assert full no-purpose create contract remains unchanged.

## Gate 4: Undo

Extend request-purpose selector to `helper.command.undo`.

Key changes:
- Add `contract_purposes: ["request"]` for undo only with the eligibility
  guidance below.
- Add optional `/validate_profile` bundle binding for undo; if resolved values
  are exposed, advertise `bundle_resolved` in `detail_modes`.
- Add one narrow `undo_change_set_eligibility` request constraint on
  `/change_set_id`: target record must exist, be committed, be applied,
  be undo-eligible, have a supported inverse, and still match the current
  document revision.
- Include `input_shape`, `request_body`, `change_set_id` request shape,
  mode/validation inputs, the validate-profile binding, `resolution`, and the
  eligibility/current-revision constraint.
- Exclude undo result `sdd-change-set`, result assessment schemas, diagnostic
  schemas, operations, handles, `path`, and `base_revision`.
- Stop Gate 4 as incomplete if the request-purpose payload only describes
  `change_set_id`, `mode`, and `validate_profile` without eligibility/current-
  revision guidance.

Tests:
- Assert undo request-purpose payload contains eligibility/current-revision guidance.
- Assert undo request-purpose payload includes the optional validate-profile
  binding and resolved profile values when called with `--resolve bundle`.
- Assert no `output_shape` or result schema leaks.
- Keep existing undo behavior tests unchanged.

## Final Verification

Run:
- `TMPDIR=/tmp pnpm run build`
- `TMPDIR=/tmp pnpm exec vitest run tests/authoringContractMetadata.spec.ts tests/authoringContractResolution.spec.ts tests/helperCli.spec.ts tests/sddSkillSource.spec.ts`
- `TMPDIR=/tmp pnpm test`

Manual CLI checks:
- `TMPDIR=/tmp pnpm sdd-helper contract helper.command.author --purpose request --resolve bundle`
- `TMPDIR=/tmp pnpm sdd-helper contract helper.command.apply --purpose request --resolve bundle`
- `TMPDIR=/tmp pnpm sdd-helper contract helper.command.create --purpose request`
- `TMPDIR=/tmp pnpm sdd-helper contract helper.command.undo --purpose request --resolve bundle`
- Compare each request-purpose payload against its full no-purpose payload and confirm it is smaller and request-focused.

Assumptions:
- The result kind remains `sdd-contract-subject-detail`; the selector changes payload contents, not the command family.
- Additive fields such as `contract_purposes` are acceptable public-contract additions.
- The author pause is mandatory even if tests pass.
