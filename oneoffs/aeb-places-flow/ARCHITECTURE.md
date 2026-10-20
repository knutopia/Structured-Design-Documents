# AEB Places Flow proof cases

## Authority and scope

This is an editorial renderer for two existing report figures, not a new SDD view or a renderer migration. Only files in this one-off directory may be authored. Existing parser, compiler, projector, renderer, bundle, report, and SDD files remain unchanged.

Content authority: `/home/knut/projects/aeb_sdd/aeb_help_center_de.sdd`, named diagrams `DG-011` (Figure 2) and `DG-026` (Figure 8). Figure 8's original artifact is `figure-09-community-paths.svg`. Do not confuse it with the newsletter diagram.

Semantic authority: `bundle/v0.2/manifest.yaml`, `core/contracts.yaml` diagram membership, and `core/views.yaml` IA selection and navigation presentation. Use loaded bundle, parser/compiler, exact named projection and IA render-model formatting; do not parse SDD with regular expressions or retype node and edge content. The original persisted source passed Simple validation with no diagnostics on 2026-10-19.

Architectural guardrails: repository `AGENTS.md`, especially projection as the semantic boundary and deterministic SVG then PNG. The user's explicit request permits one-off placement and routing beyond existing view layout conventions. These fixed placements are illustration data, not new machine-readable SDD conventions.

Visual exemplar: original Figure 2 and Figure 8 SVG/PNG files; the existing shared-node theme in `src/renderer/staged/theme.ts`, navigation paint and bracketed event-label presentation. Public Sans, 16 px semibold node titles, 10 px type/ID decorators, 12 px edge labels, white cards with teal outlines and pale blue decorator bands, blue navigation arrows and white rounded label capsules. Read these values from existing runtime/theme where possible.

## Acceptance invariants

1. Figure 2 preserves eight unique Places and seven navigation occurrences. Repeating Home in two panels adds an occurrence of the same identity only. The product route has five Places; the glossary route has four.
2. Figure 8 preserves five Places and four navigation occurrences: Community to topic, then topic to either public post or sign-in. No destination-to-destination edge exists.
3. Names, IDs, full event labels, and arrow directions match the source. No invented ScenarioSteps, realization links, containment, guards, or destinations.
4. Figure 2 reads down two separated columns with straight, short arrows; no backward progress, serpentine routing, or interleaving.
5. Figure 8 reads left to right with three terminal destinations aligned in a separate column. Each branch has an independent port and a distinct route. No crossing or overlapping edge segments, node/edge intersections, label/edge intersections (apart from a label's deliberate own-edge treatment), or ambiguous arrowheads.
6. Full titles wrap at whitespace, with width sufficient for the longest German word. No clipping, arbitrary mid-word breaking, ellipsis, or very small text. Fixed figure-specific widths may exceed the default SDD card width.
7. SVG is portable with embedded vendored fonts. PNG comes from SVG with vendored fonts. Regeneration must be byte deterministic. Save readable SVG/PNG and an HTML review page, plus the one-off source utilities and verification evidence.
8. Visual review at realistic report width is required in addition to structural/geometry checks. Record mismatches honestly and revise before accepting.

## Composition

Figure 2: Product help and Glossary are unboxed editorial headings above two independent vertical routes. Repeat Home at the top of both, with the same `P-001` decorator; explain that repetition in the caption. Use approximately 336 px-wide cards, 72–96 px column separation and roughly 64–80 px vertical connector gaps, tuned to measured text. Place event capsules beside the vertical connector. Let the shorter route end naturally; do not stretch its final edge to fake equal depth.

Figure 8: Community at left, topic at center, three terminal Places stacked at right. The two public posts are first, sign-in last. Keep the entry connector short enough to read as one step, while leaving room for its event label. Use three distinct east-side ports on the topic; outer routes turn once out and once into their destinations, and the center route is straight. Their tracks and labels occupy disjoint spaces. Titles over columns or choices are editorial text, not graph nodes. A concise note may explain public reading versus the sign-in boundary without inventing an authenticated continuation.

## Implementation seam

### Shared-start Figure 2 comparison

The additional `figure-02-shared-start` variant preserves the earlier Figure 2 unchanged. For this comparison only, acceptance invariant 1 uses eight visual occurrences: the same eight selected Places and seven selected navigation occurrences, with Home drawn once. Home sits above two downward lanes, using distinct south-side ports and disjoint orthogonal connectors to the two category destinations. Each fork retains its own full event capsule; the later connectors stay straight and downward. There are no reverse steps, crossings, overlapping routes, or invented semantic nodes. Use regular 224 px SDD cards wherever every word fits, expanding only the glossary article to the existing 308 px wide band. Keep fixed lane centers when a card expands, with measured whitespace wrapping and the existing theme unchanged. The new variant receives the same independent semantic, geometry, deterministic regeneration and visual review checks.

Load and project the original SDD with existing runtime calls. Reuse the IA render model to obtain resolved titles and navigation labels. Map that immutable selected content into a tiny illustration model. Measure with the vendored Public Sans fonts and theme. Figure-specific functions supply node coordinates, connector points and label boxes. A shared SVG painter applies SDD appearance. Rasterize that SVG with resvg. No existing auto-layout or routing pass runs after manual placement.

Shared utility public surface is to be finalized by the Figure 2 implementation agent and communicated immediately to the Figure 8 implementation agent. Both agents own separate figure files; only the Figure 2 agent owns shared utilities. Renderer source may be imported and read, never edited.

## Review evidence

Check selected node/edge occurrence coverage against the original projections, exact visible titles/IDs/labels, geometric clearances, long-word fitting and deterministic regeneration. Include positive-overlap segment checks and orthogonal crossing checks. Inspect both PNGs at native scale and in the review HTML at report width. Preserve all original report artifacts byte-for-byte.
