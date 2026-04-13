# [Fixed] `sdd-helper create` CLI Bug 4-13-26

Status: resolved historical note

## Summary

The public `sdd-helper create` CLI declares `--template` as a required option, and the documented supported value is `empty`.

Before the fix, calling the command with `--template empty` was rejected with:

```json
"message": "Unsupported template 'undefined'."
```

This was a CLI option-wiring bug, not an authoring-layer template validation bug.

## Reproduction

Command:

```bash
pnpm sdd-helper create docs/readme_support_docs/sdd-skill/examples/_bug_repro.sdd --template empty --version 0.1
```

Historical observed result:

```json
{
  "kind": "sdd-change-set",
  "path": "docs/readme_support_docs/sdd-skill/examples/_bug_repro.sdd",
  "status": "rejected",
  "diagnostics": [
    {
      "code": "sdd.unsupported_template",
      "message": "Unsupported template 'undefined'."
    }
  ]
}
```

The target file was not created.

## Why `--template` Exists

At the public CLI layer, `--template` is mandatory.

Evidence:

- [src/cli/helperProgram.ts](../../src/cli/helperProgram.ts) defines the command with:
  - `.requiredOption("--template <template_id>", "document template id")`
- [src/cli/helperDiscovery.ts](../../src/cli/helperDiscovery.ts) advertises:
  - `invocation: "sdd-helper create <document_path> --template <template_id> [--version <version>]"`
  - `required: true` for `--template`
- [src/authoring/contracts.ts](../../src/authoring/contracts.ts) defines `CreateDocumentArgs` with required `template_id: string`

So the public contract is:

- yes, `--template` is mandatory in the CLI contract today
- no, there is not a meaningful choice of templates today
- the only documented supported value is `empty`

## Supported Template

The current implementation supports exactly one template identifier:

- `empty`

Evidence:

- [src/authoring/mutations.ts](../../src/authoring/mutations.ts) defines `EMPTY_TEMPLATE_ID = "empty"`
- the same file rejects any `args.template_id !== EMPTY_TEMPLATE_ID`
- [docs/readme_support_docs/sdd-helper/README.md](../readme_support_docs/sdd-helper/README.md) states:
  - `the current implementation supports template_id=empty`
- [skills/sdd-skill/references/current-helper-gaps.md](../../skills/sdd-skill/references/current-helper-gaps.md) states:
  - `template_id=empty is the documented supported template`

The expected effect of the supported `empty` template is to create a file containing:

```text
SDD-TEXT 0.1
```

with a trailing newline, as implemented by `emptyTemplateText()` in [src/authoring/mutations.ts](../../src/authoring/mutations.ts).

## Root Cause

The `create` command wiring was inconsistent with Commander option naming.

In [src/cli/helperProgram.ts](../../src/cli/helperProgram.ts):

```ts
.requiredOption("--template <template_id>", "document template id")
.action(async (documentPath: string, options: { template: string; version?: CreateDocumentArgs["version"] }) => {
  ...
  template_id: options.template,
```

The command declares `--template`, but the buggy implementation read `options.template_id`.

Commander populates `options.template`, so the old implementation passed `undefined` into the authoring-layer template check and triggered a false `sdd.unsupported_template` rejection.

## Expected Behavior

This command now succeeds:

```bash
pnpm sdd-helper create <document_path> --template empty --version 0.1
```

It creates the new `.sdd` file using the empty template and returns an `sdd-create-document` result.

## Resolution

- keep the public `--template <template_id>` flag unchanged
- map Commander `options.template` to `CreateDocumentArgs.template_id`
- cover the binding with a helper CLI regression test

## Historical Impact

- The helper discovery contract and helper documentation described a working create flow that was temporarily unusable from the public CLI.
- Skills or other automation that followed the documented `create --template empty` path failed even when they supplied the only supported template.
- Users were pushed toward workarounds for initial file creation instead of staying entirely inside the helper-supported create flow.
