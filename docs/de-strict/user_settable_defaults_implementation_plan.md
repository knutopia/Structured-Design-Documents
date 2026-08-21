# Implementation Plan for User-Settable Validation and Rendering Defaults

Date: 2026-08-16

Status: Ready for linear execution

## Purpose

This document is the execution companion to
[`user_settable_defaults_architecture.md`](user_settable_defaults_architecture.md). It is intended to be handed to a new implementation thread and used as a live, stage-gated plan until the architecture is complete.

The implementation introduces two independent settings:

- `profile`, selected by `--profile`, controls validation only;
- `detail`, selected by `--detail`, controls rendering only.

It also introduces user-global and project-scoped preferences, keeps portable fallbacks in the selected bundle, changes automatic render-artifact identity to detail, and removes validation profiles from renderer-owned state.

The work is deliberately linear. Complete and approve one stage before starting the next. Do not attempt a broad parallel rewrite of CLI, configuration, helper contracts, renderer contracts, and goldens.

## Authority order

When sources disagree, use this order:

1. [`user_settable_defaults_architecture.md`](user_settable_defaults_architecture.md) for the target architecture.
2. [`de-strict_actionable_inventory.md`](de-strict_actionable_inventory.md) for the immediate default-profile change and its known inventory.
3. `bundle/v0.1/` for machine-readable SDD behavior.
4. Repository architecture and renderer constraints in `AGENTS.md` and `docs/toolchain/`.
5. Current code and tests as evidence of existing behavior, not as authority for preserving hidden defaults.
6. [`simple_profile_default.md`](simple_profile_default.md) as historical blast-radius analysis only.

If a stage exposes a real conflict between the first three authorities, stop and request a decision. Do not choose a convenient code-local convention that bypasses the bundle.

## Locked decisions

The executor must not reopen these decisions during implementation:

- The shipped validation fallback is `simple`.
- The shipped render-detail fallback is `compact`.
- The initial detail IDs are `compact` and `detailed`.
- Resolution precedence is independent for each setting:

  ```text
  CLI argument
    > project sdd.config.yaml
    > user-global configuration
    > selected bundle fallback
  ```

- The bundle declares profiles, detail modes, per-view detail behavior, and portable fallback IDs.
- Mutable selections live outside the bundle.
- Project preferences live at the discovered repository root in `sdd.config.yaml`.
- Only the human-facing `sdd` CLI reads persistent preferences automatically.
- `sdd-helper` remains explicit.
- Library APIs use explicit values or the loaded bundle fallbacks and never inspect user/project configuration.
- Automatic render names use `<source>.<view>.<detail>[.<backend>].<format>`.
- Validation profile remains in validation/provenance metadata, not renderer scene state or artifact names.
- Guided Addition's `default_display_profile_id` and `display_by_profile` remain separate and unchanged.

## Non-negotiable invariants

Every stage must preserve the following unless that stage explicitly performs the named migration:

1. Markdown explains, the bundle governs machine behavior, and code consumes the loaded bundle.
2. Changing only bundle fallback or detail-policy data changes runtime behavior without a code edit.
3. `--profile` cannot select display fields, layout, SVG classes, renderer scenes, or artifact names in the completed implementation.
4. `--detail` cannot change parse, compile, validate, or raw projection results.
5. Projection remains the semantic boundary before renderer preparation.
6. Renderer flow remains `projection -> RendererScene -> MeasuredScene -> PositionedScene -> SVG -> PNG`.
7. Legacy DOT, Mermaid, and Graphviz paths remain supported and consume the same detail policy as staged paths.
8. User/project configuration never enters the bundle fingerprint.
9. An invalid high-precedence value is an error; it never falls through to a lower scope.
10. `compile`, Guided Addition, helper validation, and other non-applicable surfaces do not begin reading persistent defaults.
11. Stored goldens and the rendered corpus are updated only after behavioral equivalence is proved.
12. Existing unrelated worktree changes, archived implementation evidence, and Service Blueprint documentation assets are not rewritten as collateral cleanup.

## Scope boundaries

### In scope

- bundle manifest types, loading, validation, accessors, and fingerprint evidence;
- the five profile-consuming `sdd` commands: `validate`, `render`, `dot`, `mmd`, and `show`;
- user-global and project configuration reading and atomic mutation;
- `sdd defaults show`, `set`, and `unset`;
- `--detail` on `show`, `render`, `dot`, and `mmd`;
- public combined rendering APIs and structured results;
- detail-owned display policies for all six current renderable views;
- staged and legacy renderer plumbing;
- helper preview arguments, results, discovery, contract metadata, and SDD Skill workflow text;
- automatic preview paths and rendered-corpus organization;
- focused tests, migration-equivalence evidence, public CLI documentation, and generated corpus updates.

### Out of scope

- changing validation rules inside `simple`, `permissive`, or `strict`;
- removing `strict` or any other declared profile;
- adding more detail levels;
- changing projection schemas or view semantics;
- changing Guided Addition profile behavior;
- adding a generalized cache subsystem where none exists;
- removing legacy renderers;
- changing renderer layout or routing for aesthetic reasons;
- rewriting historical files under `docs/Done/` merely to replace profile metadata;
- modifying the Service Blueprint tutorial or its checked-in illustration as incidental cleanup.

## Executor operating protocol

### Linear sequence

Execute Stage 0 through Stage 5 in order. Within a stage, follow the listed checkpoints in order. A later stage may rely only on an earlier stage whose LLM approval verdict is `APPROVED`.

Do not combine stages into one unreviewed diff. Small commits are optional, but each stage must remain reviewable as a coherent unit even if the user did not ask for commits.

### Subagent rule

Default to no subagents.

Use a subagent only when the executor can state in advance why a bounded, preferably read-only task is likely to improve quality. Suitable examples are:

- an independent bundle-authority audit after Stage 1;
- a focused review of configuration failure cases after Stage 2;
- an independent visual/equivalence audit across six views after Stage 3 or 4.

Do not use subagents merely to increase throughput. Never allow multiple agents to write overlapping files. The primary executor owns all integration, reruns the relevant checks, and records whether a subagent was used in the stage achievement report.

### Limited-human-intervention rule

The executor may advance without human confirmation when a stage passes its specified checks and receives LLM approval. Ask the user only when one of these stop conditions occurs:

- the architecture and bundle contract cannot be reconciled without a new decision;
- unrelated user changes overlap files that the stage must modify and cannot be preserved safely;
- a destructive corpus/golden regeneration would remove unexplained material;
- required equivalence or independence cannot be proved after a reasonable corrective pass;
- a required external tool is unavailable and the documented alternate evidence is insufficient;
- the implementation would need a new persistent scope, new detail ID, new public command, or other material scope expansion.

Routine code organization, test-file placement, naming of internal helpers, and correction of stage-local defects do not require human approval.

### Required LLM approval gate

At the end of every stage, the executor must inspect the complete stage diff and write an achievement report in the execution log at the end of this document. Use exactly one verdict:

- `APPROVED`: every stage acceptance condition is satisfied; work may continue.
- `NOT APPROVED`: at least one acceptance condition is unmet; fix the stage or stop.

An approval report must include:

- implemented scope;
- files or subsystems changed;
- commands run and their results;
- satisfied invariants;
- violated invariants, explicitly `none` when applicable;
- residual risks that are genuinely deferred by this plan;
- snapshot/golden/corpus disposition;
- subagent use and the quality benefit, or `none`;
- the next authorized stage.

Tests being green are not sufficient approval. The LLM must also confirm bundle authority, failure behavior, scope control, and the stage's behavioral evidence.

## Sequence overview

| Stage | Outcome | Initial status |
| --- | --- | --- |
| 0 | Re-baselined inventory and protected-worktree record | Pending |
| 1 | Bundle-owned `simple` validation fallback, with hidden strict defaults removed | Pending |
| 2 | Persistent configuration and profile precedence for the human CLI | Pending |
| 3 | Bundle-owned detail vocabulary and profile/detail-independent rendering inputs | Pending |
| 4 | Renderer/helper/artifact identity fully migrated from profile to detail | Pending |
| 5 | Documentation, corpus, full verification, and closeout | Pending |

## Stage 0: Re-baseline and protect the workspace

### Objective

Confirm that this plan still matches the repository at execution time, establish the exact baseline, and identify changes that must be preserved.

### Checkpoint 0.1: Read authority and current instructions

Read completely:

- this implementation plan;
- [`user_settable_defaults_architecture.md`](user_settable_defaults_architecture.md);
- [`de-strict_actionable_inventory.md`](de-strict_actionable_inventory.md);
- the repository `AGENTS.md` files applicable to every target path;
- current CLI, bundle, renderer, helper, and corpus code named below.

Extract a short list of non-negotiable invariants before editing.

### Checkpoint 0.2: Record current state

Record:

- `git status --short`;
- current branch and baseline commit;
- whether the worktree already contains user changes;
- current Node and pnpm availability;
- whether Graphviz is available through `pnpm run check:graphviz`;
- current full build/test result using `TMPDIR=/tmp`.

Do not clean, reset, or overwrite unrelated changes.

### Checkpoint 0.3: Refresh the blast-radius searches

