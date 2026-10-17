# Focused comparison — throwaway prototype 3

Open `focused-comparison-prototype.html` directly. It contains exactly three
static SVG crops, including embedded fonts, at one SVG unit per CSS pixel.

Question: can the existing compact backward-loop construction coexist with the
actual working DG-002 pair, with a full, unambiguous label outside the loop?

**The revised bottom loop passes for this captured two-state region.** Commit
`5c2c5c9` used the wrong construction: its label dictated a 179.744 × 82 loop.
That drawing passed collision checks but failed to follow the supplied visual
reference. Those checks were insufficient acceptance evidence.

The corrected loop uses the existing shared 23-unit port pitch and 17-unit
outward clearance. Its full label is outside, 12 units from its horizontal rail.
Both same-edge endpoints are independently allocated; departure is right of
arrival. Other occupied ports are reserved before allocating the ordered pair.

## Authority and evidence

- The user's correction supersedes the handoff's unconditional south-side trial:
  use the supplied compact-loop reference; prefer bottom when otherwise equal;
  use top if it is valid and avoids enlargement. Keep the three static panels,
  full label, fixed working pair and cards, and negative traversal.
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
- The visual exemplar is
  `docs/ia_place_map_hardening/manual_review_2_evidence/self-loop.compact.svg`.
  Its companion positioned scene has five connectors and passes the existing
  independent IA final-scene audit. Its loop has the same 23 × 17 geometry.
- `bundle/v0.2/core/views.yaml:2771` and `iaPlaceMapRouting.ts:438` provide the
  existing south-side, negative-traversal exemplar and ordered-pair usage. They
  do not establish a new UI Contracts convention.

## Construction and selection

Reuse `allocateOrderedPortPair`, `readablePortPitch`, `readableRoutingClearance`,
and `buildPortCorridorSeed`. The label does not size the loop. Both trials start
from the same captured geometry and reserve every existing endpoint on the
trial side; the south pair is allocated before ordinary arrivals. Shared label
placement searches only the loop label, retaining the working pair's labels.

Each complete trial undergoes route, label-association, and marker audits.
Rejected trials cannot win. Among accepted trials, compare crossings, bends,
measured enlargement, bottom preference, then length through `compareRouteCosts`.
Thus a valid top candidate with no growth wins over a bottom candidate requiring
growth when the unchanged routes have the same crossings and bends.

For the actual crop:

- South passes. Arrival offset is 100.5; departure offset is 123.5. The full
  measured label remains 147.744 × 50. The captured owner needs 80 extra units
  below for this label and readable export clearance.
- North fails: the loop label intersects the fixed return route and has ambiguous
  ownership. Zero enlargement alone cannot make that candidate acceptable.

The compact-loop and local geometry invariants pass. **Full-sheet reflow is not
implemented or validated.** The crop displays the recorded capacity demand;
production adoption would need owned reflow of later content, then a full-scene
audit. The HTML is a visual proof, not evidence of general routing scalability.

## Verification

- `validateFinalRouteSet`: zero violations with complete forward, back, and loop
  connectors, independently bound endpoints, all label boxes as blockers, and
  crossings forbidden. No rerouting, shared-track exemptions, or repair pass.
- `assessConnectorLabels` and independent `auditConnectorLabels` verify full
  labels, adjacency, unambiguous association, and competing routes. Marker
  blockers participate in routing, and `auditPositionedSceneMarkers` separately
  checks the painted arrows. All accepted-trial findings are empty.
- Chromium inspected the actual HTML offline at 800 CSS pixels wide. Three
  SVGs, zero controls, 3/2/3 arrowheads, every complete label present, all painted
  bounds inside their viewports, and matching SVG-unit/CSS-pixel dimensions.
  No external requests or page errors. The complete page and proposed panel were
  visually inspected at readable scale.
- The earlier build passed; this revision changes only prototype JavaScript,
  HTML, and evidence. The generator and browser inspection passed. A runtime
  assertion first rejected the old label-sized port pitch, then passed with the
  corrected shared pitch/depth. The supplied five-connector IA scene passes its
  existing production audit. No prototype test suite was introduced.

Rebuild from the repository root:

```sh
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp node src/renderer/staged/routing-prototype/capture-focused-comparison.mjs
```

`focused-comparison-evidence.json` records source hashes, independently allocated
endpoints, both side trials and their findings, the measured enlargement,
complete validation context, labels, marker footprints, crop translations, and
the resulting HTML hash. Capture is on the existing
`codex/prototype-ui-contracts-routing` throwaway branch. Existing edits to
`ALLOCATION.md` and the scope-correction document are preserved outside this commit.
