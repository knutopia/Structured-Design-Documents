# SDD Skill Authority Model And Authoring Reliability Architecture

Status: proposed architecture foundation

Audience: maintainers of `sdd-skill`, `sdd-helper`, shared SDD services, and the future SDD MCP server

Purpose: define the durable operating architecture for reliable agent use of SDD documents.

This document replaces the incident-shaped second-attempt draft. It keeps the useful outcome-assessment work and removes prompt-specific rules. Its job is to describe the stable authority model, the skill operating protocol, and the boundaries between helper mechanics, SDD language semantics, rendered artifacts, and future MCP behavior.

## 1. Architectural Thesis

`sdd-skill` is an agent workflow layer for Structured Design Documents. It is not the SDD language authority, not a renderer, not a second helper API, and not a prompt-specific modeling cookbook.

The skill succeeds when it consistently routes each question to the right authority:

- Helper surfaces answer how to call helper commands and how to interpret helper results.
- Bundle files answer what valid SDD language and graph semantics are.
- Shared assessment answers whether the workflow can continue, commit, or render.
- Renderer and CLI surfaces answer how to produce projection and preview artifacts.
- Examples and snapshots show downstream evidence only.

The architecture is therefore an authority-selection architecture. The skill does not become smarter by accumulating folk rules. It becomes reliable by consulting the correct source of truth at the moment a decision is made.

## 2. Ground Truth

The repository source-of-truth policy in `AGENTS.md` states that files in `bundle/v0.1/` are the machine-readable source of truth for tools. Markdown explains, bundle governs machine behavior, and code executes the bundle.

The active bundle manifest is `bundle/v0.1/manifest.yaml`. It maps:

- `core/vocab.yaml` for node and relationship vocabulary.
- `core/syntax.yaml` for source-text syntax.
- `core/schema.json` for compiled graph schema.
- `core/contracts.yaml` for endpoint and relationship contracts.
- `core/projection_schema.json` for downstream projection output shape.
- `core/views.yaml` for projection definitions and renderer defaults.
- `profiles/simple.yaml`, `profiles/permissive.yaml`, and `profiles/strict.yaml` for validation profiles.

`docs/readme_support_docs/sdd-helper/README.md` defines `sdd-helper` as the JSON-first machine-facing companion surface. It is separate from the broader human-facing `sdd` CLI.

`skills/sdd-skill/SKILL.md` defines the current skill as a helper-first workflow over repo-relative `.sdd` documents. It uses `skills/sdd-skill/scripts/run_helper.sh` as the stable helper wrapper, prefers request files for JSON request bodies, and branches between create, edit, read/validate/project/render, helper-failure diagnosis, and helper git workflows.

`skills/sdd-skill/references/workflow.md` defines the current assessment-first helper workflow, including dry-run before commit, persisted-state validation and projection, and the distinction between saved `sdd show` artifacts and transient helper `preview` artifacts.

`src/authoring/contractResolution.ts` currently resolves bundle-backed helper contract bindings for profiles and views. It does not provide a complete SDD authoring reference for syntax, vocabulary, endpoint contracts, and view semantics. That is not a defect in helper discovery; it is the boundary between helper command contracts and SDD language authority.

## 3. System Map

```text
User request
  -> sdd-skill
     -> classify operation and authority needs
     -> read helper capabilities/contract for helper mechanics
     -> read bundle/v0.1 for SDD language semantics
     -> call sdd-helper for safe document operations
     -> read shared assessment for workflow gates
     -> call sdd show for saved user-facing artifacts
     -> call helper preview only for transient artifact access
```

The future MCP server is a sibling adapter over shared SDD services. It must share the same authority model:

```text
sdd-skill           future MCP adapter
   |                      |
   v                      v
sdd-helper CLI      shared SDD service calls
   |                      |
   +----------+-----------+
              v
        src/authoring/*
              |
              v
     repo files + bundle/v0.1 + runtime
```

MCP must not shell out to `sdd-helper`. `sdd-helper` must not become a separate language authority from the bundle.

## 4. Authority Matrix

