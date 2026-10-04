# Diagram separation v0.2 implementation report

This report accompanies `diagram_separation_v0_2_implementation_plan.md`.
All acceptance invariants and implementation gates are satisfied. The explicit
staged IA backend limitation is recorded below.

## Authority and acceptance

The governing contract is the loaded v0.2 bundle. `AGENTS.md` supplies
architectural constraints. Independent test fixtures provide inventories and
visual proofs; the user's temporary scenario planning files are not dependencies.

| Invariant | Status | Evidence |
| --- | --- | --- |
| I1 Combined selection | Passed | Annotated/control projection equality; combined SVG equals clean baseline; preexisting corpus unchanged |
| I2 Exact edge selection | Passed | Guarded occurrence proofs; missing/mismatched/unselected references rejected; exact scene IDs |
| I3 Additive endpoints, no closure | Passed | Independent inventories; isolated/disconnected/cyclic and metamorphic exclusion tests |
| I4 Single authored membership | Passed | Literal properties preserved; resolver derives inventories/inclusion reasons without synthetic relationships |
| I5 Shared semantics/global validation | Passed | Membership-independent identity; duplicate warnings and strict obligations retained |
| I6 References do not expand topology | Passed | Cross-view isolation and real-bundle reference label/detail mutation tests |
| I7 Bundle authority | Passed | Real-loader mutations through projection/text/SVG/PNG; invalid references fail load |
| I8 Projection boundary | Passed | One shared selection context; staged scene/measurement/layout/SVG/PNG retained |
| I9 Public path agreement | Passed | Core/CLI/helper lifecycle, edit/form atomicity and direct text/preview semantic preflight |
| I10 Distinct artifact identity | Passed | ID-based paths, duplicate-title safety, revision/bundle-scoped resource URIs, distinct batches |
| I11 Compatibility | Passed | v0.1 tree untouched; combined snapshots/goldens and full suite pass; preexisting v0.2 corpus byte unchanged |
| I12 Acceptance before evidence | Passed | Independent visual proof accepted before canonical registration; new artifacts match accepted evidence |

## Gate log

| Gate | Status | Evidence |
| --- | --- | --- |
| 0 Baseline/proof expectations | Passed, scoped baseline failures | Clean Git baseline build; 133/135 focused tests; accepted control PNG; independent 11/9 and 5/4, 4/3, 3/2 inventories |
| 1 Bundle contract | Passed | `diagramMembership.spec.ts` real-loader mutation/negative tests; old bundles load |
| 2 Resolution and identity | Passed | 52 membership tests, exact identity, source duplicate checks, global obligations |
| 3 Scenario projection isolation | Passed | Inventory/metamorphic/guard/cycle/empty and occurrence-corruption proofs |
| 4 Scenario rendered acceptance | Passed | Eight compact/detailed scenario PNGs inspected; named LEGACY SVGs; combined SVG equals baseline |
| 5 Remaining views | Passed | Seven cross-view named targets in both details/all supported backends; IA cross-scope connector repaired and accepted |
| 6 CLI/helper/artifacts | Passed | Selectors, discovery, exact edits/undo, malformed candidate/form atomicity and structured failures |
| 7 Documentation/evidence | Passed | Definition/site/helper/skill guidance; canonical snapshots/corpus; highlighting generated after acceptance |
| 8 Final verification | Passed | 149 files / 1,629 tests; build, docs, generation, highlighting and final compatibility/diff audits passed |

## Initial working tree and baseline

The working tree initially contained deletion/addition pairs renaming the two
step-differentiation planning/report documents with a `[Done]` prefix. These are
unrelated and preserved. No v0.1 changes are authorized by this feature.

`TMPDIR=/tmp pnpm run build` succeeded before implementation. Focused baseline
checks in `projectionServicePublicApi`, `viewProjectionSemantics`,
`stagedScenarioFlow`, `render_dot`, and `render_mermaid` passed (19 tests).
A broader baseline run overlapped bundle implementation and observed transient
bundle inconsistency; that run cannot establish preexisting failures. Its log
is `/tmp/sdd-diagram-baseline.log`. Final verification must use a coherent tree.

