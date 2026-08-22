# Changing the SDD CLI Default Profile from `strict` to `simple`

Date: 2026-08-16

## Executive summary

Changing the default from `strict` to `simple` is mechanically small but behaviorally broad.

The current human-facing `sdd` CLI hardcodes `strict` as the default for five commands in [`src/cli/program.ts`](../../src/cli/program.ts):

- `sdd validate`
- `sdd show`
- the hidden/internal `sdd render`
- the hidden/internal `sdd dot`
- the hidden/internal `sdd mmd`

The exported text-rendering API also independently falls back to `strict` in two places in [`src/renderer/renderView.ts`](../../src/renderer/renderView.ts). A literal-only implementation could therefore appear to be seven replacements plus help text. That would leave the default as a hidden code convention, however, and would not satisfy this repository's bundle-authority policy.

The behavioral blast radius has two distinct parts:

1. **Validation becomes substantially less demanding.** `simple` retains compile errors, referential integrity, endpoint compatibility, and selected structural rules, but omits several strict governance checks entirely. It does not merely turn every strict error into a warning.
2. **Rendered diagrams become less detailed.** The same profile controls validation and display density. Every supported view has a `simple` display policy that suppresses some information.

The change fits the guided-human-authoring goal and aligns the normal CLI with the existing Guided Addition display default, which is already bundle-owned and set to `simple`. It also makes omitted-profile commands unsuitable as production-governance gates unless callers explicitly add `--profile strict`.

The recommended implementation is to add a separate, general CLI/tool default to the bundle, resolve it after loading the selected bundle, and use it consistently from the CLI and the optional-profile library API. The Guided Addition default must remain a separate setting because it is scoped to browsing and form guidance, not general validation and rendering.

## Authority and non-negotiable invariants

The investigation used these repository rules as acceptance constraints:

1. Files under [`bundle/v0.1/`](../../bundle/v0.1/) govern machine behavior. Markdown explains and code executes the loaded bundle.
2. A profile-default convention that affects validation and rendering belongs in the bundle. It must not exist only as a TypeScript or Commander literal.
3. A complete implementation needs an identifiable bundle field, a generic runtime consumer, and bundle-mutation tests proving that changing bundle data changes behavior.
4. Projection remains the semantic boundary. A default-profile change must not push display concerns into parsing, compilation, validation-independent projection, or source semantics.
5. Goldens are downstream evidence. They should not be refreshed merely to normalize an unintended default-output change.

These constraints make a seven-literal replacement an incomplete implementation even though it would change the shipped CLI.

## Current default ownership

There is no single general profile default today.

| Surface | Current behavior | Where it comes from |
| --- | --- | --- |
| `sdd validate` | Defaults to `strict` | Commander option literal in `src/cli/program.ts` |
| `sdd show` | Defaults to `strict` | Commander option literal in `src/cli/program.ts` |
| Hidden `render`, `dot`, and `mmd` commands | Default to `strict` | Three more Commander option literals in `src/cli/program.ts` |
| Exported `renderSource(...)` | Uses `strict` when `RenderOptions.profileId` is absent | Two `?? "strict"` fallbacks in `src/renderer/renderView.ts` |
| `renderSourcePreview(...)` | Has no default; `profileId` is required | `SourcePreviewRenderOptions` in `src/renderer/previewWorkflow.ts` |
| `validateGraph(...)` | Has no default; profile is required | `src/validator/validateGraph.ts` |
| `sdd-helper validate` and `preview` | Require `--profile` | `src/cli/helperProgram.ts` and helper discovery contracts |
| Guided Addition through `sdd add` | Uses `simple` as its display/guidance profile | `guided_addition.default_display_profile_id` in `bundle/v0.1/core/authoring.yaml` |
| Corpus generation and renderer goldens | Pass every profile explicitly | `src/examples/renderedCorpus.ts`, generator code, and focused tests |

Important consequences:

- `sdd compile`, raw parsing, compilation, and public projection do not consume a profile and are unaffected.
- `sdd add` is already based on `simple` guidance. Changing the normal CLI default would align the user experience but would not change Guided Addition itself.
- `sdd-helper` is not affected by a normal `sdd` CLI default change because its validation and preview commands deliberately require a profile. Mutation requests also carry an explicit or optional `validate_profile` according to their own contracts.
- The first entry in `manifest.profiles` happens to be `simple`, but profile order is not an authorized defaulting mechanism.

