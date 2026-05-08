# Graf Systems SDD Output

This folder contains the medium reasoning-effort SDD worker output for `https://grafsys.com/`.

## Evidence Boundary

The SDD uses only the shared evidence in:

`experiments/grafsys-com-reasoning-effort/hardened-shared-evidence-run/evidence`

Modeled facts are limited to the captured homepage accessibility structure:

- Public homepage at `https://grafsys.com/`
- Page title `Graf Systems - Solutions & Design`
- Skip link to `#content`
- Main article with H1 `Graf Systems`
- Logo image with accessible name `Graf Systems`
- Text `Solutions & Design by Knut Graf`
- Footer home link labeled `Graf Systems`
- External WordPress attribution link
- Same exposed structure in desktop and 390x844 mobile snapshots

No backend systems, forms, APIs, products, hidden pages, or uncaptured navigation were modeled.

## Outputs

- `grafsys.sdd`: authored SDD document
- `author-request.json`: helper authoring request used to commit the SDD
- `validation.simple.json`: simple-profile validation result
- `projection.ia_place_map.json`: persisted IA projection
- `projection.ui_contracts.json`: persisted UI contracts projection
- `grafsys.ia_place_map.simple.svg`: simple-profile IA place map render
- `grafsys.ui_contracts.simple.svg`: simple-profile UI contracts render

## Recovery Notes

Direct `pnpm sdd show` rendering was not completed because Corepack first targeted a Windows temp/state path and then attempted a network download for pnpm. The escalated retry was interrupted by the user.

Recovery used the sdd-skill helper `preview` command for both requested simple SVG renders. Both preview calls returned acceptable assessments with no diagnostics, and the helper artifacts were copied into this folder.
