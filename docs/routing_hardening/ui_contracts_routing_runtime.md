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
side assignments are generated lazily in source order, with baseline seed headroom
reserved before recovery. Canonical assignment keys and realized geometry prevent
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

Run `TMPDIR=/tmp node scripts/ui-contracts-production-proof.mjs` after a build to
capture the shipped-bundle full-sheet and DG-002 scenes, SVG/PNG, source/code/bundle
hashes and acceptance report under `/tmp/sdd-ui-contracts-production-proof`.
The [implementation status](ui_contracts_compact_loop_implementation_status.md)
records the actual commands, acceptance results and visual inspection.