| Decision | Authority | Operational rule |
| --- | --- | --- |
| Which helper command exists | helper `capabilities` | Use helper discovery before relying on remembered commands. |
| Exact helper request or result shape | helper `contract <subject_id>` | Use deep helper contract detail for nested JSON and continuation semantics. |
| Request body transport | helper docs and contract | Use request files by default for JSON request bodies. Use stdin dash only with supplied stdin. |
| Whether to continue, commit, or render | shared `assessment` | Use assessment fields as workflow gates instead of result status alone. |
| SDD source syntax | `bundle/v0.1/core/syntax.yaml` | Read the active bundle syntax before authoring unfamiliar source structure or IDs. |
| Node and relationship vocabulary | `bundle/v0.1/core/vocab.yaml` | Choose SDD tokens from the bundle, not from prompt word matching. |
| Valid relationship endpoints | `bundle/v0.1/core/contracts.yaml` | Verify edge type and endpoint pairs before authoring graph semantics. |
| Projection scope and hierarchy/order behavior | `bundle/v0.1/core/views.yaml` | Use view definitions when checking or rendering a projection. |
| Validation profile identity | helper contract with bundle resolution, manifest profiles | Resolve active profiles before using profile IDs that are not already known. |
| Saved user-facing diagram artifact | `sdd show` | Use the human-facing CLI for saved preview files. |
| Transient inline or tool artifact | helper `preview` | Treat `artifact_path` as ephemeral helper output. |
| Examples, snapshots, goldens | downstream evidence | Use them for comparison only after source authority is known. |

This table is the center of the design. When a future skill change conflicts with it, the table wins.

## 5. Core Invariants

1. SDD is a typed design graph with projections. A rendered diagram is a view over the graph, not the document's identity.
2. The bundle is the authority for SDD language semantics. Skill prose must not duplicate bundle-owned vocabulary, endpoint policy, syntax, profile lists, or view definitions as normative truth.
3. Helper discovery is the authority for helper mechanics. It is not sufficient authority for SDD authoring semantics.
4. Shared `assessment` is the authority for operational continuation. The skill must not reimplement commit or render eligibility from ad hoc result checks.
5. `.sdd` structural mutations go through helper-backed authoring flows when the helper supports the operation.
6. Existing-document handle-based edits require fresh inspect data or committed continuation handles for the returned revision.
7. Fresh document authoring continues from the `create` revision; immediate inspect is not the normal bootstrap step because an empty document can be parse-invalid.
8. Diagram or file-output requests require a saved artifact unless the user explicitly asks only for structured data or textual output.
9. Examples and snapshots cannot establish a rule that is absent from the bundle.
10. Future MCP behavior must preserve the same authority boundaries while using shared services directly.

## 6. Skill Operating Protocol

The skill starts every SDD task by classifying the operation:

- create a new document;
- edit an existing document;
- read, validate, project, or render an existing document;
- diagnose helper failure;
- use helper git commands.

After operation classification, the skill identifies which authorities are needed:

- Helper mechanics for command syntax, request shape, result shape, continuation, and transport.
- Bundle semantics for new or uncertain node types, relationship types, endpoint pairs, ID syntax, source syntax, projection scope, and view behavior.
- Shared assessment for workflow gates.
- Rendering surface for saved or transient artifacts.

The skill then executes the smallest reliable loop:

1. Read only the needed authority.
2. Compose the helper request from that authority.
3. Dry-run mutations before commit.
4. Interpret the result through `assessment`.
5. Commit only when assessment permits and the user wants a real mutation.
6. Validate or project persisted state when semantic confirmation is required.
7. Render saved artifacts through `sdd show` when the user requested a diagram or file.
8. Use helper `preview` only for transient artifact access or inline image display.

The skill stops when an authority conflict appears. It does not patch over conflicts by guessing, copying examples, or adding local prompt rules.

## 7. Targeted Bundle Reading

The bundle-authority pass is not a full-bundle dump. It is a targeted read of the files that answer the current semantic question.

For fresh document authoring, read `bundle/v0.1/manifest.yaml` first to confirm the active core files.

Read `core/syntax.yaml` when the task requires:

- node IDs;
- node headers;
- edge lines;
- property lines;
- nesting;
- source syntax details.

Read `core/vocab.yaml` when the task requires selecting SDD node or relationship tokens.

Read `core/contracts.yaml` when the task requires creating, validating, or judging edges.

Read `core/views.yaml` when the task requires projection scope, hierarchy edges, ordering edges, view-specific annotations, or rendered-view behavior.

Read profiles when the task requires validation-profile behavior beyond the profile IDs exposed by helper contract resolution.

Do not read `.sdd` examples to infer language rules. Read examples only for comparison, regression investigation, or user-requested reuse after the bundle authority is known.

## 8. Authoring Reliability Rules

The skill must author from graph meaning, not from prompt keyword matching.

Prompt words are input language. Bundle vocabulary and contracts decide SDD language. A user word that matches an SDD token still requires semantic confirmation against `vocab.yaml` and endpoint validation against `contracts.yaml` before it becomes source.

IDs must match the active bundle syntax. In `bundle/v0.1/core/syntax.yaml`, `lexical.id_pattern` is:

```text
^[A-Z]{1,3}-[0-9]{3,}([a-z][a-z0-9]*)?$
```

This pattern is cited because it is the current active bundle value. The architectural rule is not this literal regex; the rule is that the skill reads the active bundle syntax and follows it.