## Validation blast radius

The normative validation differences come from [`bundle/v0.1/profiles/simple.yaml`](../../bundle/v0.1/profiles/simple.yaml), [`bundle/v0.1/profiles/strict.yaml`](../../bundle/v0.1/profiles/strict.yaml), and per-profile severities in [`bundle/v0.1/core/contracts.yaml`](../../bundle/v0.1/core/contracts.yaml). The generic runtime consumer is [`validateGraph(...)`](../../src/validator/validateGraph.ts); the findings below are not inferred from examples or renderer snapshots.

### What remains strict under `simple`

`simple` is still structurally meaningful. The following remain errors:

- parse and compile failures;
- unresolved edge endpoints through referential integrity;
- directed-edge behavior and no implicit inverse materialization;
- illegal relationship endpoint pairs;
- a missing required `field` property on `BINDS_TO`;
- any other core/profile rule explicitly assigned `error` for `simple`.

Common duplicate-edge, annotation-scope, and similar advisory rules remain warnings where the core contract assigns warnings.

### What becomes weaker or disappears

The differences are more substantial than an error-to-warning conversion.

| Rule area | `strict` | `simple` |
| --- | --- | --- |
| Required properties for all node types | Error | Rule absent; no diagnostic |
| Node ID prefix/type coupling | Error | Rule absent; no diagnostic |
| ViewState `place_id`/`CONTAINS` parentage | Error | Rule absent; no diagnostic |
| Outcome must have `MEASURED_BY` | Error | Rule absent; no diagnostic |
| Initiative must have `ADDRESSES` | Error | Rule absent; no diagnostic |
| Step must have `REALIZED_BY` | Error | Rule absent; no diagnostic |
| Transition event annotation must reference an Event ID | Error | Rule absent; no diagnostic |
| Branching Step should be marked `kind=decision` | Warning | Rule absent; no diagnostic |
| `CONTAINS` and `COMPOSED_OF` cycles | Error | Warning |
| Step opportunity references | Error | Warning |
| Process visibility, Place formats, `primary_nav`, Step kind, and State scope | Error | Warning |
| Process visibility aliases | Canonical values only | `customer-visible` and `not-visible` aliases accepted |

This is a key product distinction among the profiles:

- `simple` is intentionally low-noise and omits several completeness/governance checks.
- `permissive` is closer to "report completeness issues but do not block," because it includes most strict governance rules as warnings.
- `strict` is the production-governance gate.

If the desired outcome is only to stop draft validation from failing while continuing to show authors all completeness gaps, `permissive` is behaviorally closer than `simple`. Selecting `simple` specifically chooses less feedback as well as fewer failures.

### Observed repository behavior

A read-only validation matrix produced these results:

- All eight manifest examples compile and validate with zero errors under both `simple` and `strict`.
- `real_world_exploration/billSage_example/billSage_structure.sdd` also validates cleanly under both.
- `real_world_exploration/billSage_example/billSage_simple_structure.sdd` has **0 errors and 0 warnings under `simple`**, but **102 errors under `strict`**, all from `validate.required_props_by_type`.

Under the proposed default, therefore, the last document changes from exit code 1 with a large diagnostic report to exit code 0 with no diagnostics when the caller omits `--profile`.

The same gating change applies to `show`, `render`, `dot`, and `mmd`: documents that strict validation currently prevents from rendering may begin producing artifacts under the default invocation.

## Rendering blast radius

Profiles are validation and display overlays in the current architecture. [`bundle/v0.1/core/views.yaml`](../../bundle/v0.1/core/views.yaml) defines profile-specific renderer display policy, and renderers consume it through [`src/renderer/profileDisplay.ts`](../../src/renderer/profileDisplay.ts).

The raw public projection remains profile-agnostic. Profile-dependent display enters in renderer preparation and render-model construction. `ui_contracts` additionally performs renderer-owned projection shaping in [`src/renderer/prepareProjectionForRender.ts`](../../src/renderer/prepareProjectionForRender.ts). This boundary should remain unchanged.

### View-by-view differences

