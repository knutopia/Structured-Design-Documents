# AGENTS.md

## Workspace Notes

- This repository is typically worked on inside WSL.
- Non-interactive login shells should have `node` and `pnpm` available via `nvm` from `~/.profile`.
- If a shell still does not see `node` or `pnpm`, use:
  `source ~/.nvm/nvm.sh && <command>`

## Test And CLI Commands

- Prefer running Node-based commands from repo root.
- For Vitest and any command that may create temporary files, set:
  `TMPDIR=/tmp`
- Recommended examples:
  `TMPDIR=/tmp pnpm test`
  `TMPDIR=/tmp pnpm sdd --help`
  `TMPDIR=/tmp pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map`

## Known Environment Quirk

- In this WSL setup, default temp resolution may point at `/mnt/c/TEMP`, which can fail with `EACCES`.
- `TMPDIR=/tmp` avoids that problem and should be the default for test runs.
