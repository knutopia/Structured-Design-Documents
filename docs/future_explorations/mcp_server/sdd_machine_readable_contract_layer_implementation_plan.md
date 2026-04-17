# SDD Shared Machine-Readable Contract Layer Implementation Plan

Status: active gated implementation plan for the shared helper-first contract rollout

Audience: maintainers implementing the shared domain-core contract layer, `sdd-helper`, `sdd-skill`, and later MCP-server consumption

Purpose: turn [sdd_machine_readable_contract_layer_design.md](./sdd_machine_readable_contract_layer_design.md) into a sequenced implementation plan with explicit gates, proof tasks, and stop conditions

## 1. Summary

This plan implements the shared machine-readable contract layer through a helper-first sequence that keeps scope under control while preserving the design's long-term shape.

The immediate implementation target is:

- shared domain-core contract metadata
- helper-side lightweight discovery and deep introspection
- skill-side operating-instruction updates that consume the richer helper contract surface

The MCP server is still the missing adapter surface. This plan therefore treats live MCP consumption as a later gate, not part of the first helper-first implementation milestone.

The implementation is complete for the first milestone only when:

- the shared contract layer exists in the domain core
- `sdd-helper capabilities` exposes additive contract pointers while staying thin and static
- `sdd-helper contract <subject_id>` exposes deep contract detail in `static` and `bundle_resolved` modes
- the repository `sdd-skill` guidance is updated to use `capabilities` and `contract` deliberately
- helper and design documentation are aligned to the implemented behavior

## 2. How To Use This Plan

This document is intended to drive multiple sequential plan-mode implementation threads.

Rules for use:

1. Complete one gate at a time. Do not start a later gate until the earlier gate is implemented, verified, and merged.
2. At the start of each gate, restate the selected gate and re-inspect the current repository state before planning code changes.
3. Cite the relevant invariants from [sdd_machine_readable_contract_layer_design.md](./sdd_machine_readable_contract_layer_design.md) and `AGENTS.md` before implementation.
4. Treat each gate as proof-case work. Do not broaden scope mid-gate just because adjacent work looks convenient.
5. If a gate exposes a design gap, stop and update the design doc before continuing into implementation drift.
6. Run verification with `TMPDIR=/tmp` for Node-based commands and test runs.

The recommended workflow is:

1. select one gate from this document
2. create a gate-specific plan-mode implementation thread
3. execute only that gate
4. verify the proof tasks for that gate
5. update docs only when the implemented behavior is real

## 3. Locked Goals And Boundaries

The following goals are locked for this implementation sequence:

- implement the shared contract layer in the shared domain core rather than in helper-only or MCP-only adapter code
- preserve bundle authority for language semantics and bundle-owned value sets
- preserve `sdd-helper` as a JSON-first helper surface
- preserve `sdd-helper capabilities` as static, self-describing, and lightweight
- add deep contract richness through on-demand introspection rather than bloating default discovery
- keep `HelperCapabilitiesResult` backward-compatible and additive
- keep the current helper command surface valid while adding the new `contract` command
- update the repository `sdd-skill` instructions so the skill becomes contract-aware instead of code-spelunking by default

The following are intentionally out of scope for the first implementation milestone:

- implementing the MCP server itself
- adding a public MCP contract resource or endpoint
- moving helper or MCP contract metadata into `bundle/v0.1/`
- raw-text authoring surfaces
- redesigning non-contract helper behavior unrelated to this feature
- independently evolving installed skill copies during implementation

## 4. Scope Strategy

To keep scope realistic, implementation should be helper-first but MCP-ready.

That means:

- the shared domain model and registries should be generic enough to support helper and future MCP subjects
- the first implemented subject inventory should cover helper commands
- live MCP subject publication and server-side consumption should be deferred until MCP server work begins

This is the key scope decision for the plan. The shared layer must be architected for both adapters, but the first executable proof slice should run entirely through the existing helper and skill surfaces.

## 5. Gate Sequence Overview

The implementation should proceed through these gates:

1. Gate 1: Shared domain-core contract foundation
2. Gate 2: Helper deep introspection and lightweight discovery integration in `static` mode
3. Gate 3: Bundle-resolved introspection for bundle-bound fields
4. Gate 4: Helper and skill guidance integration
5. Gate 5: MCP consumption follow-on once MCP server implementation begins

Gate 5 is intentionally deferred. Gates 1 through 4 define the current helper-first milestone.

## 6. Gate 1: Shared Domain-Core Contract Foundation

### Goal

Create the shared machine-readable contract layer in the domain core without changing helper CLI behavior yet.

### Why This Gate Exists