At minimum, locate and classify current occurrences of:

- Commander defaults containing `strict`;
- `?? "strict"` and equivalent runtime fallbacks;
- `profile_display`, `resolveProfileDisplayPolicy`, and profile-named display types;
- `profileId` in staged renderer contracts and backends;
- `data-profile-id` and `profile-*` SVG metadata;
- profile-based preview filenames;
- helper preview `profile_id` contracts and bindings;
- profile-based rendered-corpus variants and directories;
- public docs that state `strict` is the default.

The known starting points include:

- `bundle/v0.1/manifest.yaml`;
- `bundle/v0.1/core/views.yaml`;
- `src/bundle/types.ts`;
- `src/bundle/loadBundle.ts`;
- `src/bundle/validateLoadedBundle.ts`;
- `src/bundle/fingerprint.ts`;
- `src/cli/program.ts`;
- `src/types.ts` and `src/index.ts`;
- `src/renderer/renderView.ts`;
- `src/renderer/profileDisplay.ts`;
- `src/renderer/prepareProjectionForRender.ts`;
- `src/renderer/viewRenderers.ts`;
- `src/renderer/previewWorkflow.ts` and `previewBackends.ts`;
- `src/renderer/staged/contracts.ts` and all six staged view renderers;
- `src/previewArtifactPaths.ts`;
- `src/authoring/contracts.ts`, `preview.ts`, `contractMetadata.ts`, and `contractResolution.ts`;
- `src/cli/helperProgram.ts` and `helperDiscovery.ts`;
- `src/examples/renderedCorpus.ts` and `generateRenderedExamples.ts`;
- `skills/sdd-skill/`;
- the focused CLI, renderer, helper, bundle, corpus, and skill tests.

### Stage 0 acceptance

- The authority order is unambiguous.
- Existing user changes are listed and protected.
- The baseline build/test result is known.
- Any repository drift from this plan is documented before implementation.
- No product files have been edited.

### Stage 0 LLM approval

Approve Stage 0 only after the baseline and refreshed inventory are recorded in the execution log. If a material new consumer of profile-dependent rendering is found, add it to the appropriate later stage before approving.

## Stage 1: Make `simple` the bundle-owned validation fallback

### Objective

Complete the immediate de-strict inventory without yet introducing persistent preferences or render detail. At the end of this stage, omitted-profile behavior comes from the selected bundle and the shipped bundle chooses `simple`.

Profile still controls both validation and rendering during this transitional stage. Do not begin the renderer/detail migration here.

### Checkpoint 1.1: Extend the bundle contract

Add this shipped manifest field:

```yaml
tool_defaults:
  validation_profile_id: simple
```

Implement the corresponding manifest type and a generic bundle accessor such as `getBundleValidationProfileFallback(bundle)`. Export the accessor if public combined APIs need it.

Validation must reject:

- a missing or malformed `tool_defaults` section;
- an empty validation fallback;
- a fallback that does not name a declared and loaded profile;
- duplicate manifest profile IDs.

Duplicate manifest profile IDs are already rejected by `validateLoadedBundle(...)` at the Stage 0 baseline. Preserve that generic validation and add focused coverage rather than implementing a second duplicate-ID path.

Do not infer a fallback from manifest order. Do not add `simple` as a TypeScript fallback behind malformed bundle data.

The manifest already participates in `createBundleFingerprintInput(...)`; add focused evidence that changing the new field changes the fingerprint. Do not add user/project configuration to that input.

### Checkpoint 1.2: Remove hidden CLI defaults

Remove Commander's hardcoded default value from `--profile` on:

- `validate`;
- hidden `render`;
- hidden `dot`;
- hidden `mmd`;
- `show`.

After the selected bundle is loaded, resolve:

```text
explicit --profile, otherwise bundle.tool_defaults.validation_profile_id
```

Use one shared resolution helper for all five commands. An explicit unknown profile must continue to fail through an actionable validation error.

Update help text so omission means the selected bundle's default. Remove wording that labels `strict` as the default. Keep examples that explicitly demonstrate strict governance.

### Checkpoint 1.3: Remove hidden library defaults

In the combined text-rendering API:

- resolve `options.profileId` or the bundle fallback exactly once;
- use that resolved profile for validation and the still-profile-coupled renderer;
- report the effective profile in the structured result;
- remove every `?? "strict"` or equivalent code fallback.

Lower-level validation remains profile-explicit.

Treat profile IDs as bundle-declared strings rather than a closed TypeScript union of the three shipped IDs. The shipped bundle still declares only `simple`, `permissive`, and `strict`, but alternate valid bundles must not require a source-code union edit.

At the Stage 0 baseline, `src/authoring/contracts.ts` still declares `ProfileId` as the closed union `"simple" | "permissive" | "strict"`; include that alias in this generic-ID migration without changing Guided Addition behavior.

### Checkpoint 1.4: Make tests intentional

Follow the detailed inventory in [`de-strict_actionable_inventory.md`](de-strict_actionable_inventory.md):

- retain omitted profile only in focused default-resolution tests;
- add an explicit profile to unrelated CLI tests;
- preserve existing artifact expectations by selecting the profile the test actually intends;
- test all five CLI commands through the shared resolver;
- test explicit override;
- test an unknown fallback and unknown explicit override;
- test a bundle-only fallback mutation using a temporary bundle fixture;
- test the library fallback and single resolved value;
- test the fingerprint change.

A bundle-mutation proof must edit only bundle data in a temporary copy and then call the public runtime. Mutating a code constant or only a mock return value is not sufficient evidence of bundle authority.

### Checkpoint 1.5: Update only current default wording

Update the live CLI documentation statements identified by the actionable inventory. Ordinary examples may continue to omit `--profile` because omission is now legitimate bundle-driven behavior.

Do not regenerate renderer goldens or the rendered corpus in this stage. Do not rewrite archived docs or Service Blueprint assets.

### Focused verification

Run the smallest relevant suites after each checkpoint, then at minimum:

```bash
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/cli.spec.ts tests/render_dot.spec.ts tests/render_mermaid.spec.ts
TMPDIR=/tmp pnpm test
```

Include any newly created bundle-default test file in the focused command.

Manually verify representative omitted and explicit commands:

```bash
TMPDIR=/tmp pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd
TMPDIR=/tmp pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile strict
TMPDIR=/tmp pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --out /tmp/stage1-default.svg
```

### Stage 1 achievement criteria

- The bundle is the only omitted-profile fallback authority.
- The shipped fallback is `simple`.
- All five CLI commands and the combined library API use it.
- Explicit profile overrides still win.
- No hidden strict fallback remains in active runtime code.
- Unrelated tests are profile-explicit.
- Existing renderer behavior remains profile-coupled and otherwise unchanged.
- No renderer goldens or corpus artifacts changed.

### Stage 1 LLM approval

The LLM must review the diff for duplicated fallback logic and search active code for hidden strict assumptions. Approve only if the bundle-only mutation test demonstrates runtime dependence on the manifest field.

## Stage 2: Add persistent configuration and profile precedence

### Objective

Add the versioned configuration substrate, project/global path rules, provenance-aware resolution, and `sdd defaults` management. Integrate persistent profile selection into the human CLI only.

This stage prepares the same schema for `render_detail_id`, but detail selection does not become effective until Stage 3 adds the bundle vocabulary.

### Checkpoint 2.1: Add an application-layer configuration module

Create a cohesive module outside the bundle and renderer layers. A suitable organization is `src/config/` with separate types, paths, parser/validator, resolver, and writer files. Exact filenames may follow repository conventions, but responsibilities must remain separable and dependency-injectable.

Implement the shared schema:

```yaml
version: "1"
defaults:
  validation_profile_id: simple
  render_detail_id: compact
```

Both settings are optional. Reject:

- malformed YAML;
- a non-object root or `defaults` value;
- unsupported version;
- unknown keys at either level;
- non-string or empty IDs;
- duplicate YAML keys;
- unreadable files.

Missing files and missing individual settings are normal absence, not errors.

Configuration files select IDs only. They cannot define profiles, rules, display flags, or view behavior.

### Checkpoint 2.2: Implement platform-native paths

Resolve the global file as documented by the architecture:

| Runtime platform | Path |
| --- | --- |
| Linux/WSL | `${XDG_CONFIG_HOME}/sdd/config.yaml`, otherwise `~/.config/sdd/config.yaml` |
| macOS | `~/Library/Application Support/sdd/config.yaml` |
| Windows | `%APPDATA%\sdd\config.yaml` |

Inject platform, environment, and home-directory/path dependencies so tests never read or write the executor's real user configuration.

For project scope, reuse the existing repository-root discovery contract starting at CLI `cwd`. The project file is exactly `<repo-root>/sdd.config.yaml`; do not search above the resolved root and do not base normal resolution on the source file's directory.

Normal commands may proceed without a discovered project root by treating project configuration as absent. Project-scoped `set` and `unset` must fail when no root is discoverable.

### Checkpoint 2.3: Implement independent resolution with provenance

Define a shared result for each setting containing:

- effective `value`;
- `source`: `cli`, `project`, `global`, or `bundle`;
- optional `sourcePath` for file-backed sources.

