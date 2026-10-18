# UI Contracts implementation status

2026-10-18. **All three review findings corrected and independently checked.**

The corrections are in the working tree based on `239aad6`. They supersede the
original completion assessment for content containment, return-metric ownership,
and multi-loop search fairness. Public APIs, bundle policy, default search limits,
v0.1 and LEGACY behavior remain unchanged.

| Review finding | Correction | Regression evidence |
| --- | --- | --- |
| Clipped headers could pass publication | Shared read-only bounds audit checks actual painted headers, ordinary content and shared-node decorator/title/attributes against their owner and viewport | Ten new checks failed before the fix; SVG/PNG rejection, diagnostic output and audit immutability pass afterward |
| Return rail coordinates persisted in scene intent | Removed `returnTrack`; allocation derives offsets from the current measured revision and declared return order/owners | Two new checks failed before the fix; labelled/unlabelled returns, changed measurements, actual theme remeasurement and production consumption pass |
| Side combinations starved capacity retries | Focused-side warmup followed by alternating FIFO capacity retries and lazy seeds; only near-term work reserves budget | Three loops with eight candidates and twelve loops with 32 candidates now accept after one expansion; FIFO order, zero limits, no-loop input and accepted-revision retention pass |

Verification: `TMPDIR=/tmp pnpm test` passed **198 files / 2247 tests**, including
the TypeScript build, in 524.32s. The focused correction run passed 72 tests across
six files. Logs: `/tmp/ui-review-fixes-full-suite.log` and
`/tmp/ui-review-fixes-focused.log`; red/green evidence is in
`/tmp/ui-content-{red,green}.log`, `/tmp/ui-return-{red,green}.log`, and
`/tmp/ui-scheduler-{red,green}.log`.

Fresh full-sheet and DG-002 CLI SVGs and the production proof driver pass with
zero final audit findings. Both SVGs are byte-identical to the saved pre-fix
production baseline; full PNG is byte-identical to its CLI export. The current
search counts are recorded below. Fresh loop, named-pair, top, containment and
bottom crops were inspected. Independent probes on the regenerated full scene
confirm displaced headers and shared-node titles fail both SVG and PNG publication
without mutating the scene. All three reviewed invariants pass; no blocking issue
was found in the final correction review. This remains bounded search, not a
global routing feasibility guarantee. No historical goldens were refreshed.

## Original implementation gates — 2026-10-17

The following gate results record the initial implementation; the review
corrections and latest regression totals above supersede its completion claim.

Baseline checkout: `codex/prototype-ui-contracts-routing`, `7b49a59`.
Preserved pre-existing `routing-prototype/ALLOCATION.md` edit and untracked design,
implementation plan, and scope-correction documents. No resets or golden refreshes.

Authority: [architecture](ui_contracts_compact_loop_design.md) §§1–9 governs behavior;
[AGENTS.md](../../AGENTS.md) governs bundle authority and staged rendering;
[focused comparison](../../src/renderer/staged/routing-prototype/FOCUSED-COMPARISON.md)
is the visual exemplar, not a production implementation.

Acceptance invariants: complete occurrence/path/label/marker coverage; independently
bound same-edge ports and theme-derived compact geometry; policy-ranked valid trials;
unchanged proof cards and pair up to translation; owned space with real reflow;
read-only acceptance on exported geometry; bounded deterministic search with explicit failure.

