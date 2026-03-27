# Second Service Blueprint Renderer Reset

This note exists to record yet another change in direction for implementing rendering of service_blueprint type diagrams.

Initially, the DOT / graphviz approach failed, since graphviz is simply unsuitable.

Then the elk-based approach failed, since elk is also entirely unsuitable despite poor architecutural advice by Codex LLM.

## State while creating this Reset

Node placement appears stable.
Connectors are simple straight lines, without routing.

## New Direction

Going forward, no routing- or graphing library is used for connector routing.

We are building a custom routing algorithm, with a 2-stage approach:

### Stage 1 Global Routing 

Identifying easily-identified gutters between columns and lanes for general placement of routes. 

- This includes determining the target edge on the destination node.

- Existing whitespace between nodes is to be treated as gutter space. (Space may vary based on actual width / height of nodes.) Additional gutter space is to be added in stage 2 if needed.

Rules:
- 

### Stage 2: Detailed Routing (Gutter Manager / Track Assignment)

Eliminating overlap between connector segments that share the same gutter space, to achieve perfectly parallel, evenly-spaced routes.

- Make use of available space to place overlapping connector segments parallel to one another with a fixed distance. If not enough space is available in a given gutter, then widen the gutter by introducing additional space between the specific rows or columns.