Resolve profile independently in the required precedence order. Select the first present value, then validate it against the loaded bundle. An invalid selected value is a hard error that names:

- setting and value;
- source and path when applicable;
- selected bundle;
- available declared values.

Do not catch that error and continue down the precedence chain.

Design the resolver so Stage 3 can activate detail through the same generic mechanism rather than adding a parallel implementation.

### Checkpoint 2.4: Add safe configuration mutation

Implement atomic `set` and `unset` operations:

- create parent directories only for the exact chosen global path;
- preserve the other configured setting;
- serialize UTF-8 with canonical LF and deterministic key order;
- write to a sibling temporary file and rename atomically;
- clean up a failed temporary write;
- make setting the same value idempotent;
- remove an empty `defaults` mapping;
- remove an otherwise empty config file after `unset`;
- never rewrite the bundle.

Do not preserve unknown keys by accident; unknown keys make the file invalid before mutation.

### Checkpoint 2.5: Add `sdd defaults`

Implement the final command family:

```text
sdd defaults show [--global | --project] [--bundle <manifest>]
sdd defaults set <profile|detail> <value> (--global | --project) [--bundle <manifest>]
sdd defaults unset <profile|detail> (--global | --project)
```

At this stage, `profile` is fully operational. The generic `detail` branch may exist, but against the shipped Stage-2 bundle it must fail explicitly because no declared render-detail vocabulary exists yet; Stage 3 activates it. Do not silently accept an unvalidated detail value.

Rules:

- `set` and `unset` require exactly one scope;
- `show` accepts no scope or exactly one scope, never both;
- `show` without scope reports effective profile, source, source path when present, selected bundle path, and bundle fallback;
- scoped `show` reports the exact file path, stored/unset values, and validity against the selected bundle;
- value errors and malformed scope combinations use nonzero exits and actionable messages;
- `unset` does not require a bundle because it removes a named preference rather than selecting behavior.

Keep output deterministic and test its semantic fields. Do not add an unplanned JSON mode merely to simplify tests.

### Checkpoint 2.6: Integrate only the human CLI

Apply persistent profile resolution to `validate`, `render`, `dot`, `mmd`, and `show` after bundle loading and before validation.

Do not read configuration from:

- `compile`;
- `add` or Guided Addition internals;
- `sdd-helper`;
- `validateGraph(...)`;
- library rendering APIs;
- renderer entrypoints.

A malformed global/project file should fail a command that consumes its setting, but must not break `compile` or Guided Addition solely because those commands do not use these defaults.

### Required tests

Add focused configuration tests for:

- all platform paths, including XDG fallback;
- no project root;
- nearest discovered project root;
- absent files and partial files;
- global profile;
- project profile;
- CLI > project > global > bundle;
- an invalid value at every precedence level;
- invalid project value not falling through to valid global value;
- malformed, unsupported, unknown-key, duplicate-key, unreadable, and empty-ID files;
- set, idempotent set, partial preservation, unset, empty-file removal, and atomic write failure;
- deterministic source reporting and paths;
- real-user-config isolation through dependency injection;
- all five CLI consumers;
- `compile` and Guided Addition not reading malformed preference files;
- library/helper behavior remaining configuration-independent;
- bundle fingerprint equality before and after creating user/project configuration.

Use temporary directories for every configuration test. Never mutate the executor's actual global config.

### Focused verification

```bash
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/cli.spec.ts
TMPDIR=/tmp pnpm test
```

Include all new configuration-focused test files in the focused run.

Perform manual CLI checks under an isolated temporary configuration root. Exercise bundle, global, project, and explicit profile sources plus `show`, `set`, and `unset`.

### Stage 2 achievement criteria

- The versioned parser, path resolver, reader, writer, and resolver are independently testable.
- Profile precedence and provenance are correct for all five human CLI consumers.
- `sdd defaults` manages profile safely.
- Invalid selected values never fall through.
- Machine-facing and library surfaces remain free of filesystem preference reads.
- User/project config does not affect bundle fingerprints.
- Render detail is not yet active and rendering remains profile-coupled.

### Stage 2 LLM approval

The LLM must inspect failure paths and dependency injection, not only success cases. Approve only if tests prove that no real user config is accessed and that malformed unused configuration does not contaminate unrelated commands.

## Stage 3: Introduce render detail and separate runtime inputs

### Objective

Declare render detail in the bundle, activate persistent and CLI detail resolution, and make validation and display-policy selection use independent effective values. Establish migration equivalence before profile-owned renderer state is removed.

### Checkpoint 3.1: Extend the bundle manifest and view contract

Add the final shipped fields:

```yaml
tool_defaults:
  validation_profile_id: simple
  render_detail_id: compact

render_details:
  - id: compact
    intent: Low-noise rendering focused on primary structure.
  - id: detailed
    intent: Fuller rendering with secondary labels, annotations, and supporting detail.
```

Add manifest types, a render-detail type/accessor, and bundle validation for:

- malformed `tool_defaults`;
- duplicate or empty detail IDs;
- missing/empty intent;
- unknown render-detail fallback;
- missing detail-policy coverage;
- unknown policy detail IDs;
- non-object policies and non-boolean display values.

Manifest order must not imply the fallback.

Use bundle-owned participation plus a focused cross-layer test to ensure every currently code-renderable view has explicit coverage for every declared detail. Do not hardcode the six view IDs into bundle-validation logic.

### Checkpoint 3.2: Add detail-owned policies without changing content

In `bundle/v0.1/core/views.yaml`, add `renderer_defaults.detail_display` for all six current renderable views:

- copy the current `simple` policy to `compact`;
- copy the current `permissive`/`strict` policy to `detailed`.

All current views have identical permissive and strict policies. Add a test that proves that assertion directly from bundle data before removing the old field.

Introduce generic detail-policy resolution and detail-named policy types/readers. During the equivalence checkpoint, the old profile resolver may coexist temporarily, but new production display selection must converge on the detail resolver by the end of this stage.

Do not change flag values, add view-specific branches, or move render shaping into projection.

### Checkpoint 3.3: Activate detail configuration and CLI options

Activate `render_detail_id` in the Stage-2 resolver and all `sdd defaults` operations.

Add `--detail <detail_id>` only to:

- `show`;
- hidden `render`;
- hidden `dot`;
- hidden `mmd`.

Do not add it to `validate`, `compile`, or `add`. Commander help must describe profile as validation and detail as rendering. Omission uses the independently resolved default for each.

All rendering commands resolve both values once and carry provenance internally. A project may provide one setting while global or bundle supplies the other.

### Checkpoint 3.4: Separate combined library orchestration

Update combined source-rendering options to accept:

```text
profileId?: string
detailId?: string
```

When omitted, resolve each from the loaded bundle only. Never call the filesystem preference resolver from library code.

The combined flow must be:

```text
compile
  -> validate with effective profileId
  -> raw project without profileId/detailId
  -> prepare/render with effective detailId
```

Structured results must report both effective IDs, including failure results where resolution succeeded. Lower-level validation remains profile-explicit. Lower-level renderer/model entrypoints become detail-explicit.

Update `renderSourcePreview(...)` similarly. Its orchestration may carry both IDs, but its projection-source backend request must use detail for rendering. Profile is validation provenance only.

### Checkpoint 3.5: Migrate text and staged display selection

Migrate both renderer families to resolve display flags from detail:

- legacy DOT and Mermaid text renderers;
- staged preview renderers for all six views;
- `prepareProjectionForRender(...)`, including UI Contracts omission notes;
- all view render models and place-label helpers.

Rename user-visible notes that say `simple profile` to `compact detail` or equivalent detail language.

It is acceptable for renderer scene structures and SVG metadata to retain profile-named fields only until Stage 4, but those fields must not be consulted for display selection. Record this transitional debt explicitly in the Stage 3 achievement report; the branch is not architecturally complete until Stage 4.

### Checkpoint 3.6: Prove migration equivalence before deletion

Create a focused equivalence harness before removing `profile_display`. For every current view and applicable backend, prove:

| New detail | Existing behavior to match |
| --- | --- |
| `compact` | `simple` |
| `detailed` | `permissive` and `strict` |

Evidence must cover:

- resolved display-policy objects;
- DOT text;
- Mermaid text where supported;
- staged renderer scenes before metadata-only field migration;
- deterministic SVG content;
- PNG output or deterministic SVG-to-PNG input;
- legacy Graphviz preview input and, when Graphviz is available, output.

For SVG comparison, normalize only the explicitly planned metadata rename when necessary. Do not normalize node content, dimensions, coordinates, routes, classes unrelated to profile/detail, diagnostics, or notes.

If Graphviz is unavailable, equal DOT input plus an unchanged legacy Graphviz adapter is acceptable Stage-3 evidence. Record the missing direct artifact comparison. If the adapter changed, direct Graphviz output comparison is required.

Generate temporary representative compact and detailed SVG/PNG artifacts for all six views. The executor LLM must visually inspect the representative pairs and record whether:

- compact retains the current low-noise behavior;
- detailed retains the current fuller behavior;
- there is no layout/routing regression beyond the expected added or removed content.

