# AEB Places Flow illustrations

[View both figures](index.html).

Figure 2 shows product help and the glossary as two separate downward routes. Home repeats with the same identity so each route can be followed independently. Figure 8 shows Community leading to a topic, then branching to two public posts or sign-in. Each alternative has its own connector.

These are one-off illustrations using the original IA content and SDD appearance, with deliberately chosen placement and routing. They do not register a new SDD diagram type or modify the existing renderer.

## Files

- `figure-02.mjs` and `figure-08.mjs`: figure-specific placement and routing.
- `common.mjs`: original SDD loading, bundle-driven projection and IA label formatting, measured text, shared SDD theme, SVG painting and PNG rasterization.
- `figure-02-places-flow.svg` and `figure-08-places-flow.svg`: portable vector figures with embedded Public Sans fonts.
- Corresponding `.png` files: SVG-derived images at twice the vector dimensions.
- Corresponding `.geometry.json` files: measured boxes, source identities and connector points.
- `ARCHITECTURE.md`: analysis, authority, layout decisions and acceptance criteria, written before implementation.
- `verify.mjs`, `verification.json` and `visual-review.json`: independent automated checks and recorded visual review.

## Regenerate

Run from the SDD repository root with its existing dependencies and compiled `dist` available:

```bash
TMPDIR=/tmp node oneoffs/aeb-places-flow/figure-02.mjs
TMPDIR=/tmp node oneoffs/aeb-places-flow/figure-08.mjs
TMPDIR=/tmp node oneoffs/aeb-places-flow/verify.mjs
```

The verifier itself regenerates both figures twice and checks byte equality. If `dist` is absent or stale, first run `TMPDIR=/tmp pnpm run build`.

The default input is `/home/knut/projects/aeb_sdd/aeb_help_center_de.sdd`. Set `AEB_SDD_SOURCE` to use a different path to the same document; set `SDD_REPO` if these utilities are moved outside this repository. Outputs are written beside the utilities. Neither command writes to the original SDD or report.

Selection uses original named diagrams `DG-011` and `DG-026`. Figure 8 in the report was saved as `figure-09-community-paths.svg`; the newsletter figure is unrelated. Content comes through the loaded v0.2 bundle, compiler, named projection and IA render model. Literal Place IDs in the composition specify placement for these proof cases, not language semantics.

## Acceptance

Figure 2 preserves eight unique Places and seven navigation occurrences; Figure 8 preserves five Places and four navigation occurrences. All titles, type/ID decorators and event labels retain the source content. Automated checks cover exact occurrence selection, text fitting, endpoint attachment, crossings, overlapping routes, label collisions, embedded fonts, SVG-derived PNGs and deterministic regeneration.

The final raster figures were visually inspected at native scale and at representative report widths: 800 px for Figure 2 and 1040 px for Figure 8. Paths remain distinct and full titles are readable. No core acceptance mismatch remained. The review page preserves minimum image widths and allows horizontal scrolling in narrow windows.

Browser rendering could not be checked in this environment: the in-app connection failed to initialize and the separate preview browser was not installed. Image review used SVG rasterization with the vendored fonts; the HTML received static link and sizing checks.

## What this establishes

These cases work with Place navigation as the organizing structure. Extra ScenarioSteps and realization links are unnecessary for explaining these routes. A future Places Flow view could retain IA node and edge presentation while using navigation to assign progression and branch lanes. These two fixed compositions establish useful visual targets; they do not establish a general layout algorithm for cycles, joins or large graphs.