The design requires one shared contract authority. If helper discovery and helper deep introspection are added before the shared domain layer exists, adapter code will become the accidental source of truth.

### In Scope

- add the transport-agnostic contract model described in the design doc
- add a shared registry or service layer for subject descriptors, shape descriptors, constraints, bindings, and continuation metadata
- implement helper-command subject coverage in the shared layer
- model bundle-bound fields as references rather than hardcoded static enums
- add unit coverage for the shared layer as a domain-core facility

### Out Of Scope

- helper CLI exposure
- `sdd-helper capabilities` changes
- `sdd-helper contract` command wiring
- bundle resolution behavior
- skill documentation changes
- live MCP subject publication

### Primary Deliverables

- shared domain-core contract types and registry/service accessors
- helper-command subject descriptors with stable `subject_id` values
- reusable shape descriptors for helper request/result payloads
- machine-readable constraint, continuation, and binding metadata records
- tests proving the shared layer can answer helper-subject questions without helper CLI code

### Candidate Landing Zones

The exact file layout is not locked in advance, but likely landing zones include:

- [`src/authoring/contracts.ts`](../../../src/authoring/contracts.ts)
- a new shared contract module under `src/authoring/`
- [`tests/helperCli.spec.ts`](../../../tests/helperCli.spec.ts) only later, once helper exposure begins
- a new domain-core contract metadata test file under `tests/`

### Proof Tasks

1. In-process code can retrieve a `ContractSubjectDetail`-equivalent record for `helper.command.author`.
2. The shared layer can represent the required constraint categories from the design doc.
3. The shared layer can represent `create` continuation semantics, including the empty-bootstrap caveat.
4. Bundle-bound fields such as `view_id` and `profile_id` are represented as bindings rather than hardcoded static allowed-value enums.
5. No helper command behavior changes yet.

### Acceptance Criteria

- the shared contract layer exists as a domain-core authority
- helper subject metadata is not hand-maintained only inside helper discovery code anymore
- the design model is implemented generically enough to support future MCP subjects later
- tests prove the shared layer is internally coherent before any CLI exposure is added

### Stop Conditions

Stop this gate if:

- the implementation starts to hardcode bundle-owned enums into the static contract layer
- the proposed structure cannot represent the required constraint or continuation categories cleanly
- helper CLI changes become necessary before the shared layer is internally settled

## 7. Gate 2: Helper Deep Introspection And Lightweight Discovery Integration

### Goal

Expose the shared contract layer through `sdd-helper` in a way that preserves lightweight discovery and adds deep introspection in `static` mode.

### Why This Gate Exists

This is the first full vertical slice that a skill can consume. It is the point where the helper stops being only a thin command catalog and becomes a richer contract surface without giving up progressive disclosure.

### In Scope

- add the `sdd-helper contract <subject_id>` command in `static` mode
- integrate the shared contract layer into helper command discovery
- add the additive lightweight-discovery pointer fields described in the design doc
- expose the new `contract` command through helper discovery and help stub output
- add CLI and contract tests for the new helper behavior

### Out Of Scope

- bundle-resolved value expansion
- skill documentation updates
- MCP server consumption

### Primary Deliverables

- `sdd-helper contract <subject_id>` returning full subject detail in `static` mode
- additive `HelperCapabilitiesResult` pointer fields such as `subject_id`, `input_shape_id`, `output_shape_id`, `has_deep_introspection`, and `detail_modes`
- updated helper discovery output that remains static and thin
- tests covering both `capabilities` and `contract`

### Candidate Landing Zones

- [`src/cli/helperDiscovery.ts`](../../../src/cli/helperDiscovery.ts)
- [`src/cli/helperProgram.ts`](../../../src/cli/helperProgram.ts)
- [`src/authoring/contracts.ts`](../../../src/authoring/contracts.ts)
- [`tests/helperCli.spec.ts`](../../../tests/helperCli.spec.ts)
- [`docs/readme_support_docs/sdd-helper/README.md`](../../readme_support_docs/sdd-helper/README.md) only after the behavior is implemented

### Proof Tasks

1. `sdd-helper capabilities` still returns a static payload without repo inspection or bundle loading.
2. The `commands` inventory remains backward-compatible for existing clients.
3. `sdd-helper capabilities` includes additive contract-pointer fields for helper commands.
4. `sdd-helper contract helper.command.author` returns nested input/output shape data, semantic constraints, continuation metadata, and binding references.
5. `sdd-helper contract helper.command.create` exposes the revision continuation surface and empty-bootstrap `inspect` caveat.
6. `sdd-helper contract helper.command.preview` exposes bundle-binding references in unresolved form in `static` mode.

### Acceptance Criteria

