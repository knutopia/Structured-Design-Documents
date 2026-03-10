This directory contains the vendored preview font assets used by CLI SVG and PNG rendering.

- `public-sans-latin-400-normal.woff` is sourced from `@fontsource/public-sans` and used as the shared default preview font.
- `PublicSans-OFL.txt` contains the required SIL Open Font License text and attribution for redistribution.

When updating the preview font, keep `bundle/v0.1/core/views.yaml` in sync with the asset path and preserve the matching license text in this directory.
