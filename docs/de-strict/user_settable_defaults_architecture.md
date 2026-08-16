# Architecture for User-Settable Validation and Rendering Defaults

Date: 2026-08-16

Status: Future implementation architecture

## Summary

SDD needs two independent defaults:

- a validation profile selected by `--profile`;
- a rendering-detail level selected by `--detail`.

The bundle remains authoritative for which profiles and detail levels exist, what they mean, and which portable fallbacks apply when no preference is configured. Mutable user and project preferences live outside the bundle. Per-invocation CLI arguments override both.

This produces four distinct ownership layers:

| Layer | Responsibility |
| --- | --- |
| Bundle | Declares validation profiles, render-detail levels, their behavior, and portable fallback IDs |
| User-global configuration | Stores one person's preferred profile and detail level across projects |
| Project configuration | Stores a repository's preferred profile and detail level for contributors |
| CLI arguments | Override a setting for one invocation |

The effective value for each setting is resolved independently with this precedence:

```text
CLI argument
  > project sdd.config.yaml
  > user-global configuration
  > selected bundle fallback
```

This document builds on two earlier documents:

- [`simple_profile_default.md`](simple_profile_default.md) established the behavioral blast radius of replacing the hardcoded `strict` default and identified the need for bundle authority.
- [`de-strict_actionable_inventory.md`](de-strict_actionable_inventory.md) is the authoritative near-term inventory for making the existing codebase profile-robust and changing the shipped fallback to `simple`.

The architecture here does not replace that immediate inventory. It extends it with a persistent preference layer and a future separation of validation policy from render density. It supersedes only the earlier suggestion that a mutable user-global selection itself should be stored in the bundle.

## Architectural invariants

The future implementation must preserve these invariants:

1. Markdown explains, the bundle governs machine behavior, and runtime code consumes the loaded bundle.
2. Configuration may select a bundle-declared behavior, but it may not define validation rules, display flags, view IDs, or other spec behavior.
3. `--profile` affects validation only. It must not change renderer content, layout, scene construction, or artifact identity.
4. `--detail` affects rendering only. It must not change parser, compiler, validator, or raw projection behavior.
5. Projection remains the semantic boundary between graph semantics and renderer-owned shaping.
6. Persistent user/project settings are application preferences, not part of the bundle fingerprint or SDD language contract.
7. Machine-facing helper and library workflows remain deterministic: they do not silently read a person's configuration files.
8. Invalid configured values fail visibly. The resolver must never silently fall through to another scope after finding an invalid value.

## Setting model

### Validation profile

The validation profile selects a profile declared by the active bundle. In v0.1 the available values remain `simple`, `permissive`, and `strict`.

The shipped bundle fallback is `simple`.

Profile selection is consumed by:

- `sdd validate`;
- the validation stage of `sdd show`;
- the validation stage of the internal `render`, `dot`, and `mmd` commands;
- lower-level validation APIs when the caller supplies or accepts a bundle fallback.

Changing only the profile may change diagnostics, error counts, and whether rendering is allowed to proceed. Once validation succeeds, it must not change rendered content when the view and detail level are held constant.

### Render detail

The render-detail level selects a detail mode declared by the active bundle. The initial values are:

| Detail ID | Intent |
| --- | --- |
| `compact` | Low-noise diagrams emphasizing primary structure |
| `detailed` | Fuller diagrams retaining the current permissive/strict display information |

The shipped bundle fallback is `compact`.

Detail selection is consumed by:

- `sdd show`;
- the internal `render`, `dot`, and `mmd` commands;
- preview and rendering APIs;
- staged and legacy render-model construction.

Changing only detail may change visible fields, annotations, labels, scene size, layout, and serialized output. It must not change validation diagnostics or whether the source is structurally valid.

### Guided Addition remains separate

Guided Addition's `guided_addition.default_display_profile_id` remains a separate bundle-owned setting. It controls Guided Addition browsing, form guidance, display classification, and proposal verification. It is neither the general validation default nor the render-detail default.

The existing Guided Addition `display_by_profile` contract is also outside this rendering migration. It describes authoring guidance, not renderer display density.

## Bundle contract

### Manifest declarations and fallbacks

The manifest should declare the portable tool fallbacks and the render-detail vocabulary alongside the existing profiles:

```yaml
tool_defaults:
  validation_profile_id: simple
  render_detail_id: compact

profiles:
  - id: simple
    path: profiles/simple.yaml
    intent: Low-noise drafting with strict structural validation.
  - id: permissive
    path: profiles/permissive.yaml
    intent: Warning-first governance with strict structural validation.
  - id: strict
    path: profiles/strict.yaml
    intent: Strict governance for production-ready authoring.

render_details:
  - id: compact
    intent: Low-noise rendering focused on primary structure.
  - id: detailed
    intent: Fuller rendering with secondary labels, annotations, and supporting detail.
```