- the helper now exposes both thin discovery and deep contract introspection
- the `contract` command is usable enough to remove routine contract spelunking for `author`, `apply`, `undo`, `create`, and `preview`
- the default `capabilities` payload remains compact and additive
- existing helper discovery consumers are not broken

### Stop Conditions

Stop this gate if:

- `capabilities` starts inlining full nested schemas or expanded bundle values
- helper discovery loses its static/no-bundle-load behavior
- the `contract` command cannot describe the highest-value authoring flows well enough to replace routine code lookup

## 8. Gate 3: Bundle-Resolved Introspection

### Goal

Add `bundle_resolved` introspection so clients can ask the helper to expand bundle-bound value references against the active bundle.

### Why This Gate Exists

The design requires bundle-owned values to remain bundle-owned. The helper therefore needs a second mode that resolves those values on demand rather than duplicating them statically in discovery.

### In Scope

- add `--resolve bundle` behavior to `sdd-helper contract`
- resolve bundle-bound allowed-value references for active bundle contexts
- preserve static schema identity while expanding binding metadata in resolved mode
- add tests proving correct behavior for bundle-bound fields such as `view_id` and `profile_id`

### Out Of Scope

- skill documentation updates
- MCP server implementation

### Primary Deliverables

- `sdd-helper contract <subject_id> --resolve bundle`
- contract responses that report resolution metadata and expanded active-bundle values where applicable
- test coverage for static-versus-resolved differences

### Candidate Landing Zones

- shared domain-core contract resolution services under `src/authoring/`
- [`src/cli/helperProgram.ts`](../../../src/cli/helperProgram.ts)
- [`tests/helperCli.spec.ts`](../../../tests/helperCli.spec.ts)
- [`tests/helperCli.integration.spec.ts`](../../../tests/helperCli.integration.spec.ts)

### Proof Tasks

1. `sdd-helper contract helper.command.preview` in `static` mode returns unresolved bundle-binding refs for `view_id` and `profile_id`.
2. The same command in `bundle_resolved` mode returns active allowed-value data derived from the current bundle.
3. The structural schema records remain the same between modes.
4. Capabilities output remains unchanged and lightweight after bundle-resolution support is added.

### Acceptance Criteria

- bundle-owned values stay bundle-owned in the static contract
- clients can fetch active-bundle values only when they explicitly ask
- resolution metadata clearly reports which bundle was used
- the resolved mode is helpful without turning default discovery into a dynamic contract fetch

### Stop Conditions

Stop this gate if:

- the implementation starts duplicating bundle-owned values into static discovery
- resolved mode changes structural schema definitions rather than only expanding bindings
- the helper can no longer answer simple discovery without bundle loading

## 9. Gate 4: Helper And Skill Guidance Integration

### Goal

Update the helper and skill documentation so the existing `sdd-skill` becomes a deliberate consumer of the improved helper contract layer.

### Why This Gate Exists

Without this gate, the new contract surfaces would exist, but the operating guidance for the skill would still point agents toward code spelunking, tests, or examples for information that the helper can now expose directly.

### In Scope

- update helper documentation to describe `contract` and the additive `capabilities` pointers
- update repository `sdd-skill` guidance so the skill uses `capabilities` and `contract` deliberately
- align the skill workflow to the retrieval policy and anti-spelunking rule from the design doc
- update MCP design notes where implemented helper behavior changed the assumed contract shape

### Out Of Scope

- automatic sync of installed skill copies
- MCP server implementation
- adding extra helper features beyond those in Gates 2 and 3

### Primary Deliverables

- updated [`docs/readme_support_docs/sdd-helper/README.md`](../../readme_support_docs/sdd-helper/README.md)
- updated [`skills/sdd-skill/SKILL.md`](../../../skills/sdd-skill/SKILL.md)
- updated [`skills/sdd-skill/references/workflow.md`](../../../skills/sdd-skill/references/workflow.md)
- updated [`sdd_mcp_server_design.md`](./sdd_mcp_server_design.md) where it currently assumes the thinner discovery-only helper contract

### Proof Tasks

1. The skill docs explicitly describe when to use `capabilities`, when to use `contract`, and when to use `contract --resolve bundle`.
2. The skill docs explicitly adopt the fallback hierarchy `capabilities -> contract -> code/docs only if still insufficient`.
3. The skill docs do not duplicate full nested schemas or expanded bundle-owned enums.
4. The helper README stays aligned with the actual CLI behavior.
5. The MCP design note no longer hardcodes the old thinner helper discovery shape where the new implementation has expanded it additively.

### Acceptance Criteria

