# Horizontal Layout for Components Without Hierarchy in UI Contracts Diagram

**Status: complete.** Implemented in `66a4bf665589de746e65e1e3f011f3bf22d0e02a`
on `codex/ui-contracts-horizontal-layout`. See the
[production proof and verification record](toolchain/ui_contracts_horizontal_proof/README.md).

Modify the ui_contracts renderer output formatting so that the "Components without hierarchy"
section, when containing multiple nodes, uses the available width of the overall diagram
for multi-row packing, as the "Referenced targets" section already does. After packing,
both horizontal-layout sections fit their enclosures to the packed content without
changing the rows; see the accepted refinement below.

Here is an example containing multiple nodes in "Components without hierarchy": @aeb_help_center_de_astra.ui_contracts.svg ...note that this is not a durable asset and should thus not be used in tests.

As an example with relevant "Referenced targets" content, see the canonical
[v0.2 detailed Departure Desk SVG](../examples/rendered/v0.2/ui_contracts_diagram_type/departure_desk_example/detailed_detail/departure_desk.ui_contracts.svg).

## Corrected implementation scope — 2026-10-15

The user explicitly directed: “The scope can match the EXISTING EXAMPLE
('Referenced targets'). Leave the bundle alone.”

This is a renderer-only layout update. Leave all bundle files, bundle types, loaders,
validators, and configuration contracts unchanged. Match the existing Referenced targets
rendering scope. Do not introduce new layout policies, configurable component thresholds,
or bundle-version gates. This replaces the earlier proposal to extend the bundle.

The first implementation attempt was canceled and its production code edits discarded.
The fresh implementation followed this corrected scope and is now complete. The local
spec and single ticket are marked complete; no implementation work remains pending.

### Sources and invariants

- **Requested behavior:** the opening requirement, the accepted visual decisions below,
  and the user's explicit renderer-only scope correction govern this task.
- **Existing specification:** continue consuming existing bundles without modifying them
  or changing their semantic contracts. The local layout refinement does not require a
  new bundle convention.
- **Architecture:** follow [AGENTS.md](../AGENTS.md) for the staged pipeline, shared layout,
  deterministic geometry, and projection as the semantic boundary. The user's explicit
  instruction resolves this task's scope: leave the bundle alone.
- **Reference:** the linked Departure Desk SVG shows the existing Referenced targets row
  layout. The accepted prototype refines enclosure fitting and title-aware packing.
  The temporary Help Center SVG may illustrate the problem but is not a test dependency.
- **Acceptance:** verify the durable proof before refreshing renderer goldens. Keep
  bundle-owned examples and snapshots unchanged; add evidence under renderer tests.

### Accepted visual decisions

1. **Q1 — Source-ordered row packing:** retain each card's normal measured dimensions
   and the existing component order. Fill rows left to right; start a new row only when
   the next card does not fit. One row is valid when all cards fit. Do not stretch cards
   or reorder them to fill gaps. Accepted by the user on 2026-10-14.
2. **Q2 — Multiple components only:** activate the new behavior only for at least two
   components. Preserve the current presentation for zero or one component. Accepted
   by the user on 2026-10-14.
3. **Q3 — Independent widths (Variant B):** each wrapping section obtains its own packing
   budget from ordinary sections and its own card/title minima. The two wrapping sections
   do not force each other to a common width. The chosen prototype uses its own minimum
   when no ordinary section supplies a width. Accepted by the user on 2026-10-15.
4. **Q4 — Fit after packing:** for both Components without hierarchy and Referenced targets,
   first determine rows using the available packing budget. Then reduce enclosure width
   to the widest packed row plus normal left/right padding, retaining enough width for
   the title. Do not repack, reorder, resize or move cards, change row/column counts, or
   feed the tightened width back into packing. Keep normal inter-card gutters and outer
   margins. Zero/one isolated component retains its presentation; the existing horizontal
   target register receives the fit refinement independently. Accepted by the user on
   2026-10-15.

The term **component without hierarchy** refers to containment membership, not to the
absence of all relationships; see [GLOSSARY.md](../GLOSSARY.md).

### Renderer implementation plan

1. In [`UiContractsSceneBuilder.complete`](../src/renderer/staged/uiContractsPresentationScene.ts),
   reuse the existing Referenced targets row-packing approach for the enclosure containing
   multiple Components without hierarchy. Preserve current section membership, card order,
   content, detail visibility, and zero/one-component presentation. No presentation-model
   policy or bundle schema extension is needed.
2. Reuse [`LayoutIntent.pack`](../src/renderer/staged/contracts.ts) and shared stack layout
   in [`macroLayout.ts`](../src/renderer/staged/macroLayout.ts). Keep any additional layout
   intent internal to the renderer and limited to what the accepted geometry requires.
   Preserve the behavior of unrelated packing callers.
3. Retain ordinary-first sibling placement. Each wrapping section independently derives
   its content budget from ordinary sibling width, its own widest card, and its own
   measured title minimum, accounting for horizontal padding. Wrapping sections do not
   contribute to each other's budget. With no ordinary sibling, use the section's own
   minima. A nonpacking singleton enclosure remains an ordinary sibling.
4. Include title width before assigning rows, using the existing measured-header bound.
   A title may create enough room for several cards even with no ordinary sibling.
   The same bound must protect the title after fitting.