A clean `git archive HEAD` checkout under `/tmp/sdd-diagram-baseline-clean`
subsequently passed its build and 133/135 focused baseline tests. The two
preexisting failures are `stagedIaPlaceMap`'s BillSage geometry proof and
`stagedVisualAcceptance`'s IA proof: their test runtime selects an incompatible
bundle for the already-v0.2 BillSage source. This scope is independent of named
membership. The log is `/tmp/sdd-diagram-clean-baseline.log`.

The control was rendered with that baseline runtime as
`/tmp/sdd-scenario-baseline.svg` and `.png`, with no diagnostics. Its 11 nodes,
9 edges, disconnected flow, labels, and geometry were inspected and accepted.

## Runtime ownership

| Governing bundle fields | Generic runtime consumers |
| --- | --- |
| `bundle/v0.2/core/vocab.yaml`, `core/schema.json`: Diagram token and metadata representation | `loadBundle` → `createParserSyntaxRuntime(bundle)` → existing parser/compiler; no new grammar branch |
| `core/contracts.yaml`: `diagram_membership.declaration_type`, `type_property`, `membership_property`, `metadata_only` | `checkDiagramSourceProperties`, `resolveDocumentDiagrams`, `resolveDiagramSelection`, helper metadata/forms |
| Descriptor `references`, `source_multiplicity`, `selection`, `diagnostics` | Source checks before collapse; normalization/explicit occurrences/additive endpoints; global membership validation and helper serialization |
| Common `duplicate_edge_identity`: `key_fields`, `ignored_fields`, `property_exclusion_refs` | `semanticEdgeIdentity`/`semanticEdgeProperties`; validator, semantic relationship reader, authoring duplicate checks, render identity consumers |
| `core/views.yaml`: `projection.named_diagrams.enabled`, existing node/edge selectors/reference policy | Resolver eligibility; shared projection context separates selected structure and authorized document lookup |
| `core/projection_schema.json`: optional named identity and required exact references on named edges/annotations | Projection schema validation, source-edge index, all six render models and scene edge identity |
| `core/authoring.yaml`: DG suggestion/form, bundle view choices and membership fields | Generic field resolution, resolved helper contracts, guided catalog/forms and prefix checks |
| All three validation profiles: membership rule activation | Existing full-document profile validation, with invalid metadata errors in every profile |

Bundle contracts, views, schema, and authoring artifacts continue to participate
in the existing bundle fingerprint. Source checks operate on parsed property
occurrences. The shared resolver below projection derives memberships and exact
edge associations; it does not modify the compiled graph. Projection passes
selected structural content separately from authorized full-document reference
lookup. Renderers consume projection and occurrence associations through the
existing staged pipeline.

The architectural `COMPILED_EDGE_FIELD_REGISTRY` validates identity field names;
it is a compiler data-contract registry rather than a spec keyword table. The
shared source index hashes directed declaration identity plus duplicate ordinal
in canonical graph order. Named projections and annotations carry exact references;
missing, wrong-triple or unselected references never fall back to endpoint lookup.
Combined serialization omits the new fields. Descriptor absence controls capability,
with no version-dependent interpretation. No ELK or second layout pipeline was added.

## Scenario visual acceptance

Artifacts are under `docs/v0.2_syntax_extension/evidence/diagram-separation/`:
`combined.{compact,detailed}.{svg,png}` and
`DG-00{1,2,3}.{compact,detailed}.{svg,png}`, with named `.legacy.svg` siblings.
All eight PNGs were inspected. The three named outputs have their intended
independent flows, correct shared-node branch labels, no duplicate node, and no
clipped labels. The combined compact SVG is byte-identical to the unannotated
control and clean baseline. The proof is acceptable.

Graphviz 2.43.0 is available: `pnpm run check:graphviz` and `dot -V` passed.

## Cross-view visual acceptance

All cross-view compact/detailed PNGs were inspected by the renderer agent and
explicitly accepted. The primary agent additionally inspected detailed UI/blueprint
and cross-scope IA. Paths below are relative to the same evidence directory;
each `{svg,png}` pair exists.

