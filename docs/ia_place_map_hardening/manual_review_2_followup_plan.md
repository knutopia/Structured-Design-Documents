# Coordinated response to manual routing review 2

Status: design and execution order proposed, 2026-10-13. No runtime change or new
visual acceptance is claimed here.

Execute the [ordered proof gates](#execution-order-and-proof-gates); the policy
sections below define their acceptance criteria. Read the
[manual review](manual_review_2_routing_quality.md) before starting and the full
[forward-port specification](forward_routing_port_policy.md) before implementing
or auditing forward shortcuts. This plan owns coordination; the companion owns
forward admission and geometry. Earlier recovery plans/reports are historical
context, not instructions to repeat completed work. Resolve any conflict with
the user's current instructions and `AGENTS.md` before coding.

Implementation scope is opted-in v0.2 staged SVG and its existing SVG-derived PNG
path, both details, combined/named selections, and API/CLI/helper callers. Visual
proof artifacts are SVG only. Implement through existing shared infrastructure;
no ELK, replacement layout engine, or parallel IA geometry implementation.

The user deprecated the Workspace stacking question on 2026-10-13. It requires
no diagnosis, layout change, or unresolved-item report. Multiple-incoming remains
regression coverage for shared routing, labels, and export margins.

## Authority and required invariants

The review finds the diagrams good overall and identifies specific improvements.
The user's subsequent response accepts the current zero-crossing BillSage route
as sensible and asks for an alternative reading direction. Treat it as an
enhancement, while treating inadequate diagram-edge clearance as a quality defect.
Earlier numerical acceptance remains historical evidence against its then-current
contracts; it does not prove the new visual requirements.

| Authority | Invariant |
| --- | --- |
| [AGENTS.md](../../AGENTS.md) | Bundle governs view conventions; shared infrastructure owns geometry. Preserve the staged pipeline, projection, parser/compiler/validator, v0.1, unrelated renderers, and LEGACY outputs. |
| [v0.2 views](../../bundle/v0.2/core/views.yaml) and [contracts](../../bundle/v0.2/core/contracts.yaml) | Preserve authored hierarchy/order, exact selected occurrences, annotations, singleton fusion, and routing ownership. New presentation and routing policies must be loaded from the bundle. |
| [IA final acceptance](../diagrams/ia-place-map.md#final-acceptance) | Preserve clearances, label association/full text, painted markers, legal ports, owner/export bounds, and distinct ordinary navigation tracks. |
| Manual review and user follow-up | Add readable export margins, annotation-aware line breaks, backward loop traversal, and admissible bottom-to-left forward routing. |
| [Pre-hardening exemplar](../../real_world_exploration/billSage_example/billSage_simple_structure.ia_place_map.detailed.svg) | Use its reading direction as visual evidence. Do not restore shared navigation trunks or copy coordinates. |

Keep historical proofs immutable. Capture trial SVGs under `/tmp`; capture a new
review-2 evidence set only after its acceptance gates. Refresh affected goldens
only after final numerical and visual acceptance.

## Review items and shared responsibility

| Review item | Resolution | Owner and relationship to other work |
| --- | --- | --- |
| Decorator variants duplicate routing | Use plain and type-id for visual review. Prove id/type/type-id geometry equivalence once per fixture/detail. | Evidence/test selection; saves repeated visual work, not routing exemptions. |
| BillSage `P-210 -> P-230` right arrival | Apply the separately specified movable bottom-source exception when a two-segment left arrival improves the complete scene. | IA supplies loaded preference and ownership; shared constrained port allocation supplies geometry. |
| Parallel/self-loop return near diagram edges | Require readable clearance for all painted routes, labels, and markers from the export boundary. | Shared bounds, painted-envelope audit, and root-owned padding/reflow. This is mandatory regardless of route cost. |
| Event/guard label breaks | Prefer breaks between presentation parts; keep each part whole when it fits the width limit. | Loaded presentation policy, formatter metadata, shared wrapping/measurement, then shared label capacity and association. |
| Forward-facing self-loop | Require backward traversal along the exterior rail while retaining the same occurrence and end arrow. | Loaded loop preference plus shared ordered port-pair proposals. This equal-bend correction is independent of movable-forward admission. |
| Bottom self-loop and top-aligned cross-Area Places | Compare a bottom backward loop with the simpler backward upper loop. Admit the bottom alternative only through complete layout/route/label comparison. | Owned top/bottom capacity, ordered reservations, reflow, and complete-scene selection. It must not become a fixture-specific alignment patch. |

## Concrete findings that constrain the design

Inspection of the stored SVG geometry confirms id/type/type-id have identical
node/container rectangles and route paths for BillSage and parallel, in both
details. Plain differs because it omits the decorator row. Preserve all historical
files; the next report need not show three equivalent decorated diagrams.

The compact parallel return has rails at `x=747.988` and `y=243` in a canvas of
`754.988 x 250`. With its 2px stroke, the painted clearance is approximately 6px
on both sides. The compact self-loop variant has the same right rail and a bottom
rail at `y=253.5` in a 260.5px-high canvas: again about 6px. This is consistent with
the current root routing bounds in `buildFinalRoutingContext`, which inset by
half the stroke width. Being inside the exported image is weaker than having a
readable margin. The multiple-incoming bottom return also needs this audit.

These coordinates describe the stored proofs, not required production constants.
In the self-loop proof, the upper loop departs at `x=140.5` and arrives at `x=163.5`:
its exterior horizontal rail runs rightward. Reverse those geometric roles for
a backward loop; retain the authored occurrence and an arrow at the arrival.
The Account Place is 66px below the Workspace Place, explaining the two forward
connections' three-segment paths. The bottom-loop alternative should test whether
removing this upper label/route demand restores alignment through normal reflow.

## Coordinated policies

### 1. Readable export clearance is an acceptance requirement

For opted-in IA, require the shared readable gap (currently 16px) between the
export boundary and the complete painted envelope of connectors, arrowheads, and
labels, on all four sides. Root canvas chrome is the reference boundary, not an
obstacle that itself needs a margin. Keep internal owner/header/border clearance
and transverse-crossing rules intact.

Use the logical root/export rectangle as the boundary: for each painted envelope
`P`, require `P.left >= root.left + gap`, `P.right <= root.right - gap`, and the
equivalent vertical inequalities, within the shared tolerance. Include strokes
around label boxes and full marker footprints, not just text bounds or endpoints.
This additional gap applies to routed content; it does not indent root chrome or
move a title simply because the title is painted. Existing node/title/export
containment audits still apply.

Centreline bounds must incorporate the stroke envelope; markers and labels need
their own complete-envelope checks. The same effective bounds must be used in
proposal generation, label placement, reflow demand measurement, and the SVG
backend's final audit. A stricter final audit alone would merely reject output
that the solver still thinks fits.

Measure missing space as root-owned padding demand and rebuild the coherent scene.
Expand only affected sides. No terminal-rail clamp, arbitrary extra viewBox strip,
global scale change, or margin exemption for a return. Export-margin correction
may require expansion even when the old route was numerically accepted.
Derive padding from the measured painted deficit. Verify convergence: if a rail
tracks an expanding root boundary, re-establish its inset instead of adding the
same deficit indefinitely. Left/top expansion must coherently translate/reflow
the scene, labels, routes, and any saved comparison geometry.

### 2. Preserve presentation parts through measurement

Add a bundle-owned wrapping preference under IA navigation presentation. Prepare
ordered presentation parts using the existing loaded field/templates and event
name resolution. Carry preferred break opportunities beside the canonical label
text into `EdgeLabelSpec`; final line breaks still belong to `MeasuredScene`.
Keep existing flattened text for LEGACY outputs.
The canonical label string remains the text-integrity authority. Derive break
offsets/parts while formatting from bundle data and preserve them through scene
copies and label remeasurement. At a break, consume only the existing separator
whitespace; preserve every non-whitespace character and authored part order.

In shared `measureEdgeLabel` / wrapping, retain one line when all text fits. When
it does not, prefer a part boundary over splitting a part that fits by itself.
For the cited example, measure and emit:

```text
[Accept invitation]
{invitation valid}
```

If an individual part is too wide, use the existing word/grapheme wrapping within
that part. Do not parse brackets or braces with a new regex, hardcode event/guard
field names in the wrapper, force a newline into the global separator, truncate,
or change label text. Missing parts and duplicate event names retain existing
formatting semantics. Use a generic preferred-break contract for other callers.

Recompute actual width/height before corridor capacity or port trials. Reduced
width can reduce owned padding; changed height can increase row demand. Labels
must still be adjacent and unambiguous. There is no assumption that nicer wrapping
always makes the complete scene smaller.

### 3. Separate the two attachment policies

The [forward policy](forward_routing_port_policy.md) permits an off-centre ordinary
source only for a strictly simpler two-segment forward route. It excludes loops.
Its no-extra-expansion gate applies after the new margin and wrapping policies
have produced an accepted baseline in the current measured geometry.

Self-loops instead require two distinct same-side attachments and backward
traversal. For upper/lower horizontal sides, the departure lies to the right of
arrival and the exterior rail travels leftward. Treat side choice and traversal
order independently; selecting a north/south side does not define arrow direction.
Use configured geometric progression rather than inferring direction from IDs.

Prove a simple backward upper-loop candidate first; the final artifact may use
either that candidate or the backward bottom alternative. The correction may
have exactly the same bend count as today's loop, so the forward exception's
strict bend-improvement rule does not apply. Direction is a validity condition
under the loaded loop policy, not a soft cost that can lose to a shorter forward
loop. Same-side loops must leave and re-enter the node orthogonally, with two
distinct ports and a nonzero exterior rail; three segments/two bends is the
minimum for this topology.

For the bottom alternative, both loop attachments lie left of the existing
bottom arrival, with departure to the right of loop arrival. Reserve the existing
ordinary arrival first; allocate the loop pair together at the shared pitch in
the remaining interval. A translated loop pair is justified by these reservations,
not by the forward exception. Keep the ordinary arrival and facing cross-Area
attachments balanced. Account for incoming-marker footprints and loop-label
association; no shared-track exemption is introduced.

Compare complete reflowed upper/bottom revisions using crossings, bends, measured
expansion, displacement, length, and stable identity. The desired bottom proof has
top-aligned Places and two straight horizontal forward connectors; derive that
through owned demand removal and shared facing-coordinate reconciliation. A clean
backward upper loop is acceptable if bottom label/port capacity prevents this.
Document the fallback reason explicitly.

Construct each upper/bottom trial from the original measured scene with its own
absolute gap/padding demands. Retain demands shared by its actual labels/routes;
discard demands attributable only to the alternative being replaced. Current IA
reflow accumulates demands, so merely switching loop side on the expanded upper
revision would retain the 66px top offset and defeat this comparison. Keep each
trial coherent and charge all trials to the same live work allowance. Label
association is an independent gate, including distance to every own segment and
strictly stronger association with the loop than with another connector.

### 4. One solve and a baseline at the right stage

The coordinated flow is:

```text
loaded policy and unchanged projection
  -> scene with label parts and routing intent
  -> shared measurement and preferred wrapping
  -> ordinary ports, export margins, backward loop alternatives, owned reflow
  -> fully accepted baseline on the resulting measured geometry
  -> movable forward shortcut trials on that same geometry
  -> complete independent acceptance and SVG emission
```

The forward policy's no-extra-expansion gate must not prohibit fixing inadequate
export margins, reserving loop-label space, or remeasuring changed labels. It only
prohibits additional expansion caused by the optional forward shortcut. Any reflow
invalidates its earlier intervals and comparison witness; establish a new baseline.

All branches consume one aggregate 4,096-candidate / 128-repair / four-expansion
allowance. Reserve work for required corrections, final audits, and a fair share
of optional trials using geometric eligibility/stable ordering, never fixture
IDs. Verify that each eligible proof edge gets a direct interval trial and the
loop proof gets a bottom trial. Record actual consumption and remaining allowance;
a new branch/reflow must not reset it. Preserve an audited
fallback when optional comparison ends. Reject
output if a required margin, direction, text, or ownership invariant still fails.
Limits do not authorize retaining an old margin-defective scene.

Runtime fallback and implementation acceptance are different: fallback is valid
for arbitrary constrained inputs, but the BillSage proof must actually select its
two-segment shortcut. Search starvation is an incomplete implementation of that
proof, not evidence that the route is infeasible. A backward upper-loop fallback
is allowed for the ambitious loop option only after a bounded bottom trial and a
recorded geometric rejection, worse accepted scene cost, or comparison limit.
Do not describe an unassessed bottom candidate as infeasible.

## Bundle/runtime contract work

The existing schemas cannot express these additions. Extend the contracts before
enabling policy. Implement and prove each field's runtime consumption before
enabling it in the canonical bundle; use test bundle copies with only completed
policies during intermediate gates. Declaring a field is not behavioral support.

| Behavior | Bundle location to extend | Runtime consumption |
| --- | --- | --- |
| Export clearance | `bundle/v0.2/core/views.yaml`: IA `routing_scope`, proposed `export_clearance: readable_gap` | Scene policy metadata -> shared effective root bounds, painted audits, root padding demands |
| Preferred part breaks | Same file: IA navigation `presentation`, proposed `wrapping: prefer_part_boundaries` | Relationship presentation preparation -> label break metadata -> shared `measureEdgeLabel` |
| Forward exception | Same file: navigation `routing_preferences.forward_shortcut`, as specified separately | IA eligibility -> shared constrained attachment proposals -> baseline admission |
| Backward self-loop and side alternatives | Same file: navigation `routing_preferences.self_loop`, specified below | Shared ordered port-pair proposals -> owned reflow -> complete-scene comparison |

Proposed loop contract, alongside `forward_shortcut` in `routing_preferences`:

```yaml
self_loop:
  traversal: { axis: x, direction: negative }
  side_trials:
    - { side: south, pair_placement: before_other_arrivals }
    - { side: north, pair_placement: nearest_feasible }
```

`side_trials` enumerates allowed candidates; complete-scene cost selects the
result, not list priority. The traversal axis must be tangent to each allowed
side. `negative` means arrival coordinate < departure coordinate along that axis;
`before_other_arrivals` puts both loop ports below the lowest coordinate of other
incoming ports on that side, with full shared separation (leftward for axis x).
With no other arrivals, use the nearest feasible pair. In both placements all
occupied incoming/outgoing ports and structural reservations block capacity.
The loader rejects duplicate/empty side trials and incompatible axes/sides;
runtime audits require finite geometry and distinct ports. Support direction
changes through the loaded policy;
the review's final configuration is negative. This makes "backward" executable
without confusing the loop's horizontal traversal with forward shortcuts'
vertical progression.

These are proposed contract fields, not supported configuration today. Validate
all discriminators/combinations in `src/bundle/validateLoadedBundle.ts`, extend
`src/bundle/types.ts`, and carry/copy intent through staged contracts. Omission
retains prior behavior. Generic geometry interprets configured directions and
sides; no fixture IDs or hidden annotation tokens select production behavior.
Require existing `routing_scope` for either new routing preference; wrapping is
independent. Policy-removal tests retain necessary parent fields; invalid orphan
configurations must fail loading. Extend metadata clone helpers and cache keys so
policy/part changes cannot reuse stale scenes, measurements, or routing evidence.
Use `loadBundle` -> scene preparation -> shared machinery -> final audit, with
real-loader removal/mutation tests demonstrating observable runtime differences.

## Proof inventory

Use these sources unchanged, with `bundle/v0.2/manifest.yaml` unless checking
compatibility. Identify edges by occurrence/endpoints, not a hardcoded source hash.

| Case | Source and selections | Required outcome |
| --- | --- | --- |
| BillSage | `tests/fixtures/render/billSage_structure.sdd` and `real_world_exploration/billSage_example/billSage_simple_structure.sdd`, combined | Eight connectors including three returns, preserved structural order/indentation/trunks; south/west two-segment `P-210 -> P-230`, straight `P-210 -> P-220`, zero crossings, all internal routes within Projections. |
| Parallel | `tests/fixtures/render/ia_parallel_navigation_v02.sdd`, combined and DG-001 | Four connectors, distinct full labels, zero crossings, readable exterior return/export margins. |
| Named singleton | Same source, DG-002 and DG-003 independently | Exactly the selected occurrence and full label; one straight segment at aligned facing midpoints, no return inherited from combined selection. |
| Self-loop | Exact `self-loop` source mutation in `tests/iaPlaceMapHardeningGeometry.spec.ts`, combined | Five connectors, zero crossings, backward loop and full unambiguous label. Bottom option additionally proves ordered bottom ports, top-aligned nodes and two one-segment horizontal forward connections. |
| Multiple incoming (regression) | Exact `multiple incoming and child return` mutation in the same test, combined | Five connectors, complete child-return label, preserved hierarchy, audited margins/capacity. Stored baseline has one crossing; prohibit an increase without requiring a new layout or crossing-reduction workstream. |

Run compact/detailed for all rows. For BillSage and combined parallel, visually
review plain and type-id; compare id/type/type-id node/container rectangles,
connector-label boxes, ports, and routes numerically under the same source/detail/
selection. Decorator glyph bounds/content may differ. Singleton and loop/incoming
proofs require both details in plain; add a decorated representative to geometry
regression tests when shared port changes affect them. Equal geometry permits
visual de-duplication, not skipping mode propagation checks. Preserve exact source
and bundle hashes in the new evidence.

## Execution order and proof gates

1. **Capture baselines.** Record HEAD, working-tree status and existing user edits
   before changing files. Capture hierarchy, rectangles, source order, route costs,
   labels, and gap/padding claims for the proof inventory. Gate: each active review
   item has baseline evidence and a checkable acceptance assertion; regression
   cases have recorded geometry and occurrence/text inventories.
2. **Extend bundle contracts and prove toggles.** Exercise the real loader and
   test removal/mutation of each policy independently. Add independent acceptance
   assertions before rendering evidence. Gate: positive/negative loading and
   metadata-copy checks pass; each later behavior gate also proves its bundle
   removal/mutation effect before that policy is enabled in the canonical bundle.
3. **Fix export margins.** Prove combined parallel and self-loop returns in both
   details, and audit multiple-incoming too. Check actual strokes, labels, and
   markers on every side; corrupt an otherwise valid scene to prove SVG emission
   rejects insufficient margin. Preserve singleton named straight routes. Gate:
   independent painted-envelope inequalities pass for all four sides, with larger
   stroke/arrow tests and a convergent reflow. Implement scoped test policies
   while later direction/wrapping branches remain unfinished.
4. **Fix label wrapping and recalculate capacity.** Prove the cited invitation
   label, event-only/guard-only labels, long parts, duplicate names, and literal
   delimiters in values. Re-audit affected label capacity and every boundary proof.
   Gate: the invitation proof has the exact two preferred lines shown above, full
   text survives all cases, and measured dimensions match positioned labels.
5. **Correct loops.** First prove backward upper-loop traversal and full label
   association. Then compare the bottom alternative and its ordered reservations;
   require two straight cross-Area forward routes if claiming the ambitious option
   was achieved. Record a fully audited backward upper fallback otherwise. Gate:
   both trials have costs/rejection evidence from independent demand states; the
   accepted result has correct direction/port order, no added crossing, and passing
   label/marker audits. A rejected bottom trial need not pass acceptance.
6. **Apply forward shortcuts.** Prove both BillSage sources cited by the forward
   policy, compact/detailed and plain/type-id; preserve zero crossings and the
   straight Overview-to-Projection route. Use the corrected baseline, not the old
   stored coordinates as implementation constants. Gate: every BillSage variant
   in the inventory selects the shortcut and proves the companion specification's
   complete-scene admission, including its independently checked baseline witness.
7. **Review together, then capture evidence.** Revisit all manual-review rows after
   the final changes. Pass independent shared/public/bundle/compatibility checks
   and normal-scale SVG review, then update only affected goldens and run their
   stage checks and the full suite. Until visual acceptance, old golden differences
   remain pending evidence rather than permission to refresh them. Use SVG proofs; no new
   PNG proof set. Verify id/type/type-id equivalence numerically and show one
   decorated representative. Report each required outcome as passed, failed, or
   an explicitly justified fallback/retained convention. Gate: every inventory row
   is accounted for; no required failure is hidden by fallback or a snapshot update.

## Verification, evidence, and stop conditions

Extend existing tests at their relevant seams: `iaPlaceMapHardeningBundle`,
`iaPlaceMapRoutingQuality`, `iaPlaceMapRoutingVariants`, `iaPlaceMapRoutingBoundary`,
`iaPlaceMapHardeningPublic`, `routingCorePortCapacity`, `routingQualityBudgetAllowance`,
`routingReadableGeometry`, and `connectorLabelLayout` under `tests/` (`.spec.ts`).
Prefer independent geometry/text assertions through public/shared interfaces over
duplicating candidate-generation logic. Repeated rendering, global translation,
renamed semantic IDs, changed theme geometry, and a depleted live budget must
preserve the specified invariants or produce the documented fallback/error.

Verify combined/named API, CLI, helper, and `force` paths with accepted output and
deliberately corrupted output. Required failures must withhold SVG and consequently
SVG-derived PNG; `force` must not bypass acceptance. Retain the prepared artifact's
expected loaded policy through final acceptance so losing scene metadata cannot
silently opt out; intentional policy omission in the loaded bundle still uses its
documented fallback. Exercise lost policy metadata,
wrong loop order, altered label text, and a stale/altered forward baseline witness,
as well as insufficient painted export margins. Do not create a new PNG proof set.
Run focused checks after each implementation step and the repo build/full suite
once the final changes are stable, with `TMPDIR=/tmp`. Keep v0.1/LEGACY fixtures and
projection snapshots unchanged; shared callers without the new options retain
their existing defaults.

Write `manual_review_2_execution.md` with per-item status, evidence links, test
commands/results, policy mutations, measured expansions, consumed budgets, and
rejection/fallback reasons. Capture accepted SVGs plus source/bundle/artifact hashes
and routing traces in a new `manual_review_2_evidence/` directory. Update technical
policy documentation (`docs/diagrams/ia-place-map.md`, `shared-routing.md`) and the
v0.2 explanation alongside enabled bundle fields. Preserve the human's manual
review and historical evidence; do not rewrite them to claim acceptance.

After each substantial pass, report satisfied invariants, violated/unproven ones,
and visual acceptability. Stop the affected implementation branch and report
incomplete if the proof contradicts policy, a shared fix cannot be expressed by
the bundle, a golden would normalize a regression, or further route tuning is
speculative. Resolve the contract or approach before continuing that branch;
continue independent work. A missing visual inspection or an unresolved required
proof remains outstanding even when tests pass.

Design assessment: the forward proposal is compatible with the other items once
its baseline is established after mandatory margin/measurement work. The loop
direction fix has its own admission rule; the ambitious loop relocation is an
optional complete-scene optimization. Implementation and visual proof remain
outstanding for the active review items.
