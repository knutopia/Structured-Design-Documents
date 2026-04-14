# Possible Structure For An `sdd-skill`

Status: exploration note for a Codex skill that relies on `sdd-helper`

Audience: maintainers deciding how a first SDD-focused Codex skill should be structured before building MCP

## 1. Purpose

This note proposes a practical structure for an `sdd-skill` that uses the existing helper app as its mutation and inspection surface.

The goal is not to make the skill another implementation of SDD semantics. The goal is to give Codex a narrow, repeatable workflow for:

- finding relevant `.sdd` documents
- inspecting source structure safely
- planning structured edits
- applying or undoing change sets
- generating previews when that helps review the result

This fits the repo's current direction:

- `.sdd` files remain the source of truth
- the helper app is the machine-facing authoring surface
- a Codex skill may target the helper app directly without MCP

Grounding sources:

- `AGENTS.md`
- `docs/readme_support_docs/sdd-helper/README.md`
- `docs/future_explorations/mcp_server/sdd_mcp_server_design.md`
- `src/authoring/contracts.ts`
- `src/cli/helperDiscovery.ts`

The current helper surface in this note was also verified by running `TMPDIR=/tmp pnpm sdd-helper capabilities`.

## 2. Non-Negotiable Skill Invariants

An `sdd-skill` should treat the following as hard rules.

### 2.1 Mutation Must Go Through The Helper

The skill should not perform raw text edits against `.sdd` files when the intent is structural authoring.

For create, edit, reorder, and undo flows, the skill should use:

- `sdd-helper create`
- `sdd-helper apply`
- `sdd-helper undo`

This preserves the repo's revision-bound, handle-based authoring model instead of teaching the skill to hand-edit source text.

### 2.2 Inspect Before Mutate

For edits to existing documents, the skill should obtain fresh handle and revision data from:

- `sdd-helper inspect <document_path>`

The skill should build change requests from the returned `revision` and handles. It should not reuse stale handles across later turns without a fresh inspect.

### 2.3 Dry-Run Before Commit

For non-trivial edits, the skill should prefer:

1. `apply` with omitted `mode` or `mode: "dry_run"`
2. inspect returned summary and diagnostics
3. only then `apply` with `mode: "commit"` if the user wants the change carried out

This maps to the helper contract and keeps the skill review-friendly.

### 2.4 Keep Paths Repo-Relative And `.sdd`-Scoped

The skill should treat helper path inputs as repo-relative `.sdd` paths only. It should not invent absolute helper paths or broaden into arbitrary file manipulation.

### 2.5 Treat Helper Result Kinds As The Public Interface

The skill should reason from helper result kinds and contracts rather than from implementation details:

- `sdd-document-inspect`
- `sdd-search-results`
- `sdd-create-document`
- `sdd-change-set`
- `sdd-preview`
- `sdd-git-status`
- `sdd-git-commit`
- `sdd-helper-error`

## 3. What The Skill Should Actually Do

The skill should be a workflow layer, not a semantic layer.

It should help Codex:

- decide which helper command to call
- choose safe sequencing
- translate user intent into change-set operations
- review helper diagnostics and change summaries
- know when to preview, when to undo, and when to stop

It should not:

- duplicate bundle rules into the skill text
- parse `.sdd` syntax itself
- encode a second mutation model separate from `ChangeOperation`
- bypass the helper because a direct text edit looks faster

## 4. Recommended Skill Folder Shape

The first version should stay lean.

```text
sdd-skill/
├── SKILL.md
├── references/
│   ├── workflow.md
│   ├── change-set-recipes.md
│   └── current-helper-gaps.md
├── scripts/
│   └── run_helper.sh
└── agents/
    └── openai.yaml
```

### 4.1 `SKILL.md`

This should be the only required file. It should contain:

- trigger conditions
- the default helper-first workflow
- mutation guardrails
- a small number of concrete command patterns
- directions for which reference files to open only when needed

It should stay short and avoid restating large chunks of helper documentation.

### 4.2 `references/workflow.md`

This should describe the normal operating patterns:

- inspect an explicit document
- search first when the target document is unknown
- dry-run apply
- commit apply
- preview after mutation when useful
- undo a prior committed change set

This file is a better place than `SKILL.md` for step-by-step command examples.

### 4.3 `references/change-set-recipes.md`

This should map common user intents to helper change operations, for example:

- rename a node -> `set_node_name`
- change a property -> `set_node_property`
- remove a property -> `remove_node_property`
- add a relation -> `insert_edge_line`
- remove a relation -> `remove_edge_line`
- reorder top-level nodes -> `reposition_top_level_node`
- reorder structural children -> `reposition_structural_edge`
- move nested blocks -> `move_nested_node_block`

The value of this file is not semantic authority. Its value is that it gives the skill a compact cookbook for building request bodies consistently.

### 4.4 `references/current-helper-gaps.md`

This should explicitly list what the helper does not expose today, so the skill does not quietly promise more than the repo currently supports.

Examples:

- no standalone helper command for projection readout
- no standalone helper command for validation-only readout
- no surfaced helper `list` command in the current CLI
- document creation currently always bootstraps an empty document

### 4.5 `scripts/run_helper.sh`

This script is optional, but likely useful.

Its job would be to make helper invocation reliable across local environments by:

- running from repo root
- setting `TMPDIR=/tmp`
- sourcing `~/.nvm/nvm.sh` if `pnpm` or `node` is missing from the shell
- delegating to `pnpm sdd-helper ...`

