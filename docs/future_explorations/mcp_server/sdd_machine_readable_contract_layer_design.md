# SDD Shared Machine-Readable Contract Layer Design

Status: focused addendum for shared helper/MCP contract metadata

Audience: maintainers extending the shared SDD domain core, `sdd-helper`, `sdd-skill`, and the future MCP server

Purpose: define a concrete machine-readable tooling-contract layer in the shared domain core, with a 3-layer model that keeps default discovery lightweight while making deep contract detail available on demand

Authority:

- This document complements and proposes additive revisions to [sdd_mcp_server_design.md](./sdd_mcp_server_design.md).
- It does not replace the current MCP/helper design note as the overall design authority for helper-app and MCP behavior.
- Until implementation lands and the referenced design note is revised, the current helper and MCP-facing contracts remain authoritative for runtime behavior.
- For SDD language semantics, bundle files under `bundle/v0.1/` remain authoritative. This document defines tooling-contract metadata, not bundle semantics.

## 1. Summary

The current helper discovery surface is intentionally static and compact. That is the right default posture for orientation, but it is too thin to serve as the only machine-readable guide for efficient authoring workflows.

Today, a client can discover that `author` exists and that it accepts `ApplyAuthoringIntentArgs`, but it cannot discover the nested request shape, semantic constraints, continuation rules, or bundle-bound value semantics without reading TypeScript contracts, validation logic, or prose documentation.

This design introduces a shared machine-readable contract layer in the domain core with three layers:

1. a shared contract layer that defines reusable machine-readable subject and shape metadata for helper and MCP
2. a lightweight discovery layer that stays compact and static
3. a deep on-demand introspection layer that returns full schema detail only when the client asks for it

This is intentionally a tooling-contract design, not a language-spec design. It does not move helper or MCP contract metadata into the bundle, and it does not change bundle authority over language behavior, views, or profiles.

## 2. Observed Problem

Current helper and future MCP work share one domain model, but the machine-readable contract story is uneven:

- helper discovery is strong at command inventory and weak at nested request/result detail
- structural schema detail is implicit in TypeScript types rather than surfaced as machine-readable contract data
- semantic rules such as `local_id` ordering, uniqueness, continuation validity, and bundle-bound value semantics live in validation logic or prose rather than a shared contract layer
- the future MCP adapter would otherwise need to duplicate subject descriptions, schema generation, and constraint wording that logically belong in the shared domain core

The repo already treats machine-readable artifacts as first-class when they govern behavior. The same principle should apply here: helper and MCP contract metadata should live in one shared domain contract layer rather than being hand-maintained independently in adapter code.

## 3. Non-Negotiable Constraints

The following constraints are locked:

- `.sdd` files remain the authoritative authored artifact.
- Bundle files remain authoritative for language behavior, vocabulary, views, and profiles.
- Projection remains the stable public read-side semantic contract.
- Low-level writes remain revision-bound, handle-based change sets.
- Raw text editing does not become a public helper or MCP authoring contract.
- Helper and MCP remain sibling adapters over one shared domain core.
- The helper CLI remains JSON-first on stdout.
- `sdd-helper capabilities` remains static, self-describing, and answerable without repo inspection or bundle loading.
- The new contract layer does not require a separate schema registry outside the shared domain core.
- The new contract layer does not move tool/resource/prompt metadata into `bundle/v0.1/`.
- The design must preserve backward compatibility for the current helper command set and `HelperCapabilitiesResult`.

## 4. Design Principles

### 4.1 Bundle Authority And Tooling Contract Authority Are Separate

Bundle files govern SDD language and bundle-owned downstream semantics. The shared contract layer governs the machine-readable API metadata that helper and MCP expose over shared domain services.

The split is:

- bundle-owned: language versioning, syntax, vocabulary, graph schema, view definitions, profiles, and any value sets that are semantically defined by those artifacts
- shared contract layer-owned: helper/MCP subject inventory, request/result schema metadata, semantic constraint metadata, continuation metadata, bundle-binding references, stability metadata, and discovery/introspection shapes

This prevents adapter-only contracts from becoming the accidental source of truth for either language behavior or tool semantics.

### 4.2 One Shared Contract Layer, Two Adapter Surfaces

The helper and MCP surfaces must consume the same domain-core contract metadata.