| Target | Inspected artifacts | Judgment |
| --- | --- | --- |
| Journey | `DG-101.{compact,detailed}.{svg,png}` | Accepted; selected Stage context and reference-only annotations |
| Service blueprint | `DG-201.{compact,detailed}.{svg,png}` | Accepted; selected lanes and relationships |
| IA | `DG-301.{compact,detailed}.{svg,png}`, `DG-399.cross-scope.{svg,png}` | Accepted; explicit hierarchy/navigation, cross-scope connector retained |
| Outcome-opportunity | `DG-401.{compact,detailed}.{svg,png}` | Accepted; external annotations do not expand primary members |
| UI contracts | `DG-501.{compact,detailed}.{svg,png}` | Accepted; exact guard and selected ownership |
| UI State fallback | `DG-502.{compact,detailed}.{svg,png}`, `DG-503.{compact,detailed}.{svg,png}` | Accepted; unrelated ViewState does not suppress fallback |

Cross-scope IA initially selected a navigation edge that the staged scene omitted.
Shared exact-connection completion now uses the existing orthogonal router and
occurrence IDs to retain it. The proof passes and is accepted. Combined scenes
are unchanged; no layout tuning or refreshed golden concealed the failure.

## Mutation, identity and public-path proofs

`diagramMembership.spec.ts` uses coherent temporary bundles and the real loader
to prove convention/prefix renaming, delimiter changes, eligibility/enablement,
identity exclusion behavior, and coherent capability removal. Inconsistent
dependent fields fail bundle validation. New artifact fields affect fingerprints.
No second production keyword list establishes behavior.

The renamed real-loader proof covers exact primary inventory, a selected guard
against an unassigned same-endpoint guard, DOT/Mermaid, accessible SVG title and
Diagram ID, and SVG-derived PNG. Disabling named support retains combined DOT/SVG
for valid unannotated input. Predicate reference paths absent from every registry
entry fail load rather than silently producing empty choices; all-false values
and partially absent entries remain supported. Node/edge eligibility mutations
are coherent with their dependent reference descriptors.

`diagramSeparationProjection.spec.ts` asserts the independent inventories and
control equality, then changes excluded nodes/edges/Diagram declarations without
changing primary structure. It covers shared edges, isolated/disconnected/cyclic
content and same-endpoint guarded occurrences despite differing source/canonical
order. Guard correctness survives raw projection, DOT/Mermaid and SVG. Empty or
detail-hidden targets produce no artifact, including force paths. Corrupt source
references fail directly at text and preview backend boundaries.

The final audit reproduced a same-triple source-reference substitution that initially
rendered an unassigned guarded edge. Shared semantic preflight now checks the exact
selected occurrence inventory through the resolver, including missing selected
occurrences and unassigned annotations. The normal projection path supplies its
already-resolved trusted set. Tests reject primary, annotation and coordinated
corruption with diagnostics and no artifact. Renderers do not parse membership or
run a separate selection algorithm.

`diagramSeparationViews.spec.ts` checks every view through raw selection, both
details, SVG/PNG and supported LEGACY paths. Real-loader reference label/detail
changes affect annotations without expanding topology. UI `place_id` alone cannot
create named ownership without its structural edge. Scene occurrence 1 and 10 use
exact equality rather than an ID substring.

`diagramHelperIntegration.spec.ts` creates declarations and node/edge membership,
discovers inventory, validates, projects, previews, edits and undoes. Edits preserve
endpoints, relation, event/guard/effect, hints, comments, unrelated property occurrences
and order. Invalid assignments and stale revisions are atomically rejected.
`projection_diagrams` uses the same selection during candidate evaluation. Guided
`browse_filters.diagram_id` retains its view-type meaning; no automatic membership
or new guided workflow was added.

Generic edge edits reject candidate parse/compile failures before persistence;
leading/trailing/double delimiter empty elements are rejected by forms as well as
the resolver. Helper delimiter serialization/form-choice mutation uses copied bundle
files and the real loader. Repository-owned preview-reuse guidance requires Diagram
ID (or combined scope) agreement.

