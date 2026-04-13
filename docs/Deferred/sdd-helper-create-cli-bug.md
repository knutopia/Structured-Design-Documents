# `sdd-helper create` CLI Bug

## Summary

The public `sdd-helper create` CLI currently declares `--template` as a required option, and the documented supported value is `empty`.

However, calling the command with `--template empty` is rejected with:

```json
"message": "Unsupported template 'undefined'."
```

This appears to be a CLI option-wiring bug, not an authoring-layer template validation bug.

## Reproduction

Command:

```bash
pnpm sdd-helper create docs/readme_support_docs/sdd-skill/examples/_bug_repro.sdd --template empty --version 0.1
```

Observed result:

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

The target file is not created.

## Why `--template` Exists

At the current public CLI layer, `--template` is mandatory.

Evidence:

- [src/cli/helperProgram.ts](../../src/cli/helperProgram.ts) defines the command with:
  - `.requiredOption("--template <template_id>", "document template id")`
- [src/cli/helperDiscovery.ts](../../src/cli/helperDiscovery.ts) advertises:
  - `invocation: "sdd-helper create <document_path> --template <template_id> [--version <version>]"`
  - `required: true` for `--template`
- [src/authoring/contracts.ts](../../src/authoring/contracts.ts) defines `CreateDocumentArgs` with required `template_id: string`

So the current public answer is:

- yes, `--template` is mandatory in the CLI contract today
- no, there is not a meaningful choice of templates today
- the only documented supported value is `empty`

## Supported Template Today

The current implementation supports exactly one template identifier:

- `empty`

Evidence:

- [src/authoring/mutations.ts](../../src/authoring/mutations.ts) defines `EMPTY_TEMPLATE_ID = "empty"`
- the same file rejects any `args.template_id !== EMPTY_TEMPLATE_ID`
- [docs/readme_support_docs/sdd-helper/README.md](../readme_support_docs/sdd-helper/README.md) states:
  - `the current implementation supports template_id=empty`
- [/mnt/c/Users/Knut/.codex/skills/sdd-skill/references/current-helper-gaps.md](/mnt/c/Users/Knut/.codex/skills/sdd-skill/references/current-helper-gaps.md) states:
  - `template_id=empty is the documented supported template`

The expected effect of the supported `empty` template is to create a file containing:

```text
SDD-TEXT 0.1
```

with a trailing newline, as implemented by `emptyTemplateText()` in [src/authoring/mutations.ts](../../src/authoring/mutations.ts).

## Likely Root Cause

The `create` command wiring appears inconsistent with Commander option naming.

In [src/cli/helperProgram.ts](../../src/cli/helperProgram.ts):

```ts
.requiredOption("--template <template_id>", "document template id")
.action(async (documentPath: string, options: Pick<CreateDocumentArgs, "template_id" | "version">) => {
  ...
  template_id: options.template_id,
```

The command declares `--template`, but the action reads `options.template_id`.

The observed runtime behavior strongly suggests that Commander is populating `options.template`, while `options.template_id` remains `undefined`, which then flows into the authoring-layer check and is rejected as an unsupported template.

## Expected Behavior

This command should succeed:

```bash
pnpm sdd-helper create <document_path> --template empty --version 0.1
```

It should create the new `.sdd` file using the empty template and return an `sdd-create-document` result.

## Impact

- The helper discovery contract and helper documentation both describe a working create flow that is not currently usable from the public CLI.
- Skills or other automation that follow the documented `create --template empty` path will fail even when they supply the only supported template.
- Users are pushed toward workarounds for initial file creation instead of staying entirely inside the helper-supported create flow.