- The helper adapter does not define a separate schema model.
- The MCP adapter does not shell out to helper discovery.
- Shared subject metadata, shape metadata, constraint metadata, and bundle-binding metadata are generated and owned once in the domain core.
- Surface-specific output envelopes may still differ where protocol rules require it.

### 4.3 Progressive Disclosure Is A Locked Design Principle

The default discovery surface must stay compact. Rich contract detail must be available, but only on demand.

This design therefore rejects:

- permanently bloated top-level helper discovery payloads
- permanently expanded enums and large examples in default discovery
- forcing every client to pay the token or payload cost for contract detail it does not need

### 4.4 JSON Schema Is The Structural Shape Format

Structural request/result/resource/prompt argument shapes use JSON Schema as the canonical machine-readable schema format for this layer.

This aligns with:

- existing Ajv usage
- current repo practice around machine-readable schemas
- future MCP input-schema-backed tool exposure

JSON Schema is not sufficient by itself for all semantics. The shared contract envelope therefore carries additional machine-readable metadata for rules that are not naturally expressible as plain JSON Schema.

## 5. Three-Layer Model

```text
Client / Skill / MCP Host
  |
  +-- Layer 2: Lightweight discovery
  |     - compact static inventory
  |     - subject ids
  |     - shape refs
  |     - "deeper detail exists"
  |
  +-- Layer 3: Deep introspection (on demand)
  |     - full subject detail
  |     - full structural schemas
  |     - semantic constraints
  |     - continuation rules
  |     - bundle-binding refs or resolved values
  |
  +-- Layer 1: Shared contract layer in domain core
        - subject registry
        - shape registry
        - constraint metadata
        - continuation metadata
        - bundle-binding metadata
        - adapter consumption services
```

The shared contract layer is the real authority. Lightweight discovery and deep introspection are two different ways of surfacing that same authority to clients.

## 6. Layer 1: Shared Contract Layer

## 6.1 Intent

The shared contract layer is the transport-agnostic machine-readable contract registry in the domain core. It defines:

- what helper commands, MCP tools, MCP resources, and MCP prompts exist as machine subjects
- which structural schemas they use
- which semantic constraints apply beyond JSON Schema
- which fields are bound to bundle-owned value sources
- what continuation semantics apply to returned data

This layer is consumed by both adapters. It is not itself a CLI command and not itself an MCP endpoint.

## 6.2 Contract Categories

The shared contract layer must cover these categories:

- low-level change-set requests and results
- high-level authoring-intent requests and results
- inspect/search/create/undo/read/preview surfaces
- helper discovery payloads
- MCP-facing tool input metadata
- MCP-facing resource payload metadata
- MCP-facing prompt argument metadata

The contract layer does not define renderer internals, bundle semantics, or adapter transport behavior beyond what is required to describe subjects accurately.

## 6.3 Common IDs

The contract layer uses stable machine IDs for both subjects and shapes.

Subject IDs:

- helper commands: `helper.command.<name>`
- MCP tools: `mcp.tool.<namespace>.<name>`
- MCP resources: `mcp.resource.<namespace>.<name>`
- MCP prompts: `mcp.prompt.<namespace>.<name>`

Shape IDs:

- shared reusable shapes: `shared.shape.<name>`

Constraint IDs:

- semantic constraint records: `shared.constraint.<name>`

Binding IDs:

- bundle-binding records: `shared.binding.<name>`

Continuation IDs:

- continuation metadata records: `shared.continuation.<name>`

These IDs are stable contract identifiers. They must not depend on runtime bundle contents, filesystem paths, or generated hash values.

## 6.4 Shared Contract Types

The shared contract layer is defined by the following transport-agnostic model.