A read-only visual-review subagent is appropriate only if it materially improves coverage. It is not required.

Do not update stored goldens or the rendered corpus during this checkpoint.

### Required independence tests

Add tests proving:

1. With source, bundle, view, backend, format, and detail fixed, changing profile may change validation diagnostics or eligibility but cannot change a successful render's content. During Stage 3 only, staged scene/SVG comparison may normalize the exhaustively listed transitional `profileId`, `profile-*`, and `data-profile-id` metadata; DOT, Mermaid, render-model content, geometry, and all other serialized fields must compare exactly.
2. With source, bundle, view, and profile fixed, changing detail may change renderer output but cannot change validation diagnostics.
3. Changing only `tool_defaults.render_detail_id` changes omitted-detail rendering.
4. Changing only a per-view detail policy changes that view's output.
5. Project/global profile and detail resolve independently.
6. Invalid profile and detail errors each identify their own setting and source.
7. An unsupported view/detail combination fails instead of using another detail.

Use sources that pass under at least two profiles for the successful-render comparison. Compare serialized text/SVG and scene/model contracts, not only a few substrings. The Stage-3 normalizer must be narrow and tested; Stage 4 removes it and requires byte-identical successful artifacts across profiles when detail is fixed.

### Focused verification

Run all new bundle/detail/equivalence tests plus at minimum:

```bash
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/render_profile_display.spec.ts tests/prepareProjectionForRender.spec.ts tests/previewWorkflow.spec.ts tests/stagedRenderer.spec.ts tests/cli.spec.ts
TMPDIR=/tmp pnpm test
```

The profile-display test file may be intentionally renamed to detail terminology after equivalence is established.

### Stage 3 achievement criteria

- The bundle declares and validates `compact` and `detailed` plus the `compact` fallback.
- All six current views have complete detail policies.
- Human CLI and library resolution carry independent profile and detail values.
- Profile selects validation; detail selects display behavior.
- Legacy and staged output behaviors match their pre-migration equivalents.
- Independence tests pass with only the documented transitional metadata normalization; no rendered content difference is permitted.
- Stored goldens and corpus remain unchanged pending Stage 4 migration.
- Any remaining profile-named renderer metadata is listed exhaustively.

### Stage 3 LLM approval

Approve only after the equivalence matrix is complete and visually reviewed. A test suite made green by refreshing snapshots is an automatic `NOT APPROVED`.

## Stage 4: Remove profile from renderer, helper, and artifact identity

### Objective

Finish the architectural separation: renderer-owned contracts, helper preview, SVG metadata, automatic paths, and corpus planning use detail. Profile remains only in validation and execution provenance.

### Checkpoint 4.1: Remove profile-owned display state

Delete `renderer_defaults.profile_display` from the bundle only after Stage 3 equivalence is approved.

Remove or rename:

- `src/renderer/profileDisplay.ts`;
- `ResolvedProfileDisplayPolicy`;
- `resolveProfileDisplayPolicy(...)`;
- `readBooleanProfileDisplaySetting(...)`;
- profile-named parameters in render-model builders and staged view renderers.

Every renderer consumer must use the detail-owned equivalents. There must be no compatibility fallback from detail to a validation profile.

### Checkpoint 4.2: Migrate staged scene contracts and SVG metadata

Replace:

```text
RendererScene.profileId
MeasuredScene.profileId
PositionedScene.profileId
```

with `detailId`, including micro-layout, macro-layout, routing/debug artifacts, fixtures, snapshot harnesses, and all six scene builders.

Replace SVG metadata:

```text
profile-<id>        -> detail-<id>
data-profile-id     -> data-detail-id
```

Do not include validation profile in SVG comments, classes, data attributes, or renderer diagnostics merely as provenance. Return it in the surrounding combined result instead.

Run the exact profile-independence comparison again after this migration. With detail fixed, successful serialized artifacts must now be byte-identical across validation profiles.

### Checkpoint 4.3: Migrate preview backends and automatic paths

Projection-backed preview requests and staged backend callbacks must carry `detailId`, not `profileId`. Text-backed legacy preview obtains detail-shaped DOT/Mermaid before backend invocation.

Change `src/previewArtifactPaths.ts` and every caller to build:

```text
<source>.<view>.<detail>[.<backend>].<format>
```

Explicit output paths continue to win. Add exact tests for default and explicit backend suffixes.

Update CLI help and write messages accordingly.

### Checkpoint 4.4: Make helper preview explicit in both dimensions

Keep helper validation unchanged and profile-explicit. Change helper preview to require both:

```text
--profile <profile_id>
--detail <detail_id>
```

Update together:

- `RenderPreviewArgs` and `RenderPreviewResult`;
- helper command parsing;
- preview service calls and failure context;
- helper capabilities/discovery text;
- contract shapes and required fields;
- bundle bindings and bundle-resolved allowed values;
- contract resolution support for manifest render-detail declarations;
- helper CLI tests and integration tests;
- artifact materialization basename;
- `skills/sdd-skill/SKILL.md` and relevant workflow references/tests.

Preview results carry both `profile_id` and `detail_id`. Preview matching in the SDD Skill must require the same document revision, view, profile, detail, format, and backend.

Do not make helper arguments optional and do not let helper read persistent config.

Bundle-derived contract resolution must expose detail IDs generically. Do not hardcode `compact` and `detailed` in helper metadata as the source of allowed values.

### Checkpoint 4.5: Migrate structured execution metadata

Ensure combined library and preview results report both IDs consistently in camelCase, while helper JSON uses `profile_id` and `detail_id`.

If an actual combined validation/render cache or artifact record exists at execution time, include both effective IDs where validation outcome is cached and include detail where renderer output is cached. Do not add a new generalized cache subsystem solely for this plan.

Confirm again that user/project files are absent from bundle fingerprint input.

### Checkpoint 4.6: Plan corpus migration without yet regenerating

Change corpus planning from profile variants to detail variants:

- enumerate `bundle.manifest.render_details`;
- use detail-named variant types and directory helpers;
- use directories such as `compact_detail/` and `detailed_detail/`;
- render each detail once rather than producing duplicate output for every validation-profile/detail cross-product;
- validate generation with an explicit bundle-derived validation profile, normally `tool_defaults.validation_profile_id`;
- record that validation profile in the generated README/provenance text;
- keep detail and backend in artifact identity.

Keep focused validation tests across all profiles outside the rendered corpus. The corpus demonstrates renderer detail, not validation-policy permutations.

At this checkpoint, test path planning and generation into a temporary root if practical. Do not remove the committed profile-based corpus until Stage 5 authorizes regeneration.

### Required searches before approval

The following should be absent from active bundle/renderer/helper code except in intentional migration tests or validation provenance:

- `profile_display`;
- `resolveProfileDisplayPolicy`;
- `ResolvedProfileDisplayPolicy`;
- `data-profile-id`;
- renderer scene `profileId`;
- preview artifact path options named `profileId`;
- helper preview without `detail_id`.

`profileId` remains legitimate in validation and combined orchestration. It must not flow below the validation/render split.

### Focused verification

```bash
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm exec vitest run tests/helperCli.spec.ts tests/helperCli.integration.spec.ts tests/authoringPreviewMaterialization.spec.ts tests/previewWorkflow.spec.ts tests/stagedRenderer.spec.ts tests/stagedSvgBackend.spec.ts tests/renderedCorpus.spec.ts tests/sddSkillSource.spec.ts
TMPDIR=/tmp pnpm test
```

Include renamed/new detail, artifact-path, contract-metadata, and contract-resolution suites.

Manually inspect:

- helper `capabilities`;
- bundle-resolved preview contract detail;
- one explicit helper preview carrying both IDs;
- one `sdd show` automatic filename;
- SVG root classes/data attributes;
- profile-fixed/detail-changed and detail-fixed/profile-changed output pairs.

### Stage 4 achievement criteria

- No renderer-owned contract or display resolver depends on profile.
- SVG and automatic artifact identity use detail.
- Helper preview is explicit in both settings and remains config-independent.
- Structured results retain both effective IDs.
- Corpus planning is detail-based and collision-free.
- Exact post-migration independence tests pass.
- Committed corpus/goldens have not yet been regenerated.

### Stage 4 LLM approval

The LLM must trace one staged path and one legacy path from combined orchestration to artifact output and confirm that profile stops at validation while detail continues to rendering. Approve only if the post-migration artifacts are byte-identical across profiles when detail is fixed.

## Stage 5: Update evidence, documentation, and close out

### Objective

Regenerate only the evidence made intentionally obsolete by the approved contract changes, update live documentation, and perform final end-to-end acceptance.

### Checkpoint 5.1: Update focused goldens intentionally

List every golden/snapshot change before applying it and classify it as one of:

- schema rename `profileId` -> `detailId`;
- SVG metadata rename;
- filename/directory rename from profile to detail;
- expected compact/detailed content mapping already proved in Stage 3.

Reject any unexplained geometry, routing, content, diagnostic, or note change. If such a change appears, return to Stage 3 or 4; do not normalize it with a snapshot refresh.

Historical assets under `docs/Done/` are not active goldens and should not be bulk rewritten.