| Step | Implemented behavior | Commands/results | Satisfied / violated invariants | Evidence / next step |
| --- | --- | --- | --- | --- |
| Baseline | Checkout and authorities inspected | Build passed; five limited suites: 187 passed | Historical mixed capture retains five errors; named capture has none | Historical captures preserved |
| 0 | Cached actual-source preparation; authored DG-002 membership; normalized pair comparison | `uiContractsProofBaseline.spec.ts`: 6 passed | Full scope has 3 transitions, DG-002 has 2; current pair matches historical geometry; altered routes/labels detected | Source SHA256 `2403cb8aa57b17e54af5e68fe3e908fc3a98d0a9cf84c2098396370f12ae3bf7` |
| 1 | Strict optional schema, validation, model/root/edge metadata transport | Build passed; policy: 55 passed; existing model/IA: 41 passed | Malformed policy rejects; absence retains compatibility; runtime mutation tests pass (equal-fit order, traversal, owner/node capacity) | v0.2 YAML enabled; v0.1 unchanged |
| 2–4 | Complete return/loop intent; independent bindings; read-only audit; async owned-padding rebuild | Focused production proof: 1 passed | Three arrows, full labels, 224×53 cards, 23×17 loop, unchanged normalized pair; north rejected by actual collision/association; south accepted after one owner rebuild | `/tmp/ui-compact-loop-outcome.json`; ownership, junction and complete-return checks pass |
| Shared fixed routes | Opt-in constraint propagated through lifecycle/occupancy/proposals/identity | Build passed; 9 new + 118 existing routing tests | Fixed routes remain checked and blocking, cannot move | No default behavior change |
| 5 | Async coordinator, lazy complete assignments, isolated ledgers, cumulative work, repetition guards and accepted-revision retention | Lifecycle: 12 passed; actual full sheet passes default-budget coordinator | Explicit failures, baseline fairness, coherent retained stages verified | Enabled-bundle integration: 209 passed across 19 files; final full suite: 2231 passed |
| 6 | Port-demand minima through preliminary/final measurement, shared groups and original-height floor | 13 new measurement + 39 existing measurement/layout passed; 3 integrated port-growth cases passed | Crowded fanout grows only its source occurrence to 240×53; unrelated tall label has no sizing effect; grouped loops avoid moving reservations | Enabled-bundle integration: 209 passed across 19 files; final full suite: 2231 passed |
| 7 | Public coordinator routing and exact SVG audit; PNG from same audited SVG; diagnostic-artifact intent | 18 publication + 27 existing backend/workflow tests passed | Mutated endpoint, full label, marker, inventory and root metadata reject; force retains errors; named output suppresses errors | Actual full and DG-002 CLI SVG plus full CLI PNG pass without force |
| 8 | Real topology compatibility, runtime policy mutations and v0.2 capability enablement | 16 topology + 3 mutation + 4 complete-return + 3 junction-marker tests passed in focused runs | No invented bars; painted marker intersections reject even inside a shared path; ordinary returns have complete distinct approaches | Build, full repository suite (2231 tests / 198 files), exact CLI SVG/PNG and five visual inspections pass |
| Final | Actual shipped policy through CLI and backend; complete repository regression | `TMPDIR=/tmp pnpm test`: **198 files, 2231 tests passed**, 461.60s; `git diff --check` passed | All cited acceptance invariants satisfied; none violated in the proof or tested compatibility cases | Production SVG/PNG, exact-scene report and visual record linked below; no remaining implementation step |

## Actual production evidence

The final shipped policy is enabled in `bundle/v0.2/core/views.yaml`.
`resolveUiContractsPresentation` validates it; `buildUiContractsPresentationModel`
transports it; `runUiContractsRendererPipeline` consumes it. Mutation tests change
side ranking, traversal, owner capacity, and node-growth behavior through loaded
bundle data. The [runtime notes](ui_contracts_routing_runtime.md) describe the seams.

Artifacts produced from the unchanged actual source, with the shipped bundle:

- [Full SVG](/tmp/sdd-ui-contracts-production-proof/full.svg) and [PNG](/tmp/sdd-ui-contracts-production-proof/full.png).
- [DG-002 SVG](/tmp/sdd-ui-contracts-production-proof/dg002.svg) and [PNG](/tmp/sdd-ui-contracts-production-proof/dg002.png).
- [Exact-scene acceptance report](/tmp/sdd-ui-contracts-production-proof/acceptance-report.json), with source/revision/runtime-and-bundle hashes, policy, settings, budgets, rejected findings and capacity ledgers.
- Positioned scenes: [full](/tmp/sdd-ui-contracts-production-proof/full.positioned.json), [DG-002](/tmp/sdd-ui-contracts-production-proof/dg002.positioned.json).
- [Visual inspection record](/tmp/sdd-ui-contracts-production-proof/visual-inspection.json), [full proof crop](/tmp/sdd-ui-contracts-production-proof/full.inspection-crop.png), [named proof crop](/tmp/sdd-ui-contracts-production-proof/dg002.inspection-crop.png).

| Export | Node occurrences | Relationships | Physical connectors | Final audit findings | Candidates / repairs / expansions |
| --- | ---: | ---: | ---: | ---: | --- |
| Full | 183 | 130 | 235 | 0 | 3781 / 0 / 2 |
| DG-002 | 134 | 87 | 157 | 0 | 1861 / 0 / 1 |

The full proof has all three intended transitions. The named selection has its
actual two authored transitions. Both retain 224×53 proof cards and the historical
forward/return geometry up to translation. The accepted loop is south, has negative
x traversal, pitch 23 and outward depth 17, with the complete three-line external
label. North is rejected by actual label collision/association findings. Owner
padding participates in measurement/layout and moves following content.