```ts
type ContractSubjectId =
  | `helper.command.${string}`
  | `mcp.tool.${string}`
  | `mcp.resource.${string}`
  | `mcp.prompt.${string}`;

type ContractShapeId = `shared.shape.${string}`;
type ContractConstraintId = `shared.constraint.${string}`;
type ContractBindingId = `shared.binding.${string}`;
type ContractContinuationId = `shared.continuation.${string}`;

type ContractSchemaFormat = "json_schema_2020_12";
type ContractResolutionMode = "static" | "bundle_resolved";
type ContractStability = "stable" | "experimental" | "deprecated";
type ContractSurfaceKind = "helper_command" | "mcp_tool" | "mcp_resource" | "mcp_prompt";

interface ContractIndex {
  kind: "sdd-contract-index";
  contract_version: "0.1";
  summary: string;
  subjects: ContractSubjectDescriptor[];
  shapes: ContractShapeDescriptor[];
}

interface ContractSubjectDescriptor {
  subject_id: ContractSubjectId;
  surface_kind: ContractSurfaceKind;
  surface_name: string;
  summary: string;
  stability: ContractStability;
  mutates_repo_state?: "never" | "conditional" | "always";
  input_shape_id?: ContractShapeId;
  output_shape_id?: ContractShapeId;
  detail_modes: ContractResolutionMode[];
  has_deep_introspection: true;
}

interface ContractSubjectDetail {
  kind: "sdd-contract-subject-detail";
  subject: ContractSubjectDescriptor;
  input_shape?: ContractShapeDescriptor;
  output_shape?: ContractShapeDescriptor;
  constraints: ContractConstraintSpec[];
  bindings: ContractBindingSpec[];
  continuation: ContractContinuationSpec[];
  examples?: ContractExampleSpec[];
  resolution: {
    mode: ContractResolutionMode;
    bundle_name?: string;
    bundle_version?: string;
    unresolved_binding_ids?: ContractBindingId[];
  };
}

interface ContractShapeDescriptor {
  shape_id: ContractShapeId;
  summary: string;
  schema_format: ContractSchemaFormat;
  schema: object;
  stability: ContractStability;
}

interface ContractConstraintSpec {
  constraint_id: ContractConstraintId;
  applies_to_shape_id: ContractShapeId;
  applies_to_json_pointers?: string[];
  kind:
    | "required_if"
    | "forbidden_if"
    | "unique_within_request"
    | "must_reference_earlier_local_id"
    | "same_revision_handle"
    | "commit_safe_continuation"
    | "dry_run_informational_only";
  parameters: Record<string, unknown>;
  summary: string;
}

interface ContractBindingSpec {
  binding_id: ContractBindingId;
  applies_to_shape_id: ContractShapeId;
  applies_to_json_pointer: string;
  kind: "bundle_value_set";
  bundle_source: {
    artifact: "manifest_profiles" | "views_yaml" | "vocab_node_types" | "vocab_relationship_types";
    selector: string;
  };
  static_behavior: "reference_only";
  bundle_resolved_behavior: "expand_values";
  summary: string;
}

interface ContractContinuationSpec {
  continuation_id: ContractContinuationId;
  applies_to_subject_id: ContractSubjectId;
  kind:
    | "result_revision_is_required_next_base_revision"
    | "commit_handles_are_safe_continuation_surfaces"
    | "dry_run_handles_are_informational_only"
    | "create_revision_is_bootstrap_continuation_surface"
    | "inspect_may_fail_on_empty_bootstrap";
  summary: string;
  parameters?: Record<string, unknown>;
}

interface ContractExampleSpec {
  title: string;
  when_to_include: "explicit_request_only" | "essential_only";
  payload: unknown;
}
```

These types are the design contract for the shared layer. The later implementation may factor them differently internally, but it must preserve the same semantics and field responsibilities.

## 6.5 JSON Schema Responsibility

JSON Schema is used for structural shape only:

- required fields
- field types
- array/object structure
- simple enums that are adapter-owned rather than bundle-owned
- nullability
- nested request/result structure

The shared contract layer must not try to encode every semantic rule in JSON Schema. When a rule is semantically important but awkward or misleading to force into structural schema, it belongs in explicit `ContractConstraintSpec` records instead.

## 6.6 Constraint Taxonomy

The shared contract layer must represent at least the following semantic constraint categories.

### 6.6.1 `required_if`

Used when one field is required only when another field has a certain value.

Canonical example:

- `placement.anchor` is required when `placement.mode` is `before` or `after`

### 6.6.2 `forbidden_if`

Used when one field must be absent when another field has a certain value.

Canonical example:

- `placement.anchor` is forbidden when `placement.mode` is `first` or `last`

### 6.6.3 `unique_within_request`

Used when repeated caller-supplied IDs must be unique across one request.

Canonical examples:

- scaffold `local_id`
- nested edge `local_id`