`loadBundle(...)` must reject a bundle when:

- `tool_defaults.validation_profile_id` does not name a declared and loaded profile;
- `tool_defaults.render_detail_id` does not name a declared render-detail level;
- profile or detail IDs are duplicated;
- a renderable view cannot resolve every declared detail level;
- a detail-display value has an invalid shape.

Manifest order must not imply either default.

### Per-view detail policy

The existing `renderer_defaults.profile_display` policies in [`bundle/v0.1/core/views.yaml`](../../bundle/v0.1/core/views.yaml) should become detail-owned policies:

```yaml
renderer_defaults:
  detail_display:
    compact:
      # view-specific display values
    detailed:
      # view-specific display values
```

Every renderable view must explicitly cover every manifest-declared detail ID. Missing coverage is a bundle-validation error rather than a runtime fallback.

The initial migration is lossless:

- copy each view's current `simple` display policy to `compact`;
- copy each view's current `permissive`/`strict` display policy to `detailed`;
- remove renderer reads of validation-profile IDs only after equivalence is proven.

All six current views have identical `permissive` and `strict` renderer-display policies and a distinct `simple` policy. Therefore the two initial detail levels can preserve all current rendering behaviors without inventing a new middle policy.

Future detail modes must be added through the same bundle path: manifest declaration, per-view coverage, bundle validation, generic runtime resolution, and tests proving bundle-only changes affect output.

## Persistent configuration

### Configuration schema

User-global and project files use the same versioned schema and may set either or both values:

```yaml
version: "1"
defaults:
  validation_profile_id: simple
  render_detail_id: compact
```

Partial configuration is valid. For example, a project may pin `render_detail_id: detailed` while allowing each user's validation-profile preference or the bundle fallback to supply the effective profile.

Unknown keys, an unsupported version, malformed YAML, non-string IDs, and empty IDs are configuration errors. Configuration files select IDs only; they may not contain inline profile rules or renderer-display policy.

### User-global location

The CLI should use a platform-native user configuration path:

| Platform | Path |
| --- | --- |
| Linux and WSL | `${XDG_CONFIG_HOME}/sdd/config.yaml`, or `~/.config/sdd/config.yaml` when `XDG_CONFIG_HOME` is unset |
| macOS | `~/Library/Application Support/sdd/config.yaml` |
| Windows | `%APPDATA%\sdd\config.yaml` |

The user-global file is not repository content and is never included in the bundle fingerprint.

### Project location and discovery

Project preferences live in a visible, commit-friendly `sdd.config.yaml` at the repository root.

The current repository's project root should be resolved through the existing authoring repo-root discovery contract. Normal command resolution searches from the current working directory. `sdd defaults set ... --project` and `unset ... --project` fail with an actionable message if no SDD project root can be found; they do not create a project file in an arbitrary directory.

The nearest discovered project configuration wins. Parent directories above the resolved project root are not searched.

### Resolution result

A shared CLI-layer resolver should resolve each setting to a value plus provenance:

```text
value: simple
source: project
source_path: /path/to/repo/sdd.config.yaml
```

The source is one of `cli`, `project`, `global`, or `bundle`. `source_path` is present only for project and global configuration.

Resolution proceeds independently for profile and detail. A project profile does not prevent a global detail preference from applying, for example.

After choosing the first present value by precedence, the resolver validates it against the selected bundle. If it is unknown, resolution stops with an error naming:

- the invalid value;
- the setting;
- the configuration source and file, when applicable;
- the selected bundle;
- the available bundle-declared IDs.

It must not ignore the invalid value and continue to a lower-precedence source.

## Human-facing CLI

### Per-invocation options

The human-facing `sdd` CLI exposes:

```text
--profile <profile_id>  validation profile override
--detail <detail_id>    render-detail override
```

Command applicability is:

| Command | Profile | Detail |
| --- | --- | --- |
| `validate` | Yes | No |
| `show` | Yes | Yes |
| Internal `render` | Yes | Yes |
| Internal `dot` | Yes | Yes |
| Internal `mmd` | Yes | Yes |
| `compile` | No | No |
| `add` | Keeps its existing Guided Addition behavior | No |

CLI help must say that omission uses the resolved default; it must not advertise a hardcoded profile or detail ID for alternate bundles or configured projects.

### `sdd defaults` commands

Persistent preferences are managed through:

```bash
sdd defaults show [--global | --project] [--bundle <manifest>]
sdd defaults set <profile|detail> <value> (--global | --project) [--bundle <manifest>]
sdd defaults unset <profile|detail> (--global | --project)
```

Behavior:

- `show` without a scope prints the effective profile and detail, their sources, relevant source paths, and the selected bundle fallbacks.
- `show --global` or `show --project` prints only the stored values in that scope plus the effective bundle validation result.
- `set` requires exactly one scope and accepts one setting at a time.
- `set profile` validates the value against the selected bundle's profiles.
- `set detail` validates the value against the selected bundle's render-detail declarations and view coverage.
- `unset` requires exactly one scope and removes only the named setting. It removes an empty `defaults` mapping and an otherwise empty configuration file.
- Setting an already-equal value succeeds without changing the file.
- Writes are atomic, use UTF-8 and canonical LF newlines, and never rewrite the bundle.
- Usage errors, an undiscoverable project root, an unreadable configuration file, or a bundle-unknown value produce a nonzero exit code and an actionable message.

The defaults commands are part of the human-facing CLI only. They do not create a new SDD language feature.

## Runtime and API data flow

The human CLI path is:

```text
CLI arguments + current directory
  -> load selected bundle
  -> load project and user configuration
  -> resolve effective profile and detail with provenance
  -> validate source with profile
  -> project source without profile or detail
  -> prepare/render projection with detail
  -> serialize artifact and report effective settings
```

The settings resolver belongs to the CLI/application layer. Validators and renderers receive resolved IDs and do not read configuration files themselves.

### Library behavior

Library APIs must not read user-global or project configuration implicitly. When an optional library argument is omitted, the library resolves only the loaded bundle fallback.

Combined source-rendering APIs should accept both independently:

```text
profileId?: string
detailId?: string
```

They resolve each option once, then use profile only for validation and detail only for renderer preparation and output. Structured results should report the effective `profileId` and `detailId`.

Lower-level `validateGraph(...)` remains profile-explicit. Renderer entrypoints below the combined convenience layer remain detail-explicit.

### Helper behavior

`sdd-helper` remains configuration-independent and explicit:

- helper validation continues to require `profile_id`;
- helper preview requires both `profile_id` and `detail_id`;
- preview results return both IDs;
- helper contract resolution exposes allowed profile and detail values from the active bundle.

This keeps agent, MCP, and automation workflows reproducible across machines with different user preferences.

### Renderer contracts

Renderer-owned contracts must use `detailId`, not `profileId`:

```text
RendererScene.detailId
MeasuredScene.detailId
PositionedScene.detailId
```

Profile must not be threaded through render-model builders merely to select display policy. Validation completes before renderer preparation.

SVG output should identify render content with:

```text
class="... detail-compact ..."
data-detail-id="compact"
```

The current renderer-owned `profile-*` class and `data-profile-id` attribute should be removed after the migration. Validation provenance belongs in the surrounding structured result, not in renderer scene state.

Legacy DOT, Mermaid, and Graphviz paths must consume the same detail policy as staged renderers so that `compact` and `detailed` have consistent intent across backends. This migration must preserve legacy outputs for the equivalent detail level until a separately authorized legacy-removal step.

## Artifact identity, provenance, and caching

Automatic preview filenames should describe rendered content rather than the validation gate:

```text
<source>.<view>.<detail>[.<backend>].<format>
```

For example:

```text
outcome_to_ia_trace.ia_place_map.compact.svg
```

This naming applies to `sdd show`, helper preview materialization, and any internal command that derives a sibling preview path. Explicit `--out` paths remain authoritative.

Two successful renders with the same source, bundle, view, backend, format, and detail are content-equivalent even if they passed under different validation profiles. Profile is therefore excluded from automatic render filenames but retained in structured execution and validation metadata.

Bundle fingerprints include `tool_defaults`, declared render-detail IDs, and per-view detail policy because those fields are loaded bundle behavior. User-global and project configuration are excluded.

Cache keys and artifact-matching records must include:

- source revision;
- bundle fingerprint;
- view ID;
- effective detail ID;
- backend and format;
- effective profile ID when the cached record includes validation outcome or render eligibility.

A pixel/artifact cache that begins only after successful validation need not distinguish profile when it stores renderer output alone. A combined validation-and-render cache must distinguish both.

## Failure behavior

The following conditions are hard errors with no silent fallback:

- malformed or unreadable global/project configuration;
- unsupported configuration version or unknown keys;
- configured profile absent from the selected bundle;
- configured detail absent from the selected bundle;
- CLI profile/detail override absent from the selected bundle;
- a declared detail missing from a renderable view;
- both `--global` and `--project`, or neither, on `set`/`unset`;
- `--detail` on a command that does not render;
- project-scoped mutation when no SDD project root is discoverable.

