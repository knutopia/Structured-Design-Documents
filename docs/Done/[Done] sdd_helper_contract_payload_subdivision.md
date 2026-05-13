# [Done] SDD Helper Contract Payload Subdivision

## Purpose

This note describes the payload-weight problem in `sdd-helper contract`
responses and proposes a direction for subdividing contract detail without
changing the meaning of `--resolve bundle`.

Assume the helper can successfully emit large JSON payloads. The problem here is that several contract payloads are too large for routine agent use, expensive in tokens, and poorly matched to the common task of composing a valid helper request.

The intended follow-up is a fresh implementation design that can use this note as input.

## Current Problem

`sdd-helper contract <subject_id> [--resolve bundle]` currently returns full deep
contract detail for one helper subject. That is useful for debugging and machine
introspection, but it conflates multiple tasks:

- discovering the command surface
- composing a valid request
- understanding the full result shape
- reading continuation semantics
- expanding bundle-owned bindings
- reading compact authoring format guidance
- inspecting shared diagnostic and assessment schemas

For authoring, the most important pre-request guidance is small. For example,
`authoring_format_card` contains the active SDD node id pattern and raw
event/effect formatting rules. However, the full `helper.command.author
--resolve bundle` payload is dominated by the output schema, so the request
composition guidance is delivered together with tens of kilobytes of unrelated
result-shape detail.
The missing axis is: which part of that subject's contract does the caller need right now?

## Payload Measurements

Current measured payload sizes for `contract <subject_id>` responses:

| Subject id | Static bytes | Bundle-resolved bytes | Subdivision priority |
| --- | ---: | ---: | --- |
| `helper.command.author` | 72,601 | 76,252 | Critical |
| `helper.command.apply` | 47,325 | 47,406 | High |
| `helper.command.create` | 40,453 | 40,534 | High |
| `helper.command.undo` | 31,372 | 31,453 | High |
| `helper.command.contract` | 16,647 | 16,728 | Medium |
| `helper.command.preview` | 10,640 | 12,164 | Medium |
| `helper.command.capabilities` | 10,537 | 10,618 | Medium |
| `helper.command.project` | 9,165 | 10,204 | Medium |
| `helper.command.validate` | 9,566 | 10,089 | Medium |
| `helper.command.inspect` | 8,649 | 8,730 | Low |
| `helper.command.search` | 5,296 | 5,377 | Low |
| `helper.command.git-status` | 2,255 | 2,336 | No action likely |
| `helper.command.git-commit` | 1,898 | 1,979 | No action likely |

The largest payloads are large because they include full output schemas. That is
especially inefficient for request-first workflows, where the caller mostly
needs invocation, request loading, request schema, format hints, bundle bindings,
and relevant continuation rules.

Approximate dominant sections observed in the largest responses:

| Subject id | Dominant weight |
| --- | --- |
| `helper.command.author` | `output_shape` around 50 KB, `input_shape` around 11 KB, `authoring_format_card` around 3 KB |
| `helper.command.apply` | `output_shape` around 28 KB, `input_shape` around 13 KB |
| `helper.command.create` | `output_shape` around 36 KB |
| `helper.command.undo` | `output_shape` around 28 KB |
| `helper.command.contract` | `output_shape` around 14 KB |

## Semantics To Preserve

`--resolve bundle` should continue to mean "resolve bundle-owned references
against the active bundle." It should not become a selector for contract
subsections.

Good examples of `--resolve bundle` behavior:

- expand active `view_id` values from bundle views
- expand active `profile_id` values from manifest profiles
- include bundle-derived authoring format guidance, such as the SDD node id
  pattern, when the selected detail needs that guidance

Bad direction:

```bash
sdd-helper contract helper.command.author --resolve authoring-format-card # Wrong!
```

That overloads "resolution source" with "which section of the contract do I
want?" The better model keeps resolution and detail selection as separate axes.

## Proposed Solution Direction

Add a contract-detail selection axis. Two possible CLI shapes are viable.

### Option A: Detail Presets

Examples:

```bash
sdd-helper contract helper.command.author --detail request --resolve bundle
sdd-helper contract helper.command.author --detail result
sdd-helper contract helper.command.author --detail full --resolve bundle
```

`--detail` answers "which workflow view of this subject do I need?"

Suggested presets:

| Detail | Purpose | Expected contents |
| --- | --- | --- |
| `request` | Compose a valid request or invocation | `subject`, invocation/request loading data, input/request schema, request-relevant constraints, bundle bindings if resolved, continuation notes needed before composing the request, and `authoring_format_card` for `author` |
| `result` | Interpret a command response | `subject`, output/result schema, assessment/diagnostic contract, result continuation semantics |
| `full` | Debugging and full machine introspection | Current all-in payload, preserving today's fields and key order as much as possible |

Pros:

- One call for normal agent workflows.
- Predictable and easy to document in the skill.
- Keeps agents from deciding which low-level sections are needed.
- Maintains `--resolve bundle` as the bundle-resolution axis.

Cons:

- Presets require careful definition per subject.
- Some callers may want a combination that is not exactly `request` or `result`.
- The response schema for non-full details must be explicitly documented.

Recommended first target:

```bash
sdd-helper contract helper.command.author --detail request --resolve bundle
```

This should be the skill's normal pre-authoring call. It must include the SDD
node id guidance in the delivered payload and must not include the large full
result schema.

### Option B: Explicit Includes

Examples:

```bash
sdd-helper contract helper.command.author --include request_card --resolve bundle
sdd-helper contract helper.command.author --include request_schema,format_card,continuation --resolve bundle
```

