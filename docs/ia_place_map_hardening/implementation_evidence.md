# IA place map hardening implementation evidence

Implementation began 2026-10-12 on `codex/ia-place-map-hardening`, from
`b15b348a7accc4e56a09405317ee1c9bfbd995e3`.

Existing work preserved: modified `progress.md`, untracked
`docs/etc/design_foundations/`, and the supplied `docs/ia_place_map_hardening/` plan.

## Governing invariants

- `bundle/v0.2/core/contracts.yaml`: membership selects exact occurrences;
  duplicate declarations warn; navigation supports event and guard only.
- `bundle/v0.2/core/views.yaml`: containment owns hierarchy and structural order.
  New opt-in presentation and exact-reference policy must be consumed at runtime.
- `AGENTS.md`: preserve v0.1 and other views; geometry remains downstream of
  projection; accept the visual proof before refreshing canonical artifacts.
- The hardening implementation plan supersedes the earlier parallel-navigation
  rejection exception for opted-in IA only.

## Baseline hashes (SHA-256)

| File | Hash |
| --- | --- |
| `bundle/v0.2/core/views.yaml` | `c9fc7f75d2c78dce2de4aa978128b93baa9d5f390445406f972950da0c8ae89a` |
| `bundle/v0.2/core/contracts.yaml` | `5c6f6d505d66cf73855c13ef7202f14b0b95a71fbda019947d38d06ce15b4564` |
| `src/renderer/staged/iaPlaceMap.ts` | `f0f1ff84178e2192d9dc9acb1318400b93bb5e9c32f1d654e15b856b26ba2266` |
| `src/renderer/iaPlaceMapRenderModel.ts` | `2dd11b1879a26547fb3632294ab65ffaf381e61b9ffbcf4fd68addbff69c74c6` |
| `src/projector/shared.ts` | `4e173a3538863b2b8b2c993aee08482b5e7db8d9a31140c876886f91c2efc905` |

## Independent proof inventory

Fixture: `tests/fixtures/render/ia_parallel_navigation_v02.sdd`.

Combined and DG-001: Areas A-001/A-002, Places P-001/P-002/P-003;
Events E-001/E-002 supply reference names and are not projected nodes.
Containment: A-001 → P-001, A-002 → P-002, P-002 → P-003.
Navigation has four occurrences:

1. P-001 → P-002, E-001, guard `workspace selected`, memberships DG-001/DG-002.
2. P-001 → P-002, E-002, guard `invitation valid`, memberships DG-001/DG-003.
3. P-002 → P-003, unannotated, membership DG-001.
4. P-002 → P-001, unannotated return, membership DG-001.

DG-002 and DG-003 each contain both Areas, P-001/P-002, their respective
navigation occurrence, and the two Area containment declarations. They exclude
P-003 and the neighboring/return navigation. The one-edge control selects DG-002.

Required baseline label payloads in both details:
`[Open current workspace] {workspace selected}` and
`[Accept invitation] {invitation valid}`. Unannotated navigation has no label.

The occurrence IDs are computed from independently declared source occurrences
using the bundle-owned identity contract, rather than copied from rendered scenes.

Proof status: accepted on 2026-10-12. Final combined, full named, and separate
named outputs passed independent audits and visual inspection in both details
before the affected canonical artifacts were refreshed.

## Executed baseline

- Node 22.17.0 / pnpm 10.31.0; TypeScript build passed.
- Plan's focused baseline: 12 files / 113 tests passed.
- Additional acceptance/projection/public-preview baseline: 6 files / 51 tests
  passed. Log: `/tmp/ia-baseline-acceptance.log`.
- Graphviz check passed; `dot` version 2.43.0.
- New fixture compiles. Combined detailed SVG/PNG saved as
  `/tmp/ia-baseline-combined.svg` and `.png`.
- Visual inspection confirms combined baseline includes only the fused
  Workspace home → Workspace settings connector: both annotated cross-Area
  occurrences and the return are absent. This violates navigation completeness
  and required label invariants.
- DG-001 baseline withholds output with
  `renderer.scene.unsupported_parallel_occurrences` and return
  `renderer.routing.ia_place_map_endpoint_intrusion` errors.

These proof failures reproduce known gaps; they are not accepted evidence.

## Early implementation checks

- Bundle/reference gate: real-loader tests pass for exact combined/named source
  references, stale/missing/duplicate/omitted references, same-triple unselected
  named substitution, serialization, malformed policies, presentation
  order/templates/detail switches, reference type fallback, and coherent opt-out.
- Presentation/scene gate: combined and DG-001 have equal four-occurrence
  inventories; DG-002/DG-003 retain the selected authored label. Events remain
  reference-only. Singleton unannotated containment/navigation fusion carries
  both exact source identities. Same-name Events are consistently qualified by ID.
