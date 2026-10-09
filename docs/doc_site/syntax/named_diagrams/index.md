---
prev:
  text: Step Differentiation
  link: ../step_differentiation

next:
  text: View and Diagram Options for Sdd-Show
  link: ../view_diagram_options
---

# Named Diagrams

We often need several diagrams of the same type. For example, a product encompasses many journeys and scenario flows, and we might want to explore several information architectures in parallel. 

SDD v0.2 serves this need: one document can contain several named diagrams of the same type. They share semantic nodes and relationships. 

The combined view of each type (e.g. "all scenario flows together") remains available and includes unassigned content.

Declare a diagram, then assign individual nodes or relationships with the
`diagrams` property:

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

Each assigned relationship brings its endpoints into the diagram. A node
property includes an isolated node. To share a declaration between diagrams,
use a quoted list such as `diagrams="DG-001,DG-002"`. Remove the property to clear
membership. Forward references are supported. Invalid assignments are errors;
repeated IDs within one list warn and are counted once.

Grouping is explicit. Assign the relevant Stage, Area, parent, and structural
relationship when that context belongs in the diagram. Assigning two endpoints
alone never includes a relationship between them. Source nesting does not
assign membership. Existing reference annotations can describe shared members
without including the referenced targets as members.

Validation always checks the full document. Named diagrams change presentation
scope; they do not create independent semantic worlds or change shared
properties. Discovery counts show raw membership; compact render detail can
hide some eligible members.

```bash
# Existing combined scenario view
pnpm sdd show flows.sdd --view scenario_flow

# One named diagram, with its type inferred
pnpm sdd show flows.sdd --diagram DG-001

# Declared named diagrams, sorted by ID
pnpm sdd show flows.sdd --diagram all

# Render all named scenario-flow diagrams, but not oher types
pnpm sdd show flows.sdd --diagram all --view scenario_flow

# Inspect inventories and inclusion reasons
pnpm sdd diagrams flows.sdd --json --details
```

`--view all` enumerates applicable combined views. `--diagram all` enumerates
declared named diagrams. For one target, supplying both selectors asserts that
the named diagram has the requested type; a mismatch fails. With `--diagram all`,
add a specific `--view` to render only named diagrams of that type. See how the two options [work together](../syntax/view_diagram_options/index.md) in detail.

Default named paths include the ID, for example `flows.scenario_flow.diagram-DG-001.compact.svg`. Names need not be unique and are never used to distinguish files. A single `--out` writes exactly the requested path. Named batches insert the view and ID before its extension. 

An empty diagram is a legal draft. Rendering it alone fails without producing an artifact; a named batch skips it with a warning. The batch fails if no artifact is produced or any diagram has an error. Invalid membership does not fall back to a combined view, including with `--force`.


The [SDD helper](../sdd-helper/index.md) supports declaration and membership editing, discovery, projection, preview, and undo. Guided addition's diagram type filters keep their existing meaning and do not assign membership.