### Checkpoint 5.2: Regenerate the rendered corpus once

Before running the generator:

- inspect `examples/rendered/v0.1/` for unrelated or hand-authored files;
- confirm Stage 4 corpus path tests pass;
- confirm the generator's deletion scope is exactly the versioned generated corpus root;
- verify Graphviz availability or document the accepted alternate legacy evidence.

Then run the repository generator rather than editing generated files manually:

```bash
TMPDIR=/tmp pnpm run generate:rendered-examples
```

Verify:

- only detail directories exist for newly generated render variants;
- compact and detailed outputs match the approved equivalence mapping;
- no profile/detail collision or duplicate content set remains;
- README/provenance names the validation profile used for generation;
- staged and retained legacy backends are present as expected;
- committed-corpus consumers such as `tests/stagedVisualAcceptance.spec.ts` reference the migrated detail directories;
- a second generation produces identical sorted hashes.

Visually inspect at least one compact and one detailed generated artifact for each of the six views. Record the LLM verdict in the Stage 5 report.

### Checkpoint 5.3: Update live documentation

Update current documentation to explain:

- bundle fallback `simple` and `compact`;
- `--profile` as validation-only;
- `--detail` as rendering-only;
- CLI > project > global > bundle precedence for each setting;
- `sdd defaults show/set/unset` with scope requirements;
- platform-native global paths and repository-root `sdd.config.yaml`;
- helper explicitness;
- detail-based automatic artifact names;
- detail-based corpus organization.

Likely live targets include:

- `docs/toolchain/development.md`;
- `docs/doc_site/sdd_cli_tools/index.md`;
- `docs/doc_site/sdd-helper/index.md`;
- `docs/doc_site/diagram_types/index.md`;
- CLI help assertions;
- relevant SDD Skill workflow documentation;
- `AGENTS.md` if its current-project-goal wording is now completed or obsolete.

Do not rewrite the architecture or actionable inventory to conceal deviations. If implementation required an approved deviation, add a short dated amendment or record it in this plan's execution log.

Do not edit `docs/doc_site/.vitepress/dist` directly. Rebuild the documentation site:

```bash
TMPDIR=/tmp pnpm run docs:build
```

Preserve unrelated Service Blueprint documentation changes and assets.

### Checkpoint 5.4: Final behavior matrix

Run and record a matrix covering:

| Case | Expected result |
| --- | --- |
| No config/no flags | bundle `simple` + `compact` |
| Global profile only | global profile + lower-scope detail |
| Global detail only | lower-scope profile + global detail |
| Partial project config | project value for one setting, independent fallback for the other |
| Full project config | both project values |
| CLI profile only | CLI profile, independently resolved detail |
| CLI detail only | independently resolved profile, CLI detail |
| Both CLI flags | both CLI values |
| Invalid project profile with valid global profile | hard error at project |
| Invalid project detail with valid global detail | hard error at project |
| Malformed global config | actionable error on consuming human CLI command |
| Same malformed config with `compile` | compile remains unaffected |
| Library omitted values | bundle fallbacks only |
| Helper preview | both IDs required; no config reads |
| Fixed detail, changed profile | same successful artifact; validation may differ |
| Fixed profile, changed detail | same validation; render may differ |

Cover all five profile-consuming commands and all four detail-consuming commands.

### Checkpoint 5.5: Final verification and drift searches

Run:

```bash
TMPDIR=/tmp pnpm run build
TMPDIR=/tmp pnpm test
TMPDIR=/tmp pnpm run docs:build
git diff --check
```

Also run focused searches proving:

- no active hardcoded strict fallback remains;
- no active profile-owned renderer display state remains;
- no automatic preview filename uses profile;
- help and live docs no longer describe strict as the default;
- Guided Addition's separate profile fields remain present and unchanged;
- config paths/settings do not enter bundle fingerprints;
- the generated corpus and renderer evidence are deterministic.

Review the complete diff by subsystem. Confirm that parser, compiler, raw projection, validation rules, Guided Addition, layout, and routing have no unexplained changes.

### Final completion criteria

The implementation is complete only when:

- the bundle declares valid profile/detail fallbacks and detail policies;
- shipped omitted values are `simple` and `compact`;
- user-global and project preferences resolve independently and safely;
- `sdd defaults` shows, sets, and unsets both settings;
- the human CLI alone reads persistent preferences;
- `--profile` affects validation only;
- `--detail` affects rendering only;
- helper and lower-level machine workflows remain explicit;
- renderer scenes, SVG metadata, artifact paths, and corpus organization use detail;
- invalid configuration never silently falls through;
- bundle-only mutation tests prove runtime bundle authority;
- compact/detailed equivalence and profile/detail independence are proved;
- live documentation and CLI help match behavior;
- full tests and documentation build pass;
- no unrelated user work was overwritten.

### Stage 5 LLM approval

The final LLM approval must be based on the complete diff, full verification, behavior matrix, deterministic regeneration evidence, and visual review. If any completion criterion is unmet, verdict is `NOT APPROVED` and the implementation must not be reported as complete.

## Recommended test organization

The executor may reuse existing files where that keeps ownership clear. If new suites are useful, the following boundaries are recommended:

- `tests/bundleToolDefaults.spec.ts`: fallback declarations, validation, fingerprint, and bundle mutation;
- `tests/defaultsConfig.spec.ts`: schema, paths, reads/writes, atomicity, and precedence;
- `tests/cliDefaults.spec.ts`: defaults commands, source reporting, and five-command integration;
- `tests/renderDetail.spec.ts`: bundle detail policy, fallback mutation, view coverage, and legacy behavior;
- `tests/profileDetailIndependence.spec.ts`: separation and migration-equivalence matrix;
- existing staged view suites: scene `detailId`, SVG metadata, and view-specific compact/detailed behavior;
- existing helper/contract/skill suites: explicit `profile_id` + `detail_id`;
- `tests/renderedCorpus.spec.ts`: detail variants and deterministic path planning.

Do not create a single oversized test file that obscures which layer owns a failure.

## Implementation notes for known repository surfaces

These notes are a starting map, not permission to skip Stage 0 drift discovery:

- `src/bundle/types.ts` currently leaves `renderer_defaults` open-ended; add enough typing and validation for detail policy without hardcoding view-specific flag names.
- `src/bundle/validateLoadedBundle.ts` already collects deterministic bundle diagnostics and is the natural validation path.
- `src/bundle/fingerprint.ts` includes the manifest and views, so bundle detail/fallback data should affect fingerprints naturally; tests still need to prove it.
- `src/cli/program.ts` currently loads bundle/source together and carries Commander profile defaults; resolution should occur after bundle load and before compile/validation.
- `src/authoring/workspace.ts` already provides repository-root discovery suitable for project config.
- `src/renderer/renderView.ts` currently resolves profile separately for validation and rendering; resolve both effective settings once in the combined layer.
- `src/renderer/profileDisplay.ts` and `src/renderer/viewRenderers.ts` are the central legacy text-policy path.
- `src/renderer/prepareProjectionForRender.ts` contains the UI Contracts pre-render shaping boundary and must use detail without changing raw projection.
- `src/renderer/previewWorkflow.ts` is the combined preview orchestration boundary where profile and detail split.
- `src/renderer/previewBackends.ts` and staged renderer entrypoints must become detail-only below that boundary.
- `src/renderer/staged/contracts.ts`, `microLayout.ts`, `macroLayout.ts`, and `svgBackend.ts` carry current scene profile metadata.
- `src/previewArtifactPaths.ts` is shared by human and helper preview naming.
- `src/authoring/contracts.ts`, `contractMetadata.ts`, and `contractResolution.ts` must evolve together so helper contract discovery remains accurate.
- `src/examples/renderedCorpus.ts` currently expands variants over manifest profiles; it must ultimately expand over render details instead.
- `skills/sdd-skill/references/workflow.md` currently defines preview matching in terms of profile only and must include detail.

## Execution log

Append one report per stage using this template. Do not pre-mark stages complete.

```markdown
### Stage N achievement report

Verdict: APPROVED | NOT APPROVED

Implemented:
- ...

Changed subsystems:
- ...

Verification:
- `<command>` — pass/fail and relevant result

Satisfied invariants:
- ...

Violated invariants:
- none | ...

Residual risks:
- none | explicitly deferred item

Snapshots/goldens/corpus:
- unchanged | exact intentional changes and evidence

Subagents:
- none | bounded task and quality benefit

Next authorized stage:
- Stage N+1 | none
```

### Stage 0 achievement report

Verdict: APPROVED

Implemented:
- Read and reconciled the implementation plan, target architecture, actionable inventory, repository instructions, and current CLI, bundle, renderer, helper, and corpus surfaces.
- Recorded the execution baseline and refreshed the profile/default/rendering blast-radius inventory.
- Added newly discovered live helper documentation, corpus documentation, and corpus-path test consumers to the appropriate later-stage checkpoints.
- Recorded that duplicate manifest profile IDs are already rejected generically and that the public `ProfileId` alias remains a closed shipped-ID union.

