# [Done] Staged UI contracts: B5 implementation acceptance

The B5 port is complete through the public staged SVG/PNG preview paths, with
the user's accepted long-ID limitation. All 1,216 repository tests pass and the
documentation site builds. The evidence below records the accepted design,
integration and retained limitations.

## Result

The complete sheet contains the authored Component enclosure overview, local
Place and Component scopes, composition references, single-source outgoing
contracts and the referenced-target register. Reused hierarchies expand once in
deterministic source order; H locators identify later references. Every local
Component scope preserves all immediate parents and children. The unchanged
Departure Desk fixture shows C-430 under C-420, its C-431 descendant, the later
C-430 reference under C-470 and both parents in C-430's local scope.

Both render details preserve hierarchy and primary transition sequences.
Detailed mode adds the agreed focal attributes and supporting content; compact
retains State sequences and supporting contracts for the projection-wide
State-only fallback. Decorators are independent. Container titles and H locators
remain visible with every decorator setting.

| Detail | None | Type | ID | Type and ID |
| --- | --- | --- | --- | --- |
| Compact | [SVG](implementation_evidence/stage7/departure_desk/compact.none.svg) | [SVG](implementation_evidence/stage7/departure_desk/compact.type.svg) | [SVG](implementation_evidence/stage7/departure_desk/compact.id.svg) | [SVG](implementation_evidence/stage7/departure_desk/compact.type-id.svg) |
| Detailed | [SVG](implementation_evidence/stage7/departure_desk/detailed.none.svg) | [SVG](implementation_evidence/stage7/departure_desk/detailed.type.svg) | [SVG](implementation_evidence/stage7/departure_desk/detailed.id.svg) | [SVG](implementation_evidence/stage7/departure_desk/detailed.type-id.svg) |

Corresponding PNGs and model/scene records are beside those files. The public
preview results retain the validator's existing multiple-parent recommendation
for C-430; it is independent of renderer diagnostics. Compilation and projection
remain diagnostic-free. Detailed output represents the expected 51 identities
and 45 relationships; compact represents 17 identities and 24 relationships.
Acceptance compares sets and relationship multiplicity, not counts alone.

## Architecture and ownership

| Responsibility | Implementation |
| --- | --- |
| Machine-readable presentation | `bundle/v0.1/core/views.yaml`: `ui_contracts_presentation`, detail visibility switches, and aligned guided relationship display records |
| Validated configuration | `src/bundle/uiContractsPresentation.ts`, reached from `loadBundle` through loaded-bundle validation |
| Semantic identity, occurrence identity, visibility and provenance | `src/renderer/uiContractsPresentationModel.ts` |
| Native scene input | `src/renderer/staged/uiContractsPresentationScene.ts`, `uiContractsFanout.ts`, `uiContractsTransitions.ts` |
| Measured container title bars and native paint | `src/renderer/staged/uiContractsContainer.ts` |
| Import-compatible arrow paint | `src/renderer/staged/uiContractsArrowheads.ts` |
| Public staged entrypoints | `src/renderer/staged/uiContracts.ts` |
| Backend-aware applicability and coverage | `prepareProjectionForRender.ts` and `previewWorkflow.ts` |

The staged path is projection → presentation model → RendererScene →
MeasuredScene → PositionedScene → SVG → PNG. Occurrence IDs are deterministic
scene identities; the shared decorator receives the original semantic ID.
Segmented connectors retain their authored relationship provenance. Bundle-only
mutation tests change hierarchy visibility, selected attributes and relationship
labels in native SVG without TypeScript changes.

The title painter uses measured one-line titles, the B5 19px band, 14px radius,
1.5px inside outline and Public Sans typography. Long titles grow their enclosing
frame without widening semantic nodes. Body, inset title band and complete
outline paint in that order. PNG derives from the same SVG.

Return transitions reserve channels above the forward sequence. Fork and merge
bars contain distinct routed segments. Child arrow approaches reserve 18px;
the focused B5 comparison permits only that user-approved six-pixel change from
the original 12px multi-child legs. The 33px-stem and 11px-branch negative controls
remain rejected. Sibling leaves share a hierarchy enclosure.

