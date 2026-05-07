# Shared-Evidence Grafsys Reasoning Comparison

## Evidence Gate

The shared evidence gate passed. Safe Playwright MCP captured desktop and mobile accessibility snapshots for `https://grafsys.com/`. `browser_run_code_unsafe` was not used.

Evidence files:

- `evidence/evidence-manifest.json`
- `evidence/evidence-summary.md`
- `evidence/homepage.desktop.snapshot.md`
- `evidence/homepage.mobile.snapshot.md`

The captured site surface was small: one homepage, a skip link, main article, H1, logo image, tagline paragraph, footer home link, and external WordPress attribution link.

## Outcome Matrix

| Effort | Outcome | Validation | IA Projection | UI Contracts Projection | SVG Renders |
| --- | --- | --- | --- | --- | --- |
| low | completed | 0 errors, 0 warnings | 2 nodes, 2 edges | 10 nodes, 9 edges | IA and UI SVGs rendered |
| medium | blocked | not run | not generated | not generated | not generated |
| high | blocked | not run | not generated | not generated | not generated |
| xhigh | completed | 0 errors, 0 warnings | 2 nodes, 2 edges | 14 nodes, 13 edges | IA and UI SVGs rendered |

## Comparison

- `low` produced a compact valid model. It modeled the homepage IA, one observed view state, and the visible components. It did not create explicit `Event` nodes, so the UI contracts projection is smaller.
- `xhigh` produced a richer valid model from the same evidence. It kept the same IA size but added explicit event contracts for the skip link, footer home link, and WordPress attribution link, plus the attribution image component.
- `medium` blocked during helper author dry-run. The persisted SDD remained the helper-created bootstrap. The blocking diagnostic was `parse.invalid_edge_line`, likely from an authored `TRANSITIONS_TO` edge effect value with unparseable spaces.
- `high` blocked during helper author dry-run. The persisted SDD remained the helper-created bootstrap. Blocking diagnostics included `parse.invalid_node_header`, `parse.expected_top_level_block`, and `parse.minimum_top_level_blocks`.

## Artifact Status

Completed outputs:

- `low/grafsys.sdd`
- `low/validation.simple.json`
- `low/projection.ia_place_map.json`
- `low/projection.ui_contracts.json`
- `low/grafsys.ia_place_map.simple.svg`
- `low/grafsys.ui_contracts.simple.svg`
- `low/README.md`
- `xhigh/grafsys.sdd`
- `xhigh/validation.simple.json`
- `xhigh/projection.ia_place_map.json`
- `xhigh/projection.ui_contracts.json`
- `xhigh/grafsys.ia_place_map.simple.svg`
- `xhigh/grafsys.ui_contracts.simple.svg`
- `xhigh/README.md`

Blocked outputs:

- `medium/BLOCKED.md`
- `medium/author-dry-run-result.json`
- `high/BLOCKED.md`
- `high/author-dry-run-result.json`

## Notes

- All four workers consumed the same shared evidence folder.
- Workers were instructed not to call Playwright MCP.
- No worker created a git commit.
- The main differentiator between successful outputs is UI contract detail: `xhigh` modeled explicit events while `low` stayed closer to structural components only.

