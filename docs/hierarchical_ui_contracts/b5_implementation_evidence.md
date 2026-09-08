# B5 implementation evidence

Current status: complete through Stage 7, with the user's accepted long-ID
limitation. All 1,216 tests pass and the documentation site builds. See the
[acceptance report](b5_implementation_acceptance.md). Earlier blocked entries
below are preserved as stage history.

Implementation follows the [accepted plan](staged_ui_contracts_b5_implementation_plan.md).
This ledger preserves the decisions and evidence recorded at each stage.

## Stage 0 — passed

The [baseline record](b5_implementation_baseline.json) captures revision
`e3fe09c600d6c8681380a297d9c426cd99e53045`, pre-existing changes, the Departure Desk
checksum, 49 protected source files, 49 design references, and 156 existing goldens.
Header integration files are recorded separately because the plan permits narrow
dispatch changes there.

`uiContractsB5Replay.spec.ts` reproduces all twelve B5 positioned scenes exactly.
Independent checks cover native diagnostics, routing validation, semantic-node
width, nodes, labels, measured headers, canvas bounds, and route intersections.
A negative control confirms that route/label intersections fail independently
of native diagnostics. All 14 tests pass. Protected sources and references match.

Satisfied: frozen baseline, deterministic replay, geometry checks. Violations: none.
Acceptable for proceeding to the fan-out feasibility gate.

## Stage 1 — passed for the required proof set

The source remains one native shared node. Its first contract leaves the east
side. Subsequent contracts use distinct south ports in reverse horizontal order,
with the shared routing policy's 16px separation and 24px corner clearance.
Each subsequent contract has an invisible zero-extent anchor at its target row;
the horizontal segment carries the label and arrow. Both segments retain the
contract's style and relationship provenance. No shared segment or synthetic
semantic identity is introduced.

Only existing stack layout, native node/label measurement, typed ports, and the
unchanged pipeline/router determine geometry. Label clearance is measured; local
node widths remain 224px. No coordinates or routes are edited after positioning.

The first unsegmented candidate passed three-contract routing but failed the
higher-degree label checks because the longest vertical segment could receive a
label. Explicitly identifying the horizontal label segment fixes that ownership
problem through supported scene inputs, without narrowing labels or weakening
validation. The unsupported `avoidNodeBoxes` preference is not requested; native
repair and independent intersection validation remain enabled.

Ten cases pass: C-430, C-420, C-450, a long binding label, and an authored
eight-target emission fixture, each with decorators `none` and `type,id`.
The C-430 decorated, eight-target undecorated, and long-binding decorated outputs
were visually inspected. There are no junction circles, missing labels, overlaps,
or routing diagnostics. Native SVGs and scene/provenance records are in
[stage1](implementation_evidence/stage1/).

The proof reserves independent south ports only while they fit outside the node's
rounded corners. Exceeding that capacity explicitly fails; arbitrary-degree
support is not established by this bounded proof. Stage 6 must retain this limit
as an explicit failure case unless a supported extension is proven.

Satisfied: single source, complete relationships, independent labels, native
nodes, unchanged shared geometry. Violations in required cases: none. Acceptable
for proceeding to bundle/model implementation; no production renderer has changed.

Validation: `TMPDIR=/tmp pnpm exec vitest run tests/uiContractsB5Replay.spec.ts tests/uiContractsFanoutProof.spec.ts`
— 24 tests passed.

## Stage 2 — passed

The bundle now declares endpoint selectors, hierarchy/reference policy, selected
attributes, labels, and detail switches. Load-time validation and mutation tests
prove that the staged presentation reads those declarations. The staged model
keeps semantic identities, visual occurrences, authored relationship multiplicity,
and structural ownership separate. The legacy model remains unchanged.

Departure Desk retains the expected detailed 51/45 and compact 17/24 identity and
relationship sets. Both modes select the same H1 expansion and show both immediate
parents of C-430. Place entry points and navigation reach the focal attributes;
transition trigger/guard/effect text survives compact support-node omission.
Containment cycles fail explicitly. Declaration order uses the compiler's existing
authored-block metadata, including nested blocks, with graph-array fallback.

Validation: eight new model/policy tests pass; the existing bundle-detail,
preparation, legacy-model and immutable B5 suites pass (37 tests).
Satisfied: bundle authority, semantic coverage, occurrence identity, deterministic
expansion, legacy isolation. Violations: none in this gate. Acceptable for Stage 3.

## Stage 3 — passed

View-owned measurement keeps the title on one font-measured line before ancestor
sizing. View-owned paint draws the 14px body, inset flat-bottom 19px band, and
complete inside outline in that order. Shared integration consists only of typed
metadata/cloning and two dispatches. Unmarked containers and native nodes retain
their existing rendering.