| View | Default-output change when moving to `simple` |
| --- | --- |
| `ia_place_map` | Hides Place `route_or_key`, access, and entry points. Primary-navigation annotation remains visible. |
| `journey_map` | Hides resolved Opportunity reference badges on Steps. A document without such references can render identically. |
| `outcome_opportunity_map` | Hides instrumentation annotations on Metrics and implementation annotations on Initiatives. |
| `service_blueprint` | Keeps the relevant connectors but hides secondary edge labels, including realization, dependency, policy, read, and write labels. |
| `scenario_flow` | Hides decision-branch labels derived from edge `guard`, `event`, or `to_name`; connectors remain. |
| `ui_contracts` | Hides Place route/access/entry-point detail and ViewState `data_required`; can suppress secondary State groups and the supporting-contract lane when ViewState is primary; omits empty Place containers. |

The bundle's Guided Addition relationship classifications reflect the same intended differences: strict can expose annotations or labels that simple classifies as hidden, and simple conditionally hides supporting UI-contract relationships in ViewState-focused documents.

These policies affect staged SVG/PNG and the preserved text/legacy paths that consume the same profile display policy. The blast radius is not limited to one renderer backend.

### Observed artifact differences

In-memory SVG proof renders were generated with both explicit profiles from existing valid examples. The figures below are evidence of changed content/layout, not visual acceptance targets.

| View and proof example | `simple` SVG | `strict` SVG | Observation |
| --- | ---: | ---: | --- |
| `ia_place_map` / `outcome_to_ia_trace` | 296 × 248 | 296 × 340 | Metadata suppression reduces height. |
| `journey_map` / `outcome_to_ia_trace` | 576 × 192 | 576 × 214 | Opportunity badges increase strict height. |
| `outcome_opportunity_map` / `outcome_to_ia_trace` | 1378.524 × 152 | 1378.524 × 188 | Strict annotations increase height. |
| `service_blueprint` / `service_blueprint_slice` | 1224 × 704 | 1224 × 704 | Dimensions match, but serialized content differs because labels differ. |
| `scenario_flow` / `scenario_branching` | 1232 × 712 | 1472 × 712 | Branch labels affect horizontal layout. |
| `ui_contracts` / `place_viewstate_transition` | 826.424 × 288 | 1436.848 × 620 | Simple omission significantly reduces the scene and reports an omitted empty container. |

The `branching_journey` example produced identical simple/strict SVGs because it does not exercise the badge policy. That confirms that the effect is content-dependent rather than a blanket styling rewrite.

## Command-level operational effects

| Command | Effect of omitting `--profile` after the change |
| --- | --- |
| `sdd validate` | Different diagnostics and potentially different exit code. Strict-only governance failures no longer block or necessarily appear. |
| `sdd show` | Different validation gate, different SVG/PNG content, different notes, and a different automatic sibling filename. |
| `sdd render` | Different validation gate and DOT/Mermaid content written to stdout or `--out`. |
| `sdd dot` | Same as `render` for IA DOT. With `--png`, the existing `<source>.png` naming does not encode profile, so simple output can overwrite a previous strict PNG at the same path. |
| `sdd mmd` | Different validation gate and Mermaid content. |
| `sdd compile` | No effect. |
| `sdd add` | No default change; its bundle-owned Guided Addition display profile is already `simple`. |

### Artifact names and stale outputs

`sdd show` builds an omitted-`--out` path containing the resolved profile:

```text
<source>.<view>.<profile>[.<backend>].<format>
```

The default path therefore changes from, for example:

```text
outcome_to_ia_trace.ia_place_map.strict.svg
```

to:

```text
outcome_to_ia_trace.ia_place_map.simple.svg
```

This avoids overwriting the old strict sibling, but it can leave both files present. Users and documentation may continue linking the stale strict artifact unless the migration is explicit. When `--out` is supplied, the path does not change and the same destination will receive less-detailed simple output.

Profile IDs also appear in SVG classes/data attributes, diagnostics, helper preview metadata, validation URIs, and profile-keyed caches or artifact matching. Normal CLI output will carry `simple` in those places after the change.

## Code and API scope

### Minimal literal-only scope

A non-compliant minimal patch would touch:

- five Commander defaults and the manual top-level help label in `src/cli/program.ts`;
- two `?? "strict"` fallbacks in `src/renderer/renderView.ts`;
- CLI tests and current documentation.

That patch would work for the shipped bundle but would keep a machine-behavior convention hidden in code. It could also leave alternate bundles unable to select their own default.

