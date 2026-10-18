# UI Contracts routing runtime

The v0.2 routing capability is declared in
`bundle/v0.2/core/views.yaml` under `ui_contracts_presentation.routing`.
`resolveUiContractsPresentation` validates it; the prepared presentation model and
scene metadata carry the resolved policy. Absence selects the compatibility path.
v0.1 and LEGACY text/Graphviz renderers keep their existing behavior.

`renderUiContractsStagedSvg/Png` prepare the model and invoke the asynchronous
`runUiContractsRendererPipeline`. Each trial builds a fresh scene, measures it,
positions its layout, binds attachments independently, constructs complete routes,
places full labels, and audits the entire revision. Accepted revisions retain their
matching renderer, measured and positioned stages. A later rejected trial cannot
replace them. Enabled scenes cannot use the generic compatibility repair pipeline.

The inventory records occurrence identities, structural representations, physical
segment membership, ordered directed paths, full labels, markers, styles, owners,
and declared junction directions. Shared physical pieces paint once. Ordinary
returns and loops use one complete connector each. Forward rank assignment stays
with the inner sequence; the transition frame owns external loops and returns.
Return intent carries region/sequence owners, source-ordered lane identity and
route-preservation intent, with no metric rail offset. `allocateUiReturnTracks`
groups returns by region and sequence on every measured revision, orders their
declared lanes, and derives rail separation from current measured labels and
shared routing clearance. Unlabelled returns retain a shared-production-measured
empty-label reservation. Preliminary builder measurement sizes natural container
padding; it does not persist route coordinates in scene intent.

Self-loops allocate same-side endpoints as an ordered pair at shared marker-derived
pitch. Several loops reserve one rigid group before individual bindings are made.
Their outward depth comes from shared routing clearance. The label stays outside
the compact rail; its dimensions never set node pitch or loop depth. The simple
forward/return pair is retained during loop trials. General returns allocate
distinct attachments and rails; a lower arrival approaches from below to avoid
crossing an earlier arrival's arrow.

Capacity requests name actual owner padding, supported linear adjacency gaps, or
node occurrences. Absolute lower bounds merge by maximum within one candidate;
alternative branches keep separate ledgers. Packed rows never acquire fictitious
`gapAfter` resources. Unsupported owners fail explicitly. Every rebuild propagates
through normal measurement and macro layout, moving following content. Node minima
apply before width-dependent text measurement, in preliminary builder/fanout
measurements and final measurement. An occurrence's original height is a floor
when width grows. Other depictions change only through existing shared-size groups.

One aggregate candidate/repair/expansion allowance covers side and attachment
proposals, label candidates, shared route search, and rejected rebuilds. Complete
side assignments are generated lazily. Warmup assesses the baseline and each
allowed side of the first loop in stable source order, with other loops fixed.
After warmup, the scheduler alternates a FIFO capacity retry with a new seed,
starting with the retry; an empty source yields its turn to the other source.
New retries append behind pending retries. Seeds change one loop at a time in
source order before yielding remaining complete combinations, with duplicates
removed. Recovery reserves pending warmup assessments and the next eligible trial
from each source; label and route recovery share the remaining candidate budget.
The scheduler never reserves the Cartesian product or divides recovery allowance
by the number of queued combinations. Expansion-ineligible retries are rejected
before charging a candidate for an unperformed rebuild.
Canonical assignment keys and realized geometry prevent
repetition. Evidence reports total work, limits, rejected findings and each trial's
resource targets. Exhaustion reports the permitted search ended without an
accepted placement; it makes no claim that the diagram is impossible.

`auditUiContractsScene` is read-only and runs both during search and on the exact
scene passed to SVG serialization. It recomputes coverage, provenance, attachment,
compact shape, full-label, route, marker and containment checks. Junction incidence
can exempt the additional unrelated-route marker margin; actual painted marker
intersections remain errors, including intersections with pieces of the same path.
Ordinary export throws structured renderer diagnostics on failure. Explicit
combined-view force carries diagnostic-artifact intent and retains errors and exit
status; named diagrams retain error suppression. PNG rasterizes that same audited
SVG without another routing operation.

The shared read-only `auditPositionedSceneContentBounds` checks the actual painter
inputs: container header blocks, ordinary node blocks, and shared-node decorator,
title, attribute-label and attribute-value blocks. Shared blocks are read from
their layout objects, since `node.content` can be a separate flattened copy.
Their coordinates are item-local, including shared attribute blocks; resolve them
against the item position directly, without adding region/group origins again.
Each painted block must have finite coordinates and nonnegative dimensions and
fit both its own item and the exported viewport within shared geometry tolerance.
Diagnostics identify the block and violated owner/viewport. This same audit runs
during trial assessment and exact-scene SVG serialization, which also gates PNG.

Run `TMPDIR=/tmp node scripts/ui-contracts-production-proof.mjs` after a build to
capture the shipped-bundle full-sheet and DG-002 scenes, SVG/PNG, source/code/bundle
hashes and acceptance report under `/tmp/sdd-ui-contracts-production-proof`.
The [implementation status](ui_contracts_compact_loop_implementation_status.md)
records the actual commands, acceptance results and visual inspection.