### 6.6.4 `must_reference_earlier_local_id`

Used when a request-local reference is valid only if it points to a node created earlier in the same request.

Canonical example:

- `NodeRef` with `by: "local_id"`

### 6.6.5 `same_revision_handle`

Used when a handle is valid only for the exact revision that produced it.

Canonical examples:

- `node_handle`
- `edge_handle`
- `anchor_handle`

### 6.6.6 `commit_safe_continuation`

Used when returned values are safe continuation surfaces only for committed results and only for the returned committed revision.

Canonical examples:

- committed insertion handles
- committed `created_targets`

### 6.6.7 `dry_run_informational_only`

Used when returned values are real structural previews but explicitly not valid for later mutation requests.

Canonical examples:

- dry-run insertion handles
- dry-run `created_targets`

These constraint kinds are mandatory categories in the design. Future additive constraint kinds are allowed, but the implementation must cover these categories exactly.

## 6.7 Bundle-Binding Semantics

Some fields are structurally strings but semantically refer to bundle-owned value sets. These fields must not hardcode bundle enums into the static contract layer.

The design rule is:

- if a field's allowed values are governed by bundle authority, the shared contract layer records that as a bundle binding
- the static contract layer references the bundle-owned source
- bundle-resolved introspection may later expand those values for the active bundle

Canonical bundle-bound fields include:

- `view_id`
- `profile_id`

The same rule also applies to any future helper or MCP field whose allowed values are bundle-owned, including vocabulary-derived node or relationship identifiers when those are surfaced as machine-guided allowed-value references.

The static layer must not duplicate bundle values into hand-maintained helper- or MCP-only enums. Doing so would create a second authority for bundle semantics.

## 6.8 Continuation Semantics

Continuation rules are first-class contract metadata, not incidental prose.

The shared contract layer must represent at least these continuation semantics:

- `create` returns a revision that is the correct next `base_revision` for follow-on authoring
- immediate `inspect` is not guaranteed to succeed after `create` because the empty bootstrap may still be parse-invalid
- committed returned handles are safe continuation surfaces only for the returned committed revision
- dry-run returned handles are informational only and must not be reused in later requests
- revision-bound handles always require same-revision usage

These rules are important enough that a client should be able to discover them without reading implementation code or prose docs.

## 7. Layer 2: Lightweight Discovery

## 7.1 Intent

Lightweight discovery is the compact orientation surface. For the helper adapter, this is `sdd-helper capabilities`.

Its job is to answer:

- what subjects exist
- what they are called
- whether they mutate repo state
- what top-level shapes they use
- whether deeper detail is available

It is not the place to inline full nested schemas, expanded bundle-bound value sets, or verbose rule catalogs.

## 7.2 Helper Discovery Design

`sdd-helper capabilities` remains:

- static
- self-describing
- JSON-first
- answerable without repo inspection or bundle loading

Its payload must remain backward-compatible and additive relative to the current `HelperCapabilitiesResult`.

The additive subject-detail pointers are:

- `subject_id`
- optional `input_shape_id`
- optional `output_shape_id`
- `has_deep_introspection`
- optional `detail_modes`

The additive helper discovery shape is:

```ts
interface HelperCapabilitiesResultCommand {
  name: string;
  invocation: string;
  summary: string;
  mutates_repo_state: "never" | "conditional" | "always";
  arguments: Array<...>;
  options: Array<...>;
  request_body?: {
    via_option: "--request";
    top_level_shape: string;
    source: "file_path_or_stdin_dash";
  };
  result_kind: string;
  constraints: string[];

  // additive contract pointers
  subject_id: ContractSubjectId;
  input_shape_id?: ContractShapeId;
  output_shape_id?: ContractShapeId;
  has_deep_introspection: true;
  detail_modes?: Array<"static" | "bundle_resolved">;
}
```

This is intentionally still light. The current fields remain useful for human-readable and machine-readable quick orientation. The new fields merely tell the client how to fetch deeper detail.

## 7.3 Explicit Rejection: No Huge Capabilities Payload

The design explicitly rejects the following for `sdd-helper capabilities`:

- inlining full nested authoring or change-set schemas
- inlining full result schemas
- inlining large example payloads
- inlining expanded bundle-bound value sets
- turning discovery into a substitute for deep introspection

