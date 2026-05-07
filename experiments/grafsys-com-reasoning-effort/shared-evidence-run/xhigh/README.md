# Grafsys Shared-Evidence SDD

Reasoning effort: xhigh
Profile: simple

## Evidence Used

- Shared evidence folder: `experiments/grafsys-com-reasoning-effort/shared-evidence-run/evidence`
- Homepage URL: `https://grafsys.com/`
- Page title: `Graf Systems - Solutions & Design`
- Evidence files read:
  - `evidence-summary.md`
  - `evidence-manifest.json`
  - `homepage.desktop.snapshot.md`
  - `homepage.mobile.snapshot.md`

Observed structure modeled:

- Skip link to `#content`.
- Main article containing H1 `Graf Systems`, logo image with accessible name `Graf Systems`, and paragraph `Solutions & Design by Knut Graf`.
- Footer with same-site `Graf Systems` home link to `https://grafsys.com/`.
- Footer with external WordPress attribution link to `https://wordpress.com/?ref=footer_custom_svg` and its attribution image.
- Desktop and mobile snapshots expose the same accessibility structure.

## Modeling Assumptions

- The IA model contains one public site Area and one observed Homepage Place.
- The footer home link is represented as a same-page `NAVIGATES_TO` relationship from the Homepage Place to itself, annotated with the observed activation event.
- The UI contracts model uses one default Homepage ViewState and observed Components/Events only.
- No DataEntity, SystemAction, BINDS_TO, DEPENDS_ON, backend systems, APIs, forms, products, or hidden pages were added because the shared evidence does not support them.

## Status

- `grafsys.sdd` was created with helper `create` and populated with helper `author`.
- Author dry-run initially failed because descriptive node IDs did not satisfy the bundle `id_pattern`; the request was revised to bundle-valid IDs such as `P-001`, `VS-001`, `C-001`, and `E-001`.
- Final author dry-run was clean and commit-eligible.
- Final helper author commit succeeded.
- `validation.simple.json`: 0 errors, 0 warnings, render-eligible.
- `projection.ia_place_map.json`: 2 nodes, 2 edges, 0 diagnostics.
- `projection.ui_contracts.json`: 14 nodes, 13 edges, 0 diagnostics.
- SVG renders completed:
  - `grafsys.ia_place_map.simple.svg`
  - `grafsys.ui_contracts.simple.svg`

## Deviations

- No Playwright MCP tools were called by this worker; only shared evidence files were consumed.
- The evidence had no screenshot artifacts, so the SDD is based on accessibility snapshots and manifest/summary facts only.
- No additional same-site pages were visible, so no additional Place nodes were inferred.