Missing configuration files and absent individual settings are normal and continue down the precedence chain.

If validation fails under the resolved profile, rendering stops before projection-to-render preparation exactly as it does today. Changing detail cannot bypass validation.

## Verification strategy

### Bundle authority

Tests must prove:

- valid `tool_defaults` and render-detail declarations load;
- unknown fallback IDs fail bundle loading;
- duplicate detail IDs and missing view coverage fail bundle loading;
- changing only the bundle profile fallback changes omitted-profile validation;
- changing only the bundle detail fallback changes omitted-detail rendering;
- changing only a per-view detail policy changes renderer behavior.

### Configuration and precedence

Tests must cover:

- no configuration, using both bundle fallbacks;
- global profile and detail;
- project profile and detail;
- partial global/project settings resolved independently;
- project overriding global;
- CLI overriding project and global;
- `show` reporting values and sources;
- set, idempotent set, unset, and removal of an empty file;
- platform-specific global paths through injected path/environment dependencies;
- malformed, unsupported, unreadable, and bundle-unknown settings;
- atomic write failure without a partially written config.

### Validation/render separation

Acceptance requires two independence proofs:

1. With source, bundle, view, and detail fixed, changing profile may change diagnostics or render eligibility but cannot change a successful rendered artifact.
2. With source, bundle, view, and profile fixed, changing detail may change the rendered artifact but cannot change validation diagnostics.

The first proof should compare both serialized output and staged scene contracts. The second should compare validation reports before rendering.

### Migration equivalence

Before deleting `profile_display` or renderer `profileId` state:

- `compact` must match current `simple` output for every supported view and backend;
- `detailed` must match current `permissive` and `strict` output for every supported view and backend;
- the explicitly referenced view proof cases must satisfy visual acceptance before broader golden capture;
- profile-explicit renderer goldens must not be mechanically rewritten until equivalence is established.

After equivalence, renderer scenes, SVG metadata, automatic filenames, helper preview contracts, and corpus organization can be migrated intentionally to detail IDs.

### Surface coverage

Focused tests must cover:

- all five profile-consuming `sdd` commands using the shared resolver;
- `--detail` on all four rendering commands;
- explicit CLI overrides;
- human CLI persistent defaults;
- helper explicitness and resolved allowed values;
- library bundle-only fallbacks;
- detail-based output paths;
- structured results carrying effective profile and detail;
- cache/artifact matching across profile and detail changes.

## Staged delivery

### Stage 1: Complete the immediate de-strict inventory

Implement [`de-strict_actionable_inventory.md`](de-strict_actionable_inventory.md): add the bundle-owned general profile fallback, set it to `simple`, remove hardcoded CLI/library `strict` fallbacks, make unrelated tests profile-explicit, and update current default wording.

At this stage, the profile still controls validation and rendering. The purpose is to eliminate hidden strict assumptions without combining that change with a renderer contract migration.

### Stage 2: Add persistent profile preferences

Add the versioned global/project configuration loader, shared resolver, `sdd defaults` commands, and `--profile` precedence. Keep the bundle fallback as the final source.

Only the human `sdd` CLI reads persistent configuration. Helper and library behavior remains explicit or bundle-derived.

### Stage 3: Introduce render detail

Extend the bundle contract with `render_details` and `tool_defaults.render_detail_id`, add `--detail`, migrate `profile_display` policies to `detail_display`, and pass both resolved IDs through combined rendering workflows.

Establish compact/simple and detailed/permissive-strict equivalence before changing stored evidence.

### Stage 4: Remove profile-dependent renderer state

Replace renderer scene `profileId` with `detailId`, update SVG metadata and detail-based artifact paths, make helper preview detail-explicit, and remove all renderer reads of validation profiles.

Regenerate only the intentionally renamed or schema-changed renderer evidence after the acceptance invariants pass. Do not use snapshot refreshes to conceal mismatches.

## Completion criteria

The architecture is implemented only when:

- the bundle declares and validates profiles, detail levels, per-view detail behavior, and portable fallbacks;
- global and project files store selections only and resolve with the documented precedence;
- `sdd defaults` safely shows, sets, and unsets both preferences;
- `--profile` affects validation only;
- `--detail` affects rendering only;
- every renderer stage and artifact identity uses detail rather than profile;
- helper and lower-level machine APIs remain explicit;
- invalid high-precedence settings fail visibly;
- bundle-mutation tests prove bundle authority;
- compact and detailed preserve the two existing rendering behaviors;
- no parser, compiler, raw projection, or Guided Addition behavior changes unintentionally.