Changed subsystems:
- Planning documentation only: `docs/de-strict/user_settable_defaults_implementation_plan.md`.
- No product code, bundle data, tests, snapshots, goldens, corpus artifacts, generated documentation, or protected user work was changed.

Verification:
- `git status --short` — baseline branch `de-strict` at `e4afb62779234ff940e33220b27f7d2108a657f9`; existing modified `AGENTS.md` identified and protected.
- `node --version` — pass, `v22.17.0`.
- `pnpm --version` — pass, `10.31.0`.
- `TMPDIR=/tmp pnpm run check:graphviz` — pass, Graphviz `2.43.0` detected.
- `TMPDIR=/tmp pnpm run build` — pass.
- `TMPDIR=/tmp pnpm test` — baseline not clean under the default parallel run: 83 of 89 test files and 801 of 809 tests passed; all eight failures were timeouts with no assertion mismatch.
- `TMPDIR=/tmp pnpm exec vitest run tests/helperCli.integration.spec.ts tests/journeyMapPreRouting.spec.ts tests/journeyMapRenderModel.spec.ts tests/journeyMapRouting.spec.ts tests/stagedVisualAcceptance.spec.ts tests/journeyMapRendererStageSnapshots.spec.ts --maxWorkers=1 --minWorkers=1` — pass, 6 of 6 files and 100 of 100 tests passed.
- Refreshed inventory — five Commander `strict` defaults, two library `?? "strict"` fallbacks, six bundle `profile_display` policies, three staged scene `profileId` fields, profile-owned SVG metadata, profile-based preview/helper/corpus identities, and three live CLI-default statements.
- Rendered-corpus baseline — 12 `simple_profile`, 12 `permissive_profile`, and 12 `strict_profile` directories containing 319 committed files.

Satisfied invariants:
- Authority order is unambiguous: target architecture, actionable inventory, bundle machine behavior, repository guardrails, then current code/tests as evidence.
- Existing user work in `AGENTS.md` is listed and protected.
- Baseline tool availability, build status, full-suite result, and focused timeout rerun are known.
- Current drift and newly discovered consumers are recorded before product implementation.
- No product files or generated evidence were edited.

Violated invariants:
- none.

Residual risks:
- The default parallel full-suite run is contention-sensitive and can exceed existing per-test timeouts; Stage 1 must retain the full-run result and use focused/single-worker reruns to distinguish regressions from this recorded baseline condition.

Snapshots/goldens/corpus:
- unchanged.

Subagents:
- none.

Next authorized stage:
- Stage 1.

### Stage 1 achievement report

Verdict: APPROVED

Implemented:
- Added the required bundle-owned `tool_defaults.validation_profile_id` contract and set the shipped fallback to `simple`.
- Added generic bundle validation, a public fallback accessor, fingerprint evidence, and bundle-only public-runtime mutation proof.
- Removed the five Commander `strict` defaults and routed one resolved profile through `validate`, `render`, `dot`, `mmd`, and `show`.
- Removed both hidden library `strict` fallbacks, made compiled-graph rendering profile-explicit, and added the effective profile to every `RenderResult`.
- Widened profile ID typing to bundle-declared strings without changing Guided Addition runtime behavior.
- Updated current CLI help and live default-profile documentation while preserving explicit strict examples.

Changed subsystems:
- Bundle manifest, manifest types, loaded-bundle validation, fingerprint evidence, and public bundle accessors.
- Human CLI profile resolution and combined text-rendering orchestration.
- Public rendering/profile types, focused CLI/library/bundle tests, synthetic bundle fixtures, and current CLI documentation.

Verification:
- `TMPDIR=/tmp pnpm run build` — pass.
- `TMPDIR=/tmp pnpm exec vitest run tests/bundleToolDefaults.spec.ts tests/cli.spec.ts tests/render_dot.spec.ts tests/render_mermaid.spec.ts` — pass, 4 of 4 files and 62 of 62 tests.
- `TMPDIR=/tmp pnpm run docs:build` — pass.
- `TMPDIR=/tmp pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd` — pass with the shipped bundle fallback.
- `TMPDIR=/tmp pnpm sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile strict` — pass with the explicit override.
- `TMPDIR=/tmp pnpm sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --out /tmp/stage1-default.svg` — pass; output records `profile-simple` and `data-profile-id="simple"`.
- `TMPDIR=/tmp pnpm test` — baseline-sensitive parallel run: 89 of 90 files and 816 of 818 tests passed; the only failures were two 5-second timeouts in `tests/journeyMapRouting.spec.ts`, with no assertion mismatch.
- `TMPDIR=/tmp pnpm exec vitest run tests/journeyMapRouting.spec.ts --maxWorkers=1 --minWorkers=1` — pass, 1 of 1 file and 62 of 62 tests.
- Active-runtime drift search — no Commander `strict` default, `?? "strict"`, equivalent hidden fallback, or `strict governance (default)` wording remains.
- `git diff --check` — pass.

Satisfied invariants:
- The loaded bundle is the only authority for omitted profiles, and changing only bundle fallback data changes public runtime behavior.
- The shipped fallback is `simple`; explicit CLI and library overrides still win and unknown explicit values do not fall through.
- All five human CLI consumers share one resolution helper after loading the selected bundle.
- The combined library flow resolves once and uses the same effective profile for validation and still-profile-coupled rendering.
- Bundle fingerprints include the fallback through the manifest; no user or project configuration was introduced.
- Parser, compiler, validator rules, raw projection, Guided Addition, renderer layout, routing, and render-detail policy remain unchanged.

Violated invariants:
- none.

Residual risks:
- The recorded parallel-suite timeout sensitivity remains; the affected routing file passes in isolation with one worker.
- Renderer content, scene metadata, SVG metadata, and artifact identity intentionally remain profile-coupled until Stages 3 and 4.

Snapshots/goldens/corpus:
- unchanged.

Subagents:
- none.

Next authorized stage:
- Stage 2.

### Stage 2 achievement report

Verdict: APPROVED

Implemented:
- Added a versioned application-layer defaults module with strict YAML parsing, platform-native global paths, repository-root project paths, provenance-aware independent resolution, and atomic mutation.
- Added persistent profile precedence in the human CLI: explicit CLI, project, global, then the selected bundle fallback.
- Added `sdd defaults show`, `set`, and `unset` with scope validation, actionable value errors, deterministic reporting, idempotent writes, and safe empty-file removal.
- Kept render detail inactive: the schema can parse and preserve `render_detail_id`, scoped inspection reports it as unavailable, `set detail` fails explicitly, and `unset detail` remains operational.
- Updated current CLI help and documentation with precedence, configuration locations, and management commands.

Changed subsystems:
- New `src/config/` parser, path, storage, runtime, resolver, error, and type boundaries.
- Human `sdd` CLI dependency injection, profile resolution, defaults commands, help, and focused tests.
- Current CLI documentation and this implementation-plan execution record.

Verification:
- `TMPDIR=/tmp pnpm run build` — pass.
- `TMPDIR=/tmp pnpm exec vitest run tests/defaultsConfig.spec.ts tests/cliDefaults.spec.ts tests/cli.spec.ts tests/guidedAdditionCli.spec.ts tests/helperCli.spec.ts tests/render_dot.spec.ts tests/render_mermaid.spec.ts` — pass, 7 of 7 files and 164 of 164 tests.
- `TMPDIR=/tmp pnpm exec vitest run tests/defaultsConfig.spec.ts tests/cliDefaults.spec.ts tests/cli.spec.ts tests/bundleToolDefaults.spec.ts` — pass after final atomic-write and independence additions, 4 of 4 files and 94 of 94 tests.
- `TMPDIR=/tmp pnpm run docs:build` — pass.
- Isolated manual CLI flow under `XDG_CONFIG_HOME=/tmp/sdd-stage2-manual-4de4ee9` — pass for bundle `simple`, global `permissive`, project `strict`, explicit `simple`, scoped mutation, provenance reporting, and removal of both temporary configuration files.
- `TMPDIR=/tmp pnpm test` — baseline-sensitive parallel run: 88 of 92 files and 847 of 851 tests passed; all four failures were timeouts in Journey Map suites with no assertion mismatch.
- `TMPDIR=/tmp pnpm exec vitest run tests/journeyMapPreRouting.spec.ts tests/stagedJourneyMap.spec.ts tests/journeyMapRendererStageSnapshots.spec.ts tests/journeyMapRouting.spec.ts --maxWorkers=1 --minWorkers=1` — pass, 4 of 4 files and 96 of 96 tests.
- Configuration import audit — production configuration reads are confined to `src/cli/program.ts` and its CLI resolver; helper, compiler, validator, renderer, and public library entrypoints do not import the configuration module.
- Active fallback search — no Commander `strict` default, hidden `?? "strict"` fallback, or obsolete bundle-only CLI omission wording remains.

Satisfied invariants:
- Schema, paths, reading, mutation, and resolution are independently testable and fully dependency-injectable; tests access only injected or temporary configuration paths.
- All five human CLI consumers use one effective profile and preserve that value through validation, rendering, preview generation, and automatic artifact naming.
- Invalid selected values report source, path when applicable, selected bundle, and available bundle declarations, and never fall through.
- Missing project roots are normal for effective resolution but fail explicit project-scoped management.
- Malformed preference files fail profile-consuming commands while `compile`, Guided Addition, helper behavior, and direct library rendering remain configuration-independent.
- Configuration files select bundle-owned IDs only and do not affect bundle fingerprints.
- Render detail remains inactive and rendering remains profile-coupled.

