This directory contains the vendored preview font assets used by CLI preview rendering.

- `PublicSans-Regular.woff` is the official Public Sans `v2.001` webfont used for Graphviz-backed SVG layout and embedded SVG output.
- `PublicSans-Regular.otf` is the official Public Sans `v2.001` desktop font used for PNG rasterization via `resvg-js`.
- `PublicSans-OFL.txt` contains the required SIL Open Font License text and attribution for redistribution.

When refreshing the preview font:

- update both the WOFF and OTF assets from the same upstream Public Sans release
- keep `bundle/v0.1/core/views.yaml` in sync with both asset paths
- preserve the matching license text in this directory
