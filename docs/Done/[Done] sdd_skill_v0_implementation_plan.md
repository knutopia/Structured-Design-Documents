# [Done] SDD Skill V0 Implementation Plan

Status: active implementation plan for the first installable `sdd-skill`

Audience: maintainers creating a repo-tracked Codex skill that relies on `sdd-helper`

## 1. Summary

Create a repo-tracked, installable `sdd-skill` whose canonical source lives at `skills/sdd-skill/`, plus the skill implementation plan in `docs/`.

The v0 skill is intentionally narrow and helper-first. It should teach safe workflows for:

- searching `.sdd` documents
- inspecting source structure
- creating new documents
- planning and dry-running change sets
- committing change sets when asked
- generating previews
- undoing helper-managed changes
- checking narrow `.sdd`-scoped git status and committing explicit `.sdd` paths

This work does not change helper code, bundle contracts, MCP behavior, or any part of the runtime. It adds only repo-tracked documentation and installable skill artifacts.

Design background lives in [docs/future_explorations/sdd_skill/sdd_skill_structure.md](./future_explorations/sdd_skill/sdd_skill_structure.md). That note remains exploratory context. This document is the execution-facing source of truth for v0.

## 2. Locked Decisions

The v0 implementation uses these defaults:

- canonical skill source lives at `skills/sdd-skill/`
- v0 scope is `SKILL.md` plus `references/` plus a thin helper wrapper script
- `agents/openai.yaml` is deferred
- no helper, API, bundle, or runtime changes are part of this milestone
- installation from repo source is a follow-on step after these files land

The skill must match the currently verified helper surface. It may refer only to these helper commands:

- `inspect`
- `search`
- `create`
- `apply`
- `undo`
- `preview`
- `git-status`
- `git-commit`

The skill must not promise standalone helper commands that do not exist today, including:

- `project`
- `validate`
- `list documents`

Where semantic confirmation is needed after an edit, the skill should direct Codex to use:

- `apply` with `validate_profile`
- `apply` with `projection_views`
- `preview` when rendered confirmation is helpful

## 3. Deliverables

Create the following files:

- `skills/sdd-skill/SKILL.md`
- `skills/sdd-skill/references/workflow.md`
- `skills/sdd-skill/references/change-set-recipes.md`
- `skills/sdd-skill/references/current-helper-gaps.md`
- `skills/sdd-skill/scripts/run_helper.sh`

### 3.1 `SKILL.md`

`SKILL.md` should stay concise and trigger-focused. It should include:

- frontmatter with `name: sdd-skill`
- a repo-specific description keyed to Structured Design Documents and `sdd-helper`
- quick start
- default workflow
- edit safety rules
- when to preview
- when to use helper git commands
- a reference map pointing to the three reference files

### 3.2 Reference Files

`references/workflow.md` should document the normal skill workflow:

- search when the target document is unknown
- inspect before editing
- create for empty-document bootstrapping
- dry-run `apply` first
- commit `apply` only when appropriate
- preview when visible confirmation helps
- undo helper-managed changes

`references/change-set-recipes.md` should map common authoring intents to the current `ChangeOperation` vocabulary in `src/authoring/contracts.ts`.

`references/current-helper-gaps.md` should explicitly describe what the skill does not have available through the current helper surface.

### 3.3 Wrapper Script

The wrapper at `skills/sdd-skill/scripts/run_helper.sh` should be a thin environment-normalization wrapper only. In an installed skill copy, the same file is available as `scripts/run_helper.sh` relative to the installed skill directory. Its responsibilities are:

- use `#!/usr/bin/env bash` and `set -euo pipefail`
- resolve the repo root without hardcoding an absolute path
- `cd` to repo root before invoking the helper
- set `TMPDIR=/tmp`
- if `pnpm` or `node` is missing, source `~/.nvm/nvm.sh` and retry resolution
- end with `exec pnpm --silent sdd-helper "$@"` so the wrapper preserves the helper's JSON-only output

The script must not add helper semantics, request shaping, or fallback mutation behavior.

Because the installed skill will live outside the repo, the wrapper should work for both:

- the canonical source copy in `skills/sdd-skill/`
- the installed skill copy used while the current working directory is inside an SDD repo checkout

## 4. Proof Tasks And Acceptance

Proof tasks for this milestone:

1. `skills/sdd-skill/scripts/run_helper.sh capabilities` returns helper capability JSON.
2. `skills/sdd-skill/scripts/run_helper.sh search --query claim --under bundle/v0.1/examples --limit 1` works through the wrapper.
3. `skills/sdd-skill/scripts/run_helper.sh inspect bundle/v0.1/examples/outcome_to_ia_trace.sdd` works through the wrapper.
4. One dry-run `apply` example can be executed by first obtaining fresh handles via `inspect`, then submitting an `ApplyChangeSetArgs` request without mutating repo-tracked files.
5. One preview example is documented and runnable against a currently usable view/backend path.
6. The skill text stays aligned with `src/authoring/contracts.ts` and `pnpm sdd-helper capabilities`.

Acceptance criteria:

- another engineer can install the skill from `skills/sdd-skill/` without editing its contents
- the installed skill is usable immediately for read/orient and dry-run authoring
- the skill stays clearly helper-first
- the skill does not instruct raw `.sdd` text editing for structural mutations

## 5. Out Of Scope

The following are explicitly deferred:

- `agents/openai.yaml`
- helper feature additions
- helper interface redesign
- MCP implementation
- generalizing the skill beyond this repository layout
- adding raw text edit guidance for structural SDD authoring
