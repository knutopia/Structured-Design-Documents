# UX Brief for a Guided Addition API

This document describes the UX flow and related information for an API-driven way for users to add Nodes and Edges to an SDD (Structured Design Document.) This set of interactions will be a core capability for an assisted, manual SDD-authoring capability that may be offered by a future SDD app. 

The guided experience must shield users from SDD’s internal complexity. Bundle awareness should make the choices simple and safe, not make bundle complexity visible. Advanced or uncommon choices should be available through progressive disclosure.

The core idea is a "pit of success": the user is guided to make valid choices. By appropriately constraining the choices offered, invalid choices are prevented. 

The choices that *are* offered, are structured as a semantically sensible decision tree.

This flow is meant to take place in the context of a known (populated or empty) SDD file (or, potentially in the future, file-equivalent database context), adding content to that context.

This UX brief (current document) is meant to inform the design of a client-neutral API. This API is meant to be bundle-aware, with its logic driven by the spec bundle, following the overall repo approach that separates language definition from tooling. The API is *not* meant to perform an SDD document edit - that is the responsibility of the caller.

The initial user-facing solution to interface with the API is going to be a CLI tool. Later solutions will be web- or app-based, likely using VUE (out of scope for now.)

## UX

### 1. When a Node Is a Known Starting Point: (After User Selected a Node)

(the tool was invoked with a node as an argument, or a previous partial flow as shown in (2) has been used to identify a starting point node)

1.0.1. Browse connection direction

1.0.2.a Choose outgoing: relationship type first - proceed with step 1.1.

1.0.2.b Choose outgoing: existing destination node first - proceed with step 1.2.

1.0.2.c Choose incoming: relationship type first - proceed with step 1.3.

1.0.2.d Choose incoming: choose existing origin node first - proceed with step 1.4.

#### 1.1. Add an *Outgoing* Edge-Node Combo

1.1.1. Browse available "edge-type & node type" combos

1.1.1.1 Filter by diagram type: optionally choose diagram type to narrow choices

1.1.2 Choose "edge type & node type" combo

1.1.3. If existing destination nodes of matching type exist: 

1.1.3.1 Browse existing nodes

1.1.3.2.a Choose existing node as destination - exit flow

1.1.3.2.b Ignore existing nodes - proceed with flow

1.1.4 Create new node (sub-flow, see below) - exit flow

#### 1.2. Add an *Outgoing* Edge From Current Node to Another Existing Node

(Could also be titled: "Connect current node to another existing node that is the destination node")

1.2.1. Browse "edge-type & node" list for existing nodes (constrained to valid nodes: possible destinations based on possible edge-node type combos respecting filter). If more than one possible relationship type per destination node, then show all types on the same line, so that there is one line per destination node. Note: the combining-of-multiple-edges-on-a-line is client responsibility not API responsibility.

1.2.1.1 Filter by diagram type: optionally choose diagram type to narrow the choices

1.2.2 Choose "edge-type & node" combo line

1.2.2.a If chosen "edge-type & node" combo line is unambiguous, then exit flow

1.2.2.b If chosen "edge-type & node" combo line contains more than one edge type, then go to 1.2.3

1.2.3 Show relationship type picker menu to disambiguate relationship, then exit flow

#### 1.3. Add an *Incoming* Node-Edge Combo

1.3.1. Browse available "edge type & node type" combos

1.3.1.1 Filter by diagram type: optionally choose diagram type to narrow the choices

1.3.2 Choose "edge type & node type" combo

1.3.3. If existing originating nodes of matching type exist: 

1.3.3.1 Browse existing nodes

1.3.3.2.a Choose existing node as originating node - exit flow

1.3.3.2.b Ignore existing nodes - proceed with flow

1.3.4 Create new node (sub-flow, see below) as originating node - exit flow

#### 1.4. Add an *Incoming* Edge From Another Existing Node to Current Node

(Could also be titled: "Connect another existing node to the current node which is the destination")

1.4.1. Browse valid Existing Nodes. 

Browse "edge-type & node" list for existing nodes (constrained to valid nodes: possible origination nodes based on possible incoming node-edge type combos respecting filter). If more than one possible relationship type per origination node, then show all types on the same line, so that there is one line per origination node. Note: the combining-of-multiple-edges-on-a-line is client responsibility not API responsibility.

1.4.1.1 Filter by diagram type: optionally choose diagram type to narrow incoming node-edge type combos

1.4.2 Choose "node & edge-type" combo line

1.4.2.a If chosen "node & edge-type" combo line is unambiguous, then exit flow

1.4.2.b If chosen "node & edge-type" combo line contains more than one edge type, then go to 1.4.3

1.4.3 Show relationship type picker menu to disambiguate relationship, then exit flow

### 2. When No Node Is Known As a Starting Point:

(the tool was invoked without a node as an argument)

2.0.1. Browse add node and add relationship options

2.0.1.a Choose add node - proceed with step 2.1.

2.0.1.b Choose add relationship - proceed with step 2.2.

#### 2.1. Add a Node

2.1.1. Browse node types

2.1.1.1 Filter by diagram type: optionally choose diagram type to narrow node types

2.1.2 Choose node type

2.1.3 Create new node (sub-flow, see below) - exit flow

#### 2.2. Add a Relationship

2.2.1. Browse existing nodes for a starting node

