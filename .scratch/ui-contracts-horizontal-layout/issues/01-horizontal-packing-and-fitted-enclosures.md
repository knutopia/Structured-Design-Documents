# 01: Pack UI Contracts components horizontally and fit both enclosures

**What to build:** A renderer-only layout update in the same existing scope as Referenced
targets: pack two or more Components without hierarchy into source-ordered rows with
natural card sizes, then fit both horizontal enclosures to their packed content without
changing the rows. Reuse the existing rendering machinery. Leave bundle data and bundle
code unchanged. Deliver renderer changes, production tests, visual proof, and necessary
documentation in one implementation chat.

**Blocked by:** None (can start immediately).

**Status:** complete

**Scope correction (2026-10-15):** This replaces the earlier bundle-extension ticket.
The user explicitly directed: “The scope can match the EXISTING EXAMPLE ('Referenced
targets'). Leave the bundle alone.” Implementation resumed under this corrected scope on 2026-10-15.

- [x] Leave all bundle files, bundle types, loaders, validators, and configuration meanings unchanged. Add no new bundle controls, configurable thresholds, or bundle-version gates.
- [x] Reuse the existing Referenced targets renderer path and row-packing machinery for two or more Components without hierarchy. Preserve natural card dimensions, content, source order, and the current zero/one-component presentation; one row is valid when all cards fit.
- [x] In both detail modes, preserve containment membership, composition relationships, local contracts, section visibility, and detail-specific content.
- [x] Give each wrapping section an independent budget from ordinary sibling width and its own card/title minima, with normal padding accounted for. Wrapping sections must not widen one another. With no ordinary siblings, use the section's own minima; a long title may allow several cards per row.
- [x] Include the existing measured title minimum before assigning rows. Verify that cards do not wrap prematurely while usable space remains, as well as checking card/title containment.
- [x] Fit each horizontal enclosure to its widest packed row plus normal padding, subject to the title minimum. Preserve exact card coordinates, dimensions, source order, row membership, and enclosure height. Do not repack or feed fitted widths back into budgets.
- [x] Preserve normal gutters, outer margins, padding, top alignment, and row spacing based on the tallest card. A ragged final row must not shrink or rearrange earlier rows.
- [x] Refine horizontal Referenced targets independently of isolated-component count. A nonpacking singleton component enclosure remains an ordinary width supplier.
- [x] Keep the implementation in UI Contracts scene construction and shared renderer layout. Finalize fitted bounds before ports/routing. Avoid new layout engines, temporary width guides, post-routing geometry edits, and changes to unrelated packing behavior.
- [x] Test through the existing public staged renderer and shared pipeline. Do not add test-only interfaces, bundle-mutation tests for invented policies, or tests of private packing functions.
- [x] Add durable proofs for many cards, unequal heights, ragged rows, a two-card single row, different section minima, no ordinary siblings, and zero/one components. Cover both detail modes and recreate the accepted 13-component and wide-title examples. Do not depend on the temporary Help Center asset.
- [x] Verify fixed card placement across fitting, independent section behavior, deterministic rendering, SVG/derived PNG bounds, unchanged projection, legacy outputs, and unrelated layouts, with no new degraded-layout diagnostics.
- [x] Run the build, focused renderer tests, and repository suite. Inspect the proof before updating affected renderer goldens. Existing bundles must load unchanged; keep bundle files, code, examples, and bundle-owned snapshots out of the diff. Use renderer test fixtures for evidence.
- [x] Update the renderer documentation, preserve prototype commit `6c2245be0d847596ecc5b492ed66190e1bb5f737` as evidence, exclude its temporary machinery from production, and preserve unrelated working-tree changes.

## Completion evidence — 2026-10-15

- Implementation commit: `66a4bf665589de746e65e1e3f011f3bf22d0e02a` on `codex/ui-contracts-horizontal-layout`.
- [Production proof and reproduction instructions](../../../docs/toolchain/ui_contracts_horizontal_proof/README.md). Standard 13-card rows are `[2,2,2,2,2,2,1]`, targets `[2,2,2]`; both fitted enclosures are 496 px. The wide target title permits `[4,2]` without widening components.
- Build passed. Focused renderer verification passed 60 tests. `TMPDIR=/tmp pnpm test` passed all 2,021 tests across 182 files.
- Standards review: no findings. Spec review: no findings. Visual inspection and geometry acceptance passed before renderer snapshot refresh.
- Final diff has no bundle files, bundle runtime code, loaders, validators, configuration changes, version gates or prototype machinery. The prototype commit remains preserved.
- Preparation document, glossary and unrelated `progress.md` changes were preserved byte-for-byte. The local spec/ticket remain outside the implementation commit, with their completion status recorded here.