### Bundle-compliant scope

The preferred scope is:

1. Add a general tool default next to the profile declarations in [`bundle/v0.1/manifest.yaml`](../../bundle/v0.1/manifest.yaml), for example an explicitly named `defaults.profile_id: simple` field. The exact field name should be settled as a bundle-contract decision.
2. Extend `BundleManifest` in [`src/bundle/types.ts`](../../src/bundle/types.ts).
3. Validate that the default is present, non-empty, and names a declared/loaded profile in [`src/bundle/loadBundle.ts`](../../src/bundle/loadBundle.ts) and/or [`src/bundle/validateLoadedBundle.ts`](../../src/bundle/validateLoadedBundle.ts).
4. Add a small generic accessor for the loaded bundle's default profile.
5. Remove Commander value defaults. Resolve the profile after `--bundle` has selected and loaded the bundle in each profile-consuming command path in [`src/cli/program.ts`](../../src/cli/program.ts).
6. Make omitted `RenderOptions.profileId` resolve through the same bundle accessor in [`src/renderer/renderView.ts`](../../src/renderer/renderView.ts), or make `profileId` required and treat that as an intentional breaking API change. Keeping it optional and bundle-derived is the smaller compatibility change.
7. Keep `renderSourcePreview`, `validateGraph`, and helper commands explicit unless a separate contract decision broadens their scope.

The runtime entrypoint is `loadBundle(...)`; command execution and `renderSource(...)` should consume the loaded default. Changing only the new manifest field in a test bundle must change runtime behavior.

The existing `guided_addition.default_display_profile_id` should **not** be reused as the general default. It is intentionally scoped to Guided Addition filtering, field presentation, and proposal verification. Coupling normal validation to that UI-specific field would make future authoring-display changes silently alter CLI governance.

### Help behavior with alternate bundles

Commander currently displays a static default before a bundle is loaded. Once the default is bundle-owned, command help should describe `--profile` as using the selected bundle's default rather than presenting a hardcoded value. The top-level help may still state that the shipped v0.1 bundle defaults to `simple`, but it should not imply that every alternate bundle does.

## Tests, goldens, and documentation

### Tests that must change

[`tests/cli.spec.ts`](../../tests/cli.spec.ts) currently locks several strict-derived paths and the manual `strict governance (default)` help text. It also has a test named "different profiles" whose first invocation relies on the strict default and whose second invocation explicitly selects simple. After the change those two calls would both be simple unless the strict case becomes explicit.

At minimum, tests should cover:

- omitted-profile `validate` resolves to the bundle default;
- explicit `--profile strict` remains strict;
- omitted-profile `show` passes `simple` to the preview workflow and derives a `.simple.svg`/`.simple.png` path;
- explicit strict and simple still derive distinct sibling paths;
- hidden `render`, `dot`, and `mmd` pass the resolved default rather than relying on downstream fallback;
- `renderSource(...)` without `profileId` uses the bundle default for both validation and display;
- mutating only the bundle default to `strict` changes all omitted-profile behavior;
- an unknown bundle default is rejected during bundle loading;
- a strict-invalid/simple-valid draft changes CLI exit behavior exactly as intended.

There is currently a coverage gap: many CLI tests omit the profile but only assert view/format/backend fields, so they would not prove which profile reached the runtime.

### Goldens and generated corpus

The committed rendered corpus expands every manifest example across every manifest profile and passes `variant.profileId` explicitly. DOT, Mermaid, SVG, and PNG generation are therefore profile-explicit. Most staged renderer snapshots are also intentionally profile-explicit.

Consequently, the default change should **not** require a broad corpus or renderer-golden refresh. If such a refresh appears necessary, it is evidence that an implicit default remains in a supposedly profile-explicit path and should be investigated rather than normalized.

CLI path/help assertions are expected to change. Any existing documentation-site artifact generated from an omitted-profile command needs individual review because its intended profile may be strict even when the command did not say so.

### Documentation audit

Current non-historical documentation contains explicit statements that the CLI or service-blueprint example uses the default `strict` profile in:

- [`docs/doc_site/sdd_cli_tools/index.md`](../doc_site/sdd_cli_tools/index.md);
- [`docs/doc_site/service_blueprint_slice_example/index.md`](../doc_site/service_blueprint_slice_example/index.md);
- the adjacent `index_bup.md` backup.

