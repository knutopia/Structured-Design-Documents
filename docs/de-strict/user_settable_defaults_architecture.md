# Architecture for User-Settable Validation and Rendering Defaults

Date: 2026-08-16

Last amended: 2026-08-21

Status: Implemented

## Summary

SDD has two independent defaults:

- a validation profile selected by `--profile`;
- a rendering-detail level selected by `--detail`.

The bundle declares the available values, their behavior, and portable fallbacks. A single user-global configuration file may select one preferred value for either setting. Per-invocation CLI arguments override that file.

There is no project-scoped preference file. Normal command behavior does not depend on the current working directory or repository-root discovery.

The effective value for each setting resolves independently:

```text
CLI argument
  > user-global configuration
  > selected bundle fallback
```

This creates three ownership layers:

| Layer | Responsibility |
| --- | --- |
| Bundle | Declares profiles, detail levels, behavior, and portable fallback IDs |
| User-global configuration | Stores one person's preferred profile and detail across projects |
| CLI arguments | Override one setting for one invocation |

## Architecture change record: remove project-scoped defaults

### Decision

On 2026-08-21, immediately after the initial implementation, the user-global/project precedence model was replaced with one user-global preference scope. The earlier project file at `<repo-root>/sdd.config.yaml`, its discovery rules, and the `--global`/`--project` management flags are no longer part of the architecture.

The global configuration schema and platform-native paths are unchanged. Existing `sdd.config.yaml` files are ignored and left untouched.

### Rationale

The project scope created more user cost than product value:

- users had to choose a scope every time they managed a preference;
- the same command could behave differently solely because of its working directory;
- profile and detail could acquire mixed provenance from project and user files;
- malformed or bundle-incompatible project values could unexpectedly break normal commands;
- a project preference was ineffective as governance because explicit CLI arguments could override it.

Portable defaults already belong to the selected bundle. Repository policy belongs in explicit CI or project scripts, such as `sdd validate ... --profile strict`. Personal repetition is addressed by the single user-global file. Per-invocation exceptions remain explicit CLI arguments.

### Consequences

- `sdd defaults` never asks the user to choose global or project scope.
- Defaults resolution never searches for a repository root or reads `sdd.config.yaml`.
- The same saved preferences apply from every working directory.
- Profile and detail remain independent; this amendment does not recouple validation and rendering.

## Architectural invariants

1. Markdown explains, the bundle governs machine behavior, and runtime code consumes the loaded bundle.
2. Configuration may select bundle-declared behavior but may not define validation rules, display flags, view IDs, or other specification behavior.
3. `--profile` affects validation only. It must not change renderer content, layout, scene construction, or artifact identity.
4. `--detail` affects rendering only. It must not change parsing, compilation, validation, or raw projection behavior.
5. Projection remains the semantic boundary between graph semantics and renderer-owned shaping.
6. The user-global configuration is an application preference, not part of the bundle fingerprint or SDD language contract.
7. Machine-facing helper and library workflows remain deterministic and never read a person's configuration file implicitly.
8. Invalid selected or configured values fail visibly. Resolution never falls through after finding an invalid higher-precedence value.
9. Persistent CLI behavior is independent of the working directory.

## Setting model

### Validation profile

The validation profile selects a profile declared by the active bundle. The shipped v0.1 values are `simple`, `permissive`, and `strict`; the shipped fallback is `simple`.

Profile selection is consumed by `sdd validate` and the validation stage of `sdd show`, `render`, `dot`, and `mmd`. Changing only the profile may change diagnostics, error counts, and render eligibility. Once validation succeeds, it must not change rendered content while view and detail are fixed.

### Render detail

The render-detail level selects a detail mode declared by the active bundle:

| Detail ID | Intent |
| --- | --- |
| `compact` | Low-noise diagrams emphasizing primary structure |
| `detailed` | Fuller diagrams retaining supporting annotations and labels |

The shipped fallback is `compact`. Detail is consumed by rendering workflows only. It may change visible fields, annotations, labels, scene size, layout, and serialized output, but it must not change validation diagnostics or structural validity.

### Guided Addition remains separate

Guided Addition's `guided_addition.default_display_profile_id` and `display_by_profile` contract remain separate bundle-owned authoring guidance. They are neither the general validation default nor the render-detail default.

## Bundle contract

The manifest declares portable tool fallbacks and the render-detail vocabulary alongside profiles:

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