That would weaken the progressive-disclosure model, consume unnecessary tokens, and bloat a payload that is intentionally static and fast to consume.

## 7.4 MCP-Side Lightweight Discovery

The future MCP adapter must consume the same shared subject metadata internally.

The design requirement is:

- MCP tool/resource/prompt metadata should be generated from the shared contract layer wherever the protocol supports it
- this slice does not require a public MCP contract resource or prompt
- MCP may expose only the normal protocol-native capability surfaces while still sourcing their metadata from the shared contract layer

In other words, MCP should use the same subject registry, not invent a second discovery model.

## 8. Layer 3: Deep On-Demand Introspection

## 8.1 Intent

Deep introspection is the rich contract surface used when a client truly needs schema depth.

Its job is to answer:

- what are the full input and output schemas for this subject
- what semantic constraints apply beyond JSON Schema
- what continuation semantics matter for follow-on work
- which fields are bundle-bound and how to resolve them

This is the layer that removes the need for ad hoc contract/code spelunking in common authoring workflows.

## 8.2 Resolution Modes

Deep introspection supports exactly two modes.

### 8.2.1 `static`

Characteristics:

- no bundle load
- no repo inspection
- returns structural schemas
- returns semantic constraints
- returns continuation metadata
- returns bundle bindings as unresolved references

Use when:

- the client only needs contract structure
- the client wants a static payload safe for caching
- the client does not need active-bundle value expansion

### 8.2.2 `bundle_resolved`

Characteristics:

- loads the active bundle
- preserves the same structural schemas
- expands bundle-bound value references into active allowed-value metadata
- reports which bundle was used for resolution

Use when:

- the client needs actual active-bundle values for fields such as `view_id` or `profile_id`
- the client wants to validate candidate arguments against the current bundle-owned value sets

The two modes differ only in binding resolution and resolution metadata. They must not change the structural schema definitions themselves.

## 8.3 Helper Deep Introspection Command

The helper adapter adds one new deep-introspection command:

```bash
sdd-helper contract <subject_id> [--resolve bundle]
```

Resolution semantics:

- no `--resolve`: return `ContractSubjectDetail` in `static` mode
- `--resolve bundle`: return `ContractSubjectDetail` in `bundle_resolved` mode

This command is the helper-side deep introspection surface. It does not replace `capabilities`.

## 8.4 Helper Contract Result Shape

The helper command returns a domain-logical result based on `ContractSubjectDetail`.

```ts
interface HelperContractDetailResult extends ContractSubjectDetail {
  kind: "sdd-contract-subject-detail";
}
```

The payload must include:

- full subject metadata
- referenced input/output shape schemas
- semantic constraint specs
- continuation semantics
- bundle-binding specs
- resolution metadata

Examples:

- no examples by default
- include only minimal examples when explicitly requested in a later additive option, or when the implementation determines one example is essential to make the subject usable without ambiguity

The default stance is to omit examples unless clearly needed.

## 8.5 MCP Consumption Of Deep Introspection

The MCP adapter must consume the same shared contract layer internally and directly.

The design requirement is:

- do not shell out from MCP to `sdd-helper contract`
- do not maintain separate MCP-only schema definitions for the same domain subjects
- use the shared layer to generate MCP-facing input-schema-backed tool/resource/prompt metadata where protocol features support that

This design does not require a public MCP contract endpoint in the first slice. If future protocol needs prove that a public contract resource is useful, it must reuse the same shared subject-detail shape rather than inventing a second deep-introspection contract.

## 9. Token-Weight And Ergonomics Policy

Progressive disclosure is not an implementation convenience. It is a product constraint.

The policy is:

- Layer 2 is the default orientation surface.
- Layer 3 is fetched only when the client actually needs deeper schema detail.
- Large examples, expanded enums, or verbose rule prose do not belong in default discovery.
- Contract richness belongs in shared deep introspection, not in permanently expanded top-level helper discovery.

This is the intended trade:

- discovery stays cheap and easy to consume
- deep detail stays available when needed
- the shared contract layer still becomes the real machine-readable authority

## 10. Skill Operating Instructions Integration

The `sdd-skill` is an existing helper-first client of the shared SDD domain capabilities. Once the shared contract layer exists, the skill's operating instructions must be updated to consume that richer contract surface deliberately.

