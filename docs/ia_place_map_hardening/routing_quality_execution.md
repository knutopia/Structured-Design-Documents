# IA routing quality execution checkpoint

**Actual Status: Good, but rejected after manual review, pending small corrections**:
[manual_review_2_routing_quality.md](manual_review_2_routing_quality.md)

Status: **implemented and accepted; all verification gates closed**. Initial checkpoint recorded 2026-10-12
(local workspace date; test process timestamps use UTC). Original checkout HEAD:
`276d28b239028c0a71a8aec4ba091e5147282af5`. The initial workspace was clean.
Existing focused tests were run before implementation edits. The new quality
baseline ran concurrently with implementation and therefore is **not an untouched
HEAD baseline**. Its singleton passes cannot establish the original output's
acceptance. Historical `evidence/` files remain unchanged. Golden changes and final
SVG evidence are recorded in the dated continuation below; earlier checkpoint
failures remain historical and are superseded only by the stated later checks.

## Authority and acceptance invariants

- `bundle/v0.2/core/views.yaml` owns renderer selection and routing scope;
  `loadBundle` and `buildIaPlaceMapRendererScene` consume the optional policy.
- `bundle/v0.2/core/contracts.yaml` preserves occurrence identity and semantic
  containment. Projection remains unchanged by routing-scope mutations.
- `AGENTS.md` preserves the staged pipeline and shared geometry ownership,
  requires numerical proof and normal-scale visual review before golden updates.
- `routing_quality_recovery_plan.md` decisions 2–6 require balanced attachments,
  local ownership, 16px route/header/border/marker/parallel-track separation,
  adjacent own labels at 12px and unrelated-route label separation at 24px,
  complete inventories, and bounded coherent final selection.

## Source hashes

SHA-256 below compares immutable original HEAD bytes with this concurrent working
checkpoint. Working hashes identify a checkpoint only; later edits invalidate them.

| File | Original HEAD SHA-256 | Working checkpoint SHA-256 |
| --- | --- | --- |
| `bundle/v0.2/core/views.yaml` | `e3e5eb428abe410fa7d5fa03a80d9a1597e1a317ad30aba5873f8f32a98af624` | `ab181defdf48de74b74c4a52163a6eae625d7f747beb3c154bb7fc55051313b7` |
| `bundle/v0.2/core/contracts.yaml` | `a53bfddfbe18aebb107710b8476035078ee977a9e1ff4476a76edb64b1a19eb0` | `a53bfddfbe18aebb107710b8476035078ee977a9e1ff4476a76edb64b1a19eb0` |
| `src/renderer/staged/iaPlaceMap.ts` | `e3d8ae19375858e5e5e1ba305a1c5b1e5108ae4762744a73e04192b49c7df56e` | `e3dc1b74fdbf0f14916a041c0eb28f84908bba9a651f361804474bfca81c5d17` |
| `src/renderer/staged/iaPlaceMapRouting.ts` | `799899760845f47e6122e36ce3b597e69ca881f2c3aec45b0bcdd50a52489adc` | `351d687d139f36ac6aa6d7e4a9c4ccfaebf0a5304848b1d150c125b7c8fbab91` |
| `src/renderer/staged/routingCore/portCapacity.ts` | `598627359c2aa29ddca9b29bad2ac8893074f17448366f0b18a0e92cd3de8d9b` | `68b3c290ffdf5754c995a2a3711fb3d339efcd87daded0bfbade32108c429958` |
| `tests/fixtures/render/ia_parallel_navigation_v02.sdd` | `7f102024be0c535a25d74f92f3754d8bd3b71d5398f2cab29b73782901b50b41` | `7f102024be0c535a25d74f92f3754d8bd3b71d5398f2cab29b73782901b50b41` |
| `tests/fixtures/render/billSage_structure.sdd` | `ae30d10955e76e58273480bdd7436715f9de6cd87f5c39f2b12cacf3c2932962` | `ae30d10955e76e58273480bdd7436715f9de6cd87f5c39f2b12cacf3c2932962` |

## Verification checkpoints and remaining gates