- the repository skill guidance now points agents to the helper contract surface as the primary source of machine-readable request-shape knowledge
- the helper README and design notes match implemented helper behavior
- the skill remains concise and operational rather than becoming a second schema registry

### Stop Conditions

Stop this gate if:

- the docs start restating large chunks of machine-readable schema that now belong in the helper contract surface
- the skill guidance drifts away from the implemented helper behavior
- changes to installed skill copies are attempted before the repository skill guidance is settled

## 10. Gate 5: MCP Consumption Follow-On

### Goal

Consume the shared contract layer from the future MCP server once MCP server implementation begins.

### Why This Gate Exists

The design is explicitly helper-first for the current milestone because the MCP server does not exist yet. This reserved gate keeps the plan complete without forcing speculative MCP implementation into the first milestone.

### In Scope Once MCP Work Begins

- generate MCP tool/resource/prompt metadata from the shared contract layer
- avoid helper-shell-out reuse from the MCP adapter
- decide which MCP subjects become public protocol surfaces in the first MCP slice
- reuse the same domain-core contract shapes and semantics already proven through the helper

### Out Of Scope For The Current Milestone

- all live MCP implementation work

### Exit Condition For Deferral

Do not start this gate until:

- Gates 1 through 4 are complete
- MCP server implementation is actively underway
- the repo has a concrete MCP-server implementation plan to pair with this contract-layer plan

## 11. Cross-Gate Verification

The first helper-first milestone is not complete until the following proof cases pass across the implemented gates.

1. A client can discover helper commands through `sdd-helper capabilities` without bundle loading.
2. A client can call `sdd-helper contract helper.command.author` and receive enough detail to compose an `ApplyAuthoringIntentArgs` request without routine TypeScript spelunking.
3. A client can call `sdd-helper contract helper.command.create` and learn the bootstrap continuation rule and the immediate-`inspect` caveat.
4. A client can distinguish structural schemas from semantic constraints in helper contract detail.
5. A client can distinguish committed continuation-safe handles from dry-run informational handles.
6. A client can resolve active bundle values for bundle-bound fields only when it explicitly requests bundle resolution.
7. The repository `sdd-skill` docs point agents to helper contract discovery and introspection rather than defaulting to code/tests/examples for request-shape knowledge.
8. Existing helper clients that only know the prior `capabilities` surface still work.

## 12. Recommended Verification Commands

Use commands like these during implementation and gate verification:

```bash
TMPDIR=/tmp pnpm test -- --runInBand tests/helperCli.spec.ts
TMPDIR=/tmp pnpm test -- --runInBand tests/helperCli.integration.spec.ts
TMPDIR=/tmp pnpm test -- --runInBand tests/sddSkillSource.spec.ts
TMPDIR=/tmp pnpm sdd-helper capabilities
TMPDIR=/tmp pnpm sdd-helper contract helper.command.author
TMPDIR=/tmp pnpm sdd-helper contract helper.command.preview --resolve bundle
```

Use narrower test selections per gate where possible. Do not refresh unrelated snapshots or goldens as a substitute for proving the contract invariants.

## 13. References

Implementation should use these as current authority and anchor points:

- [`sdd_machine_readable_contract_layer_design.md`](./sdd_machine_readable_contract_layer_design.md)
- [`sdd_mcp_server_design.md`](./sdd_mcp_server_design.md)
- [`src/authoring/contracts.ts`](../../../src/authoring/contracts.ts)
- [`src/cli/helperDiscovery.ts`](../../../src/cli/helperDiscovery.ts)
- [`src/cli/helperProgram.ts`](../../../src/cli/helperProgram.ts)
- [`docs/readme_support_docs/sdd-helper/README.md`](../../readme_support_docs/sdd-helper/README.md)
- [`skills/sdd-skill/SKILL.md`](../../../skills/sdd-skill/SKILL.md)
- [`skills/sdd-skill/references/workflow.md`](../../../skills/sdd-skill/references/workflow.md)
- [`tests/helperCli.spec.ts`](../../../tests/helperCli.spec.ts)
- [`tests/helperCli.integration.spec.ts`](../../../tests/helperCli.integration.spec.ts)
- [`tests/sddSkillSource.spec.ts`](../../../tests/sddSkillSource.spec.ts)

## 14. Assumptions And Defaults

This plan assumes:

- the implementation is executed as separate gate-specific plan-mode threads
- the first practical milestone is helper-first and skill-aware, not full helper-plus-MCP delivery
- the shared contract layer should be generic enough for future MCP use even if only helper subjects are initially populated and exposed
- documentation updates should follow implemented behavior, not lead it
- installed skill copies are an operational sync concern after the repository skill guidance is correct
