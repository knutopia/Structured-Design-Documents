# Hardened Shared-Evidence Reasoning-Effort Comparison

Run directory: `/home/knut/projects/sdd/experiments/grafsys-com-reasoning-effort/hardened-shared-evidence-run`

## Evidence

Shared evidence was captured once from `https://grafsys.com/` and reused by all workers. The evidence bundle contains a manifest, desktop homepage snapshot, mobile homepage snapshot, and summary. The manifest records safe Playwright MCP use only:

- `browser_navigate`
- `browser_snapshot`
- `browser_resize`

`browser_run_code_unsafe` was not used. The initial navigation failed because `chrome-for-testing` was not installed; after browser backend installation, desktop snapshot capture succeeded. Mobile resize and mobile snapshot also succeeded after a long delay.

Evidence scope was narrow: one observed homepage, a skip link, a main article with brand heading/logo/tagline, a footer home link, and an external WordPress attribution link. No additional same-site navigation pages, forms, APIs, backend systems, products, or hidden pages were evidenced.

## Required Artifact Verification

All four worker folders contain the required successful artifacts:

| Effort | `grafsys.sdd` | `author-request.json` | validation | IA projection | UI projection | IA SVG | UI SVG | README | Blocked |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| low | present | present | present | present | present | present | present | present | no |
| medium | present | present | present | present | present | present | present | present | no |
| high | present | present | present | present | present | present | present | present | no |
| xhigh | present | present | present | present | present | present | present | present | no |

Additional worker-specific artifacts were also produced, such as preview results for `low`, dry-run/commit result JSON for `xhigh`, and progress logs for all workers.

## Validation And Render Status

| Effort | Validation outcome | Errors | Warnings | IA nodes | IA edges | UI nodes | UI edges | IA SVG bytes | UI SVG bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| low | acceptable | 0 | 0 | 2 | 2 | 10 | 9 | 61051 | 66785 |
| medium | acceptable | 0 | 0 | 2 | 1 | 11 | 10 | 61096 | 66819 |
| high | acceptable | 0 | 0 | 2 | 2 | 13 | 12 | 61073 | 66811 |
| xhigh | acceptable | 0 | 0 | 4 | 5 | 15 | 13 | 63025 | 66710 |

Both SVG diagrams are present and non-empty for every reasoning effort.

## Recovery Behavior

| Effort | Recovery observed |
| --- | --- |
| low | Recovered from helper wrapper `Permission denied` by invoking the skill wrapper through `bash`; repaired invalid SDD node IDs; replaced invalid `COMPOSED_OF` endpoint pairs with bundle-valid relationships; used skill helper preview after direct `pnpm sdd show` hit Corepack/DNS setup problems. |
| medium | Recovered from helper wrapper `Permission denied`; repaired invalid SDD node IDs; repaired nested authoring/metadata issues; needed a status nudge during rendering; used skill helper preview after direct `pnpm sdd show` hit Corepack/network setup problems. |
| high | Recovered from helper wrapper `Permission denied`; repaired an initial dry-run rejected for invalid `Component COMPOSED_OF Component` edges and IA metadata; used `node dist/cli/main.js show` after `pnpm` hit the WSL/Corepack path issue. |
| xhigh | Recovered from helper wrapper `Permission denied`; recovered from missing `jq` by using Node for JSON inspection; repaired first dry-run Place metadata warnings before commit; used `node dist/cli/main.js show` after `pnpm` hit the WSL/Corepack path issue; needed status nudges during discovery/authoring/README completion. |

No worker wrote `BLOCKED.md`. No worker created a git commit.

## Modeling Comparison

All four outputs stayed within the shared evidence boundary and avoided invented backend APIs, forms, data entities, products, or hidden pages.

The IA models differ mainly by how much they promote observed link targets:

- `low`: one Area and one Homepage Place, with a self-navigation edge for the footer home link.
- `medium`: one Area and one Homepage Place, with the simplest IA edge structure.
- `high`: one Area and one Homepage Place, with an explicit footer-home navigation event.
- `xhigh`: one Area, Homepage Place, in-page `#content` anchor Place, and external WordPress target Place. This increases IA coverage but treats visible link destinations as Places more aggressively than the other workers.

The UI contract models differ by interaction detail:

- `low`: models the visible structure and footer links, but with fewer explicit events.
- `medium`: adds an event for the skip link and keeps the footer links as components.
- `high`: models skip, footer-home, and WordPress link activation events.
- `xhigh`: models the same visible components plus explicit navigation targets for the skip link, footer home link, and external attribution link.

Node ID conventions vary across workers (`GS-*`, `A-*`, `P-*`, `C-*`, `AR-*`, `PL-*`, `CMP-*`). All IDs validated, but the outputs are not directly comparable by node ID alone; comparison should map by node kind and label.

The `primary_nav` interpretation also differs. `low` and `medium` set the homepage as primary navigation, while `high` and `xhigh` set `primary_nav=false`, matching the evidence summary's note that no visible same-site navigation menu was present.

## Overall Result

The hardened shared-evidence rerun succeeded for all four reasoning-effort levels. The helper/skill hardening allowed each worker to recover from repairable authoring or environment failures instead of stopping at the first bad result. The remaining differences are modeling choices and local environment recovery paths, not validation or rendering failures.