Nesting is source organization. Explicit edges carry graph semantics. A nested block without the corresponding semantic relationship does not establish containment, composition, transition, navigation, ordering, traceability, data access, or service dependency.

Projection is a check and presentation boundary. A view can reveal that the graph does not express the intended semantics, but the view does not replace the graph as the authoring target.

## 9. Artifact Contract

There are two artifact roles:

- Saved user-facing artifacts.
- Transient helper artifacts.

Saved user-facing artifacts are produced with `sdd show`. When a user asks for a diagram, preview file, SVG, PNG, or file output, the skill must end with a saved artifact path unless the user explicitly requested only structured projection data or a textual diagram.

Transient helper artifacts are produced with helper `preview`. The helper returns an ephemeral `artifact_path` for immediate consumption by tools or inline chat rendering. That path is not the canonical file output.

The skill can use both in one workflow:

1. Use `sdd show` to create the saved artifact.
2. Use helper `preview` with the same document, view, profile, and format when inline display or transient file access is needed.
3. Report the saved artifact as the durable output.

## 10. Helper And MCP Surface Direction

`sdd-helper` remains a CLI adapter. It owns command-line transport, request loading, JSON parsing, adapter-level errors, stdout behavior, and narrow `.sdd`-scoped operations for agent workflows.

The future MCP server remains a sibling adapter over shared services. It owns MCP tool/resource/prompt exposure and MCP-specific transport. It must call shared SDD services directly.

Shared services own domain behavior:

- inspecting documents;
- authoring and applying structured changes;
- undo behavior;
- validation;
- projection;
- preview generation through shared runtime paths;
- outcome assessment.

Bundle-derived convenience surfaces are acceptable only when generated from the loaded bundle. A future authoring crib sheet can be useful if it is generated from `manifest.yaml`, `syntax.yaml`, `vocab.yaml`, `contracts.yaml`, and `views.yaml`, and if it identifies those source files. It must not become hand-maintained duplicate SDD language.

## 11. Skill Structure Implications

The top-level skill should stay short. Its job is to keep the operating model active:

- choose the branch;
- choose the authority;
- enforce hard stops;
- invoke the helper wrapper;
- follow shared assessment;
- point to references for detailed procedure.

Detailed procedure belongs in reference files. The workflow reference should contain the targeted bundle-reading protocol, request-file patterns, dry-run/commit loop, persisted validation/projection loop, saved artifact branch, transient preview branch, and helper-failure diagnosis.

The skill should remove wording that treats code/docs lookup as a generic fallback after helper discovery. That wording collapses language authority into an implementation fallback. The replacement is explicit:

- use helper discovery for helper mechanics;
- use bundle files for SDD language;
- use docs only to explain a surface or investigate a mismatch;
- use implementation code only for implementation debugging.

## 12. Acceptance Criteria

This architecture is successful when future `sdd-skill` behavior satisfies these criteria:

1. A fresh document task produces syntactically valid IDs and source structure on the first authoring attempt by reading the active bundle syntax.
2. A graph authoring task selects node and relationship types from bundle vocabulary, not from unverified prompt keyword matches.
3. An edge authoring task verifies endpoint validity against bundle contracts before mutation.
4. A projection-sensitive task reads the relevant view definition before judging whether the graph expresses the intended view.
5. A mutation task dry-runs, reads shared `assessment`, and commits only when assessment permits and the user wants a real change.
6. A render task uses persisted-state validation and assessment before producing artifacts.
7. A file-output task returns a saved artifact from `sdd show`.
8. A helper-failure diagnosis preserves the layer boundary between transport, request shape, domain rejection, validation, projection, render, and environment failures.
9. The skill does not encode prompt-specific modeling rules as general guidance.
10. The future MCP surface exposes the same shared domain behavior without shelling out to `sdd-helper`.

## 13. Tests And Drift Control For Implementation

When this architecture is implemented in skill docs and tests, test the skill source for these properties:

- The top-level skill names helper discovery as helper-command authority.
- The top-level skill names bundle files as SDD-language authority.
- The workflow reference describes targeted bundle reads for authoring.
- The workflow reference preserves request-file defaults.
- The workflow reference preserves assessment gates.
- The workflow reference requires `sdd show` for saved diagram artifacts.
- No prompt-specific domain phrase is promoted to a general modeling rule.
- No skill text claims examples or snapshots are language authority.

Regression tests must protect against the skill becoming either too ceremonial or too thin:

- Too ceremonial: every task forces broad reading, search, inspect, validation, projection, and preview regardless of need.
- Too thin: fresh authoring proceeds from helper request shape alone without reading bundle language facts.

The target is a boring common path with sharp authority boundaries.
