# UI Contracts horizontal packing and fitted enclosures

**Status:** complete

**Scope correction (2026-10-15):** Renderer-only layout update, matching the existing
Referenced targets implementation scope. Leave all bundle files, bundle types, loaders,
and validators unchanged. This supersedes the earlier bundle-extension proposal.

## Problem Statement

UI Contracts diagrams place Components without hierarchy in a tall vertical column,
even when other sections provide enough horizontal space for several cards. This
makes diagrams unnecessarily tall and harder to scan. Referenced targets already
supports rows, but retaining its entire packing width can leave unused space on the
right. A further defect appears when a section title widens an enclosure only after
packing: cards wrap prematurely despite having enough visible space.

A component without hierarchy has neither a parent nor children in the component
containment hierarchy. It may still participate in composition relationships and
have local contract behavior. This feature changes presentation, not that definition.

## Solution

Within the existing staged UI Contracts renderer, render two or more Components
without hierarchy in source-ordered horizontal rows. Keep each card's natural size and wrap only when the next card does not fit.
Each wrapping section independently obtains a packing budget from the widest
ordinary section and its own card and title minima.

After choosing the rows, fit both the Components without hierarchy enclosure and
the horizontal Referenced targets enclosure to their packed content, retaining
normal padding and sufficient room for the title. Fitting must not move or resize
cards, change rows, or influence another section's packing budget. Preserve the
current zero/one-component presentation, existing detail visibility, and bundle semantics.
Use the same rendering scope as Referenced targets; introduce no bundle-version gate.

## User Stories

1. As a diagram author, I want multiple components without hierarchy to use horizontal space, so that my diagrams are easier to scan.
2. As a diagram reader, I want cards to wrap onto additional rows when needed, so that a large component list remains readable.
3. As a diagram reader, I want cards to retain source order, so that presentation follows the author's intended sequence.
4. As a diagram author, I want cards to retain their natural dimensions, so that the layout change does not alter their content or text wrapping.
5. As a diagram reader, I want cards that fit together to remain on one row, so that multi-row support does not create unnecessary rows.
6. As a diagram reader, I want consistent gutters and padding, so that packed sections retain the established visual style.
7. As a diagram reader, I want cards within a row to align at the top and the next row to clear the tallest card, so that mixed content heights remain readable.
8. As a diagram reader, I want each enclosure to fit its widest packed row, so that unused horizontal space is removed.
9. As a diagram reader, I want a sparse final row to leave earlier rows intact, so that fitting does not compress or rearrange the section.
10. As a diagram author, I want fitting to preserve every card's position, size, and row membership, so that the accepted arrangement remains stable.
11. As a diagram reader, I want Referenced targets to receive the same fitting refinement, so that both horizontal sections use space consistently.
12. As a diagram author, I want the two wrapping sections to use independent width budgets, so that a wide title or card in one does not widen the other.
13. As a diagram reader, I want title width considered before rows are chosen, so that cards do not wrap while usable space remains.
14. As a diagram reader, I want enclosure titles to remain fully contained after fitting, so that long titles remain readable.
15. As a diagram author, I want a section without ordinary siblings to use its own card and title minima, so that its layout is deterministic without a manual width setting.
16. As a diagram reader, I want a sufficiently wide title to permit multiple cards per row even without ordinary siblings, so that fallback layout still uses available space.
17. As a diagram author, I want the presentation for zero or one component without hierarchy preserved, so that small diagrams do not change unnecessarily.
18. As a diagram reader, I want Referenced targets to receive fitting even when there are fewer than two isolated components, so that its improvement does not depend on an unrelated count.
19. As a diagram author, I want the feature in both compact and detailed render detail, so that the same layout principles apply to both presentations.
20. As a diagram author, I want detail mode to retain its existing section visibility and content rules, so that a layout change does not change what my diagram communicates.
21. As a diagram author, I want this local layout improvement to work with existing bundles, so that I do not need configuration or specification changes.
22. As a bundle maintainer, I want existing configuration and validation contracts left intact, so that a rendering refinement does not expand the bundle schema.
23. As a diagram author, I want the same renderer scope as Referenced targets, so that the improvement does not introduce artificial bundle-version differences.
24. As a user of legacy rendering, I want existing outputs preserved, so that the staged-renderer enhancement does not disrupt my workflow.
25. As a diagram author, I want SVG and its derived PNG to reflect the same layout, so that exported formats agree.
26. As a diagram author, I want repeated renders to produce the same result, so that reviews and generated artifacts remain stable.
27. As a maintainer, I want the behavior verified through existing public rendering interfaces, so that tests protect the observable contract rather than private implementation details.
28. As a maintainer, I want durable visual proof before snapshots are refreshed, so that a golden update cannot hide poor packing or a compatibility regression.

