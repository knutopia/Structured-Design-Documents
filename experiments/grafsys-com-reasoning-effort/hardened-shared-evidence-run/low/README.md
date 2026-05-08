# Grafsys SDD

This folder contains the low reasoning-effort SDD output for `https://grafsys.com/`, based only on the shared evidence folder:

`/home/knut/projects/sdd/experiments/grafsys-com-reasoning-effort/hardened-shared-evidence-run/evidence`

## Evidence Boundary

Modeled facts:

- Homepage URL: `https://grafsys.com/`
- Page title: `Graf Systems - Solutions & Design`
- Skip link: `Skip to content` targeting `#content`
- Main article with H1 `Graf Systems`
- Logo image with accessible name `Graf Systems`
- Text: `Solutions & Design by Knut Graf`
- Footer same-site home link labeled `Graf Systems`
- Footer external WordPress attribution link labeled `Create a website or blog at WordPress.com`
- Desktop and mobile snapshots expose the same accessibility structure.

Not modeled:

- Backend systems, forms, APIs, products, hidden pages, uncaptured navigation, or additional same-site pages.

## Outputs

- `grafsys.sdd`: authored SDD document.
- `author-request.json`: sdd-helper author request used for the committed scaffold.
- `validation.simple.json`: simple profile validation result.
- `projection.ia_place_map.json`: IA Place Map projection.
- `projection.ui_contracts.json`: UI Contracts projection.
- `preview.ia_place_map.simple.json`: helper preview result for IA SVG.
- `preview.ui_contracts.simple.json`: helper preview result for UI Contracts SVG.
- `grafsys.ia_place_map.simple.svg`: rendered IA Place Map SVG.
- `grafsys.ui_contracts.simple.svg`: rendered UI Contracts SVG.

## Validation And Render Status

- Validation profile: `simple`
- Validation result: 0 errors, 0 warnings
- IA render: successful via `sdd-helper preview`
- UI Contracts render: successful via `sdd-helper preview`

## Recovery Notes

- Direct execution of `skills/sdd-skill/scripts/run_helper.sh` returned permission denied, so helper calls were run through `bash`.
- First author dry-run failed because node IDs did not match the bundle SDD ID pattern. IDs were revised to `GS-001` style.
- Second author dry-run failed because several `COMPOSED_OF` endpoint pairs were invalid under the simple profile. Bundle contracts were checked and those relationships were changed to `CONTAINS` where required.
- `pnpm sdd show --help` failed first on Corepack state under `/mnt/c`, then on DNS while trying to download pnpm. Rendering recovered through `sdd-helper preview`, and the returned SVG artifacts were copied into this folder.