`diagramSeparationCli.spec.ts` proves inferred/conflicting selectors, explicit single
paths, distinct combined/named batches, duplicate-title safety, empty-target skip
rules, global invalid membership blocking force and per-target backend failures.
Supported siblings can render while the batch records failure. Resource identity
includes Diagram ID plus existing revision/bundle/view/detail/backend/format context.

## Canonical evidence and compatibility

After acceptance, the independent proof was copied to
`bundle/v0.2/examples/scenario_separation.sdd`. The manifest registers one compiled
and four projection snapshots (combined and three named). Snapshot readers honor
optional `diagram_id`. Existing snapshots were not regenerated.

The proof intentionally remains a minimal simple-profile draft. Simple/permissive
report zero errors. Strict retains 11 prefix, 55 required-property and 11 realization
errors; the canonical test verifies these global requirements instead of weakening
profiles or rewriting the visually accepted source.

Shared declaration discovery drives named corpus generation, independently of
snapshot filenames. The generator validates full documents before replacing any
evidence and preflights detail visibility. Skipped draft/detail targets are recorded;
invalid documents preserve previous evidence. Dedicated generation tests prove this.

Generation added 97 files under
`examples/rendered/v0.2/scenario_flow_diagram_type/scenario_separation_example/`.
All 16 default SVG/PNG files equal the previously inspected evidence byte-for-byte.
Every preexisting v0.2 rendered artifact is byte-identical to Git HEAD; only the
README adds four targets. Bundle-selected highlighting adds Diagram to token,
indent and fold patterns. No v0.1 bundle/definition/example/snapshot/corpus changed.

The two BillSage harnesses now explicitly load the existing source's v0.2 bundle;
source and visual expectations are unchanged. Geometry/visual/B5 compatibility
checks pass (28/28). The historical B5 source hash guard explicitly lists
plan-authorized source extensions while retaining historical hashes, design
references and behavioral replay assertions.

## Verification and remaining limitation

Focused results: final membership/projection/syntax 62/62 (52 + 9 + 1); earlier
step/core regression 62/62; projection/cross-view/preview/scene regression 41/41;
final projection/cross-view 20/20; helper regression 106/106 and final
helper/mutations/contracts 40/40; CLI regression 86/86; canonical
compile/validate/projection 14/14; corpus 17/17; generation 5/5; highlighting 30/30.
Final complete suite: **149/149 files and 1,629/1,629 tests passed**, including
the build, in 409.23 seconds. Command:
`TMPDIR=/tmp pnpm test --maxWorkers=4 --minWorkers=4`.

The initial complete run exposed three final compatibility assertions: the skill
preview-match sentence needed the new Diagram identity requirement; duplicate
warnings had gained an unsolicited span; and a Journey mutation appended a field
while still explicitly excluding it. The warning shape was restored without
changing goldens. The two tests now check the revised identity requirement and
coherent inclusion/exclusion policy. Targeted repair checks passed 73/73 and 11/11,
plus the skill's independent 11/11 check. Final verification uses the corrected tree.

That first complete run finished with 144/149 files and 1,624/1,629 tests passing.
The other two failures hit unchanged 60-second limits in wrapper/highlighting
subprocess tests under parallel load. The full rerun used four workers without
raising timeouts or changing tests to tolerate failure. Both passed in that run:
the v0.2 wrapper lifecycle took 17.47 seconds and the highlighting script 27.03 seconds.
Initial log:
`/tmp/sdd-diagram-initial-full-tests.log`; final log:
`/tmp/sdd-diagram-final-tests.log`.

Build, v0.2 corpus generation, highlighting generation and docs build passed.
The site was rebuilt after corpus generation finished because its pages embed
generated files. `git diff --check` and narrow v0.1 audit passed. Unrelated initial
working-tree document renames remain preserved. The temporary wrapper directory
left by the initial timed-out run was removed after all checks finished.

One permitted backend limitation remains: multiple directed IA navigation
occurrences with identical endpoints selected together in a staged diagram return
`renderer.scene.unsupported_parallel_occurrences` and no artifact. LEGACY Graphviz
supports that selection. Separate named diagrams selecting individual occurrences
pass. No occurrence is silently collapsed or substituted. The site documents
the limitation and the existing backend alternative.