The evidence driver matches both SVGs byte-for-byte against their CLI exports.
The independently rerun full CLI PNG also matches the evidence PNG byte-for-byte
(SHA256 `36fb64f201eed0505759ff7810097ab4f8f9d2909685193b247a3c82c9ae2e65`).
PNG consumes the same accepted SVG and does not run a separate layout.

Exact commands, from the repository root:

```sh
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm sdd show aeb_help_center_de_astra.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --view ui_contracts --detail compact --decorators type,id --format svg --out /tmp/sdd-ui-contracts-production-proof/full.svg --diagnostics json
TMPDIR=/tmp pnpm sdd show aeb_help_center_de_astra.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --view ui_contracts --diagram DG-002 --detail compact --decorators type,id --format svg --out /tmp/sdd-ui-contracts-production-proof/dg002.svg --diagnostics json
TMPDIR=/tmp pnpm sdd show aeb_help_center_de_astra.sdd --bundle bundle/v0.2/manifest.yaml --profile simple --view ui_contracts --detail compact --decorators type,id --format png --out /tmp/sdd-ui-contracts-production-proof/full.png --diagnostics json
TMPDIR=/tmp node scripts/ui-contracts-production-proof.mjs
TMPDIR=/tmp pnpm test
```

The proof crop, named crop, top of the full sheet, containment region and bottom
were inspected as rasterizations of the production SVG. Only crop viewports were
changed for inspection; full artifacts and accepted scenes remain unchanged.
The loop/label/card/pair/reflow and preserved containment presentation are visually
acceptable. No cited visual invariant is violated. Historical prototype evidence
and snapshots/goldens were not regenerated.

## Original verification history and continuing limits

Build and the focused enabled-bundle integration pass (209 tests across 19 files;
`/tmp/ui-final-focused.log`). The first full regression pass exposed four packing
fixtures calling the intentionally rejected generic enabled-policy pipeline. These
fixtures now compare fitting before/after at the shared measurement/layout seam;
public rendering, final audit, snapshots and SVG/PNG identity retain production
coverage. The corrected packing suite passes all 38 tests. The B5 historical
source-hash guard now explicitly allows the authorized opt-in `sharedNode.ts`
minimum-extent extension; its stored historical hashes and all geometry evidence
remain unchanged, and all 14 replay tests pass. The final budget reservation
adjustment passes 17 lifecycle/complete-return/full-production tests. The final fresh full repository run includes these corrections and passes:
**198 test files, 2231 tests**, duration 461.60s. Its `pnpm test` command includes the
TypeScript build. The final whitespace check also passes. Logs:
`/tmp/ui-full-suite-final.log`, `/tmp/ui-final-build.log`,
`/tmp/ui-packing-final-pass.log`, `/tmp/ui-b5-final-pass.log`,
`/tmp/ui-budget-final.log`. The earlier superseded full run was stopped after its
five stale test checks had been diagnosed; the final run is a complete clean pass.

Bounded search is not a global feasibility proof. Exhaustion, unsupported resource
ownership and impossible pinned attachment ordering report failure; ordinary
publication remains blocked. Explicit combined-view diagnostic intent retains
errors and designation. No acceptance diagnostics were downgraded. No core acceptance requirement remains open.


Ownership correction: forward edges retain the inner sequence as layout owner so rank assignment and measured layer gaps remain unchanged. Returns and loops use the declared outer transition owner. The initial integration incorrectly removed forward edges from rank calculation; the failing proof exposed it and the ownership correction restored the historical pair.

Capacity evidence: the transition-owner south demand is 96 units; the historical 80-unit crop demand used the surrounding scope, which already contributed 16 units below the transition. The demand is computed from actual production envelopes, not a renderer constant. Stack and packed-row tests verify 96-unit displacement of following scopes and matching growth of actual ancestors.

Initial integration corrections: route recovery reserved side-seed work just as label recovery did; the October 18 scheduler correction above replaces its exhaustive reservation. Shared marker groups were initially too broad. UI now grants only margin relief for declared physical path/junction incidence, while actual painted footprints block every other segment. Separate regressions mutate both a sibling branch and a shared stem through an arrow; normal serialization rejects both. Multiple returns use readable port pitch, distinct rails, and a local final approach; shared vertical label search includes obstacle-boundary events. No diagnostics were downgraded and no historical evidence/goldens were refreshed.