5. Choose rows once. Fit each horizontal enclosure to the widest occupied row plus normal
   horizontal padding, subject to its title minimum. Preserve card coordinates, dimensions,
   row membership, order, gutters, and enclosure height. Do not feed fitted widths back
   into packing or sibling budgets.
6. Finalize fitted bounds within shared layout before container ports and routing. Keep
   SVG and derived PNG on their existing path. Do not copy the prototype's temporary
   wrappers, width guides, or post-routing geometry edits.

The behavior applies in the same existing staged UI Contracts scope as Referenced targets,
including existing bundle versions using that renderer. Do not create a version-specific
branch merely to retain the old geometry in one bundle. Existing bundle settings keep
meaning the same thing; legacy outputs and unrelated diagram layouts remain unchanged.

### Acceptance and verification

Test through the existing public staged UI Contracts renderer and shared renderer pipeline.
The earlier proposal for new bundle-validation and bundle-mutation tests is withdrawn.
No bundle contract is changing.

| Acceptance | Required proof |
| --- | --- |
| No bundle changes | All bundle files and bundle code remain unchanged; existing bundles still load. |
| Multiple components | Two or more cards use source-ordered natural-size rows; one row is valid when they fit. Zero/one retains its presentation. |
| Fit without reflow | Fitting preserves exact card positions, dimensions, content, order, row membership, and enclosure height. Width equals the widest occupied row plus padding, subject to title bounds. |
| Normal spacing | Preserve gutters, outer margins, padding, top alignment, and row height based on the tallest card. A ragged last row leaves earlier rows intact. |
| Title-aware packing | Include a title that permits additional cards per row. Check for premature wrapping as well as clipping. |
| Independent sections | Increasing one section's own minimum does not change the other's packing or width. |
| No ordinary sibling | Components alone and both sections together use independent own minima; a sufficiently wide title can allow multiple cards. |
| Targets and detail | Target fitting does not depend on isolated-component count. Cover compact and detailed views with unchanged visibility. |
| Compatibility | Preserve semantic projection, legacy outputs, unrelated layouts, deterministic artifacts, and correct SVG/PNG bounds. The intended geometry change follows the existing renderer's scope across bundle versions. |

Start from a durable synthetic fixture based on
[`ui_contracts_dense_sparse_staged.sdd`](../tests/fixtures/render/ui_contracts_dense_sparse_staged.sdd).
Recreate the accepted 13-component case and wide-title case, and inspect both sections.
Include mixed card heights, ragged rows, and a two-card single row. Do not freeze
prototype pixel values when a geometric relationship expresses the requirement.

Extend [`stagedUiContracts.spec.ts`](../tests/stagedUiContracts.spec.ts) for visible
behavior and [`stagedMacroLayout.spec.ts`](../tests/stagedMacroLayout.spec.ts) for shared
geometry. Compare equivalent packing inputs before/after fitting through existing
interfaces; do not add a bundle or public toggle solely for testing. Keep normal scope
visibility in integration tests; label any synthetic no-sibling scene explicitly.

Run the build, focused renderer tests, and full repository suite with `TMPDIR=/tmp`.
Verify that the final diff contains no bundle or bundle-code changes. Refresh only
renderer artifacts affected by the accepted layout after the invariants pass. A green
test suite does not justify ignoring a visual mismatch.

Update [`docs/toolchain/development.md`](toolchain/development.md) with the renderer
behavior as needed. No new ADR or domain term is required for this layout correction.

### Implementation artifacts and captured prototype

The local spec and one implementation ticket live under `.scratch/ui-contracts-horizontal-layout/`.
They reflect the renderer-only scope. Preserve those files, this document, the glossary,
and unrelated working-tree changes before any branch/worktree transition.

The accepted prototype is captured at commit `6c2245be0d847596ecc5b492ed66190e1bb5f737`
on `codex/prototype-ui-contracts-horizontal`. Read its README using
`git show 6c2245b:src/renderer/staged/prototypes/ui-contracts-horizontal/README.md`.
The same commit contains `B-fit-before.png`, `B-fit-after.png`, and `B-fit-targets.png`
under the prototype's evidence directory. Its older statements proposing bundle changes
are superseded by this scope correction; its visual evidence remains useful.

Variant B is the accepted result. Variant C's common widths and configurable fallbacks
remain rejected alternatives. The selected 13-component proof retains its rows when the
enclosures fit their content; the wide-title proof checks that title space is available
before wrapping. The prototype's synthetic controls are not new production features.

### Completion record — 2026-10-16

The fresh implementation is committed as `66a4bf665589de746e65e1e3f011f3bf22d0e02a`
on `codex/ui-contracts-horizontal-layout`. Production source changes are confined to
the UI Contracts scene builder, shared macro layout, and renderer-internal layout intent.
The diff from review base `36808602be85ac3a136d3f1cf27a8204922f34c5` contains no changes
to bundle files or bundle code.

The [production proof](toolchain/ui_contracts_horizontal_proof/README.md) contains durable
SVG/PNG evidence, geometry results, and reproduction commands. The implementation record
reports a passing build, 60 focused renderer tests, and all 2,021 repository tests across
182 files; the focused and full-suite logs were checked during planning closeout.
Separate standards and spec reviews reported no findings. Visual acceptance preceded
the renderer snapshot refresh.

The local spec and ticket are complete. The implementation commit remains separate from
uncommitted planning artifacts, the glossary, and unrelated `progress.md` work, which
remain preserved. This completion record supersedes the earlier pending/stopped state.