Visual inspection caught missing font CSS in a container-only scene. The custom
painter now supplies a title-only scoped font declaration even when no semantic
nodes exist. The corrected long-title PNG and enlarged decorated Component proof
were inspected: titles fit, corners are rounded only at the top, and outlines
remain visible. Artifacts are in [stage3](implementation_evidence/stage3/).

All twelve native-header proofs preserve node/connector/label geometry exactly.
Header, immutable replay and SVG-backend suites pass (23 tests); TypeScript build
passes. Satisfied: title sizing, native paint, SVG-derived PNG, shared isolation.
Violations: none. Acceptable for Stage 4.

## Stage 4 — passed

The production scope builders consume the new occurrence model. All twelve
excerpts reproduce B5 semantic-node rectangles, connector routes, label geometry,
markers, styles, and native frame widths exactly. Measured label heights supply
stem gaps and sequence/composition padding; native layered layout supplies its
common label-dependent spacing. Distinct branch segments retain provenance.

The negative 33px stem and 11px branch controls remain rejected. Header and shared
pipeline implementations retain their accepted boundaries. Proof records and SVGs
are in [stage4](implementation_evidence/stage4/). Satisfied: focused geometry,
independent detail/decorators, local intrinsic widths, native excess right width.
Violations: none in the focused proof set. Acceptable for complete-sheet assembly.

## Stage 5 — passed

The complete sheet has the source-ordered overview, all local scopes, composition
references, single-source contracts and target register. The overview contains the
explicit C-431 inset and both H1 occurrences. Place descriptions use the existing
224px measured label primitive; view-owned container styling leaves them unboxed.
Ownership relationships are checked against scope/sequence containment; connector
segments are checked against their authored relationship identities.

All eight detail/decorator combinations pass native and independent routing,
geometry, identity-set, relationship-multiset and coverage checks. The original
fixture yields detailed 51/45 and compact 17/24. Complete overview, decorated
Place and C-430 sections were visually inspected. Native SVG, derived PNG, model,
all scene stages and verification reports are in [stage5](implementation_evidence/stage5/).
The full-sheet suite has eight passing cases; the focused/header suites still pass.
Satisfied: full content, native title bars, explicit reuse, single-source contracts.
Violations: none for Departure Desk. Acceptable for topology hardening.

## Stage 6 — blocked; output is not acceptable

The strict topology suite found these failures with `detailed / type,id`:

| Fixture | Failed acceptance condition |
| --- | --- |
| [branch](implementation_evidence/stage6/branch.sdd) | Two transitions leaving one State overpaint 50.961px of horizontal connector. |
| [merge](implementation_evidence/stage6/merge.sdd) | Two transitions entering one State overpaint 50.961px. The independent default validator catches this even though the existing pipeline's arrival exception does not. |
| [diamond](implementation_evidence/stage6/diamond.sdd) | Both outgoing and incoming transitions overpaint 51.108px. |
| [cycle](implementation_evidence/stage6/cycle.sdd) | A return transition departs/arrives through endpoint boxes and crosses another State. Labels also intersect nodes. |
| [self loop](implementation_evidence/stage6/self_loop.sdd) | Native detouring places its label outside the viewport. |

The unchanged layered strategy groups a strongly connected component in one
rank. The current scene builder's east/west transition ports therefore cannot
produce a valid cyclic sequence. Branches and merges use the same native center
ports and share terminal spans. These are concrete failures of the current
scene strategy, not evidence that every possible supported scene representation
is impossible.

A bounded [typed-port probe](implementation_evidence/stage6/port_probe.ts)
separates branch/merge exits by the native 16px routing separation. It removes
the overlapping terminal spans but produces label-segment fallbacks and
label/node or route/label intersections. That probe is not installed in the
scene builder. Its complete input/output records are the `*.distinct-ports.json`
files beside the failing fixtures.

The plan's stop conditions apply: the current strategy produces structurally
wrong output, independent visual acceptance fails, and further gap/route tuning
would lack an accepted proof. Shared routing, label placement, validation and
layout remain frozen. No exemption, hidden omission, repeated-source contract
fallback or snapshot refresh was used to conceal a failure.

The same hardening pass verifies disconnected sequences, three-parent/three-child
neighborhoods, multiple composition targets, distinct parallel binding fields,
contracts owned by supporting nodes, empty Place handling, duplicate names,
source-order edits and metadata fallback. The two-step/five-step comparison
confirms local composition, description and contract rectangles remain identical
relative to their scope origin. Broader long-content and nested-reuse matrices
remain unfinished because this stage did not pass.

### Resume boundary

1. Read the failed scene/measurement/positioning records and this stop report.
2. Establish a contract-backed scene-input proof for branch, merge, diamond,
   cycle and self-loop transitions, preserving semantic identity and provenance.
   Shared algorithms must remain unchanged. Do not claim that merely reporting a
   diagnostic satisfies visual acceptance.
3. Make the strict topology tests pass, then complete the remaining Stage 6
   matrix and rerun the B5/full-sheet invariants.