This is not a separate architecture. The skill remains:

- a runtime consumer of the helper surface
- a consumer of the helper's contract discovery and introspection output
- non-authoritative for nested request schemas, semantic constraints, continuation semantics, and bundle-bound value sets

The skill must not become a second place where those contracts are manually restated and allowed to drift.

### 10.1 Skill Position In The Architecture

The design stance is:

- the shared contract layer is the machine-readable authority
- the helper is the CLI adapter that exposes that authority to the skill
- the skill is the operating-instructions layer that decides when to call `capabilities`, when to call `contract`, and how to use the returned contract data safely

This means the skill should become more contract-aware, not more schema-owning.

### 10.2 Required Changes To The Skill's Operating Instructions

The skill documentation should be revised so its normal decision flow is:

1. use `sdd-helper capabilities` for lightweight command orientation when the current helper surface may matter
2. use `sdd-helper contract <subject_id>` when the task requires full nested request or result shape detail, semantic constraints, continuation semantics, or bundle-binding metadata
3. use `sdd-helper contract <subject_id> --resolve bundle` when the task requires active bundle-resolved values for bundle-bound fields such as `view_id` or `profile_id`

The skill's documented helper surface should be updated to include:

- `capabilities`
- `contract`

The skill's quick-start and workflow guidance should explicitly treat `contract` as the preferred source for:

- composing `author` requests
- composing `apply` requests when structural or semantic rule detail matters
- composing `undo` requests when continuation or result-shape detail matters
- understanding `create` bootstrap semantics
- resolving bundle-bound preview or render arguments

### 10.3 Skill Retrieval Policy

The skill should adopt the following retrieval policy.

Use `capabilities` by default for:

- command inventory
- high-level orientation
- confirming whether a helper command exists

Use `contract` in `static` mode when:

- the skill is about to compose nested JSON for `author`, `apply`, or `undo`
- the skill needs semantic constraints that are not safely inferable from top-level discovery
- the skill needs continuation metadata such as dry-run versus commit-safe handles
- the skill needs create-bootstrap caveats before planning the next step

Use `contract` in `bundle_resolved` mode when:

- the skill needs actual active values for bundle-bound fields
- the skill wants to validate or propose `view_id` or `profile_id` values against the active bundle

Do not call `contract` by default for:

- simple `search`
- simple `inspect`
- simple `validate`
- simple `project`
- plain `sdd show` flows where the required `view_id` and `profile_id` are already known

This preserves the progressive-disclosure model on the skill side as well as the helper side.

### 10.4 Anti-Spelunking Rule For The Skill

Once the richer contract layer exists, the skill's operating instructions should state a firmer fallback hierarchy:

1. use `capabilities` for lightweight discovery
2. use `contract` for deep contract detail
3. only if those surfaces remain insufficient, consult code or prose documentation for gaps

The skill should not inspect TypeScript contracts, validation logic, tests, or repo `.sdd` examples merely to recover nested helper request shape or normal continuation rules when the helper contract surfaces already provide that information.

This does not ban code lookup entirely. Contract/code lookup remains acceptable when:

- the helper contract surface is incomplete
- the user is explicitly asking about implementation details
- the task is debugging a contract/runtime mismatch

### 10.5 Skill Documentation Boundaries

The skill documentation should describe:

- task-kind-first workflow
- when to use `capabilities`
- when to use `contract`
- how to choose between `static` and `bundle_resolved`
- how to treat continuation metadata safely

The skill documentation should not duplicate:

- full nested request schemas
- full nested result schemas
- expanded bundle-owned enums
- long lists of semantic constraints that are now available through deep introspection

Those belong in the shared contract layer and helper introspection output, not in hand-maintained skill prose.

### 10.6 Canonical Skill Guidance And Sync Expectation

Because the skill may exist both in the repository and as an installed local copy, this design adopts the following guidance stance:

- the repository skill documentation is the canonical authored guidance
- installed skill copies should be refreshed from that canonical guidance rather than independently evolved
- the shared contract layer reduces drift risk further by moving detailed machine-readable contract knowledge out of the skill text and into helper-exposed introspection

The result is that the skill stays concise and operational while the shared contract layer remains the deep authority.

## 11. Review Scenarios

The design is only acceptable if it cleanly supports the following scenarios.