Decision 1: build passed and `iaPlaceMapHardeningBundle.spec.ts` passed 13/13.
Real-loader policy removal and selector mutation change scene scope and canonical
bundle fingerprints while preserving projection. Cloning independently copies
selected container IDs. Unsupported policy values and container selectors are
rejected. v0.1 remains without the capability.

First concurrent quality run: 4 singleton tests passed, both BillSage owner tests
failed with a route x=633.5 versus maximum permitted x=632.5. This was already a
modified workspace run and cannot serve as original-HEAD visual evidence.

Extended independent quality run: **12 passed, 12 failed (24 total)**. Singleton
DG-002/DG-003 tests passed in both details. Combined/DG-001 tests rejected fatal
marker-clearance/capacity diagnostics; full labels overlapped the Account Area
(label x=226.162, required gutter left >=279.5). BillSage returned fatal diagnostics;
Overview→Projection retained a four-point detour despite a nonempty facing-side
coordinate overlap. Compact points were (416,146), (416,170), (472,170), (472,194);
detailed points were (416,242), (416,266), (472,266), (472,290).

The extended tests compute segment/rectangle distances, crossings, painted marker
bounds, side midpoints, and feasible facing-side spans independently of production
audits. Repeated proof calls ran while production integration changed, so this is
a concurrent checkpoint, not a coherent final acceptance run. Temporary candidate
JSON and logs live under `/tmp`; no PNG or canonical proof artifact was generated.

**Remaining gates:** stable independent numerical run; jointly valid combined and
BillSage proof outputs; independent capacity/expansion deficit checks; normal-scale
SVG review; broader adversarial cases; public API/CLI/helper/force fatal-boundary
checks; compatibility and full suite. No visual output is accepted by this report.

Subsequent concurrent checkpoint (26 tests): **20 passed, 6 failed**. Compact
combined/DG-001 numerical checks passed; detailed retained unresolved label audits
and an independently measured 0px distance from one label to the competing route.
Both BillSage owner tests still rejected fatal diagnostics (nonendpoint node
intersections, marker proximity, and competing tracks at 15px and 11px separation).
BillSage source order, indentation, feasible straight attachment and double-crossing
checks passed in this sample. These concurrent samples do not supersede the need
for a stable final run and visual review.

### Correction to independent margin evidence

The initial extended geometry helpers read stroke width and arrow size from the
wrong theme nesting, resulting in NaN distances and invalidating their recorded
node/header/border/marker passes. They now read `theme.paint`, assert finite
geometry inputs and positive finite paint dimensions, and reject zero-length
marker orientation. Earlier crossing, label, ownership and direct-alternative
checks did not use those incorrect theme fields. Margin acceptance requires the
corrected rerun; earlier margin-pass claims must not be used as evidence.

Corrected paint-margin run plus SVG boundary run: **27 passed, 6 failed (33)**.
The boundary spec passed all seven cases: owner escape; node/header distances
below 16px; label on its own route; label below 24px from a competing route;
marker stand-off below 16px; and aggregate 4096-candidate/128-repair accounting
with reflowed-node port consistency. Six corruptions rejected actual SVG emission
and artifact publication through public `force` handling in both selection modes.

The corrected independent quality run failed four combined/DG-001 paint-margin
cases: competing arrows, return-node clearance, and parallel Area borders measured
15px after accounting for stroke thickness. BillSage double crossings remained:
compact P-220→P-222 versus P-222→P-220 crossed twice; detailed P-210→P-230 crossed
P-221→P-220 and P-222→P-220 twice each. These findings remain rejection gates.

A focused real-loader scope probe passed: identical projection and final geometry
reported local finite-routing-bound failure with selected Area owners; removing
`routing_scope` or changing selectors to `[]` removed that local-bound diagnostic.
Thus selector changes affect actual routing validation, beyond metadata identity.

2026-10-13 follow-up: finite rectangle checks now inspect only x/y/width/height
(the node objects also contain nonnumeric metadata). Every proof helper now rejects
fatal final diagnostics before geometry assertions; rejected debug revisions cannot
silently count as geometric acceptance. Root's subsequent 17px centerline policy
integration remains pending a fresh full proof run. A corrected paint-only sample
passed detailed but rejected compact return-route distances (15px to an Account
border; 5.5px to a forward painted arrow). This sample predates final integration.

