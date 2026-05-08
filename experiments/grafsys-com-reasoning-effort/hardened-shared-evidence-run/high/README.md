# Grafsys SDD High Reasoning-Effort Run

## Evidence Used

Only the shared evidence folder was used for site facts:

- `evidence-manifest.json`
- `evidence-summary.md`
- `homepage.desktop.snapshot.md`
- `homepage.mobile.snapshot.md`

The evidence supports one public homepage at `https://grafsys.com/` with title `Graf Systems - Solutions & Design`, a skip link to `#content`, the heading/logo name `Graf Systems`, tagline text `Solutions & Design by Knut Graf`, a footer home link, and an external WordPress attribution link.

## Modeling Assumptions

- The IA contains one public site area and one observed homepage place.
- The footer `Graf Systems` link is modeled as a same-place navigation because it targets `https://grafsys.com/`.
- The UI contract models only observed accessible structure and links: skip link, main article, heading, logo image, tagline, footer, footer home link, WordPress attribution link, and activation events for the observed links.
- No backend APIs, forms, products, hidden pages, data entities, or system actions were modeled because the evidence does not support them.

## Validation And Projection

- `validation.simple.json`: `acceptable`, 0 errors, 0 warnings, `can_render=true`.
- `projection.ia_place_map.json`: `acceptable`, no diagnostics, `can_render=true`.
- `projection.ui_contracts.json`: `acceptable`, no diagnostics, `can_render=true`.

## Render Status

Rendered SVG artifacts were created with the staged renderer through `node dist/cli/main.js show`:

- `grafsys.ia_place_map.simple.svg`
- `grafsys.ui_contracts.simple.svg`

Both SVG files are non-empty and declare the expected view/profile metadata.

## Recovery Notes

- Direct helper wrapper execution returned `Permission denied`, so helper commands were run as `bash skills/sdd-skill/scripts/run_helper.sh ...`.
- The initial `author` dry-run was rejected by candidate validation because `Component COMPOSED_OF Component` edges were not allowed and IA metadata formats were invalid. The request was revised to use `CONTAINS` for component substructure, key:value `entry_points`, and `primary_nav=false`; the second dry-run passed and was committed.
- `TMPDIR=/tmp pnpm sdd show --help` failed during corepack startup while trying to create `/mnt/c/Users/Knut/AppData/Local/node/corepack/v1`. Rendering continued through the built CLI directly with `node dist/cli/main.js show`.
