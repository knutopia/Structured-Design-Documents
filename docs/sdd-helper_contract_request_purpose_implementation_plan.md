# Gated Implementation Plan: `sdd-helper contract --purpose request`

## Summary

Create `docs/sdd_helper_contract_request_purpose_implementation_plan.md` to guide an additive rollout of `sdd-helper contract <subject_id> --purpose request`.

Normative source: `docs/sdd_helper_contract_request_purpose_design.md`.

Non-negotiable invariants:
- No `--purpose` keeps the current full payload behavior.
- `--resolve bundle` remains only the bundle-resolution axis.
- `request` must not be added to `detail_modes`; use separate `contract_purposes` metadata if surfaced.
- Request-purpose payloads exclude `output_shape`, full result schemas, assessment schemas, diagnostic schemas, and result-only continuation notes.
- Implement and verify `helper.command.author` first, then pause before extending to `apply`, `create`, and `undo`.

## Gate 1: Author Slice

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
- Include `input_shape`, `request_body`, low-level operation schema through `ApplyChangeSetArgs`, handle/base-revision request constraints, request bundle bindings for inline validation/projection fields, and `resolution`.
- Exclude `output_shape`, insertion-handle continuation schemas, full assessment schemas, and full diagnostics schemas.

Tests:
- Assert `--purpose request` excludes `output_shape`.
- Assert request-side handle/revision constraints remain present.
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
- Add `contract_purposes: ["request"]` for undo.
- Include `input_shape`, `request_body`, `change_set_id` request shape, mode/validation inputs, and minimum request-facing undo eligibility metadata.
- If current metadata is insufficient, add one narrow undo request constraint covering: target record must exist, be committed, be undo-eligible, have a supported inverse, and match the current document revision.
- Exclude undo result `sdd-change-set`, result assessment schemas, and diagnostic schemas.

Tests:
- Assert undo request-purpose payload contains eligibility/current-revision guidance.
- Assert no `output_shape` or result schema leaks.
- Keep existing undo behavior tests unchanged.

## Final Verification

Run:
- `TMPDIR=/tmp pnpm run build`
- `TMPDIR=/tmp pnpm exec vitest run tests/authoringContractMetadata.spec.ts tests/authoringContractResolution.spec.ts tests/helperCli.spec.ts tests/sddSkillSource.spec.ts`
- `TMPDIR=/tmp pnpm test`

Manual CLI checks:
- `TMPDIR=/tmp pnpm sdd-helper contract helper.command.author --purpose request --resolve bundle`
- `TMPDIR=/tmp pnpm sdd-helper contract helper.command.apply --purpose request`
- `TMPDIR=/tmp pnpm sdd-helper contract helper.command.create --purpose request`
- `TMPDIR=/tmp pnpm sdd-helper contract helper.command.undo --purpose request`
- Compare each request-purpose payload against its full no-purpose payload and confirm it is smaller and request-focused.

Assumptions:
- The result kind remains `sdd-contract-subject-detail`; the selector changes payload contents, not the command family.
- Additive fields such as `contract_purposes` are acceptable public-contract additions.
- The author pause is mandatory even if tests pass.
