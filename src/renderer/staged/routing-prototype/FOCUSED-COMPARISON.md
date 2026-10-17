# Focused comparison — throwaway prototype 3

Open `focused-comparison-prototype.html` directly. It contains exactly three
static SVG crops, including embedded fonts, at one SVG unit per CSS pixel.

Question: can a local backward self-loop coexist with the actual working DG-002
forward/back pair, without changing either card or either existing route?

**Yes for this captured two-state case.** The proposed loop passes the existing
complete-route validator with all three relationships present. Both endpoints
are independently allocated on VS-002's south edge; the departure is right of
the arrival. The exterior horizontal segment travels left and the arrow returns
up into the card. No production adoption or other graph behavior is established.

## Authority and evidence

- The focused handoff (`/tmp/sdd-ui-contracts-focused-comparison-handoff.md`)
  supplies the acceptance contract: three static panels, preserved cards and
  working routes, local south-side loop, negative traversal, full label, and
  complete-route validation. It supersedes the earlier prototype formats.
- Repository `AGENTS.md` supplies the architectural guardrails. This remains a
  prototype beside the renderer; no bundle, production renderer, or golden changes.
- `aeb_help_center_de_astra.sdd:538–575` supplies the proof case. DG-002 includes
  the forward and back transitions and excludes the self-loop.
- `evidence.json` contains the retained production scenes and measured labels.
  Its failing positioned scene was confirmed identical to the original
  `/tmp/sdd-transition-original.json` capture. The first panel repaints those
  coordinates without rerouting.
- `dg002.svg` is the actual successful named-diagram output. Its two card groups,
  labels, and edge groups are copied intact into panels two and three. Only the
  containing crop is translated. The proposed panel appends the local loop.
- `bundle/v0.2/core/views.yaml:2771` and `iaPlaceMapRouting.ts:438` provide the
  existing south-side, negative-traversal exemplar and ordered-pair usage. They
  do not establish a new UI Contracts convention.

## Validated decision

Reuse `allocateOrderedPortPair` with negative direction. Preserve the measured
224 × 53 card. The full measured loop label is 147.744 × 50. Reserving 16 units
on both sides yields 179.744 units between the legs: arrival offset 22.128,
departure offset 201.872. Reserving 16 units above and below the label yields
82 units of external depth. These are this proof case's measured requirements,
not a general card-sizing formula or a new production policy.

All acceptance invariants pass; none are violated. The output is acceptable
for this local proof:

- `validateFinalRouteSet`: zero violations with complete forward, back, and loop
  connectors, independently bound endpoints, all label boxes as blockers, and
  crossings forbidden. No rerouting, shared-track exemptions, or repair pass.
- Full labels avoid nodes, other labels, and marker footprints. Markers avoid
  each other and unrelated nodes. Cards and working routes retain their capture
  coordinates and dimensions.
- Chromium inspected the actual HTML offline at 800 CSS pixels wide. Three
  SVGs, zero controls, 3/2/3 arrowheads, every complete label present, all painted
  bounds inside their viewports, and matching SVG-unit/CSS-pixel dimensions.
  No external requests or page errors. The complete page and proposed panel were
  visually inspected at readable scale.
- `pnpm run build` passed. No prototype test suite was introduced.

Rebuild from the repository root:

```sh
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp node src/renderer/staged/routing-prototype/capture-focused-comparison.mjs
```

`focused-comparison-evidence.json` records source hashes, independently allocated
endpoints, the complete validation context, measured labels, marker footprints,
crop translations, and the resulting HTML hash. Capture is on the existing
`codex/prototype-ui-contracts-routing` throwaway branch. Existing edits to
`ALLOCATION.md` and the scope-correction document are preserved outside this commit.
