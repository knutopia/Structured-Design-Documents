# Grafsys Shared Evidence SDD

## Evidence Used

- `evidence-summary.md`
- `evidence-manifest.json`
- `homepage.desktop.snapshot.md`
- `homepage.mobile.snapshot.md`

Captured facts modeled:

- Homepage URL: `https://grafsys.com/`
- Page title: `Graf Systems - Solutions & Design`
- Skip link to `#content`
- Main article with H1 `Graf Systems`
- Logo image with accessible name `Graf Systems`
- Paragraph text: `Solutions & Design by Knut Graf`
- Footer home link `Graf Systems` to `https://grafsys.com/`
- External WordPress attribution link
- Desktop and mobile snapshots expose the same accessibility structure

## Assumptions

- The site has one observed IA area and one observed place: the homepage.
- The footer home link is represented as a same-place `NAVIGATES_TO` edge because no additional same-site pages were visible.
- UI contracts include only observed view structure and components.
- No DataEntity, SystemAction, forms, APIs, products, backend systems, or hidden pages were modeled.

## Validation And Render Status

- `validation.simple.json`: passed with zero diagnostics; persisted state is render-eligible.
- `projection.ia_place_map.json`: clean projection with 2 nodes and 2 edges.
- `projection.ui_contracts.json`: clean projection with 10 nodes and 9 edges.
- `grafsys.ia_place_map.simple.svg`: rendered successfully.
- `grafsys.ui_contracts.simple.svg`: rendered successfully.

## Deviations

- Initial nested helper dry-run produced parser diagnostics, so the committed authoring request uses top-level node blocks plus explicit relationships.
- Node IDs use bundle-valid IDs (`GS-001` through `GS-011`) because the active syntax requires uppercase prefix numeric identifiers.
- During request revision, an intermediate mechanical ID replacement was made in `author-request.json`; the final committed `.sdd` structure was still produced by the helper author workflow.