[`docs/toolchain/development.md`](../toolchain/development.md) labels an omitted-profile validation command as using "the default profile" and contains many profile-omitting render commands. Those examples will begin exercising simple output and should either be relabeled or made explicitly strict when their purpose is full-detail regression/development verification.

A broad scan excluding `docs/Done` and experiment logs found 48 documentation lines invoking a profile-consuming `sdd` command, 18 with an explicit `--profile`, and 30 without one. Some of the 30 are placeholders or architectural prose rather than runnable recipes, so they require review rather than mechanical rewriting. The highest concentrations are in `docs/toolchain/development.md` and the CLI documentation.

The SDD skill's durable-render recipes already carry an explicit `<profile_id>` selected to match the assessment/preview gate. Its semantics should remain explicit; the new CLI fallback should not replace that workflow discipline.

No active checked-in `.github` or `scripts` automation was found invoking these profile-consuming commands without an explicit profile. External CI, shell aliases, user scripts, and downstream consumers remain unknowable from this repository and are the main compatibility risk.

## Risk assessment

| Risk | Severity | Reason |
| --- | --- | --- |
| Production checks silently become weaker | High | Omitted-profile validation may stop reporting required metadata, prefix, parentage, and relationship-completeness failures. |
| Default diagrams lose operational detail | High for audit/reference use; beneficial for drafts | All six views have simple-specific suppression. |
| CLI and exported API drift | Medium | Changing Commander defaults without the `renderSource` fallback would produce inconsistent omitted-profile behavior. |
| Alternate bundle incompatibility | Medium | A TypeScript literal assumes that `simple` exists and prevents bundles from choosing their own default. |
| Stale or relinked artifacts | Medium | `show` creates `.simple.*` siblings while old `.strict.*` files remain; explicit output paths are overwritten with different content. |
| Snapshot churn hides a mistake | Medium | The profile-explicit corpus should not change. Broad churn would signal an implicit-default leak. |
| Guided Addition regression | Low | It already uses a separate bundle-owned simple display default. |
| Parser/compiler/projection regression | Low | These surfaces are profile-independent and should remain untouched. |

## Recommended rollout

### 1. Define the contract first

Add and validate the general bundle-owned default. Prove with a mutated bundle that runtime behavior changes from bundle data alone.

### 2. Align every normal omitted-profile consumer

Use the new accessor in all five `sdd` command paths and in the optional-profile text-rendering API. Keep helper and lower-level validation/preview APIs explicit.

### 3. Make strict governance explicit

Update CI/release/audit recipes and development checks to say `--profile strict`. The help page should present a clear maturity path:

```text
draft/exploration: simple
warning-first completeness review: permissive
production governance: strict
```

### 4. Update documentation and artifact expectations

Change current default wording, update automatic filename examples, review every omitted-profile recipe for intent, and intentionally regenerate only current documentation artifacts whose chosen profile changes.

### 5. Run focused and full verification

The proof order should be:

1. bundle validation and bundle-mutation tests;
2. CLI default-propagation and exit-code tests;
3. explicit strict regression cases;
4. library default tests;
5. existing profile-display and preview workflow suites;
6. full tests;
7. rendered-corpus verification with no unplanned changes.

## Recommendation

Proceeding with `simple` as the normal CLI default is reasonable for guided human authoring, but it should be treated as a product-policy change rather than a convenience tweak.

The strongest benefits are a much smoother first-run experience, successful rendering of intentionally incomplete drafts, and alignment with documentation that already recommends `simple` and Guided Addition that already displays `simple` guidance.

The principal cost is that omitted-profile commands no longer communicate or enforce production completeness. The BillSage proof case demonstrates the scale: 102 strict errors become no simple diagnostics. That behavior is consistent with the current bundle, but users must understand it.

The change should therefore land only with:

- a distinct bundle-owned general default;
- explicit `--profile strict` guidance for production gates;
- CLI and library consistency;
- default-path and profile-propagation tests;
- documentation migration; and
- no broad golden refresh.

Longer term, validation posture and render density should probably become separate named choices. The current single profile makes it impossible to request strict governance with a compact diagram, or simple validation with full visual detail. That architectural issue is not required to change the default, but this proposal makes its consequences more visible.