Additional independent gates now cover disjoint label rows with reusable horizontal
capacity and absolute trace demands. The sufficient comparison gutter is the
widest measured label plus two 24px side rails; widths of separate rows must not
sum. BillSage paint audits exempt only declared structural shared trunks at their
aligned source segment, with no blanket structural-route or marker exemption.

Cached proof checkpoint (one accepted pipeline result per fixture/detail/selection):
**27 passed, 12 failed (39 tests including seven boundary tests)**. Compact parallel
combined/DG-001 passed corrected paint and reusable-gutter capacity checks. Detailed
parallel selections failed their shared fatal-diagnostic precondition, correctly
preventing ten downstream quality assertions from treating rejected output as
accepted. Both BillSage outputs passed owner, painted margin, hierarchy and feasible
direct-attachment checks, but failed avoidable double-crossing checks.

Compact selected routing costs included 4 crossings (alternative trial had 7).
Detailed selected costs included 8 crossings (alternative trial had 11). Compact
P-222→P-220 crossed the P-220→P-222 structural trunk twice; detailed
P-210→P-230 crossed both child-return connectors twice. Candidate ranking improved
relative costs but did not satisfy proof quality. A west-side Overview→CreateNew
candidate beyond all node left edges appears to avoid the detailed return crossings;
its complete marker/port/full-route-set feasibility still requires demonstration.
These proof failures remain unresolved; no goldens or canonical evidence changed.

After migrating debug traces to typed `PositionedScene.routingEvidence`, a fresh
build passed before cached proof/boundary execution. Tests now read typed evidence
and validate recorded port-group counts, finite offsets/reservations, and signed
midpoint displacement. This checkpoint returned **4 passed, 28 failed, 7 skipped**:
singletons passed; combined parallel and BillSage failed their fatal-diagnostic
preconditions after exhausting aggregate 4096-candidate budgets; boundary setup
correctly refused an invalid base scene. No prior accepted checkpoint is promoted
over these failures. Search exhaustion remains an unresolved solver-quality gate,
not proof that the required geometry is impossible. Production integration continues.

Explicit Area-top expansion proof checkpoint: **37 passed, 6 failed (43 tests)**.
Baseline top padding comes from measurement of the original scene, rather than a
literal constant. Final top padding and Area-top demand checks passed for combined
and DG-001 in both details. Compact passed all numerical proof and boundary gates
in this checkpoint. Detailed still reserved a 366.664px gutter for disjoint rows
against sufficient widest-label capacity 218.988px, and BillSage exhausted the
aggregate routing budget. These remaining failures reject final acceptance; normal
scale visual review and compatibility gates remain outstanding.

Broader IA/public/named-separation checkpoint: **61 passed, 11 failed (72)**.
Failures were confined to existing geometry variants: compact three parallels,
identical duplicates, long label, long token, self-loop and multiple incoming;
detailed three parallels, identical duplicates, long token, self-loop and multiple
incoming. Occurrence, API/CLI/helper publication and diagram-separation tests passed.
Remaining findings concern joint label/corridor capacity, self-loop attachment
geometry and annotated same-owner returns. Existing acceptance assertions remain.

Focused metamorphic coverage now includes semantic-ID renaming, global positioned
scene translation (with translated SVG viewBox), reciprocal annotations and nested
Place ownership. The first six tests passed; nested cases then passed a focused
rerun after replacing an unsupported horizontal-indentation assumption with the
existing single-child direct-vertical grammar. No fixture-specific production branch
or PNG proof was added. Self-loop and internal-return allocation helper fixes are
pending validation against the evolving bounded shared candidate/label solver.

Focused generalization checkpoint: all **8 metamorphic cases passed** after the
shared solver update; self-loop and multiple-incoming acceptance remained blocked.
A subsequent focused child-return run passed both details after measured exterior
capacity accounted for its selected route anchor and owner inset. The observed
compact deficit was 25px: label right edge 915.664px versus scoped owner maximum
890.664px. This was an owned width deficit, not a reason to weaken label clearance.