That keeps environment quirks out of `SKILL.md`.

If this script is added, it should be a thin wrapper only. It should not become a second helper API.

### 4.6 `agents/openai.yaml`

This is optional but recommended so the skill appears cleanly in Codex UI.

## 5. Recommended `SKILL.md` Shape

Below is a plausible outline for the actual skill body.

### 5.1 Frontmatter

```yaml
---
name: sdd-skill
description: Use when working with Structured Design Documents in this repository through the helper app: inspect repo-relative .sdd files, search graph content, create documents, plan and apply structured change sets, render previews, undo helper-managed changes, and perform narrow .sdd-scoped git checks and commits without raw file editing.
---
```

### 5.2 Suggested Body Sections

1. What this skill is for
2. Quick start
3. Default workflow
4. Edit safety rules
5. When to preview
6. When to use helper git commands
7. Reference map

### 5.3 Suggested Quick Start

The quick start in `SKILL.md` can stay very short:

- start with `pnpm sdd-helper capabilities` if the surface may have changed
- use `search` only when the user has not identified a target document
- use `inspect` before any edit to obtain fresh revision and handles
- prefer `apply` dry-run first
- use `preview` when a rendered view will help confirm the change
- use `undo` for helper-managed reversal

### 5.4 Suggested Edit Safety Rules

The core rules in `SKILL.md` should likely be:

- Do not hand-edit `.sdd` structure when the helper supports the operation.
- Treat helper JSON as the public contract.
- Do not construct handles manually.
- Do not commit changes on the first pass unless the user clearly asked for a real mutation.
- When `sdd-change-set` returns `status: "rejected"`, treat that as a domain result to interpret, not as a shell failure.
- When the helper returns `sdd-helper-error`, stop and fix the invocation or environment first.

## 6. Recommended Skill Workflow

### 6.1 Read / Orient

If the user names a document:

1. run `inspect`
2. summarize relevant nodes, properties, and structural handles
3. only then plan a change set

If the user does not name a document:

1. run `search`
2. identify the most likely candidate paths
3. inspect the best candidate

### 6.2 Create

For a new SDD document:

1. call `sdd-helper create <path> --version 0.1`
2. inspect the created path if follow-on edits are needed
3. apply follow-on change sets normally

### 6.3 Edit

For edits to an existing document:

1. run `inspect`
2. build an `ApplyChangeSetArgs` request using returned handles and `base_revision`
3. include `validate_profile` when the change should be checked immediately
4. include `projection_views` when a post-change projection view will help confirm semantics
5. dry-run first
6. if acceptable, re-submit with `mode: "commit"`

### 6.4 Preview

Use `preview` when the user needs rendered confirmation, especially for:

- view-sensitive structural changes
- diagram quality review
- proof that a change had the intended visible effect

Do not confuse preview with semantic projection. Preview is a render artifact.

### 6.5 Undo

Use `undo` when the user wants to reverse a helper-managed committed change set.

The skill should retain or report the relevant `change_set_id` when practical, because that is the handle for helper-managed reversal.

### 6.6 Git

Use helper git commands only for narrow `.sdd`-scoped workflows:

- `git-status` when checking SDD-local status
- `git-commit` when the user wants a commit limited to explicit `.sdd` paths

The skill should not treat helper git commands as a replacement for general Git usage in the repo.

## 7. Current Helper Surface And Its Consequences For The Skill

The current helper is strong enough for a useful first skill, but the skill should be shaped around today's actual CLI, not the wider future design.

### 7.1 What The Skill Can Reliably Do Today

- inspect one document structurally
- search graph content across `.sdd` files
- create a new empty document
- apply structured change sets
- undo committed helper-managed change sets
- render SVG or PNG previews
- check narrow `.sdd` git status
- commit explicit `.sdd` paths

### 7.2 What The Skill Should Not Pretend Exists Yet

- standalone helper `project` command
- standalone helper `validate` command
- standalone helper `list documents` command
- richer bootstrap or starter-pack flows beyond the current empty create path

Where the skill needs semantic confirmation after mutation, it should prefer:

- `apply` with `validate_profile`
- `apply` with `projection_views`
- `preview` when rendered output matters

## 8. Good First Version

A good v0 skill does not need to be ambitious.

The first useful slice could be:

- target this repository only
- use the helper app only
- support inspect, search, create, apply, undo, preview
- document helper git commands as optional, not default
- keep one default flow: inspect -> dry-run apply -> commit apply -> preview if needed

That would already make the skill materially useful for SDD authoring without forcing MCP into the critical path.

## 9. Follow-On Improvements

Once the first version works well, likely follow-ons are:

1. Add a small wrapper script for helper invocation reliability if shell environment friction appears often.
2. Add recipe examples for the most common `ChangeOperation` combinations.
3. Add a repo-specific "choose view/profile" reference once preview usage patterns are clearer.
4. Revisit the skill once helper gains standalone projection or validation reads.
5. Only after the helper workflow feels proven, mirror the same task shapes through MCP.

## 10. Recommendation

If this repo wants to try a skill soon, the best next move is not to build a broad or clever skill. It is to build a narrow `sdd-skill` that:

- trusts `sdd-helper` as the machine interface
- stays explicit about helper limitations
- teaches one safe authoring workflow well
- leaves semantic authority in the repo bundle and shared authoring contracts

That would give the project a real Codex-facing authoring surface now, while still leaving MCP as the later reusable protocol surface.