4. Only then perform Stage 7: public preview integration, backend-aware
   preparation dispatch, compatibility checks, user documentation, accepted
   snapshot/corpus refresh and documentation-site build.

Public renderer code in `staged/uiContracts.ts`, preview workflow selection,
legacy rendering and unrelated views remain at their existing implementations.
The new preparation target exists but public workflows still use the default.

## Stage 6 resumed — original failures resolved; long-ID gate blocked

The user's [visual solutions](stage_6_visual_issues_solutions.md) supplied the
accepted route and enclosure treatment. The new scene inputs now pass the
branch, merge, diamond, cycle and self-loop cases in all eight option settings.
Sibling leaves share an enclosure, child arrow approaches are 18px, and view-owned
SVG paint emits ordinary arrow paths for import compatibility. Native title bars
remain clean. Shared placement/routing, semantic-node rendering and original
reference/golden hashes remain unchanged.

The broader matrix passes nested reuse, disconnected roots, long content and
relationship provenance checks. However, four long-ID combinations expose native
shared-node decorator overflow. The 32-character semantic ID is valid source;
combined type/ID text reaches local x=268 in its fixed 224px semantic node. Both
native diagnostics and visible PNG overflow fail acceptance. This requires a
decision about the frozen shared-node overflow policy before Stage 7 may begin.

See [the resumed acceptance report](stage_6_resumed_acceptance.md) for the exact
input, options, geometry, code boundary, corrected visuals and resume conditions.
The initial Stage 6 failure evidence above is retained as history; its five
transition failures no longer describe the current implementation. Overall
Stage 6 remains blocked, and the public port remains incomplete.

Verification: the focused run passed 152/156 tests; all four failures concern the
long semantic IDs. The complete `TMPDIR=/tmp pnpm test` build succeeded and ran
1,206 tests: 1,201 passed, those same four failed, and one unrelated IA Place Map
test timed out. The complete five-test visual-acceptance suite passed on an
isolated single-worker rerun. No test limits changed. Full logs, the 120-option
topology matrix (116 passing, four blocked), native SVG/PNG, model/scene records,
coverage and the clean 49-source/49-reference/156-golden audit are retained under
`implementation_evidence/stage6_resumed/`. Documentation-site build and public
artifact refresh remain Stage 7 work, deferred by this acceptance gate.

## Stage 6 acceptance decision — passed with an explicit limitation

The user accepted long-ID overflow for this implementation and specified a
future `(long ID)` replacement outside the port's scope. Shared-node behavior
remains unchanged. The long-ID fixture now permits only the existing decorator
overflow warning and matching text-bounds finding; all raw evidence remains
recorded. The shared routing validator and every other acceptance check remain
strict. The topology matrix has 120 accepted combinations, four of which retain
that explicit limitation. This decision cleared the Stage 7 gate.

## Stage 7 — passed

The public staged SVG/PNG entrypoints use the B5 presentation model and scene
builders. Preview preparation selects staged or legacy coverage from the chosen
backend; structure-only Component diagrams remain applicable in compact batch
output. Legacy text/Graphviz keeps its existing model and behavior. Bundle
guidance and relationship documentation now reflect visible containment and
composition references.

The complete Departure Desk design passes all eight public detail/decorator
combinations. CLI smoke checks with isolated preferences verify user defaults,
explicit overrides, PNG, legacy DOT/Mermaid and batch applicability. The actual
helper preview produces the B5 SVG without diagnostics. Native container titles,
outlines, arrowheads and updated examples were visually reviewed. Ten accepted
staged UI-contract snapshots and sixteen staged SVG/PNG examples were refreshed.

The full `TMPDIR=/tmp pnpm test` integration run exposed an outdated test's
expectation of an outer sheet outline and a Journey Map timeout. The outline
test now checks B5's visible enclosure strokes and distinguishes the SVG `width`
attribute from `stroke-width`. Both affected suites pass. The final full run,
`TMPDIR=/tmp pnpm test --maxWorkers=1 --minWorkers=1`, passes **1,216 tests in
117 files**. Test timeouts were not changed. `TMPDIR=/tmp pnpm docs:build` passes
with the existing chunk-size advisory.

The protected-file audit confirms all 49 frozen source hashes, all 49 design
references and the unchanged Departure Desk checksum. Only the ten intended
staged UI-contract goldens differ from the 156 original golden hashes. Another
416 tracked legacy/unrelated generated artifacts match HEAD. See
[Stage 7 evidence](implementation_evidence/stage7/) and the
[final acceptance report](b5_implementation_acceptance.md).

Satisfied: complete public design, semantic/provenance coverage, all option
variations, native title bars, single-source contracts, frozen shared placement
and routing, and legacy compatibility. Retained with explicit acceptance:
long-ID overflow and B5's native right-edge excess. Actual Figma import remains
unverified because the connector tool limit prevented live access; ordinary SVG
arrow paths are verified. The port is complete within that accepted scope.