## Implementation Decisions

1. **Renderer-only scope.** Match the existing Referenced targets implementation scope.
   Leave bundle data, bundle types, loaders, validators, and existing policy meanings
   unchanged. Do not introduce new configuration fields or a version-specific rollout.
   The user's explicit correction supersedes the earlier proposal to extend the bundle.

2. **Accepted visual contract.** Retain the selected Variant B behavior: natural-size
   cards in source order, independent packing widths, and fitting after packing. Two
   or more components use rows; zero/one component retains its presentation. Existing
   detail policy still controls section visibility and content.

3. **Reuse the renderer path.** In UI Contracts scene construction, reuse the existing
   Referenced targets row-packing machinery for Components without hierarchy. Keep the
   small change local to the renderer and its shared layout infrastructure. Do not add
   an isolated-component policy to the presentation model or bundle configuration.

4. **Independent budgets.** Position ordinary siblings first. A section's content budget
   is the maximum of its widest card, the widest ordinary sibling's outer width minus
   its own horizontal padding, and its own title minimum outer width minus that padding.
   Wrapping siblings are excluded from each other's budget. With no ordinary siblings,
   use the section's own minima. A nonpacking singleton component enclosure remains an
   ordinary width supplier for Referenced targets.

5. **Title-aware packing.** Use the existing measured-header bound for both the packing
   minimum and final enclosure bound. Include the title before assigning rows. A long
   title can enable multiple cards per row even without ordinary siblings.

6. **Pack once, then fit.** Retain the existing greedy row algorithm, top alignment,
   gaps, and row height based on the tallest card. Fit each horizontal enclosure to the
   larger of its widest occupied row plus normal horizontal padding and its title minimum.
   Preserve every card coordinate, dimension, and row membership, and enclosure height.
   Do not feed fitted widths back into packing or sibling budgets.

7. **Shared implementation, narrow effect.** Make any necessary title-budget and fitting
   changes in shared renderer layout and apply them to the two UI Contracts sections.
   Keep unrelated packing behavior intact. Renderer-internal layout intent may be
   extended only as needed; it is not a new bundle control. Finalize enclosure bounds
   before ports and routing, without prototype-only guides or post-routing geometry edits.

8. **Compatibility.** Preserve parsing, compilation, validation, projection, legacy
   outputs, and unrelated diagram layouts. The two affected sections use the existing
   renderer coverage; do not add a bundle-version branch to preserve their old geometry
   in one version. All existing bundles must load and retain their semantics unchanged.

9. **Artifacts and execution.** SVG remains first-class, with PNG derived from it.
   Deliver one implementation ticket covering renderer code, tests, proof artifacts,
   and necessary documentation. No bundle migration or standalone prefactoring ticket
   is needed. Preserve the captured prototype as evidence, not production machinery.

## Testing Decisions

- **Existing public interfaces:** use the public staged UI Contracts renderer as the
  primary seam and the shared renderer pipeline for focused geometry checks. Those
  interfaces were agreed with the user. Bundle-validator work proposed earlier is
  removed because this feature changes no bundle contract. Add no test-only interfaces.