Violated invariants:
- none.

Residual risks:
- The recorded parallel-suite timeout sensitivity remains; every affected file passed in the required single-worker rerun.
- Windows replacement behavior relies on Node's platform `rename` semantics and is covered at the injected storage boundary rather than on a native Windows executor.

Snapshots/goldens/corpus:
- unchanged.

Subagents:
- none.

Next authorized stage:
- Stage 3.

### Stage 3 achievement report

Verdict: APPROVED

Implemented:
- Added the required bundle-owned `compact` and `detailed` render-detail vocabulary, ordered intents, `compact` fallback, public types/accessor, generic contract validation, and renderer-participation coverage.
- Added complete `detail_display` policies for all six rendering participants by preserving the former `simple` behavior as `compact` and the identical former `permissive`/`strict` behavior as `detailed`; retained `profile_display` unchanged as migration evidence.
- Activated independent persistent and CLI detail resolution with CLI, project, global, then selected-bundle precedence, while profile continues to select validation only.
- Migrated text renderers, projection preparation, preview orchestration, and all staged renderers to detail-owned policy selection with no renderer/runtime profile-to-detail fallback.
- Added detail-explicit lower renderer contracts and a transitional staged settings object; retained profile only in combined validation provenance and the Stage-3 scene/SVG metadata fields scheduled for Stage 4.
- Added `--detail` to `show`, hidden `render`, `dot`, and `mmd`; activated detail reporting and mutation in `sdd defaults`; left `validate`, `compile`, `add`, helper behavior, and public-library configuration isolation unchanged.
- Added bundle/detail, policy-equivalence, independence, CLI/configuration, failure-path, and narrow transitional-metadata normalizer coverage; updated current help and documentation without refreshing stored evidence.

Changed subsystems:
- Bundle manifest and six view renderer policies; manifest types, validation, fingerprints, accessors, and public exports.
- Human CLI defaults resolution, management commands, help, and rendering-command integration.
- Combined library rendering/preview results and orchestration, text render models, projection preparation, staged renderer entrypoints, and test-only legacy comparison support.
- Focused tests, synthetic bundle fixtures, renderer call sites, corpus-generation intent mapping, current CLI/profile documentation, and this execution record.

Verification:
- Baseline — branch `de-strict` at `24b040babbdd00b9844285cd49adda8126ca2f80`; clean worktree before Stage 3 and no commit created.
- `TMPDIR=/tmp pnpm run build` — pass.
- `TMPDIR=/tmp pnpm exec vitest run tests/bundleRenderDetails.spec.ts tests/renderDetailEquivalence.spec.ts` — pass, 2 of 2 files and 13 of 13 tests; covers all six views, full detail-policy objects, DOT, Mermaid, staged scenes/SVG/PNG, diagnostics/notes, direct legacy Graphviz SVG/PNG, fallback mutation, policy mutation, and independence.
- Focused existing display, preparation, preview, staged, CLI, defaults, helper, DOT, and Mermaid suites — pass without snapshot refresh.
- `TMPDIR=/tmp pnpm run docs:build` — pass.
- Isolated CLI exercises under `/tmp/sdd-stage3-manual.bvRMcr` — pass for global and project `detail` set, scoped show/validity, unset, and removal of the last setting without touching real user configuration.
- `TMPDIR=/tmp pnpm test` — baseline-sensitive parallel run: 91 of 94 files and 867 of 871 tests passed; all four failures were established Journey Map timeouts with no assertion mismatch.
- `TMPDIR=/tmp pnpm exec vitest run tests/journeyMapPreRouting.spec.ts tests/journeyMapRouting.spec.ts tests/journeyMapRendererStageSnapshots.spec.ts --reporter=dot --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=1` — pass, 3 of 3 files and 81 of 81 tests.
- Temporary strict-validation `compact`/`detailed` SVG and PNG generation — pass for all six views, 24 explicit-path artifacts under `/tmp`; visual inspection confirmed preserved low-noise/full behavior and no layout or routing regression.
- Production import/search audit — no profile display resolver/import/call, hidden strict fallback, or persistent-configuration read below the human CLI; retained `profile_display` is consumed only by test equivalence support.
- `git diff --check` — pass; complete diff inspected.

Satisfied invariants:
- The loaded bundle exclusively declares and validates render-detail vocabulary, fallback, participant coverage, and boolean display policy.
- Profile and detail resolve independently; profile controls validation and detail exclusively controls every renderer display decision.
- Omitted library settings come only from the loaded bundle, while persistent configuration remains human-CLI-only and is loaded once for combined CLI rendering resolution.
- `compact` is equivalent to retained `simple`; `detailed` is equivalent to both retained `permissive` and retained `strict` across every applicable renderer path.
- Fixed detail produces identical text/models and normalized staged artifacts across successful profiles; the only normalization removes the exhaustively allowed transitional profile metadata.
- Fixed profile plus changed detail leaves validation diagnostics unchanged; invalid and unsupported detail values fail explicitly without fallback.
- Helper preview contracts, automatic profile-based filenames, scene/SVG profile metadata, parser, compiler, validation rules, raw projection, layout, routing, goldens, and corpus remain unchanged as required for Stage 3.

Violated invariants:
- none.

Residual risks:
- The recorded parallel-suite Journey Map timeout sensitivity remains; all affected tests pass with one worker.
- Exhaustive Stage 4 debt: retained bundle `profile_display`; the test-only profile display resolver; renderer scene `profileId` fields; SVG `profile-*` classes and `data-profile-id`; transitional staged profile provenance; automatic profile-based filenames; and the profile-only helper preview contract.

Snapshots/goldens/corpus:
- unchanged.

Subagents:
- none.

Next authorized stage:
- Stage 4.

### Stage 4 achievement report

Verdict: APPROVED

Implemented:
- Removed all six bundle `profile_display` policies and deleted the test-only profile-display resolver; renderers now consume only bundle-owned `detail_display` policies.
- Replaced staged renderer settings and scene identity with `detailId` through scene construction, measurement, layout, routing/debug artifacts, SVG, and PNG derivation.
- Replaced SVG `profile-*` and `data-profile-id` metadata with `detail-*` and `data-detail-id`; validation profile remains only in the surrounding combined result.
- Migrated projection-backed preview requests and automatic human/helper artifact paths to detail identity, including exact default and explicit-backend path coverage.
- Made helper preview explicit in both independent dimensions with required `--profile` and `--detail`, both result IDs, generic manifest render-detail contract resolution, detail-aware failure context, and detail-aware SDD Skill matching.
- Migrated rendered-corpus planning and temporary generation to one variant per bundle render detail, detail directories, and an explicit bundle-fallback validation profile without changing the committed Stage 3 corpus.
- Added exact post-migration profile-independence coverage and retained narrow test-only compatibility normalization/read mapping solely for the intentionally unchanged Stage 3 goldens and corpus.

Changed subsystems:
- Bundle view renderer defaults; staged renderer contracts, six staged scene builders, layout propagation, preview backends, SVG metadata, and automatic artifact paths.
- Helper authoring contracts, contract metadata/resolution, discovery, parsing, preview materialization, documentation, and SDD Skill workflow guidance.
- Rendered-corpus planning/generation, focused renderer/helper/CLI/corpus tests, and Stage 3 evidence compatibility harnesses.
- Current helper and CLI documentation plus this implementation-plan execution record.