- Shared route seeding and ambiguity audit checks pass. Painted marker checks
  cover obstacle/route/label/marker collisions and root bounds.
- Shared corridor recovery regression: after collinear collapse, candidate
  terminal legs must still satisfy their declared endpoint minimum. The two
  regression tests pass without changing routing budgets.
- Detailed full proof passed independent final audits and visual inspection at
  `/tmp/ia-full-detailed.svg` and `.png`. Both annotated forward occurrences, the
  neighboring fused connector, and the return arrow are present and readable.
- Detailed public-path tests pass for source/serialized graph preparation,
  separate/full named output, named batches, combined batches, and forced fatal
  artifact withholding. Shared compatibility check passed 69 tests across five
  existing suites.

The early compact/header and BillSage marker failures were withheld. They were
resolved through owned padding, painted marker reservations, surviving terminal
leg checks, and measured terminal-channel capacity. No failed image was promoted
to a canonical artifact.


## Accepted implementation

The normative bundle changes are `bundle/v0.2/core/views.yaml`'s typed IA policy
and `core/contracts.yaml`'s presentation reference descriptor. They are consumed
by `loadBundle`, exact occurrence preflight/projection, the shared relationship
formatter, and the IA scene builder. Real-loader mutations prove that template
order, reference type, visibility, and capability absence change runtime behavior.
No parser, validation rule, semantic membership, or endpoint convention changed.

The IA adapter retains hierarchy/follower placement and uses shared measurement,
route seeds, port capacity, routing lifecycle, label search/capacity, and marker
geometry. New generic adjacent-gap intent and container remeasurement preserve
unaffected gaps while reflowing ancestors/later siblings. Header/exterior padding
and parent-to-child terminal channels have explicit geometric owners. Every
revision starts from the measured baseline plus absolute accumulated demands.
The existing expansion and search budgets remain unchanged.

The shared `obstacle_aware` corridor option is selected by the enabled IA adapter.
It filters impossible topologies before the existing candidate quota, checks
surviving terminal legs after collapse, and adds two-coordinate bends. Other
adapters retain their existing candidate behavior. The first broad full run found
changed Outcome expansion and Scenario route/expansion behavior; this explicit
option restored those checks without changing their tests or goldens.

Final acceptance checks coverage against the original source occurrence inventory,
text preservation across hard token wrapping, endpoint association/insets,
segment-specific structural sharing, competing label associations, node/header
clearance, painted markers, and export bounds. SVG checks acceptance before
serialization; PNG rasterizes the same accepted SVG. Actual overcrowded endpoint
capacity and injected fatal renderer failures withhold public artifacts under
`force`, in both combined and named output. Helper materialization also refuses
failed artifacts. Duplicate declarations still produce validator warnings.

### Visual evidence

The `evidence/` directory preserves accepted SVG/PNG pairs:

- `ia_parallel_navigation_v02.{compact,detailed}.{combined,DG-001,DG-002,DG-003}`:
  eight reviewed selections; combined/full named have four navigation occurrences,
  separate named selections retain their one authored label.
- `billSage_structure.{compact,detailed}.combined`: eight connections, including
  all three returns, with the original containment order, indent levels, direct
  vertical route, and segment-specific structural trunk geometry retained.
- `decorators.{compact,detailed}.type-id`: both decorators displayed; all four
  modes were also reviewed in both details.
- `three.compact`, `same-name.detailed`, `self-loop.detailed`, and
  `multiple-incoming.compact`: selected broader ownership/association proofs.

| Selection | Compact PNG | Detailed PNG |
| --- | --- | --- |
| Combined | [View](evidence/ia_parallel_navigation_v02.compact.combined.png) | [View](evidence/ia_parallel_navigation_v02.detailed.combined.png) |
| Full named DG-001 | [View](evidence/ia_parallel_navigation_v02.compact.DG-001.png) | [View](evidence/ia_parallel_navigation_v02.detailed.DG-001.png) |
| Open workspace DG-002 | [View](evidence/ia_parallel_navigation_v02.compact.DG-002.png) | [View](evidence/ia_parallel_navigation_v02.detailed.DG-002.png) |
| Accept invitation DG-003 | [View](evidence/ia_parallel_navigation_v02.compact.DG-003.png) | [View](evidence/ia_parallel_navigation_v02.detailed.DG-003.png) |
| BillSage compatibility | [View](evidence/billSage_structure.compact.combined.png) | [View](evidence/billSage_structure.detailed.combined.png) |
| Both decorators | [View](evidence/decorators.compact.type-id.png) | [View](evidence/decorators.detailed.type-id.png) |

Additional reviewed images in `/tmp/ia-final-evidence/` cover identical duplicates,
three parallels, same-name Events, long labels, hard-wrapped tokens, self-loops,
and multiple incoming/child return navigation in both details. Every image was
rendered from an independently audited final scene. Long token text wraps without
losing characters; the guard distinction remains visible.