2.2.1.1 Filter by diagram type: optionally choose diagram type to narrow node types

2.2.2 Choose existing node as starting node - proceed with step 1.0.1.

## Representing Variations of "Valid" Edges

Not all edges are considered equal:
docs/doc_site/diagram_types/hidden_edge_reference.md
docs/doc_site/diagram_types/node_edge_reference.md

Some edges are always visible in a given diagram type. Some are only visible when rendering with profile "strict". Some are hidden - not rendered by the current renderers at all. Yet, hidden or sometimes-shown edges can be important for the quality of an SDD, since they represent "bridges" across diagram types, solidifying the overall logic of the document.

This has consequences for the UX: often the "normal" edge types are the most obvious choices for a user, but when it counts, the other edges must be readily available and well-explained. While the actual UX should be solved client side, the API must offer "edge visibility" metadata (per edge type per diagram) to show in the UI, and it must accept such metadata as filter input.

## Notes Regarding Filtering

When filtering for a diagram type, "regular" relationships should be prioritized before "cross-view" bridge relationships, which should remain available, with annotation.

## Sub-Flow: Create New Node

Edit new node key fields. Doing so, use bundle constraints for required/optional content and format. 
After edits, complete the proposal and return it to the caller. The caller handles Commit / Cancel.

S1.1. Edit node ID 

S1.1.1 The API should suggest a collision-safe node ID while leaving final choice to the user

S1.1.2 Uniqueness should enforced based on other nodes in current SDD file

S1.2 Edit node name

S1.3 Edit node description

### New-Node Placement in Document Source

New-node placement is meant to be predictable by the user.

As it is futile to blindly postulate an easily-predicted set of node placement rules, node placement (and edge order when creating edges) must be subject to future-expandable preferences and (possibly) in-the-moment user choice. "Curating the node order" is also outside the current scope.

Nevertheless there are some principles:
- Given the choice, new nodes go last rather than first, reflecting normal "document authoring."
- When the new node B is in a structural relationship with an existing node A that implies containment, the node should be placed B nested under A: A(B) where () represents nesting.
- Where sensible, placement order should roughly align with the graph sequence: with nodes-edges A->B->C, the node order should be A, B, C.
- Where sensible, placement of multiple non-nested nodes A, B, C that are referenced by the same node D as edges D->A. D->B, D->C, should reflect the order of edges to result in D, A, B, C.
- Where sensible, placement of multiple nodes B, C, D that are nested under node A with as edges A->B. A->C, A->D, should reflect the order of edges to result in A (B, C, D) where () represents nesting.

These principles are *not* meant to be normalized/harmonized to create one perfectly predictable node order, as that would fail.

Possible further principles:

- With a mix of node types on the same level, nodes of the same type should be placed consecutively (together).
- Within adjacent nodes of the same type, node order should reflect numerical node ID sequence.
- The numerical part of the user-chosen node ID should determine relative placement of the new node before or after other nodes of the same type on the same level.

## Role of Profiles

The api should *not* enforce profiles. The target use case is, for now, `simple` profile. 

Profile enforcement / completeness messaging is outside the current scope.

## Undo, Redo Behavior

While a future app is envisioned to support undo/redo, that is outside current scope. The scope is concerned with offering a well-orchestrated decision tree, and not with quietly architecting a platform (even if the LLM really, really wants to do that.)

## Front End Consideration: Stickiness

(Not for the API to bear:)

A low-friction UX relies on "stickiness": the remembering and repeated automatic pre-filling of frequently encountered user choices, to avoid repetitive drudgery. 

Stickiness applies to

- Parameter combinations for filter choices
- Default-active filters
- Lists of choices in a menu providing most-recently-used (MRU) lists, which is especially powerful when done right in hierarchical menus

## Content Delivery, Not Document Editing

The Guided Addition API is meant to be a *content delivery* mechanism, not a document-editing mechanism.

The responsibility of the API is meant to end by returning a structured addition proposal describing:
- the selected relationship;
- its direction and endpoints;
- the new node’s content, if applicable;
- the suggested placement;
- any additional content (such as an edge being placed)
- the suggested placement for the additional content
- the document context against which the choices were made.
- The calling context (e.g future SDD editor app) then decides when the user has pressed Save or Commit and passes that proposal to a separate document-authoring service.

The boundary would be:
CLI/web app → guided API → completed addition proposal → authoring API → SDD document

This has several benefits:
- The guided API remains focused on human decisions and bundle-aware recommendations.
- It does not acquire file access, persistence, undo/redo, or database responsibilities.
- The same guidance can serve a CLI, web app, or future storage model.
- Commit and Cancel naturally remain app-level UX decisions.
= The guided logic becomes easier to test because it produces content without changing anything.

The qualification is that the caller should not be responsible for translating the proposal into raw SDD text. Otherwise each future client would implement node placement, edge ownership, escaping, and document mutation differently. The caller should invoke the existing shared authoring machinery—or a future dedicated authoring API—to apply the proposal.

Three distinct responsibilities present themselves:

1. The app conducts the interaction and owns Save/Cancel.
2. The guided API supplies choices and returns a completed addition proposal.
3. The authoring API safely applies that proposal to the document.

Because guidance depends on the current document—existing nodes, available IDs, and placement—the guided API still needs document context as input. It simply does not need permission to modify that document.
