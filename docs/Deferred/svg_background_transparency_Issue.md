# SVG background transparency Issue

**kg:**
In the page [index.md](docs/doc_site/index.md) (lines 45-48) the images

== Information Architecture Diagram
![small app information architecture diagram](./small_app_example/small_app_ia_1.png)
== UI Contracts Diagram
![small app ui contracts diagram](./small_app_example/small_app_uic_1.png)

...render with transparent background, giving them rounded edges - good. They are PNGs.

In other pages on the site, images (which are SVGs) render with white backgrounds (obscuring the rounded edges) - bad.

For example: [index.md](docs/doc_site/diagram_types/index.md) line 16:
  ![svg](../../../examples/rendered/v0.1/ia_place_map_diagram_type/outcome_to_ia_trace_example/simple_profile/outcome_to_ia_trace.ia_place_map.svg) 

This happens despite the fact that the PNGs are actually derived from SVG sources. Is there a way to give the SVGs proper transparent backgrounds? Is this a SVG format limitation, a browser-rendering limitation, something specific about how our rendering pipelines generate SVGs, or something else?

(Browser is Firefox on win 11)

Do not write any code.

**Codex:**
Yes—SVG supports transparency, and Firefox is behaving normally. This is caused by the staged rendering pipeline, combined with a difference between browser and PNG rasterizer behavior.

The generated SVG contains two backgrounds:

- A rectangular CSS background on the root SVG: `.staged-svg { background: #f7f8fb; }` in the [rendered SVG](/home/knut/projects/sdd/examples/rendered/v0.1/ia_place_map_diagram_type/outcome_to_ia_trace_example/simple_profile/outcome_to_ia_trace.ia_place_map.svg:12).
- A rounded `<rect>` covering the diagram canvas in the [same SVG](/home/knut/projects/sdd/examples/rendered/v0.1/ia_place_map_diagram_type/outcome_to_ia_trace_example/simple_profile/outcome_to_ia_trace.ia_place_map.svg:48).

Firefox paints the root SVG’s CSS background across the entire rectangular viewport. That fills the areas outside the rounded rectangle, hiding the rounded corners.

The PNG converter behaves differently. The pipeline rasterizes the SVG using Resvg in [svgArtifacts.ts](/home/knut/projects/sdd/src/renderer/svgArtifacts.ts:92). Resvg does not paint that root-element CSS `background`, so only the rounded `<rect>` is rendered and the pixels outside it remain transparent. I confirmed that both the small-app PNGs and the current corresponding rendered PNG have alpha-zero pixels in all four corners.

The root background is deliberately emitted by [svgBackend.ts](/home/knut/projects/sdd/src/renderer/staged/svgBackend.ts:551). Its near-white color comes from `canvasBackground` in [theme.ts](/home/knut/projects/sdd/src/renderer/staged/theme.ts:280). The rounded rectangle separately uses `palette.canvas`, currently the same color, at [theme.ts](/home/knut/projects/sdd/src/renderer/staged/theme.ts:303).

The documentation site is not adding the white field:

- The generated markup is an ordinary `<img>` pointing at the SVG.
- The site’s custom stylesheet has no image-background rule.
- The lightbox overlay is explicitly transparent in [Layout.vue](/home/knut/projects/sdd/docs/doc_site/.vitepress/theme/Layout.vue:21).

The clean conceptual solution is to leave the SVG viewport transparent and let the existing rounded root rectangle provide the visible canvas color. In other words, the actual SVG geometry should own the diagram background; the rectangular CSS background on the root SVG is redundant and causes the mismatch.

Adding border-radius or clipping to the site’s `<img>` elements could hide the problem visually, but it would only be a presentation workaround. The downloaded SVG and other consumers would still contain the rectangular background. No files were changed.