The loaded v0.2 endpoint contract does not allow `Area CONTAINS Area`. This work
preserves that semantic boundary. Legal nested Place ownership within Areas is
covered by the proof, child return variant, BillSage recursive scopes, and generic
adjacent-gap reflow test; no nested-Area semantic convention was invented.

### Intentional canonical differences

Only these downstream artifacts were refreshed after visual acceptance:

- Two v0.2 IA projection snapshots gain exact `source_edge_id` metadata. Topology
  remains unchanged; other combined projections retain their serialization.
- Four BillSage renderer-stage goldens capture complete occurrence/marker inventory,
  ports, owned terminal-gap expansion, return paths, and accepted SVG.
- Twenty-four artifacts for the two curated v0.2 IA examples, in both details:
  DOT/Mermaid labels and staged/legacy SVG/PNG label parity. Graphviz keeps its own
  layout. Every candidate PNG and the DOT/Mermaid payloads were reviewed before
  copying them to canonical paths.
- The v0.2 rendered corpus README now describes occurrence-complete IA output.

No v0.1 corpus, unrelated view artifact, or preserved compatibility golden changed.
`progress.md` and `docs/etc/design_foundations/` remain the user's pre-existing work.
No commit, push, or PR was created.

## Final verification

- Accepted projection/stage/visual/bundle gate: 4 files / 29 tests passed
  (`/tmp/ia-final-acceptance.log`).
- Geometry broad matrix and SVG/PNG determinism/final corruption checks: 26 tests
  passed; public-path checks passed after correcting a test's warning severity
  spelling (`warn`, not `warning`).
- Restored unrelated Outcome/Scenario routing checks: 2 files / 2 tests passed
  (`/tmp/ia-unaffected-routing.log`); the Scenario eight-expansion regression also
  passed in `/tmp/ia-gated-acceptance.log`.
- Built CLI smoke checks passed: combined detailed SVG and all three compact named
  PNGs (`/tmp/ia-built-cli.log`, `/tmp/ia-built-named.log`).
- TypeScript build and documentation build passed. The site build reported its
  existing large-chunk advisory. Graphviz availability and whitespace checks pass.
- Final full suite: **163 files / 1,784 tests passed**, including the build;
  600.73 seconds (`/tmp/ia-final-full-tests.log`).
- Final shared marker/terminal regression check: 2 files / 7 tests passed
  (`/tmp/ia-final-marker-check.log`).
- All cited acceptance invariants are satisfied within the preserved bundle
  semantics; no remaining violated invariant or unresolved implementation gate.
  The work is accepted. Full v0.1 compatibility and unaffected-view checks passed.

The initial broad run had six failures: two stale IA golden/projection checks,
one IA visual routing failure, and three shared-search compatibility regressions.
These were addressed through accepted IA artifacts, owned channel capacity, and
opt-in corridor search. No unrelated acceptance assertion was weakened.


### Reproducible evidence identifiers

SHA-256 of final proof inputs and governing policies:

| File | SHA-256 |
| --- | --- |
| `tests/fixtures/render/ia_parallel_navigation_v02.sdd` | `7f102024be0c535a25d74f92f3754d8bd3b71d5398f2cab29b73782901b50b41` |
| `bundle/v0.2/core/views.yaml` | `e3e5eb428abe410fa7d5fa03a80d9a1597e1a317ad30aba5873f8f32a98af624` |
| `bundle/v0.2/core/contracts.yaml` | `a53bfddfbe18aebb107710b8476035078ee977a9e1ff4476a76edb64b1a19eb0` |

Preserved accepted artifacts have a per-file SHA-256 inventory in `evidence/sha256.txt`.

## 2026-10-13 correction: routing recovery

The historical acceptance claim above was rejected by
[manual visual review](manual_review_routing_failures.md). Its original proof images
and hashes remain preserved; they must not establish current routing quality.
The [recovery execution](routing_quality_execution.md) records the observed
failures, subsequent fixes and independent numerical/visual acceptance. New
[SVG-only proofs](routing_quality_evidence/README.md) capture the corrected output,
measured expansion decisions, rejected alternatives and current source hashes.
The user's instruction supersedes the recovery plan's PNG proof commands.

Independent acceptance now passes 154/154 checks and normal-scale SVG review is
acceptable in both details, named/decorated selections and the loop/incoming
variants. Exactly four affected BillSage v0.2 renderer-stage goldens changed after
those gates; their suite passes 9/9. Projection snapshots, v0.1, LEGACY and the
historical evidence/corpus are preserved. Full-suite closure is recorded in the
recovery execution report: **174 files / 1,932 tests passed**, including the build,
in 578.64 seconds. All cited recovery invariants pass; the corrected work is accepted.
Final acceptance must use the recovery report and its new SVG proofs.