`--include` answers "which named sections do I want?"

Possible include names:

| Include | Meaning |
| --- | --- |
| `summary` | Subject identity, command name, invocation, mutability, result kind |
| `request_body` | `--request` loading rules and stdin/file behavior |
| `request_schema` | Input/request shape only |
| `result_schema` | Output/result shape only |
| `bindings` | Bundle binding metadata, resolved when paired with `--resolve bundle` |
| `continuation` | Revision and handle continuation rules |
| `format_card` | `authoring_format_card` for author request formatting |
| `request_card` | A compact synthesized request-composition card for the subject |
| `examples` | Minimal examples, if present |
| `full` | Current all-in payload |

Pros:

- Flexible for advanced tooling.
- Avoids inventing many presets.
- Easy to map to current top-level fields where sections already exist.

Cons:

- Harder for an agent to choose correctly.
- More combinations to test.
- Risks recreating the current problem if the skill asks for too much.
- Requires policy for invalid or conflicting combinations, such as
  `--include full,request_schema`.

### Preferred Direction

Implement detail presets first, with `--detail request`, `--detail result`, and
`--detail full`.

Consider `--include` later only if there is a real consumer that needs custom
section composition. If both are eventually supported, they should be mutually
exclusive:

```bash
sdd-helper contract helper.command.author --detail request --resolve bundle
sdd-helper contract helper.command.author --include request_schema,format_card --resolve bundle
```

Do not require agents to compose `--include` lists for the common path.

## Subject-Specific Breakdown

### `helper.command.author`

Highest priority.

The normal pre-authoring path needs:

- request loading rules
- `ApplyAuthoringIntentArgs` request shape
- SDD node id, edge target, event, effect, and property value formatting rules
- bundle-owned values relevant to inline validation/projection fields
- continuation rules for created targets and resulting revisions

It usually does not need:

- full `sdd-authoring-intent-result` output schema
- repeated nested diagnostic schemas
- full nested assessment schema

Desired command:

```bash
sdd-helper contract helper.command.author --detail request --resolve bundle
```

Expected result: small enough for routine agent use, with
`authoring_format_card` always present when `--resolve bundle` is supplied.

### `helper.command.apply`

High priority.

The request path needs request loading rules, `ApplyChangeSetArgs`, operation
shape, handle/revision constraints, and continuation rules. The full
`sdd-change-set` result schema is useful for debugging but should not be
returned for request composition by default.

Desired command:

```bash
sdd-helper contract helper.command.apply --detail request
```

### `helper.command.create`

High priority.

The request shape is small, but the output schema is large because create embeds
change-set result structure. A request detail should focus on path/version
inputs and the empty-bootstrap continuation rule. A result detail can carry the
full `sdd-create-document` response shape.

Desired commands:

```bash
sdd-helper contract helper.command.create --detail request
sdd-helper contract helper.command.create --detail result
```

### `helper.command.undo`

High priority.

The request shape is small, while the output shape is a full change-set result.
Request detail should focus on undo eligibility, current-revision requirements,
and request shape. Result detail can retain the full change-set response schema.

### `helper.command.preview`, `validate`, and `project`

Medium priority.

These are not as large, but bundle-resolved values are common. Request detail
should return argument/input shape plus resolved `view_id` or `profile_id`
bindings. Result detail can return output shape and render/validation/projection
diagnostic behavior.

Examples:

```bash
sdd-helper contract helper.command.preview --detail request --resolve bundle
sdd-helper contract helper.command.validate --detail request --resolve bundle
sdd-helper contract helper.command.project --detail request --resolve bundle
```

### `helper.command.contract` and `helper.command.capabilities`

Medium priority.

These are introspection surfaces. Subdivision is less urgent, but a result
detail mode may help avoid returning full schemas when a caller only needs usage
or option semantics.

### `inspect`, `search`, and git helper commands

Low priority or no action likely.

These payloads are smaller. They may still participate in a generic `--detail`
implementation for consistency, but they should not drive the design.

## Compatibility And Rollout Direction

Prefer an additive rollout:

1. Add `--detail request|result|full`.
2. Keep current no-detail behavior equivalent to `--detail full` initially.
3. Update the skill to use `--detail request` for pre-request composition.
4. Keep `--resolve bundle` independent and valid with any detail where bundle
   data is meaningful.
5. Optionally reconsider the default detail later, after clients have migrated.

This avoids breaking existing clients that already depend on full contract
payloads while giving agents a smaller, predictable path immediately.

## Acceptance Direction

A future implementation should prove at least these cases:

- `contract helper.command.author --detail request --resolve bundle` returns
  valid JSON containing request-composition guidance and
  `authoring_format_card`.
- The same payload excludes the full `output_shape` unless explicitly included
  by the chosen detail semantics.
- `contract helper.command.author --detail full --resolve bundle` remains
  equivalent to the current all-in resolved payload, aside from any explicitly
  documented additive metadata.
- `contract helper.command.preview --detail request --resolve bundle` includes
  resolved view/profile values without returning the full result schema.
- Invalid detail values return `sdd-helper-error` with clear diagnostics.
- `--detail` and a future `--include` option, if both exist, are mutually
  exclusive.
- Payload-size tests assert that request detail for `author` is substantially
  smaller than full detail and safely below routine tool-output limits.

## Explicit Non-Goals

- Do not use `--resolve` values as section selectors.
- Do not introduce file caching as part of this design.
- Do not move helper contract authority into docs or generated cache files.
- Do not change SDD language semantics, bundle authority, parser behavior, or
  authoring validation rules.
- Do not remove the full contract payload; keep it available for debugging and
  machine introspection.
