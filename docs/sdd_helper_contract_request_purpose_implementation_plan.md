# SDD Helper Contract Request Purpose Implementation Plan

Status: gated implementation plan

Normative source: [`sdd_helper_contract_request_purpose_design.md`](./sdd_helper_contract_request_purpose_design.md)

## Summary

Add `sdd-helper contract <subject_id> --purpose request` as a small, additive
contract selector for request-composition workflows.

Non-negotiable invariants:

- no `--purpose` keeps the current full contract payload behavior
- `--resolve bundle` remains only the bundle-resolution axis
- `request` is not a `detail_modes` value
- request-purpose payloads exclude `output_shape`, full result schemas,
  assessment schemas, diagnostic schemas, and result-only continuation notes
- `helper.command.author` lands and is verified first, then implementation
  pauses before `apply`, `create`, and `undo`

## Gate 1: Author

Implement only:

```bash
sdd-helper contract helper.command.author --purpose request --resolve bundle
```

Changes:

- add `ContractPurpose = "request"` and `purpose?: "request"` to shared
  contract types
- add optional `contract_purposes: ["request"]` metadata for
  `helper.command.author` without changing `detail_modes`
- add shared request-purpose contract selection under `src/authoring/*`
- wire `--purpose request` through `src/cli/helperProgram.ts`
- update helper and skill docs so routine pre-authoring uses the request-purpose
  author contract

Acceptance:

- author request-purpose output includes `input_shape`, `request_body`,
  request-side constraints, `resolution.mode = "bundle_resolved"`, and
  `authoring_format_card`
- author request-purpose output excludes `output_shape`, result-side
  continuation, assessment schemas, and diagnostic result schemas
- full author contract output without `--purpose` remains compatible
- invalid `--purpose` values return `sdd-helper-error` with `code:
  "invalid_args"`
- the updated skill can use the reduced author payload for request composition

Pause:

- run the skill wrapper contract call and verify the reduced author payload is
  sufficient for normal request composition
- do not implement Gate 2 until this verification is accepted

## Gate 2: Apply

Implement only after Gate 1 is accepted:

```bash
sdd-helper contract helper.command.apply --purpose request
```

Changes:

- add `contract_purposes: ["request"]` for `helper.command.apply`
- include `ApplyChangeSetArgs`, request loading rules, operation schema,
  handle/base-revision request constraints, request-side bundle bindings, and
  `resolution`
- exclude `output_shape`, insertion-handle result continuation, assessment
  schemas, and diagnostic result schemas

## Gate 3: Create

Implement only after Gate 2 is accepted:

```bash
sdd-helper contract helper.command.create --purpose request
```

Changes:

- add `contract_purposes: ["request"]` for `helper.command.create`
- include create invocation metadata, `CreateDocumentArgs`, `resolution`, and
  bootstrap continuation notes needed before the first follow-on mutation
- keep `request_body` absent because `create` does not use `--request`
- exclude `output_shape`, embedded change-set result structure, assessment
  schemas, and diagnostic result schemas

## Gate 4: Undo

Implement only after Gate 3 is accepted:

```bash
sdd-helper contract helper.command.undo --purpose request
```

Changes:

- add `contract_purposes: ["request"]` for `helper.command.undo`
- include `UndoChangeSetArgs`, request loading rules, `change_set_id`,
  mode/validation inputs, and request-facing undo eligibility metadata
- if needed, add one narrow undo request constraint for committed,
  undo-eligible, supported-inverse change sets that still match the current
  document revision
- exclude undo result `sdd-change-set`, assessment schemas, and diagnostic
  schemas

## Verification

Gate 1:

```bash
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/authoringContractMetadata.spec.ts tests/authoringContractResolution.spec.ts tests/helperCli.spec.ts tests/sddSkillSource.spec.ts
TMPDIR=/tmp skills/sdd-skill/scripts/run_helper.sh contract helper.command.author --purpose request --resolve bundle
```

After all gates:

```bash
TMPDIR=/tmp pnpm test
TMPDIR=/tmp pnpm sdd-helper contract helper.command.author --purpose request --resolve bundle
TMPDIR=/tmp pnpm sdd-helper contract helper.command.apply --purpose request
TMPDIR=/tmp pnpm sdd-helper contract helper.command.create --purpose request
TMPDIR=/tmp pnpm sdd-helper contract helper.command.undo --purpose request
```