A concrete compact self-loop alternative was checked against the complete final
scene: retain north loop attachments and move the cross-Area return to the south
midpoint, routing through existing exterior space. All final audits returned zero
findings without extra expansion. Production search still exhausted aggregate
candidate budgets before selecting that combination consistently. The remaining
seed/candidate orchestration gap is explicit; bounded exhaustion does not establish
geometric impossibility or acceptance. No new snapshots or canonical proofs changed.

## 2026-10-13 continuation

The fresh original-proof, bundle, boundary and metamorphic gate passed **65/65**
(`iaPlaceMapRoutingQuality`, `iaPlaceMapRoutingBoundary`,
`iaPlaceMapRoutingVariants`, `iaPlaceMapHardeningBundle`). Build and
`git diff --check` passed. Shared compatibility passed **179/179 across 15 files**,
including Scenario, Outcome, Service, UI, legacy corridor/lifecycle defaults,
ownership, labels and port capacity. A separate public/isolation/projection run
passed **50/50 across five files**, including the new interval-capacity tests.

Fresh original parallel and BillSage SVG candidates were rendered under
`/tmp/ia-quality-svg/`, with typed scene evidence beside them. No PNG proofs were
generated. Normal-scale review used temporary JPEG browser captures. Compact and
detailed parallel cases show centred distinct forward routes with separate readable
gutter rows and an exterior return. BillSage retains its hierarchy, source trunks,
straight Overview-to-Projection connection and three contained, separated returns.
These original proof images are acceptable at this checkpoint; they do not establish
broader or final acceptance. Named/decorator review and the full suite are ongoing.

The latest focused broader run still rejects **three cases**: compact self-loop,
detailed self-loop, and compact multiple incoming with child return. Detailed
incoming passes. The loop failures exhaust the unchanged aggregate solve;
the compact incoming failure retains a label scope deficit. Feasible geometry has
been observed, so exhaustion is not classified as impossibility. A temporary
instrumented copy under `/tmp` is tracing actual candidate exposure and selection.

Two capacity errors were corrected without weakening acceptance: prospective node
collisions no longer outrank measurable header rows, and exterior label capacity
includes actual parallel rails and their reserved displacement. The shared opt-in
`interval_peak` mode prevents a wide later label from inheriting another row's
extra track; physical rail intervals are coalesced without bridging their gaps.
The default capacity behavior remains unchanged. An attempted longitudinal demand
was removed because its 7px deficit belonged to an unselected anchor rather than
the selected bounds-only scene.

Historical evidence, projection snapshots, renderer goldens, and canonical corpus
artifacts remain unchanged. Overall implementation remains **incomplete** pending
the three rejected cases, final visual review, full-suite closure, and evidence
capture after all acceptance invariants pass. Earlier working hashes above describe
their stated checkpoint and are not hashes of this continuation.

### Final numerical and visual gate

The frozen implementation passed **154/154 across eight acceptance files**
(`/tmp/ia-quality-final-acceptance.txt`, 54.88s). This includes 36 independent proof
quality checks, bundle mutation, seven fatal SVG/public `force` boundary checks,
eight metamorphic variants, all 26 hardening geometry cases, and shared label and
interval-capacity regressions. All four previously failing compact/detailed
self-loop and multiple-incoming cases pass; the three-case rejection above is
superseded by this stable run.

The remaining work was resolved through measured capacity and bounded exposure:

- Route proposal counts and actual aggregate work reservations are distinct; label
  callbacks no longer starve a later connector's legal alternative.
- Labelled frames reserve work for subsequent measured reflows and final selection
  within the unchanged 4,096 / 128 / four-pass limits. A shared nested allowance
  preserves exact consumption in `finally` and rejects zero/overdraw/reset.
- Partial label scoring uses two adjacent rows; the full scene retains the wider
  event search. Own-label association measures minimum distance over all own legs.
- A compact loop has a measured 10.5px lower-owner deficit. Bottom reflow moves its
  constrained return track and grows the ancestor/export envelope coherently.
