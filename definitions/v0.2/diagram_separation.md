# Named diagrams in v0.2

The machine contract is `bundle/v0.2/core/contracts.yaml`'s optional
`diagram_membership` descriptor, enabled by each view's
`projection.named_diagrams.enabled`. Vocabulary, schema, profiles, and authoring
metadata complete that contract. Bundles without the descriptor have no named
diagram capability.

A `Diagram` is metadata with an ordinary ID and nonempty name. Its required
`diagram_type` identifies an enabled view. Multiple declarations may use the
same type or name; their IDs distinguish them. Diagram nodes are excluded from
ordinary drawing content and semantic relationship endpoints.

```sdd
SDD-TEXT 0.2

Diagram DG-001 "Add relationship"
  diagram_type=scenario_flow
END

Diagram DG-002 "Node pivot"
  diagram_type=scenario_flow
END

ScenarioStep S-001 "Inspect a node"
  kind=decision
  PRECEDES S-002 {add} diagrams=DG-001
  PRECEDES S-003 {pivot} diagrams=DG-002
END

ScenarioStep S-002 "Choose the relationship"
END

ScenarioStep S-003 "Inspect the related node"
END
```

The existing property grammar applies to both node and edge membership. One
Diagram ID may be bare or quoted. Several IDs use a quoted comma-separated
value, for example `diagrams="DG-001,DG-002"`. Whitespace around references is
trimmed. Membership is an unordered set: repeated IDs warn and resolve once;
generated values are unique and sorted. Empty elements, malformed IDs, missing
targets, wrong target types, and incompatible assignments are errors. Remove
the property to clear membership. Forward references are legal. Repeating a
reserved property on one declaration is a source-aware compile error.

A named diagram contains exactly its assigned edge declarations, their
endpoints, and its explicitly assigned nodes. Including two nodes never
includes their unassigned edges. No ancestors, siblings, children, Stage
context, starts, or connecting paths are inferred. Assign grouping edges
explicitly. Physical nesting only organizes source.

Membership preserves shared node identity and properties. It does not change
edge semantic identity or relax document-wide validation. For example, a shared
decision with several global branches still needs its decision marker when a
named diagram selects only one branch. Raw compilation preserves authored
membership values; inventories and inclusion reasons are derived separately.

Existing bundle-declared supporting references may annotate selected members
using the full document. They do not import referenced targets into primary
topology. Reference-only edges cannot be assigned as primary members of a view
that excludes them.

The combined view of each type still selects all content according to its
existing rules, including unassigned content. It is independent of the named
diagrams and needs no declaration. Render detail may hide eligible raw members;
discovery counts describe membership before that presentation policy.

Empty diagrams are legal, discoverable drafts that warn during validation. A
single render with no visible content fails without an artifact. Named batches
skip such targets with warnings, render other valid targets, and fail if nothing
is produced or any target has an error. Invalid metadata anywhere in the
document blocks rendering, including force paths.

Named projections carry `diagram_id`, `diagram_name`, and exact
`source_edge_id` references on primary edges and their annotations. These
occurrence references are scoped to the supplied compiled graph, separate from
durable IDs and authoring edge handles. The renderer uses the name as the SVG
accessible title and the ID in artifact identity. Combined artifact names retain
their existing shape. Views whose loaded renderer policy requires exact source
occurrences also carry `source_edge_id` on combined primary edges. The v0.2 IA
place map enables this policy; other combined projections retain their existing
serialization.

The IA policy in `bundle/v0.2/core/views.yaml` selects navigation relationships,
complete occurrence coverage, annotation templates and detail visibility, and
the permitted containment/navigation fusion. Presentation reference descriptors
in `core/contracts.yaml` permit Event name lookup without changing validation or
including Events as primary nodes. Exact occurrence references are checked
against the supplied compiled graph at public rendering boundaries, including
after serialization. Missing, substituted, omitted, or duplicated selected
references are errors in combined and named IA preparation.

IA navigation presentation also selects `wrapping: prefer_part_boundaries` in
`core/views.yaml`. The shared formatter retains the canonical flattened label
and prepares preferred offsets between its ordered template parts. Staged text
measurement keeps the whole label on one line when it fits; otherwise it prefers
those boundaries before splitting a part that fits independently. Oversized
parts still use shared word/grapheme wrapping. Only existing boundary whitespace
is consumed by a break; authored non-whitespace characters and part order remain
intact. Actual measured width and height feed downstream routing and label
capacity. DOT and Mermaid retain the canonical flattened string.

Optional IA routing intent is expressed through `routing_scope.export_clearance`
and `navigation.routing_preferences` in the loaded view contract. The latter
requires routing ownership and validates forward progression/perpendicular side
pairs and self-loop traversal/tangent side trials. These fields carry policy
intent into scene metadata; geometry, intervals and final paths remain downstream.
Supported schema does not by itself enable a policy in the canonical bundle or
establish routing acceptance.

The canonical v0.2 IA view enables readable export clearance, negative horizontal
self-loop traversal with independent south/north trials, and a same-owner
positive-vertical forward shortcut from south to west. Export clearance covers
routed strokes, label-box strokes, and markers. Missing capacity changes owned
padding and rebuilds the scene. Loop direction is a validity condition; an audited
upper loop may remain when the bounded bottom comparison fails association or
capacity. Forward sources may move only when a complete accepted comparison on
the same measured layout reduces bends without adding crossings or expansion.
A retained baseline witness is re-audited at SVG serialization. Omitted options
retain their previous staged behavior; these options do not change v0.1 or LEGACY
flattened text output.