Shared placement, routing, repair, validation and spacing code are unchanged.
Shared semantic-node measurement, typography, dimensions and paint are unchanged.
Shared integration is confined to typed UI metadata/cloning, container-header
measurement/paint dispatch, and the requested view-only arrow paint dispatch.
Unmarked containers and other views retain their existing behavior.

## Public workflows and artifacts

The invocation and artifact naming conventions remain the same:

```bash
TMPDIR=/tmp pnpm sdd show docs/hierarchical_ui_contracts/departure_desk.sdd --view ui_contracts --detail detailed --decorators type,id --out /tmp/departure.svg
TMPDIR=/tmp pnpm sdd show docs/hierarchical_ui_contracts/departure_desk.sdd --view ui_contracts --detail compact --decorators none --format png --out /tmp/departure.png
```

CLI smoke checks used an isolated `XDG_CONFIG_HOME` and verified omitted
decorators resolving to a user preference, explicit `none` overriding that
preference, PNG output, legacy DOT/Mermaid output and `--view all` retaining a
structure-only Component diagram. A separate native preview test changes the
bundle fallback and verifies omitted decorators through that path.

The actual helper `preview` command produced the staged SVG with no diagnostics.
Its unique temporary artifact convention remains unchanged. See
[CLI evidence](implementation_evidence/stage7/cli-smoke.json) and
[helper evidence](implementation_evidence/stage7/helper-preview.json).

Only accepted staged UI-contract artifacts were refreshed: ten renderer-stage
snapshots and sixteen SVG/PNG corpus/documentation examples. Legacy Graphviz
siblings, DOT/Mermaid files, projection snapshots and other views were preserved.
The [refresh manifest](implementation_evidence/stage7/refreshed-artifacts.json)
lists the generated examples. The old synthetic contract-lane regression remains
tested separately from the new B5 scene tests.

User documentation now explains the overview, locators, independent options,
detail content and legacy differences. Relationship references no longer say
Component containment is hidden in staged output. The documentation site builds
successfully; its existing chunk-size advisory does not prevent the build.

## Verification

The [stage ledger](b5_implementation_evidence.md) retains each proof gate and its
original evidence. The topology suite exercises 120 combinations across fifteen
fixture families, plus source-order/fallback and horizontal-growth comparisons.
Only the four explicitly accepted long-ID variants retain geometry findings.
All other routing, geometry and coverage checks remain strict.

The first full public-integration run executed 1,216 tests. It identified an
obsolete expectation that the UI-contract sheet itself has an outline and one
Journey Map timeout. The outline test now checks all B5 enclosure strokes within
their own frames and the exported viewport; its rectangle parser distinguishes
`width` from `stroke-width`. The complete outline suite and isolated Journey Map
suite pass. The final repository run passed all 1,216 tests in 117 files without
changing test timeouts:

```bash
TMPDIR=/tmp pnpm test --maxWorkers=1 --minWorkers=1
```

See the [final full-suite log](implementation_evidence/stage7/final-tests.log)
and [documentation build log](implementation_evidence/stage7/docs-build.log).

Visual review covered native title bars at normal and enlarged size, the
corrected cycle/self-loop/branch/merge proofs, shared sibling enclosures, long
content, complete-sheet local scopes and refreshed public examples. The native
SVG contains one ordinary filled path per arrow; no UI-contract edge depends on
an SVG marker for its arrowhead.

The [protected-file audit](implementation_evidence/stage7/protected_file_audit.json)
confirms all 49 frozen source files and 49 design-reference hashes match the
starting baseline. Of 156 original golden hashes, only the ten approved staged
UI-contract snapshots changed. An additional 416 tracked legacy and unrelated
generated artifacts match HEAD. The original fixture checksum remains
`fec1fc5b356be868944b67eb2d6134bd6d70f0ca2f290fc515662f061f45fbff`.

## Retained limitations

- The user explicitly accepts long-ID overflow in the shared semantic-node
  decorator for this port. Replacing the displayed ID with `(long ID)` is future
  shared-node work; it is not implemented here. Native warnings and raw geometry
  evidence remain available.
- B5's documented native excess width on the right remains. Positioned frames
  are not cropped or shrunk after layout.
- Figma import could not be exercised because its tool limit prevented live
  access. The supplied local Figma exports guided the visuals; marker-independent
  arrow paths were verified in native SVG/PNG.