- The compact child-return capacity includes an actual incident companion rail
  just outside the selected owner boundary. Its missing 16px is reserved by the
  existing shared interval model, yielding 216.676px required exterior padding.
  Port pitch and clearance are unchanged. Unrelated and transverse-only rails
  do not acquire a carrier claim.

Normal-scale review of original parallel and BillSage proofs, named singleton
selections, decorated cases and all four repaired loop/incoming SVGs is acceptable.
Labels remain complete and unambiguous, the parallel return is exterior, BillSage's
three returns remain inside Projections, source trunks/order are intact and its
Overview-to-Projection route is straight. Numerical audits establish the full
painted bounds and all side/clearance contracts. Temporary JPEG browser captures
were used only for inspection. **No PNG proof was generated.** The user's SVG-only
instruction overrides PNG proof commands in the attached plan.

After these gates, exactly **four BillSage v0.2 renderer-stage goldens** were
refreshed through the real scene/render APIs; the strict stage suite passed **9/9**
(`/tmp/ia-quality-stage-final.txt`, 27.83s). No projection snapshots, LEGACY outputs,
v0.1 goldens, historical proof images or canonical corpus artifacts changed.
The new [26 SVG proofs](routing_quality_evidence/README.md) preserve per-file hashes,
current source hashes and typed routing costs, rejected alternatives, port groups
and owned expansion decisions. Their detailed incoming variant reports the accepted
`renderer.routing.ia_quality_comparison_limited` warning: all final invariants pass,
but bounded search did not enumerate every alternative. Global optimality for
arbitrary graphs is not claimed.

A full-suite invocation caught TypeScript's loss of optional-property narrowing
inside the newly wrapped generator callback. Capturing the already validated
`revision.context` fixes compilation without changing geometry. The full suite was
restarted against that frozen source; its final result is pending. Read-only peer
review found no concrete correctness or compatibility defect. No remaining cited
numerical or visual invariant is violated; full-suite verification remains the
only acceptance closure gate. Final hashes in the new evidence directory supersede
all earlier working checkpoint hashes.

The final built CLI SVG smoke check rendered DG-001, DG-002 and DG-003 as a
single named batch with zero failed targets, then rendered detailed BillSage
(`/tmp/ia-quality-cli-final.txt`). All four CLI SVGs match the captured API proofs
exactly after stripping trailing whitespace. All 26 SVG hashes and 39 source/test
hashes verify; the evidence directory contains no PNG/JPEG files, and every SVG
uses canonical LF. Normal-scale review was extended to every named and decorator
SVG with the viewport reset; all reviewed routed content remains acceptable.

### Final acceptance closure

The restarted, frozen-source full suite passed **174 files / 1,932 tests**, including
TypeScript compilation, in **578.64 seconds** (`/tmp/ia-quality-full-final.txt`). It
covers parser/compiler/validator/projection compatibility, v0.1, unrelated staged
and LEGACY renderers, public API/CLI/helper paths, target isolation, SVG/PNG
rasterization and fatal `force` handling, bounded shared routing, all cited proof
families, and the broader adversarial variants. No acceptance assertion was weakened
and no unrelated golden was refreshed. `git diff --check` and all source/SVG/stage
hashes pass.

Satisfied invariants: bundle-owned optional scope consumed downstream of projection;
centred ordinary attachments and structural exceptions; internal ownership and
painted 16px margins; own labels at 12px and unrelated routes at 24px; exact
occurrence/text/marker inventory; measured owned expansion; unchanged aggregate
limits; deterministic SVG and independent fatal publication audits. **Violated
invariants: none. Remaining implementation/acceptance gates: none. Actual reviewed
SVG output: acceptable. The routing recovery is implemented and accepted.** The
comparison-limited detailed incoming warning is an explicit bounded-search
limitation, not a failed final audit or a global-optimality claim.

Only the intended implementation, regressions, technical documentation, four
BillSage v0.2 renderer goldens and new SVG evidence changed for this task. The
concurrent unrelated UI documentation deletion/new plan remain untouched. No commit,
push, PR, historical-proof replacement, corpus regeneration or PNG proof was made.