- **View integration:** exercise the normal compile/project/staged-render flow using
  unchanged existing bundles. Existing isolated-card order, Departure Desk target-row,
  and target-only fallback tests provide prior art. Check compact and detailed output,
  and SVG with its derived PNG.
- **Fixed packing, fitted bounds:** compare equivalent renderer inputs before and after
  fitting through existing interfaces. Assert identical card coordinates, dimensions,
  content, source order, row membership, and enclosure height, plus the exact fitted-width
  relationship. Include unequal card heights and a ragged final row. Do not add a public
  or bundle toggle just to enable the comparison.
- **Premature wrapping:** use a title wide enough to admit an additional card. Check
  that each wrap is required by the title-aware budget, not just that cards remain in bounds.
- **Independent sections and fallback:** changing one section's own minimum must not
  change the other's packing. Exercise components alone and both wrapping sections
  without ordinary siblings, including a title that permits multiple cards on a row.
- **Cardinality and detail:** cover zero, one, two, and many components in both detail
  modes. Include a two-card single row and target fitting independently of component count.
  Preserve normal scope visibility; use explicit synthetic scenes where needed to isolate
  the no-sibling condition.
- **Compatibility:** verify unchanged bundles still load, unchanged semantic projection,
  legacy outputs, unrelated shared-layout behavior, deterministic repeated renders,
  correct artifact bounds, and no new degraded-layout diagnostics. The intended visual
  changes may appear wherever the existing staged renderer applies, across bundle versions.
- **Proof before snapshots:** create durable synthetic sources and recreate the accepted
  13-component and wider-title examples. Inspect both sections before refreshing affected
  renderer artifacts. Test geometric relationships rather than copying prototype pixels.
  Do not use the temporary Help Center example as a test dependency.
- Run the build, focused renderer tests, and the repository test suite for the shared
  layout change. Verify that the final diff contains no changes to bundle files or
  bundle code. Preserve bundle-owned snapshots and examples; use renderer test fixtures
  for new evidence. Production acceptance must pass before renderer golden updates.

## Out of Scope

- Changes to bundle files, bundle types, loaders, validators, or configuration contracts.
- New layout-policy controls, configurable activation thresholds, or version-specific layout gates.
- Shared widths across the two wrapping sections or a manually configured fallback width.
- Card stretching, card reordering, mandatory multiple rows, or repacking after fitting.
- Changes to component containment membership, composition, contract semantics, scope
  visibility, or detail-specific content.
- New renderer backends, external layout engines, or an independent PNG renderer.
- A new CLI preference, variant switcher, persistent prototype controls, or shipped
  prototype code.
- Broad layout refactoring, changes to legacy output, or unrelated diagram redesign.

## Further Notes

The accepted prototype is captured in commit
`6c2245be0d847596ecc5b492ed66190e1bb5f737` on
`codex/prototype-ui-contracts-horizontal`. Its selected 13-component example preserved
seven component rows and three target rows when enclosures were fitted. Its wide-title
comparison exposed premature wrapping that simple clipping checks had missed.

The existing preparation document, “Horizontal Layout for Components Without Hierarchy
in UI Contracts Diagram,” contains the code navigation and implementation sequence.
Use the prototype as primary visual evidence, not as production machinery. Preserve
uncommitted preparation work before any branch transition.

This spec and its one implementation ticket are published to the local Markdown tracker
at the user's request. There are no unresolved product choices or implementation blockers.
The first implementation attempt was canceled and its code edits discarded. The fresh
implementation subsequently completed this corrected spec; see the acceptance record below.

## Production acceptance — 2026-10-15

The fresh implementation under the corrected renderer-only scope is complete in
`66a4bf665589de746e65e1e3f011f3bf22d0e02a`. This supersedes the earlier canceled attempt.
All acceptance invariants passed, including visual inspection of the durable
[production proof](../../docs/toolchain/ui_contracts_horizontal_proof/README.md),
60 focused renderer tests and the full 2,021-test/182-file repository suite.
Standards and spec reviews found no issues. Bundle data and bundle code are unchanged.
