# SDD Skill Observation: `shop_sched_exploration`

Date: 2026-04-16

## Purpose

Execute the `sdd-skill` workflow for:

- create a new SDD named `shop_sched_exploration`
- show the information architecture as a simple diagram
- include:
  - Dashboard
  - a Mechanic Scheduling area with Open Shifts, Shift Detail, My Schedule

## Persisted Outputs

- `create.json`
- `inspect.json`
- `author_dry_run_request.json`
- `author_dry_run_response.json`
- `author_commit_request.json`
- `author_commit_response.json`
- `validate_simple.json`
- `project_ia_place_map.json`
- `show_simple.txt`

Saved artifacts beside the document:

- `/home/knut/projects/sdd/shop_sched_exploration.sdd`
- `/home/knut/projects/sdd/shop_sched_exploration.svg`

## Command Sequence

1. `TMPDIR=/tmp skills/sdd-skill/scripts/run_helper.sh create shop_sched_exploration.sdd --version 0.1`
2. `TMPDIR=/tmp skills/sdd-skill/scripts/run_helper.sh inspect shop_sched_exploration.sdd`
3. `TMPDIR=/tmp skills/sdd-skill/scripts/run_helper.sh author --request tmp/sdd_skill_observation_shop_sched_exploration/author_dry_run_request.json`
4. `TMPDIR=/tmp skills/sdd-skill/scripts/run_helper.sh author --request tmp/sdd_skill_observation_shop_sched_exploration/author_commit_request.json`
5. `TMPDIR=/tmp skills/sdd-skill/scripts/run_helper.sh validate shop_sched_exploration.sdd --profile simple`
6. `TMPDIR=/tmp skills/sdd-skill/scripts/run_helper.sh project shop_sched_exploration.sdd --view ia_place_map`
7. `TMPDIR=/tmp pnpm sdd show shop_sched_exploration.sdd --view ia_place_map --profile simple`

## Observations

- No helper `search` command was needed to complete this prompt.
- No `cat` commands were used in this run.
- `inspect` failed on the newly created empty bootstrap document because the created skeleton is intentionally parse-invalid until it is populated.
- The `revision` returned by `create` was sufficient to continue into `author`.
- The authoring dry run succeeded cleanly under the `simple` profile.
- Persisted validation reported 0 errors and 0 warnings.