### 11.1 Skill Authoring With Deep Introspection

A skill calls `sdd-helper capabilities`, finds `helper.command.author`, reads its `subject_id`, then calls `sdd-helper contract helper.command.author`.

The returned subject detail gives the skill:

- the full `ApplyAuthoringIntentArgs` structural schema
- the semantic rules around `local_id`, placement anchors, and ordering
- the continuation rules around dry run versus commit

The skill no longer needs to inspect TypeScript source just to build a valid request.

### 11.2 Fresh-Document Bootstrap

A client inspects the `helper.command.create` subject detail and learns:

- the result returns a revision continuation surface
- immediate `inspect` is not guaranteed to succeed on an empty bootstrap document

That allows the client to choose `create -> author` instead of assuming `create -> inspect -> author`.

### 11.3 Bundle-Bound Value Resolution

A client inspects `helper.command.preview` in `static` mode and sees that `view_id` and `profile_id` are bundle-bound refs rather than hardcoded enums.

When it needs concrete allowed values, it requests `bundle_resolved` detail and receives the active bundle-derived values.

### 11.4 Structural Schema Versus Semantic Constraints

A client learns from one subject detail that:

- JSON Schema describes the nested payload shape
- semantic constraints separately define uniqueness, earlier-local-id references, and continuation validity

That distinction prevents the false assumption that every rule must be inferred from plain structural schema.

### 11.5 Continuation Safety

A client learns from continuation metadata that:

- committed handles are safe continuation surfaces
- dry-run handles are informational only

This lets the client continue helper workflows safely without over-generalizing dry-run results.

### 11.6 Compact Discovery

A client doing simple orientation still uses `sdd-helper capabilities` and gets a compact, static payload. It does not pay the token or parsing cost of full authoring schemas unless it explicitly asks for them.

## 12. Compatibility And Migration Stance

This design is additive.

Locked compatibility decisions:

- keep the current helper command surface valid
- keep `HelperCapabilitiesResult` backward-compatible and additive
- do not redesign the bundle to carry helper/MCP contract metadata
- do not replace the current MCP/helper design note yet

The implementation may add new domain-core contract types and one new helper introspection command, but it must not break existing helper clients that only know the current `capabilities` payload.

## 13. Explicitly Rejected Alternatives

The following alternatives are rejected by this design:

- **Put helper/MCP contract metadata into `bundle/v0.1/`**
  - rejected because bundle authority is for language and bundle-owned semantics, not adapter contract metadata
- **Inline full nested schemas directly into `sdd-helper capabilities`**
  - rejected because it bloats default discovery and violates progressive disclosure
- **Create separate helper-only and MCP-only schema registries**
  - rejected because helper and MCP are sibling adapters over one domain model
- **Require a public MCP contract resource in the first slice**
  - rejected because internal consumption from the shared contract layer is sufficient for v1

## 14. Required Future Revisions To `sdd_mcp_server_design.md`

Once this design is implemented, `sdd_mcp_server_design.md` should be revised in these specific ways:

- update the helper discovery section so `HelperCapabilitiesResult` includes additive contract-pointer fields such as `subject_id`, `input_shape_id`, `output_shape_id`, and deep-introspection availability
- add the helper deep-introspection command `sdd-helper contract <subject_id> [--resolve bundle]`
- clarify that helper discovery remains intentionally static and thin, while deep schema detail comes from on-demand contract introspection
- clarify that MCP tool/resource/prompt metadata is generated from the shared contract layer rather than hand-maintained separately in adapter code
- clarify that bundle-owned value sets remain bundle-bound references in the shared contract layer and are resolved only in bundle-resolved introspection mode

Those revisions are documentation follow-on work. They are not part of this design document's implementation scope.

## 15. Out Of Scope

This design does not include:

- implementation sequencing or checkpoint plans
- exact file layout for the future implementation
- generic shell or git contract expansion
- raw text editing contracts
- renderer-stage public APIs
- a public MCP contract resource in the first slice

## 16. Closing Position

The correct place to add tooling-contract depth is the shared domain core, not the top-level helper discovery payload alone.

The correct trade-off is:

- shared deep machine-readable authority
- thin default discovery
- rich on-demand introspection

That gives helper, skill, and future MCP work one contract authority without paying maximum token cost on every orientation pass.