Verification:
- Baseline — branch `de-strict` at `018939cfdc20395a811971c31182e48866f2994f`; clean worktree before Stage 4 and no commit created.
- `TMPDIR=/tmp pnpm run build` — pass.
- `TMPDIR=/tmp pnpm exec vitest run tests/bundleRenderDetails.spec.ts tests/renderDetailEquivalence.spec.ts tests/previewArtifactPaths.spec.ts tests/helperCli.spec.ts tests/helperCli.integration.spec.ts tests/authoringContractMetadata.spec.ts tests/authoringContractResolution.spec.ts tests/authoringPreviewMaterialization.spec.ts tests/previewWorkflow.spec.ts tests/stagedRenderer.spec.ts tests/stagedSvgBackend.spec.ts tests/renderedCorpus.spec.ts tests/sddSkillSource.spec.ts` — pass, 13 of 13 files and 174 of 174 tests.
- Final affected-fixture rerun with one worker — pass, `tests/authoringDirectoryServices.spec.ts`, `tests/stagedJourneyMap.spec.ts`, `tests/render_dot.spec.ts`, and `tests/render_mermaid.spec.ts`; 4 of 4 files and 24 of 24 tests.
- `TMPDIR=/tmp pnpm run docs:build` — pass.
- `TMPDIR=/tmp pnpm test` — baseline-sensitive parallel run: 94 of 95 files and 870 of 872 tests passed; the only failures were two established 5-second Journey Map routing timeouts, with no assertion mismatch.
- `TMPDIR=/tmp pnpm exec vitest run tests/journeyMapPreRouting.spec.ts tests/journeyMapRenderModel.spec.ts tests/journeyMapRouting.spec.ts --maxWorkers=1 --minWorkers=1` — pass, 3 of 3 files and 81 of 81 tests.
- Temporary generation from a copied bundle under `/tmp/sdd-stage4-corpus.iNiGEQ` — pass: exactly 12 `compact_detail` and 12 `detailed_detail` directories, 217 generated files, and README provenance naming the bundle-derived `simple` validation profile.
- Temporary compact/detailed PNG review — pass for all six views; low-noise/full content differences were preserved with no observed geometry, routing, clipping, or legibility regression.
- Manual helper discovery, bundle-resolved preview contract, explicit helper preview, automatic `sdd show` naming, and SVG-root inspection — pass; helper results carry both IDs, the default filename uses `.compact`, and SVG roots contain only detail identity.
- Manual fixed-detail profile comparison — `simple`/`detailed` and `strict`/`detailed` staged SVGs had the identical SHA-256 `0960502304fc22e2f3db742cb0406e8a8457e45022aade38188a76fe42670e69`; fixed `strict` with `compact` produced a distinct artifact.
- Required production searches — no `profile_display`, profile display resolver/type, `data-profile-id`, staged scene `profileId`, preview-path `profileId`, or helper preview without detail remains in active bundle/renderer/helper code.
- `git diff --check` — pass; complete implementation diff inspected and no snapshot, golden, or rendered-corpus path is modified.

Satisfied invariants:
- Profile stops at validation in combined orchestration; detail alone crosses the text/staged rendering boundary and selects display policy.
- One staged path and one legacy path were traced: staged projection requests carry only detail into renderer settings, while legacy preview receives already detail-shaped DOT before Graphviz invocation.
- With detail fixed, successful text and staged artifacts are exactly identical across validation profiles without production normalization or compatibility fallback.
- SVG, automatic filenames, helper materialization, helper matching, and corpus planning use render detail as artifact identity.
- Helper preview remains explicit, bundle-validated, and independent from global/project configuration; bundle-resolved detail values come from manifest declarations rather than hardcoded helper metadata.
- Combined library and preview results retain both effective IDs; helper JSON uses `profile_id` and `detail_id` consistently.
- Corpus planning enumerates render details once, is collision-free, and validates generation with the bundle fallback profile.

Violated invariants:
- none.

Residual risks:
- The recorded parallel-suite Journey Map timeout sensitivity remains; all affected tests pass with one worker.
- Stage 5 still owns evidence migration: committed renderer-stage goldens and SVG assets retain the old profile identity, committed corpus directories remain profile-based, test-only Stage 3 compatibility normalization/mapping remains, and active corpus/diagram documentation still links to the committed profile directories.

Snapshots/goldens/corpus:
- unchanged; temporary detail-based corpus generation occurred only under `/tmp`.

Subagents:
- none.

Next authorized stage:
- Stage 5.

### Stage 5 achievement report

Verdict: APPROVED

Implemented:
- Replaced the temporary Stage 4 renderer-golden identity normalizer with exact snapshot comparison and migrated focused scene/SVG evidence from profile identity to detail identity.
- Renamed the profile-keyed Journey Map badge goldens to `compact` and `detailed` evidence names without changing geometry, routing, content, diagnostics, or notes.
- Removed all committed-corpus compatibility path mapping and regenerated the repository corpus into bundle-declared `compact_detail` and `detailed_detail` directories.
- Migrated DOT, Mermaid, corpus completeness, and staged visual-acceptance consumers to the production detail paths.
- Added an explicit happy-path precedence matrix covering bundle, partial/global/project, and CLI profile/detail combinations while retaining the existing invalid-value and malformed-configuration cases across all consumers.
- Updated live corpus, CLI, helper-skill, diagram-type, development, and repository guidance to distinguish validation profile from render detail and to use detail-based artifact identity.
- Migrated the live SDD Skill and BillSage example SVG names and root metadata from profile identity to detail identity; preserved unrelated Service Blueprint documentation assets.

Changed subsystems:
- Focused renderer-stage goldens and their exact-comparison harness.
- Generated rendered corpus, generated README/provenance, corpus path tests, DOT/Mermaid goldens, and staged visual-acceptance paths.
- CLI precedence tests and synthetic staged test-scene identities.
- Current documentation, SDD Skill example evidence, BillSage-linked example evidence, `AGENTS.md`, and this execution record.

Verification:
- Baseline — branch `de-strict` at `0612c5b9ce1c32d2ac377f125ec771e593b2a29e`; clean worktree before Stage 5 and no commit created.
- Environment — Node `v22.17.0`, pnpm `10.31.0`, and Graphviz `2.43.0`.
- Pre-regeneration checks — Graphviz pass; existing committed-corpus, DOT, and Mermaid suites pass, 3 of 3 files and 19 of 19 tests; corpus deletion scope confirmed as exactly `examples/rendered/v0.1/`.
- Focused golden audit — 132 focused renderer-stage files inspected: 12 byte-identical and 120 differing only by the approved `profileId` -> `detailId`, SVG metadata, or badge-evidence filename mapping; zero unexplained mismatches.
- `TMPDIR=/tmp pnpm run generate:rendered-examples` — pass twice. Both generations produced 217 files, exactly 12 `compact_detail` and 12 `detailed_detail` directories, no profile directories, and the identical sorted aggregate SHA-256 `b477fbc262901bab26b83a9e4fca61641b08b3311e184a1378380bc5abc5838c`.
- Corpus equivalence audit — excluding the regenerated README, 162 files are byte-identical to the approved `simple`/`strict` mapping and 54 staged SVGs differ only by detail metadata; zero content mismatches. The README records the bundle-derived `simple` validation profile and both bundle render details.
- Visual corpus review — pass for compact and detailed PNGs from all six views. Compact preserves the low-noise presentation; detailed preserves the fuller annotations. No geometry, routing, clipping, overflow, or legibility regression was observed.
- Defaults, CLI, bundle, and independence suites — pass, 6 of 6 files and 108 of 108 tests. `cliDefaults` covers the eight happy-path matrix cases, invalid project values without fallthrough, malformed configuration isolation, all five profile consumers, and all four detail consumers.
- Helper and SDD Skill suites — pass, 7 of 7 files and 127 of 127 tests; helper preview remains explicit in both IDs and configuration-independent.
- Focused renderer, exact-golden, corpus, DOT, Mermaid, preview-path, and staged visual suites — pass, 10 of 10 files and 80 of 80 tests.
- Synthetic staged-scene identity rerun — pass, 3 of 3 files and 31 of 31 tests.
- `TMPDIR=/tmp pnpm run build` — pass.
- `TMPDIR=/tmp pnpm run docs:build` — pass.
- Final `TMPDIR=/tmp pnpm test` — baseline-sensitive parallel run: 93 of 95 files and 870 of 873 tests passed; the only failures were three established 5-second Journey Map timeouts with no assertion mismatch.
- Final one-worker rerun of the affected Journey Map files — pass, 2 of 2 files and 71 of 71 tests.
- CLI help audit — `sdd`, `sdd show`, and `sdd defaults` describe independent project/global/bundle omission, profile override, detail override, detail-based automatic names, and defaults management; no strict default is advertised.
- Required drift searches — no active hardcoded strict runtime fallback, bundle `profile_display`, profile display resolver, staged profile metadata, or profile-based automatic filename remains. Guided Addition's separate display-profile fields remain present and no `src/authoring/` implementation file changed.
- `git diff --check` — pass; the complete diff was inspected by subsystem.

Satisfied invariants:
- Shipped omitted human-CLI values are independently resolved as bundle `simple` validation plus `compact` rendering when no higher-precedence preference is present.
- CLI, project, global, and bundle sources remain independent for both settings; invalid selected values fail without fallthrough.
- All five profile-consuming commands share profile resolution and all four render commands share detail resolution.
- Public library omission remains bundle-only and helper preview remains explicit and persistent-configuration-free.
- Profile controls validation only; detail exclusively controls renderer display policy, scene/SVG identity, automatic paths, helper artifact identity, and corpus organization.
- Committed compact evidence matches retained simple behavior and committed detailed evidence matches retained strict/permissive behavior with no unexplained renderer change.
- The corpus is collision-free, deterministic, provenance-labeled, and contains the expected staged and legacy backends.
- Live documentation and help match runtime behavior, while historical `docs/Done/` material and unrelated Service Blueprint assets remain untouched.
- Parser, compiler, raw projection, validation rules, Guided Addition behavior, layout, and routing have no unexplained change.

Violated invariants:
- none.

Residual risks:
- Parallel Journey Map suites remain sensitive to the repository's 5-second per-test timeout under full-suite load; every affected assertion passes with one worker.

Snapshots/goldens/corpus:
- Focused renderer goldens and the committed rendered corpus were intentionally migrated under the Stage 5 evidence contract. No unrelated snapshot, golden, or corpus artifact changed.

Subagents:
- none.

Next authorized stage:
- none; the user-settable defaults and independent render-detail implementation plan is complete.