Bundle loading rejects unknown fallback IDs, duplicate profile or detail IDs, missing per-view detail coverage, and malformed detail-display values. Manifest order never implies a default.

Every renderable view covers every declared detail ID through `renderer_defaults.detail_display`. Bundle-only changes to fallbacks or detail policies must change runtime behavior without TypeScript edits.

## Persistent configuration

### Schema

The single user-global file uses the existing versioned schema and may set either or both values:

```yaml
version: "1"
defaults:
  validation_profile_id: simple
  render_detail_id: compact
```

Partial configuration is valid. An absent setting continues to the selected bundle fallback. Unknown keys, unsupported versions, malformed YAML, non-string IDs, and empty IDs are configuration errors. Configuration selects IDs only and cannot contain inline validation or renderer policy.

### Location

| Platform | Path |
| --- | --- |
| Linux and WSL | `${XDG_CONFIG_HOME}/sdd/config.yaml`, or `~/.config/sdd/config.yaml` when `XDG_CONFIG_HOME` is unset |
| macOS | `~/Library/Application Support/sdd/config.yaml` |
| Windows | `%APPDATA%\sdd\config.yaml` |

The file is never repository content and never enters the bundle fingerprint.

### Resolution and provenance

Each setting resolves to a value plus provenance. The source is `cli`, `global`, or `bundle`; a source path is present only for the global file.

After selecting the first present value, the resolver validates it against the active bundle. An unknown value stops resolution and reports the value, setting, source file when applicable, selected bundle, and available bundle-declared IDs.

## Human-facing CLI

Per-invocation overrides remain:

```text
--profile <profile_id>  validation profile override
--detail <detail_id>    render-detail override
```

Persistent preferences are managed without a scope decision:

```bash
sdd defaults [--bundle <manifest>]
sdd defaults show [--bundle <manifest>]
sdd defaults set <profile|detail> <value> [--bundle <manifest>]
sdd defaults unset <profile|detail>
```

Behavior:

- bare `sdd defaults` and `sdd defaults show` are equivalent;
- `show` prints each effective value as either a user default or bundle fallback;
- `set` validates against the selected bundle and writes the user-global file atomically;
- `unset` removes only the named setting without loading a bundle, removes an empty `defaults` mapping, and removes an otherwise empty file;
- setting an equal value succeeds without rewriting the file;
- `--global` and `--project` are not accepted options.

## Runtime and API data flow

The human CLI path is:

```text
CLI arguments
  -> load selected bundle
  -> load user-global configuration
  -> resolve profile and detail independently
  -> validate source with profile
  -> project source without profile or detail
  -> prepare and render projection with detail
  -> serialize artifact and report effective settings
```

The resolver belongs to the CLI/application layer. Validators and renderers receive resolved IDs and do not read configuration files.

Library APIs never read the user-global file. Optional library values resolve only to loaded-bundle fallbacks. Helper validation remains profile-explicit; helper preview remains profile- and detail-explicit.

Renderer-owned scene contracts and SVG metadata use `detailId`, not `profileId`. Automatic preview filenames remain `<source>.<view>.<detail>[.<backend>].<format>`. Validation profile remains in surrounding validation provenance only.

## Failure behavior

These conditions are hard errors with no silent fallback:

- malformed or unreadable user-global configuration;
- unsupported configuration version or unknown keys;
- configured or explicit profile absent from the selected bundle;
- configured or explicit detail absent from the selected bundle;
- a declared detail missing from a renderable view;
- `--detail` on a command that does not render.

Missing configuration and absent individual settings are normal. If validation fails under the resolved profile, rendering stops before renderer preparation. Changing detail cannot bypass validation.

## Verification contract

Tests must prove:

- bundle-only fallback and detail-policy changes affect runtime behavior;
- each setting independently follows CLI, global, then bundle precedence;
- commands read only the platform-native global path and produce the same selected values from different working directories;
- `sdd.config.yaml` does not participate in defaults resolution;
- bare `defaults`, `show`, set, idempotent set, unset, and empty-file removal work;
- malformed, unreadable, unsupported, and bundle-unknown global values fail visibly;
- profile changes cannot change a successful fixed-detail artifact;
- detail changes cannot change validation diagnostics;
- helper and library workflows remain configuration-independent;
- user configuration never changes the bundle fingerprint.
